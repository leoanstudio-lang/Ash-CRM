
import React, { useState, useEffect } from 'react';
import { Project, Employee, Client, Service, Priority, Package, PackageLineItem, PaymentMilestone, PaymentAlert } from '../types';
import { Plus, User, Clock, CheckCircle, Search, Calendar, DollarSign, Filter, ChevronDown, Wallet, Package as PackageIcon, Users, Trash2, Eye, BarChart3, Edit3, ChevronLeft, ChevronRight, AlertTriangle, Layers, Download, X, Link as LinkIcon } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { addProjectToDB, addPackageToDB, updatePackageInDB, deletePackageFromDB, addPaymentAlertToDB, getCompanyProfile } from '../lib/db';

type GraphicsTab = 'tasks' | 'packages' | 'clients';

interface GraphicsDesigningProps {
  employees: Employee[];
  projects: Project[];
  setProjects?: React.Dispatch<React.SetStateAction<Project[]>>; // Optional/Deprecated
  clients: Client[];
  services: Service[];
  packages: Package[];
  paymentAlerts: PaymentAlert[];
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const GraphicsDesigning: React.FC<GraphicsDesigningProps> = ({ employees, projects, clients, services, packages = [], paymentAlerts = [] }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeGraphicsTab, setActiveGraphicsTab] = useState<GraphicsTab>('tasks');
  const [selectedMonth, setSelectedMonth] = useState<number | 'all' | 'custom' | 'specific'>(() => {
    const saved = localStorage.getItem('graphics_filter_month');
    if (saved === 'all') return 'all';
    if (saved === 'custom') return 'custom';
    if (saved === 'specific') return 'specific';
    return saved !== null ? parseInt(saved) : new Date().getMonth();
  });
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [specificDate, setSpecificDate] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // --- Task Filter State ---
  const [taskSearch, setTaskSearch] = useState('');
  const [filterService, setFilterService] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [newTask, setNewTask] = useState<Partial<Project & { packageId?: string; packageLineItemIndex?: number }>>({
    clientId: '',
    serviceId: '',
    priority: 'Medium',
    startDate: '',
    deadline: '',
    description: '',
    assignedEmployeeId: '',
    totalAmount: 0,
    advance: 0
  });

  // --- PDF Download Link Interceptor State ---
  const [pdfDownloadPkg, setPdfDownloadPkg] = useState<Package | null>(null);
  const [pdfLinkTitle, setPdfLinkTitle] = useState('');
  const [pdfLinkUrl, setPdfLinkUrl] = useState('');

