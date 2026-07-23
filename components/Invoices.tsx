import React, { useState, useEffect, useRef } from 'react';
import { Invoice, InvoiceItem, PaymentAlert, Client, CompanyProfile, Project, Package, Service } from '../types';
import {
  Receipt, Plus, Trash2, Download, CheckCircle2, Clock, X, Building2, User, Phone, Mail,
  Search, Calendar, Filter, ArrowUpRight, AlertCircle, Pencil, Sparkles, Check, FileText, ArrowRight, Wallet
} from 'lucide-react';
import { addInvoiceToDB, updateInvoiceInDB, deleteInvoiceFromDB, generateProfessionalInvoiceId, getCompanyProfile, subscribeToCollection, updatePaymentAlertInDB, addClientToDB, updateClientInDB } from '../lib/db';
import { processAutomaticRevenue } from '../lib/accounting';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadWatermarkBase64, stampWatermarkAllPages } from '../lib/pdfWatermark';

interface InvoicesProps {
  clients: Client[];
  services?: Service[];
  paymentAlerts: PaymentAlert[];
  packages?: Package[];
  projects?: Project[];
}

const DEFAULT_SERVICES = [
  'Web Development',
  'Mobile App Development',
  'Graphic Designing',
  'Digital Marketing',
  'SEO & Performance',
  'Brand Identity & Creative Poster',
  'Consulting & Strategy'
];

