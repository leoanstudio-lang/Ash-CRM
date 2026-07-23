import React, { useState } from 'react';
import { Project, Employee, Client, Service, Priority, PaymentAlert, GraphicDeliverableLog } from '../types';
import {
  Plus, Search, Calendar, Clock, Settings2, Edit3,
  CheckCircle2, AlertCircle, Palette, Trash2, ArrowLeft, Download, FileText,
  User, Check, AlertTriangle, Building2, UserPlus, ChevronRight, Layers, Link as LinkIcon, ExternalLink, X, RefreshCw
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadWatermarkBase64, stampWatermarkAllPages } from '../lib/pdfWatermark';
import { addProjectToDB, updateProjectInDB, deleteProjectFromDB, addClientToDB, deleteClientFromDB, addPaymentAlertToDB, getCompanyProfile } from '../lib/db';

interface GraphicsDesigningProps {
  employees?: Employee[];
  projects?: Project[];
  setProjects?: React.Dispatch<React.SetStateAction<Project[]>>;
  clients?: Client[];
  services?: Service[];
  packages?: any[];
  paymentAlerts?: PaymentAlert[];
}

const GraphicsDesigning: React.FC<GraphicsDesigningProps> = ({
  employees = [],
  projects = [],
  setProjects,
  clients = [],
  services = []
}) => {
  // Navigation State: Level 1 (!selectedClient), Level 2 (selectedClient && !selectedProject), Level 3 (selectedProject)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Session Added Client IDs
  const [addedGraphicClientIds, setAddedGraphicClientIds] = useState<string[]>([]);

  // Modals State
  const [showCreateClientModal, setShowCreateClientModal] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  
  // Search States
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [logSearchTerm, setLogSearchTerm] = useState('');

  // PDF Link Modal State (shown before download)
  const [showPdfLinkModal, setShowPdfLinkModal] = useState(false);
  const [pdfLinkInput, setPdfLinkInput] = useState('');
  const [pdfLinkTargetClient, setPdfLinkTargetClient] = useState<Client | null>(null);
  const [pdfLinkTargetProject, setPdfLinkTargetProject] = useState<Project | null>(null);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  // Create Client Form State
  const [clientMode, setClientMode] = useState<'search' | 'new'>('search');
  const [selectedExistingClientId, setSelectedExistingClientId] = useState('');
  const [newClientForm, setNewClientForm] = useState({
    name: '',
    companyName: '',
    email: '',
    mobile: ''
  });

  // Create Project Form State
  const [projectForm, setProjectForm] = useState<{
    serviceId: string;
    serviceName: string;
    priority: Priority;
    startDate: string;
    deadline: string;
    assignedEmployeeId: string;
    totalDeliverables: number;
    totalAmount: number;
    advance: number;
    description: string;
  }>({
    serviceId: '',
    serviceName: '',
    priority: 'Medium',
    startDate: new Date().toISOString().split('T')[0],
    deadline: '',
    assignedEmployeeId: '',
    totalDeliverables: 10,
    totalAmount: 0,
    advance: 0,
    description: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Safe Arrays
  const safeEmployees = Array.isArray(employees) ? employees : [];
  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeClients = Array.isArray(clients) ? clients : [];
  const safeServices = Array.isArray(services) ? services : [];

  // Graphic Designers List
  const graphicDesigners = safeEmployees.filter(e => e && (
    e.department === 'Graphic' || 
    e.department === 'Graphic Designing' || 
    e.department === 'Graphics Designing' ||
    !e.department ||
    e.department === 'Development' ||
    e.department === 'All'
  ));

  // Filter Graphic Services from Settings / Services Prop
  const graphicServices = safeServices.filter(s => {
    if (!s) return false;
    const cat = (s.category || '').toLowerCase();
    const name = (s.name || '').toLowerCase();
    return cat.includes('graphic') || cat.includes('design') || name.includes('poster') || name.includes('banner') || name.includes('logo') || name.includes('reel') || name.includes('graphic') || name.includes('design');
  });

  const availableServices = graphicServices.length > 0 ? graphicServices : safeServices;

  // Filter Graphic Designing Projects (Deduplicated by ID)
  const graphicsProjects = safeProjects
    .filter((p, index, self) => p && p.id && self.findIndex(o => o && o.id === p.id) === index)
    .filter(p => (
      p.department === 'Graphics Designing' || 
      p.type === 'Graphic' ||
      safeServices.some(s => s && s.id === p.serviceId && (s.category || '').toLowerCase().includes('graphic'))
    ));

  // Clients that have Graphic Designing projects OR were added to Graphic Designing
  const graphicClients = safeClients.filter(c => c && c.id && (
    graphicsProjects.some(p => p && p.clientId === c.id) ||
    addedGraphicClientIds.includes(c.id)
  ));

  // Filter Graphic Clients by Search Term
  const filteredGraphicClients = graphicClients.filter(c => c && (
    (c.name || '').toLowerCase().includes((clientSearchTerm || '').toLowerCase()) ||
    (c.companyName || '').toLowerCase().includes((clientSearchTerm || '').toLowerCase()) ||
    (c.email || '').toLowerCase().includes((clientSearchTerm || '').toLowerCase()) ||
    (c.mobile || '').includes(clientSearchTerm || '')
  ));

  // SORT CLIENTS: Clients WITH Active Projects on TOP!
  const sortedGraphicClients = [...filteredGraphicClients].sort((a, b) => {
    const aActiveCount = graphicsProjects.filter(p => p && p.clientId === a.id && p.status !== 'Completed' && p.status !== 'Finished').length;
    const bActiveCount = graphicsProjects.filter(p => p && p.clientId === b.id && p.status !== 'Completed' && p.status !== 'Finished').length;
    return bActiveCount - aActiveCount;
  });

  // Calculate Days Remaining
  const getDaysRemainingDetails = (deadline: string) => {
    if (!deadline) return { days: 999, text: 'No Deadline', level: 'neutral' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(deadline);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { days: diffDays, text: `${Math.abs(diffDays)}d Overdue`, level: 'critical' };
    if (diffDays === 0) return { days: 0, text: 'Due Today', level: 'critical' };
    if (diffDays <= 2) return { days: diffDays, text: `${diffDays} Days Left`, level: 'critical' };
    if (diffDays <= 5) return { days: diffDays, text: `${diffDays} Days Left`, level: 'warning' };
    return { days: diffDays, text: `${diffDays} Days Left`, level: 'normal' };
  };

  // TOGGLE PROJECT STATUS (IN PROGRESS <-> COMPLETED)
  const handleToggleProjectStatus = async (project: Project, newStatus: string) => {
    try {
      const updates: Partial<Project> = {
        status: newStatus as any
      };
      if (newStatus === 'Completed') {
        updates.completedAt = new Date().toISOString();
      }

      if (setProjects) {
        setProjects(prev => prev.map(p => p.id === project.id ? { ...p, ...updates } : p));
      }
      if (selectedProject?.id === project.id) {
        setSelectedProject(prev => prev ? { ...prev, ...updates } : null);
      }

      await updateProjectInDB(project.id, updates);

      // Trigger payment alert immediately if completed with balance due > 0
      if (newStatus === 'Completed') {
        const totalAmt = Number(project.totalAmount) || 0;
        const advanceAmt = Number(project.advance) || 0;
        const balanceDue = totalAmt - advanceAmt;

        if (balanceDue > 0) {
          await addPaymentAlertToDB({
            projectId: project.id,
            packageId: undefined,
            clientId: project.clientId,
            clientName: selectedClient?.name || project.clientName || 'Client',
            amount: balanceDue,
            milestoneLabel: `Balance Payment - ${project.serviceName || 'Graphic Service'}`,
            department: project.department || 'Graphics Designing',
            status: 'due',
            type: 'standalone',
            triggeredAt: new Date().toISOString()
          });
        }
      }
    } catch (err) {
      console.error("Failed to update project status:", err);
      alert("Failed to update project status.");
    }
  };

  // DELETE CLIENT ACCOUNT (ADMIN ONLY)
  const handleDeleteClient = async (clientId: string, clientName: string) => {
    if (!window.confirm(`Are you sure you want to delete client account "${clientName}"? This action cannot be undone.`)) return;
    try {
      await deleteClientFromDB(clientId);
      setAddedGraphicClientIds(prev => prev.filter(id => id !== clientId));
      if (selectedClient?.id === clientId) {
        setSelectedClient(null);
        setSelectedProject(null);
      }
    } catch (err) {
      console.error("Failed to delete client account:", err);
      alert("Failed to delete client account.");
    }
  };

  // DELETE PROJECT (ADMIN ONLY)
  const handleDeleteProject = async (projectId: string, serviceName: string) => {
    if (!window.confirm(`Are you sure you want to delete project "${serviceName}"? This action cannot be undone.`)) return;
    try {
      await deleteProjectFromDB(projectId);
      if (setProjects) {
        setProjects(prev => prev.filter(p => p.id !== projectId));
      }
      if (selectedProject?.id === projectId) {
        setSelectedProject(null);
      }
    } catch (err) {
      console.error("Failed to delete project:", err);
      alert("Failed to delete project.");
    }
  };

  // DELETE DELIVERABLE TASK LOG (ADMIN ONLY)
  const handleDeleteTaskLog = async (project: Project, logId: string) => {
    if (!window.confirm("Are you sure you want to delete this deliverable task log entry?")) return;
    try {
      const existingLogs = project.deliverableLogs || [];
      const updatedLogs = existingLogs.filter(l => l.id !== logId);
      const total = project.totalDeliverables || 1;
      const newCompleted = updatedLogs.length;
      const progressPct = Math.min(100, Math.round((newCompleted / total) * 100));

      const updates: Partial<Project> = {
        completedDeliverables: newCompleted,
        deliverableLogs: updatedLogs,
        progress: progressPct,
        status: newCompleted >= total ? 'Completed' : 'In Progress'
      };

      if (setProjects) {
        setProjects(prev => prev.map(p => p.id === project.id ? { ...p, ...updates } : p));
      }
      setSelectedProject(prev => prev && prev.id === project.id ? { ...prev, ...updates } : prev);

      await updateProjectInDB(project.id, updates);
    } catch (err) {
      console.error("Failed to delete task log:", err);
      alert("Failed to delete task log.");
    }
  };

  // Handle Client Account Creation / Selection
  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (clientMode === 'search') {
        if (!selectedExistingClientId) {
          alert('Please select a client from Client DB.');
          setIsSubmitting(false);
          return;
        }
        const clientObj = safeClients.find(c => c && c.id === selectedExistingClientId);
        if (clientObj) {
          if (!addedGraphicClientIds.includes(clientObj.id)) {
            setAddedGraphicClientIds(prev => [...prev, clientObj.id]);
          }
          setSelectedClient(clientObj);
          setSelectedProject(null);
          setShowCreateClientModal(false);
        }
      } else {
        if (!newClientForm.name.trim()) {
          alert('Please enter client name.');
          setIsSubmitting(false);
          return;
        }
        const createdClient = await addClientToDB({
          name: newClientForm.name.trim(),
          companyName: newClientForm.companyName.trim() || newClientForm.name.trim(),
          email: newClientForm.email.trim(),
          mobile: newClientForm.mobile.trim(),
          createdAt: new Date().toISOString(),
          status: 'Active'
        });

        if (createdClient && createdClient.id) {
          if (!addedGraphicClientIds.includes(createdClient.id)) {
            setAddedGraphicClientIds(prev => [...prev, createdClient.id]);
          }
          setSelectedClient(createdClient);
          setSelectedProject(null);
          setShowCreateClientModal(false);
        } else {
          alert('Failed to create client account.');
        }
      }
      setNewClientForm({ name: '', companyName: '', email: '', mobile: '' });
      setSelectedExistingClientId('');
    } catch (err) {
      console.error('Error adding client:', err);
      alert('Error creating client account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Service Selection Change from Dropdown
  const handleServiceSelectChange = (serviceId: string) => {
    const selectedSrv = availableServices.find(s => s && s.id === serviceId);
    if (selectedSrv) {
      setProjectForm(prev => ({
        ...prev,
        serviceId: selectedSrv.id,
        serviceName: selectedSrv.name,
        totalAmount: selectedSrv.price ? Number(selectedSrv.price) : prev.totalAmount
      }));
    } else {
      setProjectForm(prev => ({ ...prev, serviceId: serviceId }));
    }
  };

  // Handle Project Creation inside Selected Client Account
  const handleCreateProjectForClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const selectedServiceObj = availableServices.find(s => s && s.id === projectForm.serviceId);
      const finalServiceName = projectForm.serviceName || selectedServiceObj?.name || 'Graphic Design Service';

      const newProjectPayload: Omit<Project, 'id'> = {
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        serviceId: projectForm.serviceId || 'custom_graphic_service',
        serviceName: finalServiceName,
        department: 'Graphics Designing',
        type: 'Graphic',
        priority: projectForm.priority,
        startDate: projectForm.startDate || new Date().toISOString().split('T')[0],
        deadline: projectForm.deadline || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        assignedEmployeeId: projectForm.assignedEmployeeId,
        totalDeliverables: Number(projectForm.totalDeliverables) || 1,
        completedDeliverables: 0,
        deliverableLogs: [],
        totalAmount: Number(projectForm.totalAmount) || 0,
        advance: Number(projectForm.advance) || 0,
        receivedAmount: Number(projectForm.advance) || 0,
        description: projectForm.description,
        status: 'In Progress',
        progress: 0,
        createdAt: new Date().toISOString()
      };

      const newProjectId = await addProjectToDB(newProjectPayload);

      // Update Global state safely without duplicates
      if (setProjects && newProjectId) {
        setProjects(prev => {
          if (prev.some(p => p && p.id === newProjectId)) return prev;
          return [...prev, { id: newProjectId, ...newProjectPayload }];
        });
      }

      // Trigger Advance Payment Alert in Accounts / Payments if advance > 0
      if (Number(projectForm.advance) > 0 && newProjectId) {
        await addPaymentAlertToDB({
          projectId: newProjectId,
          packageId: undefined,
          clientId: selectedClient.id,
          clientName: selectedClient.name,
          amount: Number(projectForm.advance),
          milestoneLabel: `Advance Payment - ${finalServiceName}`,
          status: 'received',
          type: 'standalone',
          triggeredAt: new Date().toISOString(),
          resolvedAt: new Date().toISOString()
        });
      }

      setShowCreateProjectModal(false);
      setProjectForm({
        serviceId: '',
        serviceName: '',
        priority: 'Medium',
        startDate: new Date().toISOString().split('T')[0],
        deadline: '',
        assignedEmployeeId: '',
        totalDeliverables: 10,
        totalAmount: 0,
        advance: 0,
        description: ''
      });
    } catch (err) {
      console.error('Failed to create project:', err);
      alert('An error occurred while creating the project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // PDF Report Export for Specific Project Task Logs
  const handleDownloadProjectPDFReport = async (client: Client, project: Project, overrideLink?: string) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const watermarkB64 = await loadWatermarkBase64();
    const co = await getCompanyProfile();

    // ─── HEADER BAND ───────────────────────────────────────────
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('PROJECT DELIVERABLE TASK LOG REPORT', 14, 18);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - 14, 18, { align: 'right' });

    // ─── CLIENT & PROJECT DETAILS ───────────────────────────────
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('CLIENT & PROJECT DETAILS', 14, 38);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Client Name:`, 14, 46);  doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'bold'); doc.text(client.name, 42, 46);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(71, 85, 105);
    doc.text(`Company:`, 14, 52);       doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'bold'); doc.text(client.companyName || client.name, 42, 52);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(71, 85, 105);
    doc.text(`Service Project:`, 110, 46); doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'bold'); doc.text(project.serviceName || '—', 145, 46);
    const designer = safeEmployees.find(e => e && e.id === project.assignedEmployeeId)?.name || 'Assigned Designer';
    doc.setFont('helvetica', 'normal'); doc.setTextColor(71, 85, 105);
    doc.text(`Assigned Designer:`, 110, 52); doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'bold'); doc.text(designer, 145, 52);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(14, 57, pageWidth - 14, 57);

    // ─── FINANCIAL SUMMARY TABLE ────────────────────────────────
    let curY = 63;
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('PROJECT DELIVERABLES & FINANCIAL SUMMARY', 14, curY);

    const completed = project.deliverableLogs ? project.deliverableLogs.length : (project.completedDeliverables || 0);
    const total = project.totalDeliverables || 1;
    const pct = Math.round((completed / total) * 100);
    const totalAmt = Number(project.totalAmount) || 0;
    const advance = Number(project.advance) || 0;
    const balance = Math.max(0, totalAmt - advance);

    autoTable(doc, {
      startY: curY + 4,
      head: [['Service / Project', 'Deliverables', 'Status', 'Total Amount', 'Advance Received', 'Balance Due']],
      body: [[
        project.serviceName || 'Graphic Service',
        `${completed} / ${total} (${pct}%)`,
        project.status || 'In Progress',
        `Rs. ${totalAmt.toLocaleString('en-IN')}`,
        `Rs. ${advance.toLocaleString('en-IN')}`,
        `Rs. ${balance.toLocaleString('en-IN')}`
      ]],
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'left'
      },
      bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
      columnStyles: {
        0: { cellWidth: 48, halign: 'left' },
        1: { cellWidth: 28, halign: 'center' },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' },
        5: { cellWidth: 24, halign: 'right', fontStyle: 'bold', textColor: balance > 0 ? [220, 38, 38] : [22, 163, 74] }
      },
      margin: { left: 14, right: 14 }
    });

    curY = ((doc as any).lastAutoTable?.finalY ?? curY + 20) + 10;

    // ─── RECORDED TASK LOGS TABLE ────────────────────────────────
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('RECORDED DELIVERABLE TASK LOGS', 14, curY);

    const sortedLogs = [...(project.deliverableLogs || [])].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Table rows: Date | # | Deliverable Title / Note | Logged By  (NO link column)
    const logRows = sortedLogs.map((log, idx) => [
      new Date(log.date).toLocaleDateString('en-GB'),
      String(idx + 1),
      log.fileName || log.note || 'Work Delivered',
      log.note && log.fileName ? log.note : '',
      log.completedByName || designer
    ]);

    if (logRows.length > 0) {
      autoTable(doc, {
        startY: curY + 4,
        head: [['Date', '#', 'Deliverable Title / Note', 'Remarks', 'Logged By']],
        body: logRows,
        theme: 'striped',
        headStyles: {
          fillColor: [71, 85, 105],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.5
        },
        bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 24, halign: 'center' },
          1: { cellWidth: 8, halign: 'center' },
          2: { cellWidth: 72, halign: 'left' },
          3: { cellWidth: 50, halign: 'left', textColor: [100, 116, 139], fontSize: 7 },
          4: { cellWidth: 28, halign: 'left' }
        },
        margin: { left: 14, right: 14, bottom: 40 }
      });
      curY = ((doc as any).lastAutoTable?.finalY ?? curY + 20) + 10;
    } else {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text('No task logs recorded for this project.', 14, curY + 10);
      curY += 20;
    }

    // ─── WORK LINKS SECTION (below table) ────────────────────────
    // Use overrideLink first, then fall back to individual log links
    const primaryLink = (overrideLink || '').trim();
    const logsWithLinks = sortedLogs.filter(l => l.workLink && l.workLink.trim());

    if (primaryLink || logsWithLinks.length > 0) {
      if (curY + 20 > pageHeight - 45) {
        doc.addPage();
        curY = 20;
      }
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('WORK / FOLDER LINKS', 14, curY);
      curY += 6;

      if (primaryLink) {
        const fullLink = primaryLink.startsWith('http') ? primaryLink : `https://${primaryLink}`;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(51, 65, 85);
        doc.text('Primary Work Folder:', 14, curY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(37, 99, 235);
        doc.textWithLink(fullLink, 14, curY + 5, { url: fullLink });
        curY += 14;
      }

      logsWithLinks.forEach((log, idx) => {
        if (log.workLink === primaryLink) return; // skip if same as primary
        const link = log.workLink!.startsWith('http') ? log.workLink! : `https://${log.workLink}`;
        const label = `${idx + 1}. ${log.fileName || 'Deliverable'}`;
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(51, 65, 85);
        doc.text(label, 14, curY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(37, 99, 235);
        doc.textWithLink(link, 14, curY + 4.5, { url: link });
        curY += 12;
      });
    }

    // ─── WATERMARK ────────────────────────────────────────────────
    if (watermarkB64) {
      stampWatermarkAllPages(doc, watermarkB64);
    }

    // ─── FOOTER (all pages) ───────────────────────────────────────
    const royalPurple: [number, number, number] = [108, 46, 247];
    const deepEclipse: [number, number, number] = [15, 23, 42];
    const textMuted: [number, number, number] = [100, 116, 139];
    const pageCount = doc.getNumberOfPages();
    const footerBandHeight = 28;

    const fallbackIconMap: Record<string, string> = {
      instagram: 'instagram.png', facebook: 'Facebook.png', youtube: 'YouTube.png',
      linkedin: 'linkedin.png', behance: 'Behance.png', x: 'X.png', twitter: 'X.png',
      website: 'Website.png', whats: 'whatsapp.png', whatsapp: 'whatsapp.png',
    };

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const ph = doc.internal.pageSize.height;
      const footerY = ph - footerBandHeight;

      // Continuation mini-header (page 2+)
      if (i > 1) {
        doc.setFillColor(...deepEclipse);
        doc.rect(0, 0, pageWidth, 14, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(co?.companyName || 'Ash Creative Studio', 14, 9);
        doc.text('Task Log Report — continued', pageWidth - 14, 9, { align: 'right' });
      }

      // Purple separator line
      doc.setDrawColor(...royalPurple);
      doc.setLineWidth(0.6);
      doc.line(14, footerY, pageWidth - 14, footerY);

      // Company name
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...deepEclipse);
      doc.text(co?.companyName || 'Ash Creative Studio', 14, footerY + 8);

      // Tagline
      if (co?.tagline && co.tagline.trim() !== '') {
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...textMuted);
        doc.text(co.tagline, 14, footerY + 14);
      }

      // Page number (only multi-page)
      if (pageCount > 1) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...royalPurple);
        doc.text(`${i}/${pageCount}`, pageWidth / 2, footerY + 10, { align: 'center' });
      }

      // Social icons
      const iconSize = 5;
      const spacing = 3;
      let rightX = pageWidth - 14;
      const iconY = footerY + 5;
      const socials = co?.socials ?? [];
      for (let s = socials.length - 1; s >= 0; s--) {
        const social = socials[s];
        const rawLabel = social.label ? social.label.toLowerCase().trim() : '';
        if (!rawLabel) continue;
        const labelKey = rawLabel.replace(/\s+/g, '_');
        const iconFile = fallbackIconMap[labelKey] || `${labelKey}.png`;
        try {
          const resp = await fetch(`/${iconFile}`);
          if (!resp.ok) throw new Error('icon not found');
          const blob = await resp.blob();
          const b64: string = await new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onloadend = () => typeof reader.result === 'string' ? res(reader.result) : rej();
            reader.onerror = rej;
            reader.readAsDataURL(blob);
          });
          const iconX = rightX - iconSize;
          doc.addImage(b64, 'PNG', iconX, iconY, iconSize, iconSize);
          const url = social.value.startsWith('http') ? social.value : `https://${social.value}`;
          doc.link(iconX, iconY, iconSize, iconSize, { url });
          rightX -= (iconSize + spacing);
        } catch { /* skip icon gracefully */ }
      }
    }

    doc.save(`${(client.name || 'Client').replace(/\s+/g, '_')}_${(project.serviceName || 'Project').replace(/\s+/g, '_')}_Task_Log_Report.pdf`);
  };

  // -------------------------------------------------------------
  // LEVEL 1: CLIENT ACCOUNTS LISTING
  // -------------------------------------------------------------
  if (!selectedClient) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-6 space-y-6">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Graphic Design Client Accounts
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Select or create a graphic design client account to manage projects
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateClientModal(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-2 active:scale-95"
            >
              <UserPlus size={15} /> CREATE CLIENT ACCOUNT
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {graphicClients.length > 0 && (
          <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-xs max-w-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search graphic design clients..."
                value={clientSearchTerm}
                onChange={(e) => setClientSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs pl-8 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-slate-900 focus:bg-white"
              />
            </div>
          </div>
        )}

        {/* CLIENT ACCOUNTS TABLE */}
        {sortedGraphicClients.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center shadow-xs space-y-3">
            <Building2 className="mx-auto text-slate-300 mb-1" size={44} />
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">No Graphic Design Accounts Yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Click <strong className="text-slate-800">"CREATE CLIENT ACCOUNT"</strong> above to select a client from Client DB or create a new client for graphic designing.
            </p>
            <div className="pt-2">
              <button
                onClick={() => setShowCreateClientModal(true)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-xs inline-flex items-center gap-2"
              >
                <UserPlus size={15} /> CREATE CLIENT ACCOUNT
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden divide-y divide-slate-100">
            <div className="bg-slate-50 text-slate-500 font-bold text-[11px] uppercase tracking-wider px-6 py-3.5 grid grid-cols-12 gap-4 items-center border-b border-slate-200/60">
              <div className="col-span-4">Client Name / Company</div>
              <div className="col-span-3">Contact Email</div>
              <div className="col-span-2">Mobile / Phone</div>
              <div className="col-span-2">Service Projects</div>
              <div className="col-span-1 text-right">Action</div>
            </div>

            {sortedGraphicClients.map(client => {
              if (!client) return null;
              const clientProjs = graphicsProjects.filter(p => p && p.clientId === client.id);
              const activeProjs = clientProjs.filter(p => p && p.status !== 'Completed' && p.status !== 'Finished');
              const completedProjs = clientProjs.filter(p => p && (p.status === 'Completed' || p.status === 'Finished'));
              const hasProjects = clientProjs.length > 0;

              return (
                <div
                  key={client.id}
                  onClick={() => {
                    setSelectedClient(client);
                    setSelectedProject(null);
                  }}
                  className="px-6 py-4 grid grid-cols-12 gap-4 items-center transition-colors cursor-pointer hover:bg-slate-50/80 group"
                >
                  <div className="col-span-4 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs transition-colors ${
                      activeProjs.length > 0
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 group-hover:bg-slate-900 group-hover:text-white'
                    }`}>
                      {client.name ? client.name.charAt(0).toUpperCase() : 'C'}
                    </div>

                    <div className="truncate">
                      <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                        {client.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 font-normal truncate">
                        {client.companyName || 'Private Client'}
                      </p>
                    </div>
                  </div>

                  <div className="col-span-3 text-xs text-slate-700 font-medium truncate">
                    {client.email ? client.email : <span className="text-slate-400 italic">No email</span>}
                  </div>

                  <div className="col-span-2 text-xs text-slate-600 truncate">
                    {client.mobile ? client.mobile : <span className="text-slate-400 italic">No phone</span>}
                  </div>

                  <div className="col-span-2 flex items-center gap-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-md ${
                      activeProjs.length > 0
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {activeProjs.length} Active
                    </span>

                    {completedProjs.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {completedProjs.length} Done
                      </span>
                    )}
                  </div>

                  <div className="col-span-1 text-right flex items-center justify-end gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClient(client);
                        setSelectedProject(null);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors"
                    >
                      <span>Open</span>
                      <ChevronRight size={14} />
                    </button>

                    {/* DELETE CLIENT BUTTON (ADMIN) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClient(client.id, client.name);
                      }}
                      title="Delete Client Account"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CREATE / SELECT CLIENT MODAL */}
        {showCreateClientModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white border border-slate-200 w-full max-w-lg rounded-3xl p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Create / Select Graphic Client</h3>
                  <p className="text-xs text-slate-500 font-medium">Choose a client from Client DB or register a new client</p>
                </div>
                <button
                  onClick={() => setShowCreateClientModal(false)}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg bg-slate-100 transition-all"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleClientSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setClientMode('search')}
                    className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      clientMode === 'search'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Search size={14} /> Search Client DB
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientMode('new')}
                    className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      clientMode === 'new'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <UserPlus size={14} /> Manually Create Client
                  </button>
                </div>

                {clientMode === 'search' ? (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Select Client from Client DB *</label>
                    <SearchableSelect
                      options={safeClients.filter(c => c && c.id).map(c => ({ id: c.id, value: c.id, label: `${c.name || 'Unnamed'} (${c.companyName || 'Client'})` }))}
                      value={selectedExistingClientId}
                      onChange={(val) => setSelectedExistingClientId(val)}
                      placeholder="Search existing clients in DB..."
                    />
                  </div>
                ) : (
                  <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Client Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. John Doe"
                        value={newClientForm.name}
                        onChange={(e) => setNewClientForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full bg-white border border-slate-200 text-slate-800 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-slate-900"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Company / Brand Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Acme Studio"
                        value={newClientForm.companyName}
                        onChange={(e) => setNewClientForm(prev => ({ ...prev, companyName: e.target.value }))}
                        className="w-full bg-white border border-slate-200 text-slate-800 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-slate-900"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Email Address</label>
                        <input
                          type="email"
                          placeholder="john@example.com"
                          value={newClientForm.email}
                          onChange={(e) => setNewClientForm(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full bg-white border border-slate-200 text-slate-800 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-slate-900"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Mobile / Phone</label>
                        <input
                          type="text"
                          placeholder="+91 98765 43210"
                          value={newClientForm.mobile}
                          onChange={(e) => setNewClientForm(prev => ({ ...prev, mobile: e.target.value }))}
                          className="w-full bg-white border border-slate-200 text-slate-800 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateClientModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-xs disabled:opacity-50"
                  >
                    {isSubmitting ? 'Opening Account...' : 'Open Client Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // LEVEL 2: INSIDE CLIENT DESK (ACTIVE & COMPLETED PROJECTS LIST FOR ADMIN)
  // -------------------------------------------------------------
  const myClientProjects = graphicsProjects.filter(p => p && p.clientId === selectedClient.id);
  const activeClientProjects = myClientProjects.filter(p => p && p.status !== 'Completed' && p.status !== 'Finished');
  const completedClientProjects = myClientProjects.filter(p => p && (p.status === 'Completed' || p.status === 'Finished'));

  if (!selectedProject) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-6 space-y-6">
        {/* Back Button & Client Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-b border-slate-200/80 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedClient(null)}
              className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 transition-all shadow-xs flex items-center gap-1 text-xs font-bold"
            >
              <ArrowLeft size={16} /> Back to Clients
            </button>

            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                {selectedClient.name}
                {selectedClient.companyName && (
                  <span className="text-xs font-bold text-slate-500 bg-slate-200/70 px-2.5 py-0.5 rounded-md">
                    {selectedClient.companyName}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Client Account Desk • {myClientProjects.length} Total Service Project(s) ({activeClientProjects.length} Active, {completedClientProjects.length} Completed)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (availableServices.length > 0) {
                  const defaultSrv = availableServices[0];
                  setProjectForm(prev => ({
                    ...prev,
                    serviceId: defaultSrv.id,
                    serviceName: defaultSrv.name,
                    totalAmount: defaultSrv.price ? Number(defaultSrv.price) : prev.totalAmount
                  }));
                }
                setShowCreateProjectModal(true);
              }}
              className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-2 active:scale-95"
            >
              <Plus size={15} /> CREATE NEW PROJECT
            </button>
          </div>
        </div>

        {/* ACTIVE PROJECTS TABLE */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Layers size={15} className="text-blue-600" /> Active Service Projects ({activeClientProjects.length})
          </h3>

          {activeClientProjects.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-10 text-center shadow-xs space-y-2">
              <Palette className="mx-auto text-slate-300 mb-1" size={36} />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">No Active Projects Currently</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Click <strong className="text-slate-800">"CREATE NEW PROJECT"</strong> above to assign a service project for this client.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden divide-y divide-slate-100">
              <div className="bg-slate-50 text-slate-500 font-bold text-[11px] uppercase tracking-wider px-6 py-3.5 grid grid-cols-12 gap-4 items-center border-b border-slate-200/60">
                <div className="col-span-3">Service / Project Name</div>
                <div className="col-span-2">Assigned Designer</div>
                <div className="col-span-2">Work Progress</div>
                <div className="col-span-3">Total / Advance / Balance</div>
                <div className="col-span-2 text-right">Action</div>
              </div>

              {activeClientProjects.map(project => {
                if (!project) return null;
                const total = project.totalDeliverables || 1;
                const completed = project.deliverableLogs ? project.deliverableLogs.length : (project.completedDeliverables || 0);
                const progressPct = Math.min(100, Math.round((completed / total) * 100));
                const daysInfo = getDaysRemainingDetails(project.deadline);
                const assignedEmp = safeEmployees.find(e => e && e.id === project.assignedEmployeeId);

                const totalAmt = project.totalAmount || 0;
                const advanceAmt = project.advance || 0;
                const balanceDue = Math.max(0, totalAmt - advanceAmt);

                return (
                  <div
                    key={project.id}
                    onClick={() => setSelectedProject(project)}
                    className="px-6 py-4 grid grid-cols-12 gap-4 items-center transition-colors hover:bg-slate-50/80 cursor-pointer group text-xs"
                  >
                    <div className="col-span-3">
                      <h4 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                        {project.serviceName || 'Graphic Service'}
                      </h4>
                      {project.description && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {project.description}
                        </p>
                      )}
                    </div>

                    <div className="col-span-2 font-medium text-slate-700 truncate">
                      {assignedEmp?.name || <span className="text-slate-400 italic">Unassigned</span>}
                    </div>

                    <div className="col-span-2 space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-[11px] text-slate-500">Progress:</span>
                        <span className="text-[11px] text-slate-900 font-bold">
                          <strong className="text-blue-600">{completed}</strong> / {total} ({progressPct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-slate-900 h-full rounded-full transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="col-span-3 text-xs space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Total Amount:</span>
                        <span className="font-bold text-slate-900">₹{totalAmt.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Advance:</span>
                        <span className="font-semibold text-emerald-600">₹{advanceAmt.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Balance Due:</span>
                        <span className={`font-bold ${balanceDue > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          ₹{balanceDue.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="col-span-2 text-right flex items-center justify-end gap-1.5 flex-wrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleProjectStatus(project, 'Completed');
                        }}
                        title="Mark Project Completed & Trigger Balance Payment Alert"
                        className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10px] border border-emerald-200 transition-all inline-flex items-center gap-1"
                      >
                        <CheckCircle2 size={11} /> Done
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProject(project);
                        }}
                        className="inline-flex items-center gap-0.5 text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors"
                      >
                        <span>Open</span>
                        <ChevronRight size={13} />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProject(project.id, project.serviceName);
                        }}
                        title="Delete Project"
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* COMPLETED PROJECTS TABLE (VISIBLE IN ADMIN PANEL FOR REPORT DOWNLOAD & AUDIT) */}
        {completedClientProjects.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-slate-200/80">
            <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-600" /> Completed Service Projects ({completedClientProjects.length})
            </h3>

            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden divide-y divide-slate-100">
              <div className="bg-slate-50 text-slate-500 font-bold text-[11px] uppercase tracking-wider px-6 py-3.5 grid grid-cols-12 gap-4 items-center border-b border-slate-200/60">
                <div className="col-span-3">Service / Project Name</div>
                <div className="col-span-2">Assigned Designer</div>
                <div className="col-span-2">Status & Deliverables</div>
                <div className="col-span-3">Total / Balance</div>
                <div className="col-span-2 text-right">Action</div>
              </div>

              {completedClientProjects.map(project => {
                if (!project) return null;
                const total = project.totalDeliverables || 1;
                const completed = project.deliverableLogs ? project.deliverableLogs.length : (project.completedDeliverables || total);
                const assignedEmp = safeEmployees.find(e => e && e.id === project.assignedEmployeeId);

                const totalAmt = project.totalAmount || 0;
                const advanceAmt = project.advance || 0;
                const balanceDue = Math.max(0, totalAmt - advanceAmt);

                return (
                  <div
                    key={project.id}
                    onClick={() => setSelectedProject(project)}
                    className="px-6 py-4 grid grid-cols-12 gap-4 items-center transition-colors hover:bg-slate-50/80 cursor-pointer group text-xs opacity-90"
                  >
                    <div className="col-span-3">
                      <h4 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                        {project.serviceName || 'Graphic Service'}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        Completed {project.completedAt ? new Date(project.completedAt).toLocaleDateString('en-GB') : ''}
                      </p>
                    </div>

                    <div className="col-span-2 font-medium text-slate-700 truncate">
                      {assignedEmp?.name || <span className="text-slate-400 italic">Unassigned</span>}
                    </div>

                    <div className="col-span-2 space-y-1">
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-100 text-[11px]">
                        <CheckCircle2 size={12} /> Completed ({completed}/{total})
                      </span>
                    </div>

                    <div className="col-span-3 text-xs space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Total:</span>
                        <span className="font-bold text-slate-900">₹{totalAmt.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Balance Due:</span>
                        <span className={`font-bold ${balanceDue > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          ₹{balanceDue.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="col-span-2 text-right flex items-center justify-end gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProject(project);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors"
                      >
                        <span>View Logs</span>
                        <ChevronRight size={14} />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProject(project.id, project.serviceName);
                        }}
                        title="Delete Completed Project"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CREATE NEW PROJECT MODAL */}
        {showCreateProjectModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-3xl p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-slate-100 text-slate-900 rounded-xl flex items-center justify-center border border-slate-200">
                    <Palette size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Create Project for {selectedClient.name}</h3>
                    <p className="text-xs text-slate-500 font-medium">Configure service deliverables, timelines & designer assignment</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateProjectModal(false)}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg bg-slate-100 transition-all"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateProjectForClient} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Select Graphic Service *</label>
                    <select
                      required
                      value={projectForm.serviceId}
                      onChange={(e) => handleServiceSelectChange(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-3 py-2.5 rounded-xl focus:outline-none focus:border-slate-900 focus:bg-white font-medium"
                    >
                      <option value="">Select Service from List...</option>
                      {availableServices.map(srv => (
                        <option key={srv.id} value={srv.id}>
                          {srv.name} {srv.price ? `(₹${Number(srv.price).toLocaleString()})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Total Deliverables (Qty) *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="e.g. 10"
                      value={projectForm.totalDeliverables}
                      onChange={(e) => setProjectForm(prev => ({ ...prev, totalDeliverables: parseInt(e.target.value) || 1 }))}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-3 py-2.5 rounded-xl focus:outline-none focus:border-slate-900 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Start Date *</label>
                    <input
                      type="date"
                      required
                      value={projectForm.startDate}
                      onChange={(e) => setProjectForm(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-slate-900 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">End Date / Deadline *</label>
                    <input
                      type="date"
                      required
                      value={projectForm.deadline}
                      onChange={(e) => setProjectForm(prev => ({ ...prev, deadline: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-slate-900 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Assigned Designer *</label>
                    <select
                      required
                      value={projectForm.assignedEmployeeId}
                      onChange={(e) => setProjectForm(prev => ({ ...prev, assignedEmployeeId: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-slate-900 focus:bg-white"
                    >
                      <option value="">Select Designer...</option>
                      {graphicDesigners.map(e => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Priority</label>
                    <select
                      value={projectForm.priority}
                      onChange={(e) => setProjectForm(prev => ({ ...prev, priority: e.target.value as Priority }))}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-slate-900 focus:bg-white"
                    >
                      <option value="Urgent">Urgent</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Total Amount (₹) *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      placeholder="e.g. 15000"
                      value={projectForm.totalAmount}
                      onChange={(e) => setProjectForm(prev => ({ ...prev, totalAmount: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-slate-900 focus:bg-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Advance Received (₹)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 5000"
                      value={projectForm.advance}
                      onChange={(e) => setProjectForm(prev => ({ ...prev, advance: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-slate-50 border border-slate-200 text-emerald-700 font-bold text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-slate-900 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Requirements / Guidelines</label>
                  <textarea
                    rows={2}
                    placeholder="Enter design dimensions, guidelines or notes..."
                    value={projectForm.description}
                    onChange={(e) => setProjectForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs p-3 rounded-xl focus:outline-none focus:border-slate-900 focus:bg-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateProjectModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-xs disabled:opacity-50"
                  >
                    {isSubmitting ? 'Creating Project...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // LEVEL 3: INSIDE A SPECIFIC PROJECT DESK (TASK LOGS & DELETE LOG OPTION)
  // -------------------------------------------------------------
  const currentProjectObj = safeProjects.find(p => p && p.id === selectedProject.id) || selectedProject;
  const projectLogs = currentProjectObj.deliverableLogs || [];
  
  // Sort latest task logs first
  const sortedProjectLogs = [...projectLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Filter task logs by search term
  const filteredProjectLogs = sortedProjectLogs.filter(log => (
    (log.fileName || '').toLowerCase().includes(logSearchTerm.toLowerCase()) ||
    (log.note || '').toLowerCase().includes(logSearchTerm.toLowerCase()) ||
    (log.completedByName || '').toLowerCase().includes(logSearchTerm.toLowerCase())
  ));

  const total = currentProjectObj.totalDeliverables || 1;
  const completed = currentProjectObj.deliverableLogs ? currentProjectObj.deliverableLogs.length : (currentProjectObj.completedDeliverables || 0);
  const progressPct = Math.min(100, Math.round((completed / total) * 100));
  const daysInfo = getDaysRemainingDetails(currentProjectObj.deadline);
  const assignedEmp = safeEmployees.find(e => e && e.id === currentProjectObj.assignedEmployeeId);

  const totalAmt = currentProjectObj.totalAmount || 0;
  const advanceAmt = currentProjectObj.advance || 0;
  const balanceDue = Math.max(0, totalAmt - advanceAmt);

  return (
    <>
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-6 space-y-6">
      {/* Back Button & Project Header + DOWNLOAD REPORT BUTTON ON LOG PAGE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedProject(null)}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 transition-all shadow-xs flex items-center gap-1 text-xs font-bold"
          >
            <ArrowLeft size={16} /> Back to Projects
          </button>

          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              {currentProjectObj.serviceName || 'Graphic Service'}
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100">
                {selectedClient.name}
              </span>
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Assigned Designer: <strong className="text-slate-800">{assignedEmp?.name || 'Unassigned'}</strong> • Progress: <strong className="text-blue-600">{completed}/{total} Tasks ({progressPct}%)</strong>
            </p>
          </div>
        </div>

        {/* DOWNLOAD PDF REPORT BUTTON DIRECTLY ON LOG PAGE */}
        <div className="flex items-center gap-3">
          {currentProjectObj.workLink && (
            <a
              href={currentProjectObj.workLink.startsWith('http') ? currentProjectObj.workLink : `https://${currentProjectObj.workLink}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white hover:bg-slate-100 border border-slate-300 text-blue-600 font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-xs inline-flex items-center gap-1.5"
            >
              <LinkIcon size={14} /> Work Folder <ExternalLink size={11} />
            </a>
          )}

          <button
            onClick={() => {
              setPdfLinkTargetClient(selectedClient);
              setPdfLinkTargetProject(currentProjectObj);
              // Pre-fill with the project's existing workLink if available
              setPdfLinkInput(currentProjectObj.workLink || '');
              setShowPdfLinkModal(true);
            }}
            className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-2 active:scale-95"
          >
            <Download size={15} /> Download PDF Report
          </button>

          {/* DELETE PROJECT BUTTON (ADMIN) */}
          <button
            onClick={() => handleDeleteProject(currentProjectObj.id, currentProjectObj.serviceName)}
            title="Delete Project"
            className="bg-white hover:bg-red-50 border border-red-200 text-red-600 font-bold text-xs p-2.5 rounded-xl transition-all shadow-xs"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* PROJECT SUMMARY & FINANCIAL BREAKDOWN CARD */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <span>Work Progress:</span>
              <span className="text-blue-600">{completed} / {total} Tasks Completed ({progressPct}%)</span>
            </div>
            <div className="w-64 bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-slate-900 h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Financial Overview Cards */}
          <div className="flex items-center gap-6 text-xs bg-slate-50 px-4 py-2 rounded-xl border border-slate-200/80">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Total Amount</span>
              <span className="font-extrabold text-slate-900 text-xs">₹{totalAmt.toLocaleString()}</span>
            </div>
            <div className="border-l border-slate-200 pl-4">
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Advance Received</span>
              <span className="font-extrabold text-emerald-600 text-xs">₹{advanceAmt.toLocaleString()}</span>
            </div>
            <div className="border-l border-slate-200 pl-4">
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Balance Due</span>
              <span className={`font-extrabold text-xs ${balanceDue > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                ₹{balanceDue.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className={`inline-flex items-center gap-1.5 font-semibold ${
              daysInfo.level === 'critical' ? 'text-red-600 font-bold' : 'text-slate-600'
            }`}>
              <Clock size={14} /> {daysInfo.text}
            </span>

            <span className="font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-100">
              {currentProjectObj.status || 'In Progress'}
            </span>
          </div>
        </div>
      </div>

      {/* DELIVERABLE TASK LOGS TABLE FOR THIS SPECIFIC PROJECT */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <FileText size={15} className="text-blue-600" /> Deliverable Task Logs for {currentProjectObj.serviceName} ({filteredProjectLogs.length})
          </h3>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            <input
              type="text"
              placeholder="Search task logs..."
              value={logSearchTerm}
              onChange={(e) => setLogSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-800 text-xs pl-8 pr-3 py-1.5 rounded-xl focus:outline-none focus:border-slate-900 shadow-xs"
            />
          </div>
        </div>

        {filteredProjectLogs.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center shadow-xs space-y-2">
            <FileText className="mx-auto text-slate-300 mb-1" size={40} />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">No Task Logs Recorded</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {logSearchTerm ? 'No task logs match your search term.' : 'The assigned designer has not submitted any deliverable task logs for this project yet.'}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden divide-y divide-slate-100">
            {/* Table Header Row */}
            <div className="bg-slate-50 text-slate-500 font-bold text-[11px] uppercase tracking-wider px-6 py-3.5 grid grid-cols-12 gap-4 items-center border-b border-slate-200/60">
              <div className="col-span-2">Date</div>
              <div className="col-span-4">Deliverable Title / Note</div>
              <div className="col-span-5">Work Link / Designer</div>
              <div className="col-span-1 text-right">Action</div>
            </div>

            {/* Line-by-Line Task Logs */}
            {filteredProjectLogs.map(log => (
              <div
                key={log.id}
                className="px-6 py-3.5 grid grid-cols-12 gap-4 items-center transition-colors hover:bg-slate-50/80 text-xs"
              >
                {/* Date */}
                <div className="col-span-2 text-slate-500 font-medium">
                  {new Date(log.date).toLocaleDateString('en-GB')}
                </div>

                {/* File / Title + Note */}
                <div className="col-span-4 truncate">
                  <span className="font-semibold text-slate-800 truncate block">
                    {log.fileName}
                  </span>
                  {log.note && (
                    <span className="text-[11px] text-slate-400 truncate block">
                      {log.note}
                    </span>
                  )}
                </div>

                {/* Work Link & Designer */}
                <div className="col-span-5 truncate space-y-0.5">
                  <span className="font-semibold text-slate-800 block truncate">{log.completedByName || assignedEmp?.name || 'Designer'}</span>
                  {log.workLink ? (
                    <a
                      href={log.workLink.startsWith('http') ? log.workLink : `https://${log.workLink}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline bg-blue-50 px-2 py-0.5 rounded border border-blue-100"
                    >
                      <LinkIcon size={10} /> Folder <ExternalLink size={9} />
                    </a>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">No link</span>
                  )}
                </div>

                {/* Delete Task Log Action (Admin) */}
                <div className="col-span-1 text-right">
                  <button
                    onClick={() => handleDeleteTaskLog(currentProjectObj, log.id)}
                    title="Delete Log Entry"
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

      {/* PDF LINK MODAL — appears before generating PDF */}
      {showPdfLinkModal && pdfLinkTargetClient && pdfLinkTargetProject && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-2xl text-slate-800 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Download size={15} className="text-slate-300" />
                  Download PDF Report
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {pdfLinkTargetProject.serviceName} — {pdfLinkTargetClient.name}
                </p>
              </div>
              <button
                onClick={() => { setShowPdfLinkModal(false); setPdfLinkInput(''); }}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Primary Work / Folder Link
                </label>
                <p className="text-[11px] text-slate-500">
                  Paste your Google Drive, Dropbox, or any work folder link. It will appear as a clickable link in the PDF.
                </p>
                <div className="relative mt-2">
                  <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="url"
                    value={pdfLinkInput}
                    onChange={e => setPdfLinkInput(e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/..."
                    autoFocus
                    className="w-full bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white text-slate-900 text-xs pl-9 pr-3 py-2.5 rounded-xl focus:outline-none transition-all"
                  />
                </div>
                {pdfLinkInput && (
                  <p className="text-[10px] text-blue-600 truncate px-1">
                    {pdfLinkInput.startsWith('http') ? pdfLinkInput : `https://${pdfLinkInput}`}
                  </p>
                )}
              </div>

              <p className="text-[11px] text-slate-400 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                You can also leave this blank — any work links added in individual task logs will still be included.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="px-6 pb-5 flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowPdfLinkModal(false); setPdfLinkInput(''); }}
                className="text-slate-600 hover:text-slate-900 font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                disabled={isPdfGenerating}
                onClick={async () => {
                  setIsPdfGenerating(true);
                  try {
                    await handleDownloadProjectPDFReport(pdfLinkTargetClient, pdfLinkTargetProject, pdfLinkInput.trim());
                  } finally {
                    setIsPdfGenerating(false);
                    setShowPdfLinkModal(false);
                    setPdfLinkInput('');
                  }
                }}
                className="bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-sm active:scale-95"
              >
                {isPdfGenerating ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <Download size={13} /> Download PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GraphicsDesigning;