  // --- Package State ---
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedClientForHistory, setSelectedClientForHistory] = useState<string>('');
  const [newPackage, setNewPackage] = useState({
    clientId: '',
    packageName: '',
    period: '',
    totalAmount: 0,
    lineItems: [{ serviceName: '', quantity: 1, completedCount: 0 }] as PackageLineItem[],
    milestones: [{ label: 'Advance', percentage: 25, triggerAtQuantity: 0, isAdvance: true }] as { label: string; percentage: number; triggerAtQuantity: number; isAdvance: boolean }[]
  });

  // --- Edit Package State ---
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [editPackageForm, setEditPackageForm] = useState<{
    packageName: string;
    period: string;
    totalAmount: number;
    lineItems: PackageLineItem[];
    milestones: { label: string; percentage: number; triggerAtQuantity: number; isAdvance: boolean }[];
  }>({
    packageName: '', period: '', totalAmount: 0,
    lineItems: [{ serviceName: '', quantity: 1, completedCount: 0 }],
    milestones: []
  });

  // --- Bulk Entry Multi-Item Queue State ---
  interface BulkLineItemConfig {
    lineItemIndex: number;
    serviceName: string;
    quantity: number;
    method: 'dateRange' | 'specificDays';
    assignedEmployeeId: string;
    priority: string;
    description: string;
    startDate: string;
    endDate: string;
    holidays: string[];
    selectedDates: string[];
  }

  // The queue of confirmed items ready to be created
  const [bulkQueue, setBulkQueue] = useState<BulkLineItemConfig[]>([]);
  // Which line item index is currently being configured (-1 = none)
  const [bulkConfigLineIdx, setBulkConfigLineIdx] = useState<number | null>(null);
  // Ephemeral config state for the item being currently set up
  const [bulkItemConfig, setBulkItemConfig] = useState<Partial<BulkLineItemConfig>>({
    method: 'dateRange',
    priority: 'Medium',
    holidays: [],
    selectedDates: [],
    startDate: '',
    endDate: '',
    description: '',
    assignedEmployeeId: '',
  });
  const [bulkHolidayInput, setBulkHolidayInput] = useState('');
  const [bulkCalendarMonth, setBulkCalendarMonth] = useState<Date>(() => new Date());
  const [bulkDecimalWarning, setBulkDecimalWarning] = useState<string>('');
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

  const addLineItem = () => {
    setNewPackage(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, { serviceName: '', quantity: 1, completedCount: 0 }]
    }));
  };

  const removeLineItem = (index: number) => {
    setNewPackage(prev => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, i) => i !== index)
    }));
  };

  const updateLineItem = (index: number, field: keyof PackageLineItem, value: any) => {
    setNewPackage(prev => ({
      ...prev,
      lineItems: prev.lineItems.map((item, i) => i === index ? { ...item, [field]: value } : item)
    }));
  };

  const addMilestone = () => {
    setNewPackage(prev => ({
      ...prev,
      milestones: [...prev.milestones, { label: '', percentage: 0, triggerAtQuantity: 0, isAdvance: false }]
    }));
  };

  const removeMilestone = (index: number) => {
    setNewPackage(prev => ({
      ...prev,
      milestones: prev.milestones.filter((_, i) => i !== index)
    }));
  };

  const updateMilestone = (index: number, field: string, value: any) => {
    setNewPackage(prev => ({
      ...prev,
      milestones: prev.milestones.map((m, i) => i === index ? { ...m, [field]: value } : m)
    }));
  };

  const handleCreatePackage = async (e: any) => {
    e.preventDefault?.();
    if (!newPackage.clientId || !newPackage.packageName) {
      alert('Please select a client and enter a package name.');
      return;
    }

    const client = clients.find(c => c.id === newPackage.clientId);
    const totalAmount = newPackage.totalAmount;

    // Build milestones — advance milestones auto-marked as received
    const paymentMilestones: PaymentMilestone[] = newPackage.milestones.map(m => {
      const milestone: PaymentMilestone = {
        label: m.label,
        percentage: m.percentage,
        triggerAtQuantity: m.triggerAtQuantity,
        status: m.isAdvance ? 'received' : 'upcoming',
        amountDue: Math.round((m.percentage / 100) * totalAmount)
      };
      if (m.isAdvance) {
        milestone.paidDate = new Date().toISOString();
      }
      return milestone;
    });

    // Calculate advance received amount
    const advanceReceived = paymentMilestones
      .filter((_, i) => newPackage.milestones[i].isAdvance)
      .reduce((sum, m) => sum + m.amountDue, 0);

    const packageData: Omit<Package, 'id'> = {
      clientId: newPackage.clientId,
      clientName: client?.name || '',
      packageName: newPackage.packageName,
      period: newPackage.period,
      lineItems: newPackage.lineItems.filter(li => li.serviceName.trim() !== ''),
      totalAmount: totalAmount,
      receivedAmount: advanceReceived,
      paymentMilestones: paymentMilestones,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    try {
      const newPackageId = await addPackageToDB(packageData);

      // Create payment alerts for advance milestones (auto-received)
      for (let i = 0; i < newPackage.milestones.length; i++) {
        const m = newPackage.milestones[i];
        const pm = paymentMilestones[i];
        if (m.isAdvance) {
          await addPaymentAlertToDB({
            clientId: newPackage.clientId,
            clientName: client?.name || '',
            packageId: newPackageId,
            packageName: newPackage.packageName,
            milestoneLabel: pm.label,
            amount: pm.amountDue,
            status: 'received',
            triggeredAt: new Date().toISOString(),
            resolvedAt: new Date().toISOString(),
            type: 'package'
          });
        } else if (m.triggerAtQuantity === 0) {
          // Non-advance but triggers at start = due immediately
          await addPaymentAlertToDB({
            clientId: newPackage.clientId,
            clientName: client?.name || '',
            packageId: newPackageId,
            packageName: newPackage.packageName,
            milestoneLabel: pm.label,
            amount: pm.amountDue,
            status: 'due',
            triggeredAt: new Date().toISOString(),
            type: 'package'
          });
        }
      }

      setShowPackageModal(false);
      setNewPackage({
        clientId: '',
        packageName: '',
        period: '',
        totalAmount: 0,
        lineItems: [{ serviceName: '', quantity: 1, completedCount: 0 }],
        milestones: [{ label: 'Advance', percentage: 25, triggerAtQuantity: 0, isAdvance: true }]
      });
    } catch (error) {
      console.error('Error creating package:', error);
      alert('Failed to create package. Check console for details.');
    }
  };

  const openEditPackage = (pkg: Package) => {
    setEditingPackage(pkg);
    setEditPackageForm({
      packageName: pkg.packageName,
      period: pkg.period,
      totalAmount: pkg.totalAmount,
      lineItems: pkg.lineItems.map(li => ({ ...li })),
      milestones: pkg.paymentMilestones.map(m => ({
        label: m.label,
        percentage: m.percentage,
        triggerAtQuantity: m.triggerAtQuantity ?? 0,
        isAdvance: m.status === 'received'
      }))
    });
  };

  const handleUpdatePackage = async (e: any) => {
    e.preventDefault?.();
    if (!editingPackage) return;
    const totalAmount = editPackageForm.totalAmount;

    // Rebuild milestones — preserve existing status, recalculate amountDue with new total
    const updatedMilestones = editPackageForm.milestones.map((m, i) => {
      const existing = editingPackage.paymentMilestones[i];
      return {
        label: m.label,
        percentage: m.percentage,
        triggerAtQuantity: m.triggerAtQuantity,
        status: existing?.status ?? (m.isAdvance ? 'received' : 'upcoming'),
        amountDue: Math.round((m.percentage / 100) * totalAmount),
        ...(existing?.paidDate ? { paidDate: existing.paidDate } : {})
      };
    });

    // Recalc received amount from preserved milestones
    const recalcReceived = updatedMilestones
      .filter(m => m.status === 'received')
      .reduce((sum, m) => sum + m.amountDue, 0);

    try {
      await updatePackageInDB(editingPackage.id, {
        packageName: editPackageForm.packageName,
        period: editPackageForm.period,
        totalAmount,
        lineItems: editPackageForm.lineItems.filter(li => li.serviceName.trim() !== ''),
        paymentMilestones: updatedMilestones,
        receivedAmount: recalcReceived
      } as any);
      setEditingPackage(null);
    } catch (error) {
      console.error('Error updating package:', error);
    }
  };

  // Helper: dynamically count completed tasks for a package line item
  const getLineItemDone = (pkgId: string, lineItemIndex: number) => {
    return projects.filter(p =>
      p.packageId === pkgId &&
      p.packageLineItemIndex === lineItemIndex &&
      (p.status === 'Finished' || p.status === 'Completed' || p.status === 'Closed')
    ).length;
  };

  // Helper: get total done for a package (all line items)
  const getPackageTotalDone = (pkg: Package) => {
    return pkg.lineItems.reduce((s, _li, idx) => s + getLineItemDone(pkg.id, idx), 0);
  };

  // Helper: get package completion percentage
  const getPackageProgress = (pkg: Package) => {
    const totalQty = pkg.lineItems.reduce((s, li) => s + li.quantity, 0);
    const totalDone = getPackageTotalDone(pkg);
    return totalQty === 0 ? 0 : Math.round((totalDone / totalQty) * 100);
  };

  // PDF Export Function
  const generatePackagePDF = async (pkg: Package, workLinkTitle?: string, workLinkUrl?: string) => {
    const client = clients.find(c => c.id === pkg.clientId);
    const clientName = client?.companyName || client?.name || pkg.clientName || 'Unknown';
    const filename = `Package Report - ${clientName} - ${pkg.packageName} - ${pkg.period}.pdf`.replace(/[/\\?%*:|"<>]/g, '-');

    // Fetch live company branding for the footer
    const companyConfig = await getCompanyProfile();

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Header styling
    doc.setFillColor(10, 0, 40); // Deep Eclipse (#0A0028)
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('PACKAGE REPORT', 14, 25);

    // Status Badge
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    if (pkg.status === 'active') {
      doc.setTextColor(108, 46, 247); // Royal Purple (#6C2EF7)
    } else {
      doc.setTextColor(148, 163, 184); // slate-400
    }
    doc.text(pkg.status === 'active' ? 'ACTIVE' : 'COMPLETED', pageWidth - 14, 25, { align: 'right' });
    doc.setFont(undefined, 'normal');

    // Client & Package Details
    doc.setTextColor(10, 0, 40); // Deep Eclipse
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Overview', 14, 55);
    doc.setFont(undefined, 'normal');

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105); // slate-500
    doc.text(`Client Name:`, 14, 65);
    doc.text(`Package:`, 14, 72);
    doc.text(`Start Date:`, 14, 79);
    doc.text(`Period:`, 14, 86);

    doc.setTextColor(10, 0, 40); // Deep Eclipse
    doc.setFont(undefined, 'bold');
    doc.text(`${clientName}`, 45, 65);
    doc.text(`${pkg.packageName}`, 45, 72);

    // Format package creation date
    const pkgDate = pkg.createdAt ? new Date(pkg.createdAt) : new Date();
    const shortMonth = pkgDate.toLocaleString('default', { month: 'short' });
    const formattedPkgDate = isNaN(pkgDate.getTime())
      ? pkg.createdAt
      : `${pkgDate.toLocaleDateString('en-GB')} (${shortMonth})`;
    doc.text(`${formattedPkgDate}`, 45, 79);
    doc.text(`${pkg.period}`, 45, 86);
    doc.setFont(undefined, 'normal');

    // Financials
    doc.setTextColor(71, 85, 105);
    doc.text(`Total Amount:`, pageWidth / 2, 65);
    doc.text(`Received:`, pageWidth / 2, 72);
    doc.text(`Balance:`, pageWidth / 2, 79);
    doc.text(`Progress:`, pageWidth / 2, 86);

    const balanceAmount = pkg.totalAmount - pkg.receivedAmount;

    doc.setTextColor(10, 0, 40); // Deep Eclipse
    doc.setFont(undefined, 'bold');
    doc.text(`Rs. ${pkg.totalAmount.toLocaleString()}`, pageWidth / 2 + 30, 65);
    doc.setTextColor(5, 150, 105); // emerald-600
    doc.text(`Rs. ${pkg.receivedAmount.toLocaleString()}`, pageWidth / 2 + 30, 72);
    doc.setTextColor(225, 29, 72); // rose-600
    doc.text(`Rs. ${balanceAmount.toLocaleString()}`, pageWidth / 2 + 30, 79);
    doc.setTextColor(108, 46, 247); // Royal Purple (#6C2EF7)
    doc.text(`${getPackageProgress(pkg)}%`, pageWidth / 2 + 30, 86);
    doc.setFont(undefined, 'normal');

    let nextY = 102;

    // Optional: Dynamic Work Link Injection
    if (workLinkUrl) {
      // Draw a subtle highlighted box for the work link
      doc.setFillColor(243, 238, 255); // Very light purple
      doc.setDrawColor(108, 46, 247); // Royal Purple
      doc.roundedRect(14, 96, pageWidth - 28, 18, 2, 2, 'FD');

      // Title/Label
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(10, 0, 40); // Deep Eclipse
      doc.text(workLinkTitle || 'Project Link:', 20, 107.5);

      // Clickable URL
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(108, 46, 247); // Royal Purple
      doc.textWithLink(workLinkUrl, 20 + doc.getTextWidth(workLinkTitle || 'Project Link:') + 4, 107.5, { url: workLinkUrl });

      // Push everything else down
      nextY += 24;
    }

    // Milestones Section
    doc.setTextColor(10, 0, 40); // Deep Eclipse
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Payment Milestones', 14, nextY);
    doc.setFont(undefined, 'normal');
    nextY += 8;

    const milestoneData = pkg.paymentMilestones.map(m => [
      m.label,
      `Rs. ${m.amountDue.toLocaleString()}`,
      m.status.toUpperCase()
    ]);

    autoTable(doc, {
      startY: nextY,
      head: [['Milestone', 'Amount', 'Status']],
      body: milestoneData,
      theme: 'grid',
      headStyles: { fillColor: [10, 0, 40], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' }, // Deep Eclipse
      bodyStyles: { textColor: [15, 23, 42], fontSize: 9 },
      columnStyles: {
        2: { fontStyle: 'bold' }
      },
      didParseCell: function (data) {
        if (data.section === 'body' && data.column.index === 2) {
          if (data.cell.raw === 'RECEIVED') {
            data.cell.styles.textColor = [5, 150, 105]; // emerald
          } else if (data.cell.raw === 'DUE') {
            data.cell.styles.textColor = [217, 119, 6]; // amber
          }
        }
      }
    });

    nextY = (doc as any).lastAutoTable.finalY + 15;

    // Line Items Section
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Package Inclusions', 14, nextY);
    doc.setFont(undefined, 'normal');
    nextY += 8;

    const lineItemData = pkg.lineItems.map((li, idx) => [
      li.serviceName,
      `${li.quantity}`,
      `${getLineItemDone(pkg.id, idx)}`,
      `${li.quantity - getLineItemDone(pkg.id, idx)}`
    ]);

    autoTable(doc, {
      startY: nextY,
      head: [['Service Name', 'Total Qty', 'Completed', 'Remaining']],
      body: lineItemData,
      theme: 'grid',
      headStyles: { fillColor: [10, 0, 40], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' }, // Deep Eclipse
      bodyStyles: { textColor: [15, 23, 42], fontSize: 9 },
    });

    nextY = (doc as any).lastAutoTable.finalY + 15;

    // Detailed Work Log
    doc.setTextColor(10, 0, 40); // Deep Eclipse
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Detailed Production Log', 14, nextY);
    doc.setFont(undefined, 'normal');
    nextY += 8;

    const pkgTasks = projects
      .filter(t => t.packageId === pkg.id)
      .sort((a, b) => (a.createdAt || a.startDate).localeCompare(b.createdAt || b.startDate));

    if (pkgTasks.length > 0) {
      const taskData = pkgTasks.map(task => {
        const emp = employees.find(e => e.id === task.assignedEmployeeId);
        // Start date = createdAt or startDate. End date = completedAt or deadline if finished
        const startRaw = new Date(task.createdAt || task.startDate);
        const start = isNaN(startRaw.getTime()) ? task.startDate : startRaw.toLocaleDateString();

        // Find end date
        let end = '-';
        if (task.status === 'Completed' || task.status === 'Finished' || task.status === 'Closed') {
          const endRaw = new Date(task.completedAt || task.deadline);
          end = isNaN(endRaw.getTime()) ? task.deadline : endRaw.toLocaleDateString();
        }

        return [
          task.serviceName,
          start,
          end,
          task.description || '-',
          task.status.toUpperCase()
        ];
      });

      autoTable(doc, {
        startY: nextY,
        head: [['Task / Item', 'Started', 'Ended', 'Description', 'Status']],
        body: taskData,
        theme: 'striped',
        headStyles: { fillColor: [108, 46, 247], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' }, // Royal Purple
        bodyStyles: { textColor: [15, 23, 42], fontSize: 8 },
        columnStyles: {
          3: { cellWidth: 50 } // Give description more space
        }
      });
    } else {
      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text('No tasks have been logged for this package yet.', 14, nextY);
    }

    // Determine Y coordinate after the last table
    let tableEndY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : nextY;

    // --- Thank You Section ---
    const pageHeight = doc.internal.pageSize.height;

    // Auto page-break if the table overlaps with the Thank You & Footer area
    if (tableEndY > pageHeight - 75) {
      doc.addPage();
    }

    // Position Thank You section directly above the footer line
    const thankYouY = pageHeight - 65;

    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(10, 0, 40); // Deep Eclipse
    doc.text('Thank You.', 14, thankYouY);

    doc.setFontSize(10);
    doc.setFont(undefined, 'italic');
    doc.setTextColor(108, 46, 247); // Royal Purple
    doc.text('For your continued trust and cooperation.', 14, thankYouY + 8);

    // --- Dynamic Beautiful Footer ---
    if (companyConfig) {
      const footerY = pageHeight - 35; // Position near the very bottom

      // Add a subtle top border to separate the footer visually
      doc.setDrawColor(108, 46, 247); // Royal Purple
      doc.line(14, footerY - 5, pageWidth - 14, footerY - 5);

      // Company Name
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(10, 0, 40); // Deep Eclipse
      doc.text(companyConfig.companyName || 'Our Company', 14, footerY);

      if (companyConfig.tagline) {
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text(companyConfig.tagline, 14, footerY + 5);
      }

      // Draw Contacts (Right aligned, stacked if needed)
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105); // slate-600
      let rightY = footerY;

      if (companyConfig.contacts && companyConfig.contacts.length > 0) {
        // Just print the first 2 primary contacts so the footer isn't overwhelmed
        companyConfig.contacts.slice(0, 2).forEach(contact => {
          const text = `${contact.label}: ${contact.value}`;
          doc.text(text, pageWidth - 14, rightY, { align: 'right' });
          rightY += 5;
        });
      }

      // Draw Socials/Links gracefully on a new line below
      let socialsY = footerY + 12;
      if (companyConfig.socials && companyConfig.socials.length > 0) {
        doc.setFont(undefined, 'bold');
        let socialX = 14;
        companyConfig.socials.slice(0, 4).forEach(social => {
          // Render clickable tiny social links
          const txt = `${social.label}`;
          doc.setTextColor(59, 130, 246); // blue-500
          doc.textWithLink(txt, socialX, socialsY, { url: social.value.startsWith('http') ? social.value : `https://${social.value}` });
          socialX += doc.getTextWidth(txt) + 8; // Spacing between links
        });
      }
    }

    // Save
    doc.save(filename);
  };

  // Get unique clients that have packages
  const clientsWithPackages = clients.filter(c => packages.some(p => p.clientId === c.id));

  // Save filter choice to local storage whenever it changes
  useEffect(() => {
    localStorage.setItem('graphics_filter_month', selectedMonth.toString());
  }, [selectedMonth]);

  const graphicProjects = projects.filter(p => p.type === 'Graphic');

  // Logic: Sum of receivedAmount for completed projects + advance for active ones 
  // This calculates from the WHOLE database for that month
  const totalReceived = graphicProjects
    .filter(p => {
      if (selectedMonth === 'all') return true;
      if (selectedMonth === 'custom') {
        if (!customDateRange.start || !customDateRange.end) return true;
        const projectDate = new Date(p.startDate || p.createdAt || '');
        const start = new Date(customDateRange.start);
        const end = new Date(customDateRange.end);
        end.setHours(23, 59, 59, 999);
        return projectDate >= start && projectDate <= end;
      }
      if (selectedMonth === 'specific') {
        if (!specificDate) return true;
        const pDate = new Date(p.startDate || p.createdAt || '').toISOString().split('T')[0];
        return pDate === specificDate;
      }
      return new Date(p.startDate || p.createdAt || '').getMonth() === selectedMonth;
    })
    .reduce((acc, p) => {
      if (p.status === 'Completed' || p.status === 'Closed') {
        return acc + (p.totalAmount || 0);
      }
      return acc + (p.advance || 0);
    }, 0);

  // ACTIVE TASKS FILTER (Hides 'Completed' so they move to History)
  const activeFilteredByMonth = graphicProjects
    .filter(p => {
      const isActive = p.status !== 'Completed' && p.status !== 'Closed';
      if (!isActive) return false;
      if (selectedMonth === 'all') return true;
      if (selectedMonth === 'custom') {
        if (!customDateRange.start || !customDateRange.end) return true;
        const projectDate = new Date(p.startDate || p.createdAt || '');
        const start = new Date(customDateRange.start);
        const end = new Date(customDateRange.end);
        end.setHours(23, 59, 59, 999);
        return projectDate >= start && projectDate <= end;
      }
      if (selectedMonth === 'specific') {
        if (!specificDate) return true;
        const pDate = new Date(p.startDate || p.createdAt || '').toISOString().split('T')[0];
        return pDate === specificDate;
      }
      const projectDate = new Date(p.startDate || p.createdAt || '');
      return projectDate.getMonth() === selectedMonth;
    })
    // Search filter
    .filter(p => {
      if (!taskSearch.trim()) return true;
      const q = taskSearch.toLowerCase();
      return (
        (p.serviceName || '').toLowerCase().includes(q) ||
        (p.clientName || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    })
    // Service filter
    .filter(p => !filterService || p.serviceName === filterService)
    // Priority filter
    .filter(p => !filterPriority || p.priority === filterPriority)
    // Status filter
    .filter(p => !filterStatus || p.status === filterStatus)
    // Sort: newest first (LIFO)
    .sort((a, b) => {
      const dateA = a.createdAt || a.startDate || '';
      const dateB = b.createdAt || b.startDate || '';
      return dateB.localeCompare(dateA);
    });

  const activeGraphicsCount = activeFilteredByMonth.length;


  // Get active packages for a specific client (for task linking)
  const getClientActivePackages = (clientId: string) => {
    return packages.filter(p => p.clientId === clientId && p.status === 'active');
  };

  // =====================================================================
  // BULK ENTRY HELPERS
  // =====================================================================

  /** Returns all dates between start and end (inclusive), excluding Sundays and given holidays */
  const getWorkingDays = (start: string, end: string, holidays: string[]): string[] => {
    const result: string[] = [];
    const cur = new Date(start);
    const endD = new Date(end);
    const holidaySet = new Set(holidays);
    while (cur <= endD) {
      const iso = cur.toISOString().split('T')[0];
      if (cur.getDay() !== 0 && !holidaySet.has(iso)) {
        result.push(iso);
      }
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  };

  /**
   * Redistributes posters from a holiday day to nearby working days.
   * 1-2 posters → all to previous working day.
   * 3+ posters → spread 1 each going backwards through previous working days.
   * If no previous, carry forward to next working day.
   */
  const computeRedistribution = (workingDays: string[], postersPerDay: number, holidays: string[]): Map<string, number> => {
    const extra = new Map<string, number>();
    const holidaySet = new Set(holidays);
    // For each holiday inside the range, redistribute its posters
    holidays.forEach(holiday => {
      // Find all working days BEFORE this holiday
      const before = workingDays.filter(d => d < holiday);
      // Find all working days AFTER this holiday (fallback)
      const after = workingDays.filter(d => d > holiday);

      const count = postersPerDay;
      if (count <= 2) {
        // All to the closest previous working day (or next if none)
        const target = before.length > 0 ? before[before.length - 1] : after[0];
        if (target) extra.set(target, (extra.get(target) || 0) + count);
      } else {
        // Spread 1 per previous working day going backwards
        let remaining = count;
        for (let i = before.length - 1; i >= 0 && remaining > 0; i--) {
          extra.set(before[i], (extra.get(before[i]) || 0) + 1);
          remaining--;
        }
        // If still remaining, carry to next working days
        for (let i = 0; i < after.length && remaining > 0; i++) {
          extra.set(after[i], (extra.get(after[i]) || 0) + 1);
          remaining--;
        }
      }
    });
    return extra;
  };

  /** Builds all task entries for bulk creation */
  const buildBulkEntries = (
    dates: string[],
    postersPerDay: number,
    extraMap: Map<string, number>,
    baseTask: typeof newTask,
    totalEntries: number,
    baseDescription: string,
    client: any,
    service: any
  ) => {
    const entries: any[] = [];
    let counter = 1;
    dates.forEach(date => {
      const dayCount = postersPerDay + (extraMap.get(date) || 0);
      for (let i = 0; i < dayCount; i++) {
        entries.push({
          clientId: baseTask.clientId!,
          serviceId: baseTask.serviceId || service?.id || '',
          clientName: client?.name,
          serviceName: service?.name,
          type: 'Graphic',
          priority: (baseTask.priority as any) || 'Medium',
          startDate: date,
          deadline: date,
          totalAmount: 0,
          advance: 0,
          receivedAmount: 0,
          description: baseDescription.trim()
            ? `${baseDescription.trim()} ${counter}/${totalEntries}`
            : `Entry ${counter}/${totalEntries}`,
          status: 'Allocated',
          progress: 0,
          assignedEmployeeId: baseTask.assignedEmployeeId,
          createdAt: new Date().toISOString(),
          ...(baseTask.packageId ? { packageId: baseTask.packageId } : {}),
          ...(baseTask.packageId && baseTask.packageLineItemIndex !== undefined
            ? { packageLineItemIndex: baseTask.packageLineItemIndex }
            : {})
        });
        counter++;
      }
    });
    return entries;
  };

  // =====================================================================
  // BULK ENTRY — NEW MULTI-ITEM QUEUE HELPERS
  // =====================================================================

  // Get item summary for date range method
  const getBulkItemSummary = (cfg: Partial<BulkLineItemConfig>, lineQty: number) => {
    if (!cfg.startDate || !cfg.endDate) return null;
    const startD = new Date(cfg.startDate);
    const endD = new Date(cfg.endDate);
    if (startD > endD) return null;
    // Total calendar days
    const diffMs = endD.getTime() - startD.getTime();
    const totalCalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    // Count Sundays
    let sundays = 0;
    const cur = new Date(startD);
    while (cur <= endD) { if (cur.getDay() === 0) sundays++; cur.setDate(cur.getDate() + 1); }
    const holidayCount = (cfg.holidays || []).filter(h => h >= cfg.startDate! && h <= cfg.endDate!).length;
    const working = getWorkingDays(cfg.startDate, cfg.endDate, cfg.holidays || []);
    const workingDays = working.length;
    const rawPerDay = workingDays > 0 ? lineQty / workingDays : 0;
    const isValid = workingDays > 0 && Number.isInteger(rawPerDay) && rawPerDay > 0;
    return { totalCalDays, sundays, holidayCount, workingDays, rawPerDay, isValid };
  };

  // Add currently-configured item to the queue
  const addBulkItemToQueue = (lineItemIndex: number, lineItemName: string, lineQty: number) => {
    const cfg = bulkItemConfig;
    if (!cfg.assignedEmployeeId) { alert('Please select a Staff member.'); return; }
    if (cfg.method === 'dateRange') {
      if (!cfg.startDate || !cfg.endDate) { alert('Please select Start and End date.'); return; }
      const summary = getBulkItemSummary(cfg, lineQty);
      if (!summary?.isValid) { alert('Working days do not divide evenly into the item quantity. Please adjust the date range.'); return; }
    } else {
      if (!cfg.selectedDates || cfg.selectedDates.length === 0) { alert('Please select at least one date.'); return; }
    }
    const item: BulkLineItemConfig = {
      lineItemIndex,
      serviceName: lineItemName,
      quantity: lineQty,
      method: cfg.method as 'dateRange' | 'specificDays',
      assignedEmployeeId: cfg.assignedEmployeeId!,
      priority: cfg.priority || 'Medium',
      description: cfg.description || '',
      startDate: cfg.startDate || '',
      endDate: cfg.endDate || '',
      holidays: cfg.holidays || [],
      selectedDates: cfg.selectedDates || [],
    };
    setBulkQueue(prev => [...prev.filter(q => q.lineItemIndex !== lineItemIndex), item]);
    setBulkConfigLineIdx(null);
    setBulkItemConfig({ method: 'dateRange', priority: 'Medium', holidays: [], selectedDates: [], startDate: '', endDate: '', description: '', assignedEmployeeId: '' });
    setBulkHolidayInput('');
    setBulkDecimalWarning('');
  };

  // Main confirm — loop all queue items and save to DB
  const handleBulkQueueCreate = async () => {
    if (bulkQueue.length === 0) { alert('No items in queue. Configure and add at least one line item.'); return; }
    const client = clients.find(c => c.id === newTask.clientId);
    const total = bulkQueue.reduce((s, item) => {
      if (item.method === 'dateRange') {
        const working = getWorkingDays(item.startDate, item.endDate, item.holidays);
        const perDay = item.quantity / working.length;
        return s + working.reduce((ws, d) => ws + perDay + (computeRedistribution(working, perDay, item.holidays.filter(h => h >= item.startDate && h <= item.endDate)).get(d) || 0), 0);
      } else { return s + item.selectedDates.length; }
    }, 0);

    let overallCurrent = 0;
    setBulkProgress({ current: 0, total: Math.round(total) });

    for (const item of bulkQueue) {
      const service = services.find(s => s.name === item.serviceName) || services.find(s => s.id === newTask.serviceId);
      let dates: string[] = [];
      let extraMap = new Map<string, number>();
      let perDay = 1;

      if (item.method === 'dateRange') {
        dates = getWorkingDays(item.startDate, item.endDate, item.holidays);
        perDay = item.quantity / dates.length;
        const inRangeHols = item.holidays.filter(h => h >= item.startDate && h <= item.endDate);
        if (inRangeHols.length > 0) extraMap = computeRedistribution(dates, perDay, inRangeHols);
      } else {
        dates = [...item.selectedDates].sort();
        perDay = 1;
      }

      const totalEntries = item.method === 'dateRange' ? item.quantity : dates.length;
      const entries = buildBulkEntries(
        dates, perDay, extraMap,
        { ...newTask, assignedEmployeeId: item.assignedEmployeeId, priority: item.priority as any, packageLineItemIndex: item.lineItemIndex },
        totalEntries,
        item.description,
        client,
        service
      );
      for (let i = 0; i < entries.length; i++) {
        await addProjectToDB(entries[i]);
        overallCurrent++;
        setBulkProgress({ current: overallCurrent, total: Math.round(total) });
      }
    }

    setBulkProgress(null);
    setShowAddModal(false);
    setBulkQueue([]);
    setBulkConfigLineIdx(null);
    setBulkItemConfig({ method: 'dateRange', priority: 'Medium', holidays: [], selectedDates: [], startDate: '', endDate: '', description: '', assignedEmployeeId: '' });
    setBulkHolidayInput('');
    setBulkDecimalWarning('');
    setNewTask({ priority: 'Medium', totalAmount: 0, advance: 0 });
  };

  // Reset everything when modal closes
  const closeBulkModal = () => {
    setShowAddModal(false);
    setBulkQueue([]);
    setBulkConfigLineIdx(null);
    setBulkItemConfig({ method: 'dateRange', priority: 'Medium', holidays: [], selectedDates: [], startDate: '', endDate: '', description: '', assignedEmployeeId: '' });
    setBulkHolidayInput('');
    setBulkDecimalWarning('');
    setBulkProgress(null);
    setNewTask({ priority: 'Medium', totalAmount: 0, advance: 0 });
  };

  // Calendar helpers for the specific-days picker inside the config panel
  const toggleBulkDate = (iso: string) => {
    const d = new Date(iso);
    if (d.getDay() === 0) return;
    setBulkItemConfig(prev => ({
      ...prev,
      selectedDates: prev.selectedDates?.includes(iso)
        ? prev.selectedDates.filter(x => x !== iso)
        : [...(prev.selectedDates || []), iso]
    }));
  };

  const bulkCalendarDays = (): (string | null)[] => {
    const year = bulkCalendarMonth.getFullYear();
    const month = bulkCalendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push(iso);
    }
    return cells;
  };
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Tab Navigation */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveGraphicsTab('tasks')}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeGraphicsTab === 'tasks'
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
            : 'bg-white text-slate-400 border border-slate-100 hover:border-indigo-200 hover:text-indigo-600'
            }`}
        >
          <Calendar size={16} />
          Tasks
        </button>
        <button
          onClick={() => setActiveGraphicsTab('packages')}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeGraphicsTab === 'packages'
            ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20'
            : 'bg-white text-slate-400 border border-slate-100 hover:border-violet-200 hover:text-violet-600'
            }`}
        >
          <PackageIcon size={16} />
          Packages
          {packages.filter(p => p.status === 'active').length > 0 && (
            <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] ${activeGraphicsTab === 'packages' ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700'
              }`}>
              {packages.filter(p => p.status === 'active').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveGraphicsTab('clients')}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeGraphicsTab === 'clients'
            ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20'
            : 'bg-white text-slate-400 border border-slate-100 hover:border-teal-200 hover:text-teal-600'
            }`}
        >
          <Users size={16} />
          Clients
        </button>
      </div>

      {/* === TASKS TAB (Original content, untouched) === */}
      {activeGraphicsTab === 'tasks' && (<>
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-center">
          {/* Stats Section */}
          <div className="xl:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-indigo-600 px-8 py-6 rounded-[2rem] text-white shadow-xl shadow-indigo-600/20 relative overflow-hidden group hover:scale-[1.02] transition-transform">
              <h4 className="text-[10px] font-black opacity-80 uppercase tracking-widest relative z-10">Active Operations</h4>
              <p className="text-4xl font-black relative z-10 mt-2">{activeGraphicsCount}</p>
              <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
            </div>

            <div className="bg-white px-8 py-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between hover:border-indigo-100 transition-colors group">
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Monthly Revenue</h4>
                <p className="text-3xl font-black text-slate-900 tracking-tight group-hover:text-emerald-600 transition-colors">₹{totalReceived.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100">
                <Wallet size={24} strokeWidth={2.5} />
              </div>
            </div>
          </div>

          {/* Controls Section */}
          <div className="xl:col-span-4 flex flex-col sm:flex-row gap-3 justify-end h-full">
            <div className="relative group w-full sm:w-auto h-full">
              <select
                value={selectedMonth}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedMonth(val === 'all' || val === 'custom' || val === 'specific' ? val : parseInt(val));
                  if (val === 'custom' || val === 'specific') {
                    setShowDatePicker(true);
                  } else {
                    setShowDatePicker(false);
                  }
                }}
                className="w-full sm:w-auto pl-4 pr-10 py-5 bg-white border border-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest appearance-none cursor-pointer hover:border-indigo-400 focus:border-indigo-600 outline-none shadow-sm transition-all h-full min-h-[56px]"
              >
                <option value="all">ALL TIME</option>
                {MONTHS.map((month, index) => (
                  <option key={month} value={index}>{month}</option>
                ))}
                <option value="custom">CUSTOM RANGE</option>
                <option value="specific">SPECIFIC DATE</option>
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />

              {/* Popover for Dates */}
              {showDatePicker && (selectedMonth === 'custom' || selectedMonth === 'specific') && (
                <div className="absolute top-full right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-50 min-w-[300px] animate-in slide-in-from-top-2">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-slate-800 text-sm">
                      {selectedMonth === 'custom' ? 'Select Date Range' : 'Select Specific Date'}
                    </h4>
                    <button onClick={() => setShowDatePicker(false)} className="text-slate-400 hover:text-slate-600">
                      ✕
                    </button>
                  </div>

                  {selectedMonth === 'custom' ? (
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Start Date</label>
                        <input
                          type="date"
                          value={customDateRange.start}
                          onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">End Date</label>
                        <input
                          type="date"
                          value={customDateRange.end}
                          onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600 transition-all"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Date</label>
                        <input
                          type="date"
                          value={specificDate}
                          onChange={(e) => setSpecificDate(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-600 transition-all"
                        />
                      </div>
                    </div>
                  )}
                  <button onClick={() => setShowDatePicker(false)} className="w-full mt-4 bg-indigo-600 text-white py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors">
                    Apply Filter
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="w-full sm:w-auto bg-[#0f172a] text-white px-6 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.1em] flex items-center justify-center gap-3 hover:bg-indigo-600 transition-all shadow-lg shadow-slate-900/10 hover:shadow-indigo-600/20 active:scale-95 h-full"
            >
              <Plus size={20} className="stroke-[3]" />
              <span>New Task</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/20">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
                <Calendar size={20} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 tracking-tight">Live Production Queue</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Tasks currently in development</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {selectedMonth === 'custom' || selectedMonth === 'specific' ? (
                <button
                  onClick={() => setShowDatePicker(true)}
                  className="text-[10px] bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl font-black uppercase tracking-wider hover:bg-indigo-200 transition-colors"
                >
                  {selectedMonth === 'custom' ? 'Custom Range' : 'Specific Date'} Filter Active ✎
                </button>
              ) : (
                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl font-black uppercase tracking-wider">
                  {selectedMonth === 'all' ? 'All Time' : MONTHS[selectedMonth as number]} Filter Active
                </span>
              )}
            </div>
          </div>
          {/* Filter Bar */}
          <div className="px-8 py-4 border-b border-slate-100 bg-white">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Search tasks, clients..."
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  value={taskSearch}
                  onChange={e => setTaskSearch(e.target.value)}
                />
              </div>
              {/* Service Filter */}
              <select
                value={filterService}
                onChange={e => setFilterService(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[140px]"
              >
                <option value="">All Services</option>
                {[...new Set(graphicProjects.map(p => p.serviceName).filter(Boolean))].sort().map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {/* Priority Filter */}
              <select
                value={filterPriority}
                onChange={e => setFilterPriority(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[120px]"
              >
                <option value="">All Priority</option>
                <option value="Urgent">🔴 Urgent</option>
                <option value="High">🟠 High</option>
                <option value="Medium">🔵 Medium</option>
                <option value="Low">⚪ Low</option>
              </select>
              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[120px]"
              >
                <option value="">All Status</option>
                <option value="Allocated">Allocated</option>
                <option value="Pending">Pending</option>
                <option value="Working">Working</option>
                <option value="Waiting">Waiting</option>
                <option value="Finished">Finished</option>
              </select>
              {/* Clear Filters */}
              {(taskSearch || filterService || filterPriority || filterStatus) && (
                <button
                  onClick={() => { setTaskSearch(''); setFilterService(''); setFilterPriority(''); setFilterStatus(''); }}
                  className="px-3 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all"
                >
                  ✕ Clear
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.25em]">
                  <th className="px-10 py-6">Task & Client</th>
                  <th className="px-10 py-6">Allocation</th>
                  <th className="px-10 py-6">Priority</th>
                  <th className="px-10 py-6">Financials</th>
                  <th className="px-10 py-6 text-right">Work Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {activeFilteredByMonth.map(project => {
                  const assignedEmp = employees.find(e => e.id === project.assignedEmployeeId);
                  return (
                    <tr key={project.id} className="hover:bg-slate-50/80 transition-all duration-300 group">
                      <td className="px-10 py-6">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-800 text-base tracking-tight">{project.serviceName}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Client: {project.clientName}</span>

                          {/* Package Context */}
                          {project.packageId && (() => {
                            const pkg = packages.find(p => p.id === project.packageId);
                            if (pkg && typeof project.packageLineItemIndex === 'number') {
                              const lineItem = pkg.lineItems[project.packageLineItemIndex];
                              // Calculate index based on creation time for stable "4/30" numbering
                              const allPackageTasks = projects
                                .filter(p => p.packageId === project.packageId && p.packageLineItemIndex === project.packageLineItemIndex)
                                .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
                              const index = allPackageTasks.findIndex(p => p.id === project.id) + 1;

                              return (
                                <div className="mt-1 flex flex-col">
                                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                                    {pkg.packageName}
                                  </span>
                                  <span className="text-[9px] font-bold text-slate-400">
                                    Item {index}/{lineItem.quantity}
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                          {project.description && (
                            <span className="text-[10px] text-slate-500 font-medium mt-2 line-clamp-2 max-w-xs leading-relaxed opacity-80">
                              {project.description}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-black shadow-sm border border-indigo-100">
                            {assignedEmp?.name.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="text-xs font-black text-slate-700">{assignedEmp?.name || 'Unassigned'}</span>
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm border ${project.priority === 'Urgent' ? 'bg-red-50 text-red-600 border-red-100' :
                          project.priority === 'High' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-slate-50 text-slate-600 border-slate-100'
                          }`}>
                          {project.priority}
                        </span>
                      </td>
                      <td className="px-10 py-6">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900">₹{project.totalAmount.toLocaleString()}</span>
                          <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Received: ₹{(project.status === 'Completed' ? project.totalAmount : project.advance).toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="px-10 py-6 text-right">
                        <span className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 border ${project.status === 'Working' ? 'bg-blue-100 text-blue-700 border-blue-200 animate-pulse' :
                          project.status === 'Waiting' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                          {project.status === 'Working' && <Clock size={12} />}
                          {project.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {activeFilteredByMonth.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-32 text-center text-slate-400">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle size={32} className="opacity-20" />
                      </div>
                      <p className="font-black text-xs uppercase tracking-[0.3em]">No active tasks for {MONTHS[selectedMonth]}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>)}

      {/* === PACKAGES TAB === */}
      {activeGraphicsTab === 'packages' && (
        <div className="space-y-6">
          {/* Package Stats & Controls */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-center">
            <div className="xl:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-violet-600 px-8 py-6 rounded-[2rem] text-white shadow-xl shadow-violet-600/20 relative overflow-hidden group hover:scale-[1.02] transition-transform">
                <h4 className="text-[10px] font-black opacity-80 uppercase tracking-widest relative z-10">Active Packages</h4>
                <p className="text-4xl font-black relative z-10 mt-2">{packages.filter(p => p.status === 'active').length}</p>
                <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
              </div>
              <div className="bg-white px-8 py-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-violet-100 transition-colors group">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Package Value</h4>
                <p className="text-3xl font-black text-slate-900 tracking-tight group-hover:text-violet-600 transition-colors">₹{packages.filter(p => p.status === 'active').reduce((s, p) => s + p.totalAmount, 0).toLocaleString()}</p>
              </div>
              <div className="bg-white px-8 py-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-emerald-100 transition-colors group">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Completed Packages</h4>
                <p className="text-3xl font-black text-slate-900 tracking-tight group-hover:text-emerald-600 transition-colors">{packages.filter(p => p.status === 'completed').length}</p>
              </div>
            </div>
            <div className="xl:col-span-4 flex justify-end">
              <button
                onClick={() => setShowPackageModal(true)}
                className="bg-violet-600 text-white px-6 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.1em] flex items-center justify-center gap-3 hover:bg-violet-700 transition-all shadow-lg shadow-violet-600/20 active:scale-95"
              >
                <Plus size={20} className="stroke-[3]" />
                <span>New Package</span>
              </button>
            </div>
          </div>

          {/* Active Packages List */}
          <div className="space-y-4">
            {packages.filter(p => p.status === 'active').length === 0 ? (
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl py-24 text-center">
                <div className="w-16 h-16 bg-violet-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <PackageIcon size={32} className="text-violet-300" />
                </div>
                <p className="font-black text-xs uppercase tracking-[0.3em] text-slate-400">No active packages</p>
                <p className="text-[10px] text-slate-300 mt-2 font-medium">Create a package to get started</p>
              </div>
            ) : (
              packages.filter(p => p.status === 'active').map(pkg => {
                const progress = getPackageProgress(pkg);
                const totalQty = pkg.lineItems.reduce((s, li) => s + li.quantity, 0);
                const totalDone = getPackageTotalDone(pkg);
                return (
                  <div key={pkg.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-lg p-6 hover:shadow-xl transition-all">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest bg-violet-50 text-violet-700 border border-violet-200">📦 {pkg.period}</span>
                          <span className="px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200">🟢 Active</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditPackage(pkg); }}
                            className="ml-1 p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-xl transition-all"
                            title="Edit Package"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(pkg.id); }}
                            className="ml-auto p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            title="Delete Package"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <h4 className="font-black text-slate-900 text-xl tracking-tight mt-2">{pkg.clientName}</h4>
                        <p className="text-sm font-bold text-slate-500">{pkg.packageName}</p>

                        {/* Line Items */}
                        <div className="mt-4 space-y-2">
                          {pkg.lineItems.map((li, idx) => (
                            <div key={idx} className="flex items-center gap-3 text-xs">
                              <span className="font-black text-slate-600">{li.serviceName}</span>
                              <span className="text-slate-300">—</span>
                              <span className="font-bold text-slate-500">{getLineItemDone(pkg.id, idx)}/{li.quantity}</span>
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-[120px]">
                                <div
                                  className="h-full bg-violet-500 rounded-full transition-all"
                                  style={{ width: `${li.quantity === 0 ? 0 : (getLineItemDone(pkg.id, idx) / li.quantity) * 100}%` }}
                                ></div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Milestones */}
                        <div className="mt-4 flex flex-wrap gap-2">
                          {pkg.paymentMilestones.map((m, idx) => (
                            <span key={idx} className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border flex items-center gap-1.5 ${m.status === 'received' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              m.status === 'due' ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' :
                                m.status === 'pending' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                  m.status === 'waiting' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                    'bg-slate-50 text-slate-400 border-slate-200'
                              }`}>
                              {m.status === 'received' ? '✅' : m.status === 'due' ? '🟡' : m.status === 'upcoming' ? '⚪' : '🔵'}
                              {m.label} ({m.percentage}%) — ₹{m.amountDue.toLocaleString()}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="text-3xl font-black text-slate-900">₹{pkg.totalAmount.toLocaleString()}</p>
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Received: ₹{pkg.receivedAmount.toLocaleString()}</p>
                        <div className="mt-3">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Overall Progress</div>
                          <div className="w-40 h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
                          </div>
                          <p className="text-xs font-black text-violet-600 mt-1">{totalDone}/{totalQty} ({progress}%)</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Completed Packages */}
          {packages.filter(p => p.status === 'completed').length > 0 && (
            <div className="mt-8">
              <h3 className="font-black text-xs uppercase tracking-[0.3em] text-slate-400 mb-4">Completed Packages</h3>
              <div className="space-y-3">
                {packages.filter(p => p.status === 'completed').map(pkg => (
                  <div key={pkg.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 opacity-80">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-black text-slate-700">{pkg.clientName} — {pkg.packageName}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{pkg.period} • ₹{pkg.totalAmount.toLocaleString()} • ✅ Completed</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle size={20} className="text-emerald-500" />
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(pkg.id); }}
                          className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title="Delete Package"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* === CLIENTS TAB === */}
      {activeGraphicsTab === 'clients' && (
        <div className="space-y-6">
          {clientsWithPackages.length === 0 ? (
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl py-24 text-center">
              <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users size={32} className="text-teal-300" />
              </div>
              <p className="font-black text-xs uppercase tracking-[0.3em] text-slate-400">No clients with packages yet</p>
              <p className="text-[10px] text-slate-300 mt-2 font-medium">Create a package first to see client history</p>
            </div>
          ) : (
            <>
              {/* Client List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clientsWithPackages.map(client => {
                  const clientPackages = packages.filter(p => p.clientId === client.id);
                  const activeCount = clientPackages.filter(p => p.status === 'active').length;
                  const totalValue = clientPackages.reduce((s, p) => s + p.totalAmount, 0);
                  const totalReceived = clientPackages.reduce((s, p) => s + p.receivedAmount, 0);
                  return (
                    <button
                      key={client.id}
                      onClick={() => setSelectedClientForHistory(selectedClientForHistory === client.id ? '' : client.id)}
                      className={`text-left p-6 rounded-[2rem] border transition-all ${selectedClientForHistory === client.id
                        ? 'bg-teal-50 border-teal-200 shadow-lg shadow-teal-500/10'
                        : 'bg-white border-slate-100 shadow-sm hover:border-teal-200 hover:shadow-md'
                        }`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center text-xs font-black border border-teal-100">
                          {client.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900">{client.name}</h4>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{client.companyName}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-lg font-black text-slate-900">{clientPackages.length}</p>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                        </div>
                        <div>
                          <p className="text-lg font-black text-teal-600">{activeCount}</p>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Active</p>
                        </div>
                        <div>
                          <p className="text-lg font-black text-emerald-600">₹{totalReceived.toLocaleString()}</p>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Received</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Client's Package Details */}
              {selectedClientForHistory && (
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
                  <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/20">
                    <h3 className="font-black text-slate-900 tracking-tight">
                      {clients.find(c => c.id === selectedClientForHistory)?.name} — Package History
                    </h3>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">All packages for this client</p>
                  </div>
                  <div className="p-6 space-y-4">
                    {packages.filter(p => p.clientId === selectedClientForHistory).map(pkg => {
                      const progress = getPackageProgress(pkg);
                      const totalQty = pkg.lineItems.reduce((s, li) => s + li.quantity, 0);
                      const totalDone = getPackageTotalDone(pkg);
                      const pkgTasks = projects.filter(t => t.packageId === pkg.id);
                      return (
                        <div key={pkg.id} className={`p-5 rounded-2xl border ${pkg.status === 'active' ? 'border-violet-200 bg-violet-50/30' : 'border-slate-100 bg-slate-50/30'
                          }`}>
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${pkg.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                  {pkg.status === 'active' ? '🟢 Active' : '✅ Completed'}
                                </span>
                                <span className="text-[9px] font-bold text-slate-400">{pkg.period}</span>
                              </div>
                              <h4 className="font-black text-slate-900 text-lg">{pkg.packageName}</h4>
                              <div className="flex flex-wrap gap-3 mt-2">
                                {pkg.lineItems.map((li, idx) => (
                                  <span key={idx} className="text-[10px] font-bold text-slate-500">
                                    {li.serviceName}: {getLineItemDone(pkg.id, idx)}/{li.quantity}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-6">
                              <div className="text-right hidden sm:block">
                                <p className="text-xl font-black text-slate-900">₹{pkg.totalAmount.toLocaleString()}</p>
                                <p className="text-[9px] font-black text-emerald-600">Received: ₹{pkg.receivedAmount.toLocaleString()}</p>
                                <p className="text-[10px] font-black text-violet-600 mt-1">{progress}% ({totalDone}/{totalQty})</p>
                              </div>
                              <button
                                onClick={() => setPdfDownloadPkg(pkg)}
                                className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10 whitespace-nowrap"
                                title="Download Report PDF"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                  <polyline points="7 10 12 15 17 10"></polyline>
                                  <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                                Download Report
                              </button>
                            </div>
                          </div>

                          {/* Milestone badges */}
                          <div className="flex flex-wrap gap-2 mt-3">
                            {pkg.paymentMilestones.map((m, idx) => (
                              <span key={idx} className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${m.status === 'received' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                m.status === 'due' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                  'bg-slate-50 text-slate-400 border-slate-200'
                                }`}>
                                {m.status === 'received' ? '✅' : m.status === 'due' ? '🟡' : '⚪'} {m.label} — ₹{m.amountDue.toLocaleString()}
                              </span>
                            ))}
                          </div>

                          {/* Tasks linked to this package */}
                          {pkgTasks.length > 0 && (
                            <div className="mt-4 bg-white rounded-xl border border-slate-100 overflow-hidden">
                              <div className="px-4 py-2 bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">Linked Tasks ({pkgTasks.length})</div>
                              <div className="divide-y divide-slate-50">
                                {pkgTasks.map(task => (
                                  <div key={task.id} className="px-4 py-3 flex items-center justify-between text-xs">
                                    <div>
                                      <span className="font-black text-slate-700">{task.serviceName}</span>
                                      <span className="text-slate-400 ml-2">{task.description?.substring(0, 40)}</span>
                                    </div>
                                    <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase ${task.status === 'Completed' || task.status === 'Closed' ? 'bg-emerald-50 text-emerald-700' :
                                      task.status === 'Working' ? 'bg-blue-50 text-blue-700' :
                                        'bg-slate-50 text-slate-600'
                                      }`}>
                                      {task.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-300 border border-white/20 max-h-[95vh] overflow-y-auto">
            <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Allocate New Task</h3>
                <p className="text-xs text-slate-500 font-medium">Production & Financial Assignment</p>
              </div>
              <button
                onClick={closeBulkModal}
                className="w-10 h-10 rounded-full hover:bg-slate-200 flex items-center justify-center transition-colors shadow-sm bg-white border border-slate-100"
              >
                <Plus className="rotate-45 text-slate-400" size={20} />
              </button>
            </div>

            <div className="p-8 space-y-5">

              {/* ── TOP SHARED FIELDS ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <SearchableSelect
                    label="Client Association"
                    placeholder="Search master client..."
                    options={clients.map(c => ({ id: c.id, label: c.name, subLabel: c.companyName }))}
                    value={newTask.clientId || ''}
                    onChange={(val) => {
                      setNewTask({ ...newTask, clientId: val, packageId: '', packageLineItemIndex: undefined });
                      setBulkQueue([]); setBulkConfigLineIdx(null);
                    }}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Service</label>
                  <select
                    className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={newTask.serviceId}
                    onChange={e => setNewTask({ ...newTask, serviceId: e.target.value })}
                  >
                    <option value="">Select graphic service...</option>
                    {services.filter(s => s.category === 'Graphic Designing').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {/* ── PACKAGE LINKING ── */}
              {newTask.clientId && getClientActivePackages(newTask.clientId).length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Link to Package (Optional)</label>
                  <select
                    className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none"
                    value={newTask.packageId || ''}
                    onChange={e => {
                      setNewTask({ ...newTask, packageId: e.target.value || undefined, packageLineItemIndex: undefined });
                      setBulkQueue([]); setBulkConfigLineIdx(null); setBulkDecimalWarning('');
                    }}
                  >
                    <option value="">Standalone (no package)</option>
                    {getClientActivePackages(newTask.clientId).map(pkg => (
                      <option key={pkg.id} value={pkg.id}>{pkg.packageName} — {pkg.period}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* ── IF NO PACKAGE: show standalone fields ── */}
              {!newTask.packageId && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assign Staff</label>
                      <select className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none"
                        value={newTask.assignedEmployeeId} onChange={e => setNewTask({ ...newTask, assignedEmployeeId: e.target.value })}>
                        <option value="">Select allocation...</option>
                        {employees.filter(e => e.role === 'employee').map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Priority</label>
                      <select className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none"
                        value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value as any })}>
                        <option value="Low">Low Priority</option>
                        <option value="Medium">Medium Standard</option>
                        <option value="High">High Urgency</option>
                        <option value="Urgent">Immediate Action</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valuation (₹)</label>
                      <input type="number" placeholder="0" className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none"
                        value={newTask.totalAmount} onChange={e => setNewTask({ ...newTask, totalAmount: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Advance (₹)</label>
                      <input type="number" placeholder="0" className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none"
                        value={newTask.advance} onChange={e => setNewTask({ ...newTask, advance: parseInt(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Creative Brief / Description</label>
                    <textarea className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50 h-[4.5rem] focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium resize-none"
                      placeholder="Describe specific design requirements..."
                      value={newTask.description || ''} onChange={e => setNewTask({ ...newTask, description: e.target.value })} />
                  </div>
                  <div className="pt-2">
                    <button type="button"
                      onClick={async () => {
                        if (!newTask.clientId || !newTask.serviceId || !newTask.assignedEmployeeId) { alert('Please fill in Client, Service, and Staff.'); return; }
                        const client = clients.find(c => c.id === newTask.clientId);
                        const service = services.find(s => s.id === newTask.serviceId);
                        const projectToAdd: any = {
                          clientId: newTask.clientId!, serviceId: newTask.serviceId!, clientName: client?.name, serviceName: service?.name,
                          type: 'Graphic', priority: (newTask.priority as any) || 'Medium',
                          startDate: newTask.startDate || new Date().toISOString().split('T')[0],
                          deadline: newTask.deadline || new Date().toISOString().split('T')[0],
                          totalAmount: Number(newTask.totalAmount) || 0, advance: Number(newTask.advance) || 0,
                          receivedAmount: Number(newTask.advance) || 0, description: newTask.description || '',
                          status: 'Allocated', progress: 0, assignedEmployeeId: newTask.assignedEmployeeId, createdAt: new Date().toISOString()
                        };
                        await addProjectToDB(projectToAdd);
                        closeBulkModal();
                      }}
                      className="w-full py-3 bg-indigo-600 text-white font-black rounded-xl shadow-lg hover:bg-indigo-700 active:scale-[0.98] transition-all uppercase tracking-[0.2em] text-xs shadow-indigo-600/20">
                      Confirm Allocation
                    </button>
                  </div>
                </>
              )}

              {/* ── IF PACKAGE SELECTED: Multi-Item Queue Builder ── */}
              {newTask.packageId && (() => {
                const selectedPkg = packages.find(p => p.id === newTask.packageId);
                if (!selectedPkg) return null;
                return (
                  <div className="space-y-4">
                    {/* All line items */}
                    <div className="border border-violet-100 bg-violet-50/30 rounded-2xl overflow-hidden">
                      <div className="px-5 py-3 bg-violet-50 border-b border-violet-100 flex items-center gap-2">
                        <Layers size={14} className="text-violet-500" />
                        <span className="text-[10px] font-black text-violet-700 uppercase tracking-widest">Package Items — Configure Each for Bulk Entry</span>
                      </div>
                      <div className="divide-y divide-violet-50">
                        {selectedPkg.lineItems.map((li, idx) => {
                          const done = getLineItemDone(selectedPkg.id, idx);
                          const remaining = li.quantity - done;
                          const queued = bulkQueue.find(q => q.lineItemIndex === idx);
                          const isConfiguring = bulkConfigLineIdx === idx;
                          const summary = isConfiguring && bulkItemConfig.method === 'dateRange'
                            ? getBulkItemSummary(bulkItemConfig, li.quantity) : null;

                          return (
                            <div key={idx} className="p-4">
                              {/* Line item header row */}
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black border ${queued ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                    {queued ? '✅' : idx + 1}
                                  </div>
                                  <div>
                                    <p className="font-black text-slate-800 text-xs">{li.serviceName}</p>
                                    <p className="text-[9px] font-bold text-slate-400">
                                      {done}/{li.quantity} done · <span className={remaining > 0 ? 'text-violet-600' : 'text-emerald-600'}>{remaining} remaining</span>
                                    </p>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  {queued && (
                                    <button type="button"
                                      onClick={() => setBulkQueue(prev => prev.filter(q => q.lineItemIndex !== idx))}
                                      className="px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-100 transition-all">
                                      Remove
                                    </button>
                                  )}
                                  {remaining > 0 && (
                                    <button type="button"
                                      onClick={() => {
                                        if (isConfiguring) { setBulkConfigLineIdx(null); return; }
                                        setBulkConfigLineIdx(idx);
                                        setBulkItemConfig({ method: 'dateRange', priority: 'Medium', holidays: [], selectedDates: [], startDate: '', endDate: '', description: '', assignedEmployeeId: '' });
                                        setBulkHolidayInput(''); setBulkDecimalWarning('');
                                      }}
                                      className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${isConfiguring ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-violet-600 text-white border-violet-600 hover:bg-violet-700'}`}>
                                      {isConfiguring ? 'Cancel' : queued ? 'Edit' : '+ Configure'}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Queued summary */}
                              {queued && !isConfiguring && (
                                <div className="mt-2 ml-11 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-[9px] font-bold text-emerald-700">
                                  {queued.method === 'dateRange'
                                    ? `📅 ${queued.startDate} → ${queued.endDate} · ${queued.quantity} tasks · ${employees.find(e => e.id === queued.assignedEmployeeId)?.name || '?'} · ${queued.priority}`
                                    : `🗓 ${queued.selectedDates.length} specific days · ${employees.find(e => e.id === queued.assignedEmployeeId)?.name || '?'} · ${queued.priority}`}
                                </div>
                              )}

                              {/* Configuration panel */}
                              {isConfiguring && (
                                <div className="mt-4 ml-0 space-y-4 p-4 bg-white border border-violet-200 rounded-2xl">
                                  {/* Staff + Priority */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Assign Staff</label>
                                      <select className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none"
                                        value={bulkItemConfig.assignedEmployeeId || ''}
                                        onChange={e => setBulkItemConfig(prev => ({ ...prev, assignedEmployeeId: e.target.value }))}>
                                        <option value="">Select staff...</option>
                                        {employees.filter(e => e.role === 'employee').map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                                      </select>
                                    </div>
                                    <div className="space-y-1">
                                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Priority</label>
                                      <select className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none"
                                        value={bulkItemConfig.priority || 'Medium'}
                                        onChange={e => setBulkItemConfig(prev => ({ ...prev, priority: e.target.value }))}>
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                        <option value="Urgent">Urgent</option>
                                      </select>
                                    </div>
                                  </div>

                                  {/* Description */}
                                  <div className="space-y-1">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Description Template (auto-incremented)</label>
                                    <input type="text" placeholder={`e.g. ${li.serviceName} → becomes "${li.serviceName} 1/${li.quantity}"`}
                                      className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none"
                                      value={bulkItemConfig.description || ''}
                                      onChange={e => setBulkItemConfig(prev => ({ ...prev, description: e.target.value }))} />
                                  </div>

                                  {/* Method selector */}
                                  <div className="flex gap-2">
                                    {(['dateRange', 'specificDays'] as const).map(m => (
                                      <button key={m} type="button"
                                        onClick={() => setBulkItemConfig(prev => ({ ...prev, method: m, selectedDates: [], startDate: '', endDate: '', holidays: [] }))}
                                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${bulkItemConfig.method === m ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-400'}`}>
                                        {m === 'dateRange' ? '📅 Date Range' : '🗓 Specific Days'}
                                      </button>
                                    ))}
                                  </div>

                                  {/* Date Range UI */}
                                  {bulkItemConfig.method === 'dateRange' && (
                                    <div className="space-y-3">
                                      <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                                          <input type="date" className="w-full p-2.5 border border-slate-200 rounded-xl bg-white font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-400"
                                            value={bulkItemConfig.startDate || ''}
                                            onChange={e => { setBulkItemConfig(prev => ({ ...prev, startDate: e.target.value })); setBulkDecimalWarning(''); }} />
                                        </div>
                                        <div className="space-y-1">
                                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">End Date</label>
                                          <input type="date" className="w-full p-2.5 border border-slate-200 rounded-xl bg-white font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-400"
                                            value={bulkItemConfig.endDate || ''}
                                            onChange={e => { setBulkItemConfig(prev => ({ ...prev, endDate: e.target.value })); setBulkDecimalWarning(''); }} />
                                        </div>
                                      </div>

                                      {/* Holiday manager */}
                                      <div className="space-y-1.5">
                                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Skip Holidays (Sundays auto-excluded)</label>
                                        <div className="flex gap-2">
                                          <input type="date" className="flex-1 p-2.5 border border-slate-200 rounded-xl bg-white font-bold text-xs outline-none"
                                            value={bulkHolidayInput} onChange={e => setBulkHolidayInput(e.target.value)} />
                                          <button type="button"
                                            onClick={() => {
                                              if (bulkHolidayInput && !(bulkItemConfig.holidays || []).includes(bulkHolidayInput)) {
                                                setBulkItemConfig(prev => ({ ...prev, holidays: [...(prev.holidays || []), bulkHolidayInput].sort() }));
                                                setBulkHolidayInput(''); setBulkDecimalWarning('');
                                              }
                                            }}
                                            className="px-3 py-2 bg-orange-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all">
                                            + Add
                                          </button>
                                        </div>
                                        {(bulkItemConfig.holidays || []).length > 0 && (
                                          <div className="flex flex-wrap gap-1.5 mt-1">
                                            {(bulkItemConfig.holidays || []).map(h => (
                                              <span key={h} className="flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-[9px] font-black">
                                                🚫 {h}
                                                <button type="button" onClick={() => setBulkItemConfig(prev => ({ ...prev, holidays: (prev.holidays || []).filter(x => x !== h) }))} className="hover:text-red-600">✕</button>
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>

                                      {/* Summary card */}
                                      {summary && (
                                        <div className={`rounded-xl border p-3 text-xs ${summary.isValid ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                                          <div className="space-y-0.5">
                                            <p className={`font-black ${summary.isValid ? 'text-emerald-700' : 'text-amber-700'}`}>
                                              📅 {bulkItemConfig.startDate} → {bulkItemConfig.endDate} ({summary.totalCalDays} calendar days)
                                            </p>
                                            <p className={`text-[10px] font-bold ${summary.isValid ? 'text-emerald-600' : 'text-amber-600'}`}>
                                              ├─ Sundays excluded: {summary.sundays}
                                            </p>
                                            <p className={`text-[10px] font-bold ${summary.isValid ? 'text-emerald-600' : 'text-amber-600'}`}>
                                              ├─ Holidays excluded: {summary.holidayCount}
                                            </p>
                                            <p className={`text-[10px] font-bold ${summary.isValid ? 'text-emerald-600' : 'text-amber-600'}`}>
                                              └─ ✅ Working days: {summary.workingDays}
                                            </p>
                                            <p className={`text-[10px] font-black mt-1 ${summary.isValid ? 'text-emerald-700' : 'text-amber-700'}`}>
                                              {li.quantity} items ÷ {summary.workingDays} days = <strong>{summary.rawPerDay.toFixed(2)}</strong>/day
                                              {summary.isValid ? ' ✅' : ' ⚠️ Not a whole number'}
                                            </p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Specific Days UI */}
                                  {bulkItemConfig.method === 'specificDays' && (
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <button type="button" onClick={() => setBulkCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                                          className="p-1.5 rounded-xl hover:bg-white border border-slate-200 transition-all">
                                          <ChevronLeft size={13} className="text-slate-500" />
                                        </button>
                                        <span className="text-xs font-black text-slate-700 uppercase tracking-widest">
                                          {bulkCalendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                                        </span>
                                        <button type="button" onClick={() => setBulkCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                                          className="p-1.5 rounded-xl hover:bg-white border border-slate-200 transition-all">
                                          <ChevronRight size={13} className="text-slate-500" />
                                        </button>
                                      </div>
                                      <div className="grid grid-cols-7 gap-1 text-center">
                                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                          <div key={d} className={`text-[8px] font-black uppercase tracking-widest py-1 ${d === 'Su' ? 'text-red-400' : 'text-slate-400'}`}>{d}</div>
                                        ))}
                                      </div>
                                      <div className="grid grid-cols-7 gap-1">
                                        {bulkCalendarDays().map((iso, i) => {
                                          if (!iso) return <div key={i} />;
                                          const isSun = new Date(iso).getDay() === 0;
                                          const isSel = (bulkItemConfig.selectedDates || []).includes(iso);
                                          return (
                                            <button key={iso} type="button" disabled={isSun} onClick={() => toggleBulkDate(iso)}
                                              className={`py-1.5 rounded-lg text-[10px] font-black transition-all ${isSun ? 'bg-red-50 text-red-200 cursor-not-allowed' : isSel ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-100 text-slate-600 hover:border-indigo-400'}`}>
                                              {new Date(iso).getDate()}
                                            </button>
                                          );
                                        })}
                                      </div>
                                      {(bulkItemConfig.selectedDates || []).length > 0 && (
                                        <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-1.5">
                                          <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest">
                                            {(bulkItemConfig.selectedDates || []).length} dates selected → {(bulkItemConfig.selectedDates || []).length} tasks
                                          </span>
                                          <button type="button" onClick={() => setBulkItemConfig(prev => ({ ...prev, selectedDates: [] }))}
                                            className="text-[8px] font-black text-indigo-400 hover:text-red-500 uppercase tracking-widest">Clear</button>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Add to Queue button */}
                                  <button type="button"
                                    disabled={
                                      !bulkItemConfig.assignedEmployeeId ||
                                      (bulkItemConfig.method === 'dateRange' && !!summary && !summary.isValid) ||
                                      (bulkItemConfig.method === 'dateRange' && (!bulkItemConfig.startDate || !bulkItemConfig.endDate)) ||
                                      (bulkItemConfig.method === 'specificDays' && (bulkItemConfig.selectedDates || []).length === 0)
                                    }
                                    onClick={() => addBulkItemToQueue(idx, li.serviceName, li.quantity)}
                                    className="w-full py-2.5 bg-violet-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-violet-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                                    ✅ Add "{li.serviceName}" to Queue
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Queue summary + confirm */}
                    {bulkQueue.length > 0 && (
                      <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 space-y-3">
                        <p className="text-[10px] font-black text-violet-700 uppercase tracking-widest">
                          <Layers size={12} className="inline mr-1" />
                          {bulkQueue.length} item{bulkQueue.length > 1 ? 's' : ''} ready to create
                        </p>
                        <button type="button" onClick={handleBulkQueueCreate}
                          className="w-full py-3 bg-violet-600 text-white font-black rounded-xl shadow-lg hover:bg-violet-700 active:scale-[0.98] transition-all uppercase tracking-[0.15em] text-xs shadow-violet-600/20">
                          <Layers size={14} className="inline mr-2" />
                          Confirm Bulk Entry — Create All Tasks
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

            </div>
          </div>
        </div>
      )}

      {/* ── BULK PROGRESS OVERLAY ── */}
      {
        bulkProgress && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[60]">
            <div className="bg-white rounded-[2rem] shadow-2xl p-10 text-center w-full max-w-sm animate-in zoom-in duration-200">
              <div className="w-16 h-16 bg-violet-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Layers size={28} className="text-violet-500 animate-pulse" />
              </div>
              <h3 className="font-black text-slate-900 text-lg tracking-tight mb-1">Creating Tasks</h3>
              <p className="text-xs text-slate-500 font-medium mb-5">
                Entry {bulkProgress.current} of {bulkProgress.total}
              </p>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all duration-300"
                  style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-[10px] font-black text-violet-600 mt-2 uppercase tracking-widest">
                {Math.round((bulkProgress.current / bulkProgress.total) * 100)}%
              </p>
            </div>
          </div>
        )
      }
      {/* === Delete Confirmation Modal === */}
      {
        deleteConfirmId && (() => {
          const pkgToDelete = packages.find(p => p.id === deleteConfirmId);
          return (
            <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-8 animate-in zoom-in duration-200">
                <div className="text-center">
                  <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 size={28} className="text-red-500" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">Delete Package?</h3>
                  <p className="text-sm text-slate-500 font-medium">
                    {pkgToDelete ? `"${pkgToDelete.packageName}" for ${pkgToDelete.clientName}` : 'This package'} will be permanently deleted. This cannot be undone.
                  </p>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 font-black rounded-xl hover:bg-slate-200 transition-all text-xs uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => { await deletePackageFromDB(deleteConfirmId); setDeleteConfirmId(null); }}
                    className="flex-1 py-3 bg-red-500 text-white font-black rounded-xl hover:bg-red-600 transition-all text-xs uppercase tracking-widest shadow-lg shadow-red-500/20"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })()
      }

      {/* === Package Creation Modal === */}
      {
        showPackageModal && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-300 border border-white/20 max-h-[90vh] overflow-y-auto">
              <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center sticky top-0 z-10">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Create New Package</h3>
                  <p className="text-xs text-slate-500 font-medium">Package with line items & payment milestones</p>
                </div>
                <button
                  onClick={() => setShowPackageModal(false)}
                  className="w-10 h-10 rounded-full hover:bg-slate-200 flex items-center justify-center transition-colors shadow-sm bg-white border border-slate-100"
                >
                  <Plus className="rotate-45 text-slate-400" size={20} />
                </button>
              </div>

              <form onSubmit={(e) => e.preventDefault()} className="p-8 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="space-y-1.5">
                    <SearchableSelect
                      label="Client"
                      placeholder="Search client..."
                      options={clients.map(c => ({ id: c.id, label: c.name, subLabel: c.companyName }))}
                      value={newPackage.clientId}
                      onChange={(val) => setNewPackage({ ...newPackage, clientId: val })}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Package Name</label>
                    <input
                      type="text"
                      placeholder="e.g. 50 Poster Package"
                      className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none"
                      value={newPackage.packageName}
                      onChange={e => setNewPackage({ ...newPackage, packageName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Period</label>
                    <input
                      type="text"
                      placeholder="e.g. February 2026"
                      className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none"
                      value={newPackage.period}
                      onChange={e => setNewPackage({ ...newPackage, period: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Total Package Amount (₹)</label>
                  <input
                    type="number"
                    placeholder="0"
                    className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none max-w-xs"
                    value={newPackage.totalAmount}
                    onChange={e => setNewPackage({ ...newPackage, totalAmount: parseInt(e.target.value) || 0 })}
                  />
                </div>

                {/* Line Items */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Line Items (Services)</label>
                    <button type="button" onClick={addLineItem} className="text-[10px] font-black text-violet-600 uppercase tracking-widest hover:text-violet-700 flex items-center gap-1">
                      <Plus size={12} /> Add Item
                    </button>
                  </div>
                  <div className="space-y-3">
                    {newPackage.lineItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <select
                          className="flex-1 p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none"
                          value={item.serviceName}
                          onChange={e => updateLineItem(idx, 'serviceName', e.target.value)}
                        >
                          <option value="">Select service...</option>
                          {services.filter(s => s.category === 'Graphic Designing').map(s => (
                            <option key={s.id} value={s.name}>{s.name}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          placeholder="Qty"
                          className="w-24 p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none"
                          value={item.quantity}
                          onChange={e => updateLineItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                        />
                        {newPackage.lineItems.length > 1 && (
                          <button type="button" onClick={() => removeLineItem(idx)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Total Quantity Summary */}
                  <div className="mt-3 flex items-center gap-4">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Total Items: <span className="text-violet-600 text-sm">{newPackage.lineItems.reduce((s, li) => s + li.quantity, 0)}</span>
                    </p>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Services: <span className="text-violet-600 text-sm">{newPackage.lineItems.filter(li => li.serviceName.trim() !== '').length}</span>
                    </p>
                  </div>
                </div>

                {/* Payment Milestones */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Milestones</label>
                    <button type="button" onClick={addMilestone} className="text-[10px] font-black text-violet-600 uppercase tracking-widest hover:text-violet-700 flex items-center gap-1">
                      <Plus size={12} /> Add Milestone
                    </button>
                  </div>
                  <div className="space-y-3">
                    {newPackage.milestones.map((m, idx) => (
                      <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                        <div className="flex items-center gap-3">
                          <input
                            type="text"
                            placeholder="Label (e.g. Advance, At 50%)"
                            className="flex-1 p-3 border border-slate-200 rounded-xl bg-white font-bold text-xs text-slate-700 outline-none"
                            value={m.label}
                            onChange={e => updateMilestone(idx, 'label', e.target.value)}
                          />
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              placeholder="%"
                              className="w-20 p-3 border border-slate-200 rounded-xl bg-white font-bold text-xs text-slate-700 outline-none"
                              value={m.percentage}
                              onChange={e => updateMilestone(idx, 'percentage', parseInt(e.target.value) || 0)}
                            />
                            <span className="text-[10px] font-black text-slate-400">% of amount</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              placeholder="Qty"
                              className="w-20 p-3 border border-slate-200 rounded-xl bg-white font-bold text-xs text-slate-700 outline-none"
                              value={m.triggerAtQuantity}
                              onChange={e => updateMilestone(idx, 'triggerAtQuantity', parseInt(e.target.value) || 0)}
                            />
                            <span className="text-[10px] font-black text-slate-400">/ {newPackage.lineItems.reduce((s, li) => s + li.quantity, 0)} items done</span>
                          </div>
                          {newPackage.milestones.length > 1 && (
                            <button type="button" onClick={() => removeMilestone(idx)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        {/* Advance Checkbox + Amount Preview */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={m.isAdvance}
                              onChange={e => updateMilestone(idx, 'isAdvance', e.target.checked)}
                              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${m.isAdvance ? 'text-emerald-600' : 'text-slate-400'
                              }`}>
                              {m.isAdvance ? '✅ Advance Received' : 'Is this Advance?'}
                            </span>
                          </label>
                          {newPackage.totalAmount > 0 && (
                            <span className={`text-xs font-black ${m.isAdvance ? 'text-emerald-600' : 'text-slate-400'
                              }`}>
                              ₹{Math.round((m.percentage / 100) * newPackage.totalAmount).toLocaleString()}
                              {m.isAdvance && ' (auto-received)'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {newPackage.totalAmount > 0 && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                          Total Allocation: {newPackage.milestones.reduce((s, m) => s + m.percentage, 0)}%
                          = ₹{Math.round(newPackage.milestones.reduce((s, m) => s + m.percentage, 0) / 100 * newPackage.totalAmount).toLocaleString()}
                        </p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                          Advance: ₹{Math.round(newPackage.milestones.filter(m => m.isAdvance).reduce((s, m) => s + m.percentage, 0) / 100 * newPackage.totalAmount).toLocaleString()}
                        </p>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium mt-1">
                        Balance after advance: ₹{(newPackage.totalAmount - Math.round(newPackage.milestones.filter(m => m.isAdvance).reduce((s, m) => s + m.percentage, 0) / 100 * newPackage.totalAmount)).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleCreatePackage}
                    className="w-full py-3 bg-violet-600 text-white font-black rounded-xl shadow-lg hover:bg-violet-700 active:scale-[0.98] transition-all uppercase tracking-[0.2em] text-xs shadow-violet-600/20"
                  >
                    Create Package
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* === EDIT PACKAGE MODAL === */}
      {
        editingPackage && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-300 border border-white/20 max-h-[90vh] overflow-y-auto">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-violet-600/20">
                    <Edit3 size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none">Edit Package</h3>
                    <p className="text-slate-400 font-bold text-[9px] mt-1 uppercase tracking-widest opacity-80">{editingPackage.clientName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingPackage(null)}
                  className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center transition-all bg-white border border-slate-100 hover:rotate-90"
                >
                  <Plus className="rotate-45 text-slate-400" size={20} />
                </button>
              </div>

              <form onSubmit={handleUpdatePackage} className="p-6 space-y-6">
                {/* Package Name + Period */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Package Name</label>
                    <input
                      required
                      className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 text-sm outline-none focus:border-violet-500"
                      value={editPackageForm.packageName}
                      onChange={e => setEditPackageForm({ ...editPackageForm, packageName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Period</label>
                    <input
                      className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 text-sm outline-none focus:border-violet-500"
                      placeholder="e.g. February"
                      value={editPackageForm.period}
                      onChange={e => setEditPackageForm({ ...editPackageForm, period: e.target.value })}
                    />
                  </div>
                </div>

                {/* Total Amount */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Total Amount (₹)</label>
                  <input
                    type="number"
                    className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 text-sm outline-none focus:border-violet-500"
                    value={editPackageForm.totalAmount}
                    onChange={e => setEditPackageForm({ ...editPackageForm, totalAmount: parseInt(e.target.value) || 0 })}
                  />
                </div>

                {/* Line Items */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Line Items</label>
                    <button type="button"
                      onClick={() => setEditPackageForm(prev => ({ ...prev, lineItems: [...prev.lineItems, { serviceName: '', quantity: 1, completedCount: 0 }] }))}
                      className="text-[10px] font-black text-violet-600 uppercase tracking-widest hover:text-violet-700 flex items-center gap-1"
                    >
                      <Plus size={12} /> Add Item
                    </button>
                  </div>
                  <div className="space-y-2">
                    {editPackageForm.lineItems.map((li, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Service name"
                          className="flex-1 p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none"
                          value={li.serviceName}
                          onChange={e => setEditPackageForm(prev => ({ ...prev, lineItems: prev.lineItems.map((l, i) => i === idx ? { ...l, serviceName: e.target.value } : l) }))}
                        />
                        <input
                          type="number"
                          placeholder="Qty"
                          className="w-20 p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none"
                          value={li.quantity}
                          min={1}
                          onChange={e => setEditPackageForm(prev => ({ ...prev, lineItems: prev.lineItems.map((l, i) => i === idx ? { ...l, quantity: parseInt(e.target.value) || 1 } : l) }))}
                        />
                        {editPackageForm.lineItems.length > 1 && (
                          <button type="button"
                            onClick={() => setEditPackageForm(prev => ({ ...prev, lineItems: prev.lineItems.filter((_, i) => i !== idx) }))}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Milestones */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Milestones</label>
                    <button type="button"
                      onClick={() => setEditPackageForm(prev => ({ ...prev, milestones: [...prev.milestones, { label: '', percentage: 0, triggerAtQuantity: 0, isAdvance: false }] }))}
                      className="text-[10px] font-black text-violet-600 uppercase tracking-widest hover:text-violet-700 flex items-center gap-1"
                    >
                      <Plus size={12} /> Add Milestone
                    </button>
                  </div>
                  <div className="space-y-3">
                    {editPackageForm.milestones.map((m, idx) => {
                      const existingMs = editingPackage.paymentMilestones[idx];
                      const alreadyTriggered = existingMs && (existingMs.status === 'received' || existingMs.status === 'due');
                      return (
                        <div key={idx} className={`p-4 rounded-xl border bg-slate-50/50 ${alreadyTriggered ? 'border-emerald-200' : 'border-slate-200'}`}>
                          {alreadyTriggered && (
                            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2">⚡ Already triggered — label &amp; % only</p>
                          )}
                          <div className="flex items-center gap-3">
                            <input
                              type="text"
                              placeholder="Label"
                              className="flex-1 p-3 border border-slate-200 rounded-xl bg-white font-bold text-xs text-slate-700 outline-none"
                              value={m.label}
                              onChange={e => setEditPackageForm(prev => ({ ...prev, milestones: prev.milestones.map((ms, i) => i === idx ? { ...ms, label: e.target.value } : ms) }))}
                            />
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                placeholder="%"
                                className="w-20 p-3 border border-slate-200 rounded-xl bg-white font-bold text-xs text-slate-700 outline-none"
                                value={m.percentage}
                                onChange={e => setEditPackageForm(prev => ({ ...prev, milestones: prev.milestones.map((ms, i) => i === idx ? { ...ms, percentage: parseInt(e.target.value) || 0 } : ms) }))}
                              />
                              <span className="text-[10px] font-black text-slate-400">%</span>
                            </div>
                            {!alreadyTriggered && (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  placeholder="Qty"
                                  className="w-20 p-3 border border-slate-200 rounded-xl bg-white font-bold text-xs text-slate-700 outline-none"
                                  value={m.triggerAtQuantity}
                                  onChange={e => setEditPackageForm(prev => ({ ...prev, milestones: prev.milestones.map((ms, i) => i === idx ? { ...ms, triggerAtQuantity: parseInt(e.target.value) || 0 } : ms) }))}
                                />
                                <span className="text-[10px] font-black text-slate-400">items</span>
                              </div>
                            )}
                            {editPackageForm.milestones.length > 1 && !alreadyTriggered && (
                              <button type="button"
                                onClick={() => setEditPackageForm(prev => ({ ...prev, milestones: prev.milestones.filter((_, i) => i !== idx) }))}
                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                          {editPackageForm.totalAmount > 0 && (
                            <p className="text-[10px] font-black text-slate-400 mt-2 ml-1">
                              = ₹{Math.round((m.percentage / 100) * editPackageForm.totalAmount).toLocaleString()}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3 bg-violet-600 text-white font-black rounded-xl shadow-lg hover:bg-violet-700 active:scale-[0.98] transition-all uppercase tracking-[0.2em] text-xs shadow-violet-600/20"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* PDF Work Link Interceptor Modal */}
      {pdfDownloadPkg && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <Download size={20} /> PDF Download
                </h3>
                <p className="text-blue-100 text-xs mt-1">Configure your Package Report PDF</p>
              </div>
              <button onClick={() => setPdfDownloadPkg(null)} className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-all">
                <X size={16} />
              </button>
            </div>

            <div className="p-6">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
                <h4 className="font-bold text-amber-800 flex items-center gap-2 text-sm"><LinkIcon size={14} /> Add a Work Link? (Optional)</h4>
                <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                  You can seamlessly inject a clickable link (like a Google Drive URL) into your generated PDF. If you leave this blank, the PDF will generate cleanly without it.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Link Title / Text</label>
                  <input
                    value={pdfLinkTitle}
                    onChange={(e) => setPdfLinkTitle(e.target.value)}
                    placeholder="e.g. Review Your Project Files"
                    className="w-full p-4 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-bold text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">URL / Link Address</label>
                  <input
                    value={pdfLinkUrl}
                    onChange={(e) => setPdfLinkUrl(e.target.value)}
                    placeholder="e.g. https://drive.google.com/..."
                    className="w-full p-4 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                  />
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => {
                    // Generating instantly with no link params
                    generatePackagePDF(pdfDownloadPkg);
                    setPdfDownloadPkg(null);
                    setPdfLinkTitle('');
                    setPdfLinkUrl('');
                  }}
                  className="flex-1 py-3 text-sm font-black text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                >
                  Skip & Download
                </button>
                <button
                  onClick={() => {
                    // Pass the typed link data down to the generator
                    generatePackagePDF(pdfDownloadPkg, pdfLinkTitle || 'View Work Files', pdfLinkUrl);
                    setPdfDownloadPkg(null);
                    setPdfLinkTitle('');
                    setPdfLinkUrl('');
                  }}
                  disabled={!pdfLinkUrl && !!pdfLinkTitle}
                  className="flex-1 py-3 text-sm font-black text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {pdfLinkUrl ? <><LinkIcon size={14} /> Add & Download</> : <><Download size={14} /> Download PDF</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div >
  );
};

export default GraphicsDesigning;