const Invoices: React.FC<InvoicesProps> = ({ clients = [], services = [], paymentAlerts = [], packages = [], projects = [] }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);

  // Modal States
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null);

  // Active Tab & Filters
  const [activeTab, setActiveTab] = useState<'All' | 'Pending' | 'Received' | 'Draft' | 'Sent'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Form State
  const [clientType, setClientType] = useState<'existing' | 'new'>('existing');
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  const [newClientName, setNewClientName] = useState('');
  const [newClientCompany, setNewClientCompany] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [items, setItems] = useState<InvoiceItem[]>([{ serviceName: '', description: '', quantity: 1, unitPrice: 0, total: 0 }]);
  const [discount, setDiscount] = useState<number>(0);
  const [tax, setTax] = useState<number>(0);
  const [terms, setTerms] = useState("1. Payment is due within 14 days from issue date.\n2. Please include invoice number in payment remarks.\n3. Make all payments to Ash Creative Studio bank/UPI account.");
  const [notes, setNotes] = useState('');
  const [linkedPaymentAlertId, setLinkedPaymentAlertId] = useState<string | undefined>(undefined);

  // Subscribe to live data
  useEffect(() => {
    getCompanyProfile().then(profile => {
      if (profile) setCompanyProfile(profile);
    });

    const unsubInvoices = subscribeToCollection<Invoice>('invoices', (data) => {
      setInvoices(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });

    return () => {
      unsubInvoices();
    };
  }, []);

  // Combine system services + default services
  const availableServices = Array.from(new Set([
    ...services.map(s => s.name),
    ...DEFAULT_SERVICES
  ]));

  // Handle client selection with pre-filling previous invoice details
  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    if (!clientId) {
      setNewClientName('');
      setNewClientCompany('');
      setNewClientEmail('');
      setNewClientPhone('');
      setClientAddress('');
      return;
    }

    const client = clients.find(c => c.id === clientId);
    if (client) {
      setNewClientName(client.name || '');
      setNewClientCompany(client.companyName || '');
      setNewClientEmail(client.email && client.email !== 'No Email Registered' ? client.email : '');
      setNewClientPhone(client.mobile && client.mobile !== 'Not Provided' ? client.mobile : '');
    }

    const previousInvoice = invoices.find(inv => inv.clientId === clientId || inv.clientName.toLowerCase() === (client?.companyName || client?.name || '').toLowerCase());
    if (previousInvoice) {
      if (previousInvoice.clientAddress) setClientAddress(previousInvoice.clientAddress);
      if (previousInvoice.termsAndConditions) setTerms(previousInvoice.termsAndConditions);
    }
  };

  // Filter Active Suggested Payment Alerts
  const suggestedAlerts = (paymentAlerts || []).filter(a => a && (a.status === 'due' || a.status === 'pending' || a.status === 'waiting'));

  // Metrics
  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
  const totalCollected = invoices.filter(i => i.status === 'Received').reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
  const totalPending = invoices.filter(i => i.status === 'Pending' || i.status === 'Sent' || i.status === 'Draft').reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

  // Filter Invoices
  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = (inv.invoiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.clientName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === 'All' || inv.status === activeTab;
    const matchesDate = !dateFilter || inv.issueDate === dateFilter;
    return matchesSearch && matchesTab && matchesDate;
  });

  // Handle Items calculation
  const handleAddItem = () => {
    setItems([...items, { serviceName: '', description: '', quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...items];
    const item = { ...newItems[index] };
    if (field === 'description' || field === 'serviceName') {
      item[field] = value as string;
    } else {
      item[field] = Number(value) as never;
    }
    if (field === 'quantity' || field === 'unitPrice') {
      item.total = item.quantity * item.unitPrice;
    }
    newItems[index] = item;
    setItems(newItems);
  };

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const totalAmount = Math.max(0, subtotal - (discount || 0) + (tax || 0));

  const openCreateModal = async (suggestedAlert?: PaymentAlert) => {
    const generatedId = await generateProfessionalInvoiceId();
    setInvoiceNumber(generatedId);
    setIssueDate(new Date().toISOString().split('T')[0]);
    setDueDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setDiscount(0);
    setTax(0);
    setNotes('');

    if (suggestedAlert) {
      setLinkedPaymentAlertId(suggestedAlert.id);
      const existingClient = clients.find(c => c.id === suggestedAlert.clientId || c.name.toLowerCase() === suggestedAlert.clientName.toLowerCase());
      if (existingClient) {
        setClientType('existing');
        handleClientSelect(existingClient.id);
      } else {
        setClientType('new');
        setNewClientName(suggestedAlert.clientName);
        setNewClientCompany(suggestedAlert.clientName);
      }
      setItems([{
        serviceName: suggestedAlert.department || 'Graphic Designing',
        description: `${suggestedAlert.packageName || suggestedAlert.taskName || 'Milestone Payment'} (${suggestedAlert.milestoneLabel})`,
        quantity: 1,
        unitPrice: suggestedAlert.amount,
        total: suggestedAlert.amount
      }]);
    } else {
      setLinkedPaymentAlertId(undefined);
      setClientType('existing');
      setSelectedClientId('');
      setNewClientName('');
      setNewClientCompany('');
      setNewClientEmail('');
      setNewClientPhone('');
      setClientAddress('');
      setItems([{ serviceName: '', description: '', quantity: 1, unitPrice: 0, total: 0 }]);
    }

    setIsEditing(false);
    setEditingInvoiceId(null);
    setIsCreating(true);
  };

  const handleEditClick = (inv: Invoice) => {
    setInvoiceNumber(inv.invoiceNumber);
    setIssueDate(inv.issueDate);
    setDueDate(inv.dueDate);
    if (inv.clientId) {
      setClientType('existing');
      setSelectedClientId(inv.clientId);
    } else {
      setClientType('new');
    }
    setNewClientName(inv.clientName);
    setNewClientCompany(inv.clientName);
    setNewClientEmail(inv.clientEmail || '');
    setNewClientPhone(inv.clientPhone || '');
    setClientAddress(inv.clientAddress || '');
    setItems(inv.items && inv.items.length > 0 ? [...inv.items] : [{ serviceName: '', description: '', quantity: 1, unitPrice: 0, total: 0 }]);
    setDiscount(inv.discount || 0);
    setTax(inv.tax || 0);
    setTerms(inv.termsAndConditions || '');
    setNotes(inv.notes || '');
    setLinkedPaymentAlertId(inv.paymentAlertId);

    setEditingInvoiceId(inv.id);
    setIsEditing(true);
    setIsCreating(true);
  };

  const resetForm = () => {
    setClientType('existing');
    setSelectedClientId('');
    setNewClientName('');
    setNewClientCompany('');
    setNewClientEmail('');
    setNewClientPhone('');
    setClientAddress('');
    setItems([{ serviceName: '', description: '', quantity: 1, unitPrice: 0, total: 0 }]);
    setDiscount(0);
    setTax(0);
    setNotes('');
    setLinkedPaymentAlertId(undefined);
    setIsCreating(false);
    setIsEditing(false);
    setEditingInvoiceId(null);
  };

  const handleSaveInvoice = async () => {
    if (clientType === 'existing' && !selectedClientId) return alert("Please select an existing client.");
    if (clientType === 'new' && !newClientName.trim()) return alert("Please enter client contact person name.");
    if (items.some(i => !i.description.trim() && !i.serviceName?.trim())) return alert("All line items must have a service or description.");

    let finalClientName = '';
    let finalClientEmail = newClientEmail;
    let finalClientPhone = newClientPhone;
    let finalClientId = selectedClientId;

    if (clientType === 'existing' && selectedClientId) {
      const existingClient = clients.find(c => c.id === selectedClientId);
      finalClientName = existingClient?.companyName || existingClient?.name || newClientCompany || newClientName;

      try {
        await updateClientInDB(selectedClientId, {
          name: newClientName || existingClient?.name,
          companyName: newClientCompany || existingClient?.companyName,
          email: newClientEmail || existingClient?.email,
          mobile: newClientPhone || existingClient?.mobile
        });
      } catch (err) {
        console.error("Error updating existing client in DB:", err);
      }
    } else {
      try {
        const createdClient = await addClientToDB({
          name: newClientName,
          companyName: newClientCompany || newClientName,
          email: newClientEmail || 'No Email Registered',
          mobile: newClientPhone || 'Not Provided',
          serviceEnquired: 'Invoice Direct Entry',
          dateAdded: new Date().toISOString().split('T')[0],
          status: 'Active'
        });
        if (createdClient && createdClient.id) {
          finalClientId = createdClient.id;
        }
      } catch (err) {
        console.error("Error saving new client to DB:", err);
      }
      finalClientName = newClientCompany ? `${newClientName} (${newClientCompany})` : newClientName;
    }

    const invoiceData: Omit<Invoice, 'id'> = {
      invoiceNumber,
      issueDate,
      dueDate,
      clientId: finalClientId || undefined,
      clientName: finalClientName,
      clientEmail: finalClientEmail || undefined,
      clientPhone: finalClientPhone || undefined,
      clientAddress: clientAddress || undefined,
      paymentAlertId: linkedPaymentAlertId || undefined,
      items,
      subtotal,
      discount: discount || 0,
      tax: tax || 0,
      totalAmount,
      termsAndConditions: terms,
      notes: notes || undefined,
      status: isEditing ? (invoices.find(i => i.id === editingInvoiceId)?.status || 'Pending') : 'Pending',
      createdAt: new Date().toISOString()
    };

    try {
      if (isEditing && editingInvoiceId) {
        await updateInvoiceInDB(editingInvoiceId, invoiceData);
      } else {
        await addInvoiceToDB(invoiceData);
      }
      resetForm();
    } catch (err) {
      console.error("Error saving invoice:", err);
      alert("Failed to save invoice. Check console for details.");
    }
  };

  const handleStatusChange = async (inv: Invoice, newStatus: Invoice['status']) => {
    try {
      await updateInvoiceInDB(inv.id, { status: newStatus });

      if (newStatus === 'Received') {
        let matchingAlert = paymentAlerts.find(a => a.id === inv.paymentAlertId);
        if (!matchingAlert) {
          matchingAlert = paymentAlerts.find(a =>
            a.clientName.toLowerCase() === inv.clientName.toLowerCase() &&
            a.status !== 'received'
          );
        }

        if (matchingAlert) {
          await updatePaymentAlertInDB(matchingAlert.id, {
            status: 'received',
            resolvedAt: new Date().toISOString(),
            actualAmount: inv.totalAmount
          });
          await processAutomaticRevenue(matchingAlert, inv.totalAmount);
        } else {
          const dummyAlert: PaymentAlert = {
            id: inv.id,
            clientId: inv.clientId || '',
            clientName: inv.clientName,
            milestoneLabel: `Invoice ${inv.invoiceNumber}`,
            amount: inv.totalAmount,
            status: 'received',
            triggeredAt: new Date().toISOString(),
            type: 'standalone'
          };
          await processAutomaticRevenue(dummyAlert, inv.totalAmount);
        }
      }
    } catch (e) {
      console.error("Error updating invoice status:", e);
      alert("Failed to update status.");
    }
  };

  const confirmDelete = async () => {
    if (!deletingInvoiceId) return;
    try {
      await deleteInvoiceFromDB(deletingInvoiceId);
      setDeletingInvoiceId(null);
    } catch (e) {
      console.error("Error deleting invoice:", e);
      alert("Failed to delete invoice.");
    }
  };

  // -------------------------------------------------------------------------------- //
  // DIRECT PDF GENERATION LOGIC (MATCHING QUOTATION PDF FORMAT + BRAND FOOTER 1-TO-1)
  // -------------------------------------------------------------------------------- //
  const generateInvoicePDF = async (inv: Invoice) => {
    const doc = new jsPDF();
    const co = companyProfile;

    const deepEclipse: [number, number, number] = [10, 0, 40];    // #0A0028
    const textMuted: [number, number, number] = [100, 116, 139];  // Slate 500
    const lightGray: [number, number, number] = [226, 232, 240];  // Slate 200
    const royalPurple2: [number, number, number] = [108, 46, 247]; // #6C2EF7
    const white: [number, number, number] = [255, 255, 255];

    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const pageWidth = doc.internal.pageSize.width;

    // ==========================================
    // 1. HEADER SECTION — Brand Dark Band (Quotation PDF Style)
    // ==========================================
    doc.setFillColor(...deepEclipse);
    doc.rect(0, 0, pageWidth, 46, 'F');

    // Company Name — White, bold, left
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...white);
    doc.text(co?.companyName || 'Ash Creative Studio', 14, 18);

    let bandTextY = 23;
    if (co?.tagline && co.tagline.trim() !== "") {
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(200, 190, 230);
      doc.text(co.tagline, 14, bandTextY);
      bandTextY += 5;
    }

    // Company Contacts — sort: phone first, email second, address last
    if (co?.contacts && co.contacts.length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(180, 170, 210);

      const getContactPriority = (val: string) => {
        if (val.includes('@')) return 2;
        if (val.replace(/\D/g, '').length >= 10) return 1;
        return 3;
      };
      const sortedContacts = [...co.contacts].sort((a, b) => getContactPriority(a.value) - getContactPriority(b.value));

      sortedContacts.slice(0, 3).forEach(contact => {
        if (bandTextY < 42) {
          doc.text(contact.value, 14, bandTextY);
          bandTextY += 4.5;
        }
      });
    }

    // "INVOICE" Title — White, large, bold, right-aligned on band (EXACT QUOTATION FORMAT)
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...white);
    doc.text("INVOICE", pageWidth - 14, 28, { align: 'right' });

    // === INVOICE DETAILS ROW — Below the dark band ===
    const detailsY = 56;
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...deepEclipse);
    doc.text("Invoice No:", 14, detailsY);
    doc.text("Date:", 90, detailsY);
    doc.text("Due Date:", 155, detailsY);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textMuted);

    doc.text(inv.invoiceNumber, 34, detailsY);
    doc.text(formatDate(inv.issueDate), 104, detailsY);
    doc.text(formatDate(inv.dueDate), 175, detailsY);

    // === SEPARATOR LINE ===
    doc.setDrawColor(...lightGray);
    doc.setLineWidth(0.5);
    doc.line(14, detailsY + 5, pageWidth - 14, detailsY + 5);

    // ==========================================
    // 2. CLIENT DETAILS (INVOICE FOR)
    // ==========================================
    let maxHeaderY = detailsY + 15;
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.setFont("helvetica", "bold");
    doc.text("INVOICE FOR", 14, maxHeaderY);

    maxHeaderY += 6;
    doc.setFontSize(14);
    doc.setTextColor(...deepEclipse);
    doc.setFont("helvetica", "bold");
    doc.text(inv.clientName, 14, maxHeaderY);

    maxHeaderY += 5.5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textMuted);

    // 1. Address
    if (inv.clientAddress && inv.clientAddress.trim() !== "") {
      const cleanAddr = inv.clientAddress.replace(/^[,\s*]+|[,\s*]+$/g, '').trim();
      if (cleanAddr) {
        const splitAddress = doc.splitTextToSize(cleanAddr, 80);
        doc.text(splitAddress, 14, maxHeaderY);
        maxHeaderY += (splitAddress.length * 4.5);
      }
    }

    // 2. Phone / Mobile
    if (inv.clientPhone && inv.clientPhone.trim() !== "") {
      let cp = inv.clientPhone.replace(/[\*\,]/g, '');
      let digits = cp.replace(/[^\d+]/g, '');
      if (digits.length >= 10 && digits.length <= 15) {
        if (digits.startsWith('+91') && digits.length === 13) {
          cp = digits.replace(/(\+91)(\d{5})(\d{5})/, '$1 $2 $3');
        } else if (!digits.startsWith('+') && digits.length === 10) {
          cp = digits.replace(/(\d{5})(\d{5})/, '$1 $2');
        } else {
          cp = digits;
        }
      } else {
        cp = cp.replace(/\s+/g, ' ').trim();
      }

      if (cp) {
        doc.text(cp, 14, maxHeaderY);
        maxHeaderY += 4.5;
      }
    }

    // 3. Email
    if (inv.clientEmail && inv.clientEmail !== "No Email Registered" && inv.clientEmail.trim() !== "") {
      doc.text(inv.clientEmail.trim(), 14, maxHeaderY);
      maxHeaderY += 4.5;
    }

    // ==========================================
    // 3. ITEMS TABLE (SEPARATE SERVICE & DESCRIPTION COLUMNS)
    // ==========================================
    const tableBody = (inv.items || []).map((item, idx) => [
      (idx + 1).toString(),
      item.serviceName || 'General Service',
      item.description || '-',
      item.quantity.toString(),
      `Rs. ${item.unitPrice.toLocaleString('en-IN')}`,
      `Rs. ${item.total.toLocaleString('en-IN')}`
    ]);

    autoTable(doc, {
      startY: maxHeaderY + 6,
      head: [['#', 'Service', 'Description', 'Qty', 'Unit Price', 'Total']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: deepEclipse,
        textColor: white,
        fontStyle: 'bold',
        fontSize: 8.5
      },
      bodyStyles: {
        textColor: [30, 41, 59],
        fontSize: 8.5
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 42 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 14, halign: 'center' },
        4: { cellWidth: 30, halign: 'right' },
        5: { cellWidth: 32, halign: 'right' }
      },
      margin: { left: 14, right: 14 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 8;
    const totalsX = pageWidth - 75;
    let totY = finalY;

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);

    doc.text("Subtotal:", totalsX, totY);
    doc.text(`Rs. ${inv.subtotal.toLocaleString('en-IN')}`, pageWidth - 14, totY, { align: 'right' });
    totY += 5;

    if (inv.discount && inv.discount > 0) {
      doc.text("Discount:", totalsX, totY);
      doc.text(`- Rs. ${inv.discount.toLocaleString('en-IN')}`, pageWidth - 14, totY, { align: 'right' });
      totY += 5;
    }

    if (inv.tax && inv.tax > 0) {
      doc.text("Tax / GST:", totalsX, totY);
      doc.text(`+ Rs. ${inv.tax.toLocaleString('en-IN')}`, pageWidth - 14, totY, { align: 'right' });
      totY += 5;
    }

    doc.setFillColor(...deepEclipse);
    doc.roundedRect(totalsX - 4, totY, pageWidth - totalsX - 10, 8, 1, 1, 'F');
    doc.setTextColor(...white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("Total Amount:", totalsX, totY + 5.5);
    doc.text(`Rs. ${inv.totalAmount.toLocaleString('en-IN')}`, pageWidth - 16, totY + 5.5, { align: 'right' });

    totY += 16;

    if (inv.termsAndConditions) {
      doc.setTextColor(...deepEclipse);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Terms & Conditions:", 14, totY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const splitTerms = doc.splitTextToSize(inv.termsAndConditions, pageWidth - 28);
      doc.text(splitTerms, 14, totY + 5);
    }

    // ==========================================
    // 4. WATERMARK & DYNAMIC PAGINATED FOOTER (EXACT QUOTATION FORMAT)
    // ==========================================
    const watermarkBase64 = await loadWatermarkBase64('/public/ash-bg-logo.png');
    if (watermarkBase64) {
      stampWatermarkAllPages(doc, watermarkBase64);
    }

    const pageCount = doc.getNumberOfPages();
    const footerBandHeight = 28;

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const pageH = doc.internal.pageSize.height;
      const footerBandY = pageH - footerBandHeight;

      // Continuation Header for Page 2+
      if (i > 1) {
        doc.setFillColor(...deepEclipse);
        doc.rect(0, 0, pageWidth, 14, 'F');
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(co?.companyName || 'Ash Creative Studio', 14, 9);
        doc.text(`${inv.invoiceNumber} — continued`, pageWidth - 14, 9, { align: 'right' });
      }

      // Purple separator line
      doc.setDrawColor(...royalPurple2);
      doc.setLineWidth(0.6);
      doc.line(14, footerBandY, pageWidth - 14, footerBandY);

      // Company Name
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...deepEclipse);
      doc.text(co?.companyName || 'Ash Creative Studio', 14, footerBandY + 8);

      // Tagline
      if (co?.tagline && co.tagline.trim() !== "") {
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(...textMuted);
        doc.text(co.tagline, 14, footerBandY + 14);
      }

      // Page Number (Center)
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...royalPurple2);
      doc.text(`${i}/${pageCount}`, pageWidth / 2, footerBandY + 10, { align: 'center' });

      // Social Icons
      const fallbackIconMap: Record<string, string> = {
        instagram: 'instagram.png',
        facebook: 'Facebook.png',
        youtube: 'YouTube.png',
        linkedin: 'linkedin.png',
        behance: 'Behance.png',
        x: 'X.png',
        twitter: 'X.png',
        website: 'Website.png',
        whats: 'whatsapp.png',
        whatsapp: 'whatsapp.png',
      };
      const iconSize = 5;
      const spacing = 3;
      let rightX = pageWidth - 14;
      const iconY = footerBandY + 5;

      const socials = co?.socials ?? [];

      for (let s = socials.length - 1; s >= 0; s--) {
        const social = socials[s];
        const rawLabel = social.label ? social.label.toLowerCase().trim() : '';
        if (!rawLabel) continue;

        const labelKey = rawLabel.replace(/\s+/g, '_');
        const iconFile = fallbackIconMap[labelKey] || `${labelKey}.png`;
        const iconUrl = `/${iconFile}`;

        try {
          const resp = await fetch(iconUrl);
          if (!resp.ok) throw new Error('Icon not found');
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
        } catch {
          // Skip missing icon gracefully
        }
      }
    }

    doc.save(`${inv.invoiceNumber}_${inv.clientName.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* TOP STATS & ACTIONS HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="text-blue-600" size={22} />
            <span>Invoices</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Manage client billing, automated payment suggestions, and financial sync</p>
        </div>

        <button
          onClick={() => openCreateModal()}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all active:scale-[0.98]"
        >
          <Plus size={16} />
          <span>Create New Invoice</span>
        </button>
      </div>

      {/* METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Invoiced</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">₹{totalInvoiced.toLocaleString('en-IN')}</div>
          <span className="text-xs text-slate-500 font-medium mt-1 block">{invoices.length} Invoices</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Collected (Paid)</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">₹{totalCollected.toLocaleString('en-IN')}</div>
          <span className="text-xs text-emerald-600/80 font-medium mt-1 block">Synced to Accounts</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Receivable (Pending)</span>
          <div className="text-2xl font-bold text-amber-600 mt-1">₹{totalPending.toLocaleString('en-IN')}</div>
          <span className="text-xs text-amber-600/80 font-medium mt-1 block">Awaiting Payment</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Payment Suggestions</span>
          <div className="text-2xl font-bold text-indigo-600 mt-1">{suggestedAlerts.length}</div>
          <span className="text-xs text-indigo-600/80 font-medium mt-1 block">Pending from Payments</span>
        </div>
      </div>

      {/* SUGGESTED INVOICES FROM PAYMENTS */}
      {suggestedAlerts.length > 0 && (
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Suggested Invoices to Generate</h3>
              <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {suggestedAlerts.length} Pending
              </span>
            </div>
            <span className="text-xs text-slate-500">1-click invoice creation from Payments section</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {suggestedAlerts.map(alert => (
              <div
                key={alert.id}
                className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm hover:border-indigo-300 transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-slate-900">{alert.clientName}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-1.5 py-0.5 rounded uppercase">
                      {alert.type}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-700 line-clamp-1">
                    {alert.packageName || alert.taskName || 'Milestone Payment'}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Milestone: <span className="font-medium text-slate-700">{alert.milestoneLabel}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Amount</span>
                    <span className="text-sm font-bold text-slate-900">₹{alert.amount.toLocaleString('en-IN')}</span>
                  </div>

                  <button
                    onClick={() => openCreateModal(alert)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1 transition-all active:scale-[0.98]"
                  >
                    <span>Generate</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INVOICE HISTORY TABLE CONTAINER */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4 p-5">
        
        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
            {(['All', 'Pending', 'Received', 'Draft', 'Sent'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === tab
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Client or Invoice #..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-sm w-full sm:w-64"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Client Name</th>
                <th className="py-3 px-4">Issue Date</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-medium text-xs">
                    No invoices found matching your search.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {inv.clientName}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-medium">
                      {inv.issueDate}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-medium">
                      {inv.dueDate}
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-slate-900">
                      ₹{inv.totalAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        value={inv.status}
                        onChange={e => handleStatusChange(inv, e.target.value as Invoice['status'])}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none transition-all ${
                          inv.status === 'Received'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : inv.status === 'Pending'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : inv.status === 'Sent'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <option value="Draft">Draft</option>
                        <option value="Sent">Sent</option>
                        <option value="Pending">Pending</option>
                        <option value="Received">Received (Paid)</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => generateInvoicePDF(inv)}
                          className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg transition-all"
                          title="Download Letterhead PDF"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => handleEditClick(inv)}
                          className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg transition-all"
                          title="Edit Invoice"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeletingInvoiceId(inv.id)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg transition-all"
                          title="Delete Invoice"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT INVOICE MODAL */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl my-8 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="text-blue-600" size={18} />
                <span>{isEditing ? 'Edit Invoice' : 'Create New Invoice'}</span>
              </h2>
              <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {/* Client Type Selector */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-500 uppercase">CLIENT TYPE:</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setClientType('existing');
                      setSelectedClientId('');
                    }}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
                      clientType === 'existing'
                        ? 'bg-blue-50 text-blue-700 border-blue-300'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    Existing Client
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setClientType('new');
                      setSelectedClientId('');
                      setNewClientName('');
                      setNewClientCompany('');
                      setNewClientEmail('');
                      setNewClientPhone('');
                      setClientAddress('');
                    }}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
                      clientType === 'new'
                        ? 'bg-blue-50 text-blue-700 border-blue-300'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    New Client
                  </button>
                </div>
              </div>

              {clientType === 'existing' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Select Client *</label>
                  <select
                    value={selectedClientId}
                    onChange={e => handleClientSelect(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm font-semibold"
                  >
                    <option value="">-- Choose Client from DB --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.companyName ? `${c.companyName} (${c.name})` : c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Client Contact & Address Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Contact Person *</label>
                  <input
                    type="text"
                    value={newClientName}
                    onChange={e => setNewClientName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Company Name</label>
                  <input
                    type="text"
                    value={newClientCompany}
                    onChange={e => setNewClientCompany(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={newClientEmail}
                    onChange={e => setNewClientEmail(e.target.value)}
                    placeholder="client@acme.com"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={newClientPhone}
                    onChange={e => setNewClientPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                  />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Client Address</label>
                  <textarea
                    rows={2}
                    value={clientAddress}
                    onChange={e => setClientAddress(e.target.value)}
                    placeholder="Building / Street Address, City, State, Country, Pincode"
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Dates & Invoice Number */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Invoice #</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-blue-600 focus:outline-none focus:border-blue-500 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Issue Date</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={e => setIssueDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                />
              </div>
            </div>

            {/* Line Items: Service Dropdown + Description Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500 uppercase">LINE ITEMS & SERVICES</label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1 text-xs text-blue-600 font-bold hover:underline"
                >
                  <Plus size={13} />
                  <span>Add Line Item</span>
                </button>
              </div>

              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                      {/* Service Category Dropdown */}
                      <div className="md:col-span-4">
                        <select
                          value={item.serviceName || ''}
                          onChange={e => handleItemChange(idx, 'serviceName', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
                        >
                          <option value="">-- Select Service --</option>
                          {availableServices.map((srv, sIdx) => (
                            <option key={sIdx} value={srv}>{srv}</option>
                          ))}
                        </select>
                      </div>

                      {/* Service Details / Description Input */}
                      <div className="md:col-span-8">
                        <input
                          type="text"
                          placeholder="Specific description or milestone details..."
                          value={item.description}
                          onChange={e => handleItemChange(idx, 'description', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-1.5 border-t border-slate-200/60">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-semibold text-slate-500">Qty:</span>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-900 text-center focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-semibold text-slate-500">Unit Price (₹):</span>
                        <input
                          type="number"
                          value={item.unitPrice || ''}
                          onChange={e => handleItemChange(idx, 'unitPrice', e.target.value)}
                          className="w-28 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-900 text-right focus:outline-none focus:border-blue-500 font-semibold"
                        />
                      </div>

                      <div className="text-right font-extrabold text-xs text-slate-900 min-w-[90px]">
                        ₹{item.total.toLocaleString('en-IN')}
                      </div>

                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-400 hover:text-red-500 p-1"
                          title="Remove item"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Calculations & Discounts */}
            <div className="flex flex-col md:flex-row justify-between gap-4 pt-3 border-t border-slate-100">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Terms & Conditions</label>
                <textarea
                  rows={2}
                  value={terms}
                  onChange={e => setTerms(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                />
              </div>

              <div className="w-full md:w-56 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-slate-900">₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Discount (₹):</span>
                  <input
                    type="number"
                    value={discount || ''}
                    onChange={e => setDiscount(Number(e.target.value))}
                    className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-right text-xs text-slate-900 focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Tax / GST (₹):</span>
                  <input
                    type="number"
                    value={tax || ''}
                    onChange={e => setTax(Number(e.target.value))}
                    className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-right text-xs text-slate-900 focus:outline-none"
                  />
                </div>
                <div className="flex justify-between font-bold text-sm text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total:</span>
                  <span>₹{totalAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveInvoice}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm"
              >
                {isEditing ? 'Update Invoice' : 'Save Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deletingInvoiceId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-5 space-y-3 shadow-2xl text-center">
            <div className="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900">Delete Invoice?</h3>
            <p className="text-xs text-slate-500">Are you sure you want to delete this invoice? This action cannot be undone.</p>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setDeletingInvoiceId(null)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Invoices;
