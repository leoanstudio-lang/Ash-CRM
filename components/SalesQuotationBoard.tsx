import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Quotation, QuotationItem, CatalogService, CompanyProfile } from '../types';
import {
  FileText, Plus, Trash2, Download, ChevronDown, ChevronLeft,
  Save, Send, X, User, Phone, Mail, MapPin,
  Calendar, Search, Package, CheckCircle,
  AlertCircle, Pencil, Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight, List, ListOrdered
} from 'lucide-react';
import { addQuotationToDB, updateQuotationInDB, getCompanyProfile, generateProfessionalQuotationId, updateActiveDealInDB } from '../lib/db';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadWatermarkBase64, stampWatermarkAllPages } from '../lib/pdfWatermark';

interface SalesQuotationBoardProps {
  currentUser: { id: string; name: string; department: string };
  activeDeals?: any[];
  inboundActiveDeals?: any[];
  quotations?: Quotation[];
}

const DEFAULT_TERMS = `1. 50% Advance payment required to commence work.
2. Quotation is valid for 30 days from issue date.
3. Final deliverables securely handed over upon receipt of balance payment.
4. Revisions beyond the agreed scope will be billed additionally.
5. All prices are inclusive of applicable taxes unless stated otherwise.`;

const formatCurrency = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

const statusColor = (status: string) => {
  switch (status) {
    case 'Draft': return 'bg-slate-100 text-slate-600';
    case 'Sent': return 'bg-blue-100 text-blue-700';
    case 'Manager Approved': return 'bg-purple-100 text-purple-700';
    case 'Approved': return 'bg-emerald-100 text-emerald-700';
    case 'Rejected': return 'bg-red-100 text-red-700';
    default: return 'bg-slate-100 text-slate-500';
  }
};

const SalesQuotationBoard: React.FC<SalesQuotationBoardProps> = ({
  currentUser,
  activeDeals = [],
  inboundActiveDeals = [],
  quotations = [],
}) => {
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  useEffect(() => {
    const q = query(collection(db, 'catalog_services'));
    const unsub = onSnapshot(q, (snap) => {
      const list: CatalogService[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as CatalogService));
      setCatalogServices(list);
    });
    return () => unsub();
  }, []);

  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  useEffect(() => { getCompanyProfile().then(p => p && setCompanyProfile(p)); }, []);

  const [sourceFilter, setSourceFilter] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [isManualMode, setIsManualMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMarkingClientApproved, setIsMarkingClientApproved] = useState(false);

  const [clientName, setClientName] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [validityDate, setValidityDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [lineItems, setLineItems] = useState<(QuotationItem & { _catalogDescription?: string })[]>([]);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
  const [terms, setTerms] = useState(DEFAULT_TERMS);
  const [projectNotes, setProjectNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const projectNotesRef = useRef<HTMLDivElement>(null);

  const executeProjectNotesCommand = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    if (projectNotesRef.current) {
      setProjectNotes(projectNotesRef.current.innerHTML);
    }
  };

  useEffect(() => {
    if (projectNotesRef.current && projectNotesRef.current.innerHTML !== projectNotes) {
      projectNotesRef.current.innerHTML = projectNotes;
    }
  }, [projectNotes]);

  useEffect(() => {
    if (!selectedQuotation) {
      setHasChanges(false);
      return;
    }
    const origItems = selectedQuotation.items || [];
    const itemsChanged = JSON.stringify(lineItems.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total
    }))) !== JSON.stringify(origItems.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total
    })));

    const clientNameChanged = clientName !== selectedQuotation.clientName;
    const clientCompanyChanged = clientCompany !== (selectedQuotation.clientCompany || '');
    const clientEmailChanged = clientEmail !== (selectedQuotation.clientEmail || '');
    const clientPhoneChanged = clientPhone !== (selectedQuotation.clientPhone || '');
    const clientAddressChanged = clientAddress !== (selectedQuotation.clientAddress || '');
    const discountChanged = discount !== (selectedQuotation.discount || 0);
    const discountTypeChanged = discountType !== (selectedQuotation.discountType || 'flat');
    const termsChanged = terms !== (selectedQuotation.termsAndConditions || '');
    const projectNotesChanged = projectNotes !== ((selectedQuotation as any).projectNotes || '');

    if (clientNameChanged || clientCompanyChanged || clientEmailChanged || clientPhoneChanged || clientAddressChanged || discountChanged || discountTypeChanged || termsChanged || projectNotesChanged || itemsChanged) {
      setHasChanges(true);
    } else {
      setHasChanges(false);
    }
  }, [clientName, clientCompany, clientEmail, clientPhone, clientAddress, discount, discountType, terms, projectNotes, lineItems, selectedQuotation]);

  const quotationDeals = useMemo(() => {
    const outbound = activeDeals
      .filter(d => d.outboundStage === 'Quotation')
      .map(d => ({ ...d, _source: 'Outbound' as const }));
    const inbound = inboundActiveDeals
      .filter(d => d.outboundStage === 'Quotation')
      .map(d => ({ ...d, _source: 'Inbound' as const }));
    return [...inbound, ...outbound];
  }, [activeDeals, inboundActiveDeals]);

  const filteredDeals = useMemo(() => {
    let deals = quotationDeals;
    if (sourceFilter === 'inbound') deals = deals.filter(d => d._source === 'Inbound');
    if (sourceFilter === 'outbound') deals = deals.filter(d => d._source === 'Outbound');
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      deals = deals.filter(d =>
        (d.contactName || d.name || '').toLowerCase().includes(q) ||
        (d.companyName || '').toLowerCase().includes(q)
      );
    }
    return deals;
  }, [quotationDeals, sourceFilter, searchTerm]);

  // Fix 4: Manual quotations — only show when filter is 'all', and only this employee's
  const myDealIds = useMemo(() => new Set([
    ...activeDeals.map(d => d.id),
    ...inboundActiveDeals.map(d => d.id),
  ]), [activeDeals, inboundActiveDeals]);

  const manualQuotations = useMemo(() =>
    // Fix 3: show only quotations created by this employee (no salesDealId + createdByEmployeeId matches)
    quotations.filter(q => !q.salesDealId && (q as any).createdByEmployeeId === currentUser.id),
    [quotations, currentUser.id]
  );

  const getLinkedQuotation = (dealId: string) =>
    quotations.find(q => q.salesDealId === dealId && q.status !== 'Rejected');

  const subtotal = lineItems.reduce((acc, item) => acc + (item.total || 0), 0);
  const discountAmount = discountType === 'percent'
    ? Math.round((subtotal * discount) / 100)
    : discount;
  const grandTotal = Math.max(0, subtotal - discountAmount);

  const resetForm = () => {
    setClientName(''); setClientCompany(''); setClientEmail('');
    setClientPhone(''); setClientAddress('');
    setIssueDate(new Date().toISOString().split('T')[0]);
    setValidityDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setLineItems([]); setDiscount(0); setDiscountType('flat');
    setTerms(DEFAULT_TERMS); setProjectNotes(''); setInternalNotes('');
    setSelectedQuotation(null); setServiceSearch(''); setServiceDropdownOpen(false);
  };

  const loadQuotationIntoForm = (q: Quotation) => {
    setSelectedQuotation(q);
    setClientName(q.clientName || '');
    setClientCompany('');
    setClientEmail(q.clientEmail || '');
    setClientPhone(q.clientPhone || '');
    setClientAddress(q.clientAddress || '');
    setIssueDate(q.issueDate || new Date().toISOString().split('T')[0]);
    setValidityDate(q.validityDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setLineItems((q.items || []).map(item => ({ ...item, _catalogDescription: '' })));
    setDiscount(q.discount || 0);
    setTerms(q.termsAndConditions || DEFAULT_TERMS);
    setProjectNotes((q as any).projectNotes || '');
    setInternalNotes('');
  };

  const openDealQuotation = (deal: any) => {
    setSelectedDealId(deal.id);
    setIsManualMode(false);
    const linked = getLinkedQuotation(deal.id);
    if (linked) {
      loadQuotationIntoForm(linked);
    } else {
      resetForm();
      setClientName(deal.contactName || deal.name || '');
      setClientCompany(deal.companyName || deal.projectName || '');
      setClientEmail(deal.email || '');
      setClientPhone(deal.mobile || '');
      setSelectedQuotation(null);
    }
  };

  const openManualQuotation = (q: Quotation) => {
    setSelectedDealId(null);
    setIsManualMode(true);
    loadQuotationIntoForm(q);
  };

  const openCreateManual = () => {
    setSelectedDealId(null);
    setIsManualMode(true);
    setSelectedQuotation(null);
    resetForm();
  };

  const addServiceFromCatalog = (service: CatalogService) => {
    const newItem: QuotationItem & { _catalogDescription: string } = {
      description: service.name,
      quantity: 1,
      unitPrice: service.price || 0,
      total: service.price || 0,
      _catalogDescription: service.description || '',
    };
    setLineItems(prev => [...prev, newItem]);
    setServiceDropdownOpen(false);
    setServiceSearch('');
  };

  const addCustomLine = () => {
    setLineItems(prev => [...prev, { description: '', quantity: 1, unitPrice: 0, total: 0, _catalogDescription: '' }]);
  };

  const updateLineItem = (idx: number, field: string, value: any) => {
    setLineItems(prev => {
      const updated = [...prev];
      const item = { ...updated[idx], [field]: value } as any;
      if (field === 'quantity' || field === 'unitPrice') {
        item.total = (item.quantity || 0) * (item.unitPrice || 0);
      }
      updated[idx] = item;
      return updated;
    });
  };

  const removeLineItem = (idx: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async (status: 'Draft' | 'Sent') => {
    if (!clientName.trim()) return alert('Please enter a client name.');
    if (lineItems.length === 0) return alert('Please add at least one service.');
    setIsSaving(true);
    try {
      const deal = selectedDealId ? quotationDeals.find(d => d.id === selectedDealId) : null;
      const linked = selectedDealId ? getLinkedQuotation(selectedDealId) : null;
      const quotationToUpdate = selectedQuotation || linked;
      const qNumber = quotationToUpdate?.quotationNumber || await generateProfessionalQuotationId();

      const payload: Omit<Quotation, 'id'> = {
        quotationNumber: qNumber,
        issueDate,
        validityDate,
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim(),
        clientPhone: clientPhone.trim(),
        clientAddress: clientAddress.trim(),
        items: lineItems.map(item => ({
          description: item._catalogDescription
            ? `${item.description}\n${item._catalogDescription}`
            : item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
        subtotal,
        discount: discountAmount,
        totalAmount: grandTotal,
        termsAndConditions: terms,
        status,
        createdAt: quotationToUpdate?.createdAt || new Date().toISOString(),
        isNewClient: !deal?.clientId,
        salesDealId: selectedDealId || undefined,
        salesType: deal ? (deal._source as 'Inbound' | 'Outbound') : undefined,
        // Fix 3: track which employee created this
        createdByEmployeeId: currentUser.id,
        projectNotes: projectNotes.trim() || undefined,
        isUpdated: (status === 'Sent' && quotationToUpdate && ['Manager Approved', 'Approved'].includes(quotationToUpdate.status)) 
          ? true 
          : (quotationToUpdate as any)?.isUpdated || false,
      } as any;

      if (quotationToUpdate) {
        await updateQuotationInDB(quotationToUpdate.id, payload as any);
        setSelectedQuotation({ ...quotationToUpdate, ...payload } as any);
      } else {
        const newId = await addQuotationToDB(payload as any);
        if (newId) setSelectedQuotation({ id: newId, ...payload } as any);
      }
      alert(status === 'Draft'
        ? '✅ Saved as Draft! Admin will review and approve.'
        : '✅ Marked as Sent to client!');
    } catch (err) {
      console.error(err);
      alert('Error saving quotation. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Fix 1: accept explicit notes param so current state always wins regardless of q object
  const generateQuotationPDF = async (q: Quotation, notes?: string) => {
    const doc = new jsPDF();
    const co = companyProfile;
    const deepEclipse: [number, number, number] = [10, 0, 40];
    const textMuted: [number, number, number] = [100, 116, 139];
    const lightGray: [number, number, number] = [226, 232, 240];

    const cleanHTMLToPlainText = (html: string) => {
      if (!html) return '';
      let text = html;
      text = text.replace(/<li[^>]*>/gi, '  • ');
      text = text.replace(/<\/li>/gi, '\n');
      text = text.replace(/<(p|div|h1|h2|h3|h4|h5|h6)[^>]*>/gi, '');
      text = text.replace(/<\/(p|div|h1|h2|h3|h4|h5|h6)>/gi, '\n');
      text = text.replace(/<br\s*\/?>/gi, '\n');
      text = text.replace(/<[^>]*>/g, '');
      text = text.replace(/&nbsp;/g, ' ')
                 .replace(/&amp;/g, '&')
                 .replace(/&lt;/g, '<')
                 .replace(/&gt;/g, '>')
                 .replace(/&quot;/g, '"');
      return text.trim();
    };
    const pageWidth = doc.internal.pageSize.width;
    const white: [number, number, number] = [255, 255, 255];
    const royalPurple2: [number, number, number] = [108, 46, 247];

    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    doc.setFillColor(...deepEclipse);
    doc.rect(0, 0, pageWidth, 46, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...white);
    doc.text(co?.companyName || 'Ash Creative Studio', 14, 18);
    let bandTextY = 23;
    if (co?.tagline && co.tagline.trim() !== '') {
      doc.setFontSize(8); doc.setFont('helvetica', 'italic');
      doc.setTextColor(200, 190, 230);
      doc.text(co.tagline, 14, bandTextY); bandTextY += 5;
    }
    if (co?.contacts && co.contacts.length > 0) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      doc.setTextColor(180, 170, 210);
      const getP = (v: string) => v.includes('@') ? 2 : v.replace(/\D/g, '').length >= 10 ? 1 : 3;
      const sorted = [...co.contacts].sort((a, b) => getP(a.value) - getP(b.value));
      sorted.slice(0, 3).forEach(c => { if (bandTextY < 42) { doc.text(c.value, 14, bandTextY); bandTextY += 4.5; } });
    }
    doc.setFontSize(24); doc.setFont('helvetica', 'bold');
    doc.setTextColor(...white);
    doc.text('QUOTATION', pageWidth - 14, 28, { align: 'right' });

    const detailsY = 56;
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...deepEclipse);
    doc.text('Quote No:', 14, detailsY); doc.text('Date:', 90, detailsY); doc.text('Valid Until:', 155, detailsY);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMuted);
    doc.text(q.quotationNumber, 34, detailsY);
    doc.text(formatDate(q.issueDate), 104, detailsY);
    doc.text(formatDate(q.validityDate), 175, detailsY);
    doc.setDrawColor(...lightGray); doc.setLineWidth(0.5);
    doc.line(14, detailsY + 5, pageWidth - 14, detailsY + 5);

    let maxHeaderY = detailsY + 15;
    doc.setFontSize(8); doc.setTextColor(...textMuted); doc.setFont('helvetica', 'bold');
    doc.text('QUOTATION FOR', 14, maxHeaderY); maxHeaderY += 6;
    doc.setFontSize(14); doc.setTextColor(...deepEclipse); doc.setFont('helvetica', 'bold');
    doc.text(q.clientName, 14, maxHeaderY); maxHeaderY += 5.5;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMuted);
    if (q.clientAddress?.trim()) {
      const clean = q.clientAddress.replace(/^[,\s*]+|[,\s*]+$/g, '').trim();
      if (clean) { const sp = doc.splitTextToSize(clean, 80); doc.text(sp, 14, maxHeaderY); maxHeaderY += sp.length * 4.5; }
    }
    if (q.clientPhone?.trim()) {
      let cp = q.clientPhone.replace(/[\*\,]/g, '');
      const digits = cp.replace(/[^\d+]/g, '');
      if (digits.length >= 10 && digits.length <= 15) {
        cp = digits.startsWith('+91') && digits.length === 13 ? digits.replace(/(\+91)(\d{5})(\d{5})/, '$1 $2 $3')
          : !digits.startsWith('+') && digits.length === 10 ? digits.replace(/(\d{5})(\d{5})/, '$1 $2') : digits;
      }
      if (cp) { doc.text(cp, 14, maxHeaderY); maxHeaderY += 4.5; }
    }
    if (q.clientEmail?.trim()) { doc.text(q.clientEmail.trim(), 14, maxHeaderY); maxHeaderY += 4.5; }

    const tableBody = q.items.map((item, idx) => [idx + 1, item.description, item.quantity, `Rs. ${item.unitPrice.toLocaleString()}`, `Rs. ${item.total.toLocaleString()}`]);
    autoTable(doc, {
      startY: maxHeaderY + 8,
      head: [['#', 'DESCRIPTION', 'QTY', 'UNIT PRICE', 'TOTAL']],
      body: tableBody, theme: 'plain',
      headStyles: { fillColor: [248, 250, 252], textColor: textMuted, fontStyle: 'bold', fontSize: 8, halign: 'left' },
      bodyStyles: { fontSize: 9, textColor: deepEclipse },
      columnStyles: { 0: { cellWidth: 12, halign: 'left' }, 1: { cellWidth: 83, halign: 'left' }, 2: { cellWidth: 15, halign: 'center' }, 3: { cellWidth: 35, halign: 'right' }, 4: { cellWidth: 35, halign: 'right', fontStyle: 'bold', textColor: deepEclipse } },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      // Fix 1: add top margin so page 2+ content clears the 14mm mini-header
      margin: { top: 20, left: 14, right: 14, bottom: 40 },
      didParseCell: (data) => {
        if (data.section === 'head' && (data.column.index === 3 || data.column.index === 4)) data.cell.styles.halign = 'right';
        if (data.section === 'head' && data.column.index === 2) data.cell.styles.halign = 'center';
      },
      didDrawPage: (data) => { doc.setDrawColor(...lightGray); doc.setLineWidth(0.5); doc.line(14, data.settings.startY, 196, data.settings.startY); },
      didDrawCell: (data) => { if (data.row.section === 'body') { doc.setDrawColor(241, 245, 249); doc.setLineWidth(0.5); doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height); } }
    });

    let finalY = (doc as any).lastAutoTable.finalY + 10;
    const pageHeight = doc.internal.pageSize.height;
    if (finalY > pageHeight - 75) { doc.addPage(); finalY = 20; }
    const rightEdge = 196; const totalsBoxX = 135; let totalsY = finalY;
    doc.setFontSize(9); doc.setTextColor(...textMuted); doc.setFont('helvetica', 'normal');
    doc.text('Subtotal', totalsBoxX, totalsY);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...deepEclipse);
    doc.text(`Rs. ${q.subtotal.toLocaleString()}`, rightEdge, totalsY, { align: 'right' });
    if (q.discount && q.discount > 0) {
      totalsY += 8;
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMuted); doc.text('Discount', totalsBoxX, totalsY);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(225, 29, 72);
      doc.text(`-Rs. ${q.discount.toLocaleString()}`, rightEdge, totalsY, { align: 'right' });
    }
    totalsY += 8;
    doc.setDrawColor(...lightGray); doc.setLineWidth(0.5); doc.line(totalsBoxX, totalsY, rightEdge, totalsY);
    totalsY += 8;
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...deepEclipse);
    doc.text('TOTAL AMOUNT', totalsBoxX, totalsY);
    doc.setFontSize(14); doc.text(`Rs. ${q.totalAmount.toLocaleString()}`, rightEdge, totalsY, { align: 'right' });

    // Fix 2 Project Notes in PDF — between totals and terms (explicit param wins)
    const pNotes = cleanHTMLToPlainText((notes || '').trim() || ((q as any).projectNotes || '').trim());
    if (pNotes && pNotes.trim()) {
      let notesY = totalsY + 15;
      if (notesY > pageHeight - 60) { doc.addPage(); notesY = 20; }
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...deepEclipse);
      doc.text('PROJECT NOTES', 14, notesY); notesY += 5;
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMuted);
      const splitNotes = doc.splitTextToSize(pNotes.trim(), 175);
      doc.text(splitNotes, 14, notesY, { lineHeightFactor: 1.6 });
      totalsY = notesY + (splitNotes.length * 5.5);
    }

    let termsY = totalsY + 15;
    if (termsY > pageHeight - 50) { doc.addPage(); termsY = 20; }
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...deepEclipse);
    doc.text('TERMS & CONDITIONS', 14, termsY); termsY += 5;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...textMuted);
    const splitTerms = doc.splitTextToSize(q.termsAndConditions, 100);
    doc.text(splitTerms, 14, termsY, { lineHeightFactor: 1.5 });

    const watermarkB64 = await loadWatermarkBase64();
    stampWatermarkAllPages(doc, watermarkB64);
    const pageCount = doc.getNumberOfPages();
    const footerBandHeight = 28;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const ph = doc.internal.pageSize.height;
      const footerBandY = ph - footerBandHeight;
      if (i > 1) {
        doc.setFillColor(...deepEclipse); doc.rect(0, 0, pageWidth, 14, 'F');
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
        doc.text(co?.companyName || 'Your Company', 14, 9);
        doc.text(`${q.quotationNumber} — continued`, pageWidth - 14, 9, { align: 'right' });
      }
      doc.setDrawColor(...royalPurple2); doc.setLineWidth(0.6);
      doc.line(14, footerBandY, pageWidth - 14, footerBandY);
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...deepEclipse);
      doc.text(co?.companyName || 'Your Company', 14, footerBandY + 8);
      if (co?.tagline?.trim()) {
        doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(...textMuted);
        doc.text(co.tagline, 14, footerBandY + 14);
      }
      if (pageCount > 1) {
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...royalPurple2);
        doc.text(`${i}/${pageCount}`, pageWidth / 2, footerBandY + 10, { align: 'center' });
      }
      const fallbackIconMap: Record<string, string> = { instagram: 'instagram.png', facebook: 'Facebook.png', youtube: 'YouTube.png', linkedin: 'linkedin.png', behance: 'Behance.png', x: 'X.png', twitter: 'X.png', website: 'Website.png', whats: 'whatsapp.png', whatsapp: 'whatsapp.png' };
      const iconSize = 5; const spacing = 3; let rightX = pageWidth - 14; const iconY = footerBandY + 5;
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
          const b64: string = await new Promise((res, rej) => { const reader = new FileReader(); reader.onloadend = () => typeof reader.result === 'string' ? res(reader.result) : rej(); reader.onerror = rej; reader.readAsDataURL(blob); });
          const iconX = rightX - iconSize;
          doc.addImage(b64, 'PNG', iconX, iconY, iconSize, iconSize);
          const url = social.value.startsWith('http') ? social.value : `https://${social.value}`;
          doc.link(iconX, iconY, iconSize, iconSize, { url });
          rightX -= (iconSize + spacing);
        } catch { /* skip */ }
      }
    }
    const safeName = q.clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`Quotation_${safeName}_${q.quotationNumber}.pdf`);
  };

  // Removed handleMarkClientApproved as it is now done dynamically via status dropdown select

  const buildCurrentQuotation = (): Quotation | null => {
    const linked = selectedDealId ? getLinkedQuotation(selectedDealId) : selectedQuotation;
    if (!linked) return null;
    return {
      ...linked,
      clientName, clientEmail, clientPhone, clientAddress,
      issueDate, validityDate,
      items: lineItems.map(item => ({
        description: item._catalogDescription ? `${item.description}\n${item._catalogDescription}` : item.description,
        quantity: item.quantity, unitPrice: item.unitPrice, total: item.total,
      })),
      subtotal, discount: discountAmount, totalAmount: grandTotal,
      termsAndConditions: terms,
      // Pass notes into PDF builder
      projectNotes,
    } as any;
  };

  const isBuilderOpen = selectedDealId !== null || isManualMode;

  return (
    <div className="flex h-full overflow-hidden bg-slate-50">
      {/* LEFT PANEL */}
      <div className={`flex flex-col bg-white border-r border-slate-200 shrink-0 overflow-hidden transition-all duration-300 ${isBuilderOpen ? 'w-72' : 'w-full max-w-lg'}`}>
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">My Quotations</h2>
              <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Deals in Quotation stage</p>
            </div>
            <button onClick={openCreateManual} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm shadow-indigo-200">
              <Plus size={12} /> New
            </button>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <input type="text" placeholder="Search deals..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-medium outline-none focus:ring-2 focus:ring-indigo-400 transition-all" />
          </div>
          <div className="flex gap-1.5">
            {(['all', 'inbound', 'outbound'] as const).map(f => (
              <button key={f} onClick={() => setSourceFilter(f)} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${sourceFilter === f ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredDeals.length > 0 && (
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Pipeline Deals</p>
              {filteredDeals.map(deal => {
                const linked = getLinkedQuotation(deal.id);
                const isSelected = selectedDealId === deal.id;
                return (
                  <button key={deal.id} onClick={() => openDealQuotation(deal)} className={`w-full text-left p-3 rounded-xl border transition-all mb-2 ${isSelected ? 'bg-indigo-50 border-indigo-300 shadow-sm' : 'bg-white border-slate-100 hover:border-indigo-200 hover:bg-slate-50'}`}>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black text-slate-800 truncate">{deal.contactName || deal.name || 'Unknown'}</p>
                        <p className="text-[9px] text-slate-400 truncate mt-0.5">{deal.companyName || deal.projectName || '—'}</p>
                      </div>
                      <span className={`shrink-0 px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${deal._source === 'Inbound' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>{deal._source}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-slate-500">{deal.value ? formatCurrency(deal.value) : 'Est. TBD'}</span>
                      {linked ? (
                        <span className={`flex items-center gap-1 text-[8px] font-black px-1.5 py-0.5 rounded ${statusColor(linked.status)}`}><CheckCircle size={8} /> {linked.quotationNumber}</span>
                      ) : (
                        <span className="text-[8px] text-slate-400 italic">No quote yet</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {/* Fix 4: Manual Quotations ONLY shown when filter is 'all' */}
          {sourceFilter === 'all' && manualQuotations.length > 0 && (
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 mt-3">Manual Quotations</p>
              {manualQuotations.map(q => (
                <button key={q.id} onClick={() => openManualQuotation(q)} className={`w-full text-left p-3 rounded-xl border transition-all mb-2 ${selectedQuotation?.id === q.id && isManualMode ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-100 hover:border-indigo-200'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black text-slate-800 truncate">{q.clientName}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">{q.quotationNumber}</p>
                    </div>
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[8px] font-black ${statusColor(q.status)}`}>{q.status}</span>
                  </div>
                  <p className="text-[10px] font-black text-slate-700 mt-1.5">{formatCurrency(q.totalAmount)}</p>
                </button>
              ))}
            </div>
          )}
          {/* Fix 4: empty state accounts for filter */}
          {filteredDeals.length === 0 && (sourceFilter !== 'all' || manualQuotations.length === 0) && (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4"><FileText className="text-slate-300" size={24} /></div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No Quotation Deals</p>
              <p className="text-[10px] text-slate-300 mt-1">Move deals to "Quotation" stage<br />or create a manual quotation</p>
              <button onClick={openCreateManual} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">
                <Plus size={10} className="inline mr-1" /> Create Manual
              </button>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Quotation Builder */}
      {isBuilderOpen && (
        <div className="flex-1 overflow-y-auto bg-slate-50">
          <div className="max-w-3xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <button onClick={() => { setSelectedDealId(null); setIsManualMode(false); setSelectedQuotation(null); }} className="p-2 rounded-xl hover:bg-slate-200 text-slate-500 transition-all">
                  <ChevronLeft size={16} />
                </button>
                <div>
                  <h2 className="text-base font-black text-slate-900">{selectedQuotation?.quotationNumber || (isManualMode && !selectedQuotation ? 'New Quotation' : 'Quotation Builder')}</h2>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">{isManualMode && !selectedDealId ? 'Manual Quotation' : `Sales Deal • ${quotationDeals.find(d => d.id === selectedDealId)?._source || ''}`}</p>
                </div>
              </div>
              {selectedQuotation && (
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${statusColor(selectedQuotation.status)}`}>{selectedQuotation.status}</span>
              )}
            </div>

            {selectedQuotation && ['Draft', 'Sent'].includes(selectedQuotation.status) && (
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl mb-5">
                <AlertCircle className="text-amber-500 shrink-0" size={16} />
                <div>
                  <p className="text-[11px] font-black text-amber-700">PDF available after Manager Approval</p>
                  <p className="text-[10px] text-amber-600 mt-0.5">Manager reviews and approves → then you can download the branded PDF.</p>
                </div>
              </div>
            )}

            {/* Manager Approved Alert */}
            {selectedQuotation && selectedQuotation.status === 'Manager Approved' && !hasChanges && (
              <div className="flex items-center gap-3 p-4 bg-purple-50 border border-purple-200 rounded-2xl mb-5">
                <CheckCircle className="text-purple-500 shrink-0" size={16} />
                <div>
                  <p className="text-[11px] font-black text-purple-700">✓ Approved by Manager</p>
                  <p className="text-[10px] text-purple-600 mt-0.5">You can now download the PDF and send it to the client. Update client decision status below.</p>
                </div>
              </div>
            )}

            {/* Client Approved Badge */}
            {selectedQuotation && selectedQuotation.status === 'Approved' && !hasChanges && (
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl mb-5">
                <CheckCircle className="text-emerald-500 shrink-0" size={16} />
                <div>
                  <p className="text-[11px] font-black text-emerald-700">✅ Quotation Approved by Client</p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">Client has confirmed. The Kanban card is marked with the approval badge.</p>
                </div>
              </div>
            )}

            {/* Client Rejected Badge */}
            {selectedQuotation && selectedQuotation.status === 'Rejected' && !hasChanges && (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl mb-5">
                <AlertCircle className="text-red-500 shrink-0" size={16} />
                <div>
                  <p className="text-[11px] font-black text-red-700">❌ Quotation Rejected by Client</p>
                  <p className="text-[10px] text-red-600 mt-0.5">Client rejected this quotation. The Kanban card is updated.</p>
                </div>
              </div>
            )}

            {/* Warning Alert if previously approved and now edited */}
            {selectedQuotation && ['Manager Approved', 'Approved'].includes(selectedQuotation.status) && hasChanges && (
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl mb-5">
                <AlertCircle className="text-amber-500 shrink-0" size={16} />
                <div>
                  <p className="text-[11px] font-black text-amber-700">⚠️ Changes Made After Approval</p>
                  <p className="text-[10px] text-amber-600 mt-0.5">You have edited this quotation. You must click <b>"Send Updated"</b> to resend it to the Manager for re-approval. The download option will be available once approved.</p>
                </div>
              </div>
            )}

            {/* Client Status Feedback Selector */}
            {selectedQuotation && ['Manager Approved', 'Approved', 'Rejected'].includes(selectedQuotation.status) && !hasChanges && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <CheckCircle size={12} className="text-indigo-500" /> Record Client Decision
                </h3>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
                  <div className="text-[11px] text-slate-500 font-medium">
                    Select the status based on client's direct feedback:
                  </div>
                  <select
                    value={selectedQuotation.status}
                    onChange={async (e) => {
                      const newStatus = e.target.value as any;
                      setIsSaving(true);
                      try {
                        await updateQuotationInDB(selectedQuotation.id, { status: newStatus });
                        if (selectedDealId) {
                          await updateActiveDealInDB(selectedDealId, {
                            quotationClientApproved: newStatus === 'Approved'
                          });
                        }
                        setSelectedQuotation(prev => prev ? { ...prev, status: newStatus } : null);
                        alert(`✅ Quotation status updated to: ${newStatus === 'Approved' ? 'Approved by Client' : newStatus === 'Rejected' ? 'Rejected by Client' : 'Waiting for Client'}`);
                      } catch (err) {
                        console.error(err);
                        alert('Error updating status.');
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                    className="w-full sm:w-60 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
                  >
                    <option value="Manager Approved">Waiting for Client (Manager Approved)</option>
                    <option value="Approved">Approved by Client</option>
                    <option value="Rejected">Rejected by Client</option>
                  </select>
                </div>
              </div>
            )}

            {/* Client Details */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><User size={12} /> Client Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Client Name <span className="text-red-500">*</span></label>
                  <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Contact name" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-400 transition-all" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Company Name</label>
                  <input type="text" value={clientCompany} onChange={e => setClientCompany(e.target.value)} placeholder="Company / Organisation" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-400 transition-all" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1"><Phone size={9} className="inline mr-1" /> Phone</label>
                  <input type="text" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="Mobile number" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-400 transition-all" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1"><Mail size={9} className="inline mr-1" /> Email</label>
                  <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="Email address" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-400 transition-all" />
                </div>
                <div className="col-span-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1"><MapPin size={9} className="inline mr-1" /> Address (Optional)</label>
                  <input type="text" value={clientAddress} onChange={e => setClientAddress(e.target.value)} placeholder="Billing / mailing address" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-400 transition-all" />
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Calendar size={12} /> Quotation Dates</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Issue Date</label>
                  <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-400 transition-all" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Valid Until</label>
                  <input type="date" value={validityDate} onChange={e => setValidityDate(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-400 transition-all" />
                </div>
              </div>
            </div>

            {/* Services */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Package size={12} /> Services / Line Items</h3>
                <div className="flex gap-2">
                  <div className="relative">
                    <button onClick={() => setServiceDropdownOpen(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                      <Plus size={10} /> From Catalog <ChevronDown size={10} />
                    </button>
                    {serviceDropdownOpen && (
                      <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                        <div className="p-3 border-b border-slate-100">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={11} />
                            <input type="text" value={serviceSearch} onChange={e => setServiceSearch(e.target.value)} placeholder="Search services..." className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] outline-none focus:ring-2 focus:ring-indigo-400" autoFocus />
                          </div>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {catalogServices.filter(s => !serviceSearch || s.name.toLowerCase().includes(serviceSearch.toLowerCase())).map(s => (
                            <button key={s.id} onClick={() => addServiceFromCatalog(s)} className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-all border-b border-slate-50 last:border-none">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-[11px] font-black text-slate-800">{s.name}</p>
                                  <p className="text-[9px] text-slate-400 mt-0.5">{s.category}</p>
                                </div>
                                <span className="shrink-0 text-[10px] font-black text-indigo-600">{formatCurrency(s.price || 0)}</span>
                              </div>
                            </button>
                          ))}
                          {catalogServices.filter(s => !serviceSearch || s.name.toLowerCase().includes(serviceSearch.toLowerCase())).length === 0 && (
                            <p className="text-center text-[10px] text-slate-400 py-6">No services found</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <button onClick={addCustomLine} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                    <Plus size={10} /> Custom
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {lineItems.length === 0 && (
                  <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <Package className="text-slate-200 mx-auto mb-2" size={24} />
                    <p className="text-[10px] text-slate-400 font-bold">Add services using the buttons above</p>
                  </div>
                )}
                {lineItems.map((item, idx) => (
                  <div key={idx} className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0">{idx + 1}</span>
                      <input type="text" value={item.description} onChange={e => updateLineItem(idx, 'description', e.target.value)} placeholder="Service name" className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-indigo-400 transition-all" />
                      <button onClick={() => removeLineItem(idx)} className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={14} /></button>
                    </div>
                    <div className="mb-3">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                        Description / Scope of Work
                        {item._catalogDescription && <span className="ml-1 normal-case font-medium text-indigo-400">(auto-filled from catalog, editable)</span>}
                      </label>
                      <textarea value={item._catalogDescription || ''} onChange={e => updateLineItem(idx, '_catalogDescription', e.target.value)} placeholder="Describe what's included for this client: e.g. 3 ad creative sets, A/B testing, monthly report..." rows={3} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] text-slate-700 font-medium outline-none focus:ring-2 focus:ring-indigo-400 transition-all resize-none" />
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Qty</label>
                        <input type="number" min={1} value={item.quantity} onChange={e => updateLineItem(idx, 'quantity', Number(e.target.value))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-center outline-none focus:ring-2 focus:ring-indigo-400 transition-all" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Unit Price (₹)</label>
                        <input type="number" min={0} value={item.unitPrice} onChange={e => updateLineItem(idx, 'unitPrice', Number(e.target.value))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-400 transition-all" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total</label>
                        <div className="px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-black text-indigo-700 text-right">{formatCurrency(item.total)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {lineItems.length > 0 && (
                <div className="mt-4 bg-slate-900 rounded-2xl p-4">
                  <div className="flex items-center justify-between text-[11px] mb-2">
                    <span className="text-slate-400 font-medium">Subtotal</span>
                    <span className="text-white font-black">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-slate-400 font-medium text-[11px]">Discount</span>
                    <input type="number" min={0} value={discount} onChange={e => setDiscount(Number(e.target.value))} className="w-24 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-[11px] font-bold text-white text-right outline-none focus:ring-2 focus:ring-indigo-500" />
                    <select value={discountType} onChange={e => setDiscountType(e.target.value as 'flat' | 'percent')} className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-[10px] font-bold text-slate-300 outline-none">
                      <option value="flat">₹ Flat</option>
                      <option value="percent">% Percent</option>
                    </select>
                    {discountAmount > 0 && <span className="text-red-400 font-black text-[11px] ml-auto">-{formatCurrency(discountAmount)}</span>}
                  </div>
                  <div className="border-t border-slate-700 pt-3 flex items-center justify-between">
                    <span className="text-slate-300 font-black text-[11px] uppercase tracking-widest">Grand Total</span>
                    <span className="text-xl font-black text-white">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Fix 2: Project Notes — between Services and Terms */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Pencil size={12} /> Project Notes
                <span className="ml-1 normal-case font-medium text-slate-300 text-[9px]">(shown to client in PDF)</span>
              </h3>
              
              {/* Rich Text Editor Container */}
              <div className="flex flex-col border border-slate-200 rounded-xl shadow-sm bg-white overflow-hidden relative mb-2">
                {/* Toolbar */}
                <div className="flex items-center gap-1 p-2 bg-slate-50 border-b border-slate-200 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => executeProjectNotesCommand('bold')}
                    className="p-1.5 hover:bg-slate-250 text-slate-600 rounded transition-colors"
                    title="Bold"
                  >
                    <Bold size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => executeProjectNotesCommand('italic')}
                    className="p-1.5 hover:bg-slate-250 text-slate-600 rounded transition-colors"
                    title="Italic"
                  >
                    <Italic size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => executeProjectNotesCommand('underline')}
                    className="p-1.5 hover:bg-slate-250 text-slate-600 rounded transition-colors"
                    title="Underline"
                  >
                    <Underline size={12} />
                  </button>
                  
                  <div className="w-px h-4 bg-slate-200 mx-1"></div>

                  <button
                    type="button"
                    onClick={() => executeProjectNotesCommand('justifyLeft')}
                    className="p-1.5 hover:bg-slate-250 text-slate-600 rounded transition-colors"
                    title="Align Left"
                  >
                    <AlignLeft size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => executeProjectNotesCommand('justifyCenter')}
                    className="p-1.5 hover:bg-slate-250 text-slate-600 rounded transition-colors"
                    title="Align Center"
                  >
                    <AlignCenter size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => executeProjectNotesCommand('justifyRight')}
                    className="p-1.5 hover:bg-slate-250 text-slate-600 rounded transition-colors"
                    title="Align Right"
                  >
                    <AlignRight size={12} />
                  </button>
                  
                  <div className="w-px h-4 bg-slate-200 mx-1"></div>

                  <button
                    type="button"
                    onClick={() => executeProjectNotesCommand('insertUnorderedList')}
                    className="p-1.5 hover:bg-slate-250 text-slate-600 rounded transition-colors"
                    title="Bullet List"
                  >
                    <List size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => executeProjectNotesCommand('insertOrderedList')}
                    className="p-1.5 hover:bg-slate-250 text-slate-600 rounded transition-colors"
                    title="Numbered List"
                  >
                    <ListOrdered size={12} />
                  </button>
                  
                  <div className="w-px h-4 bg-slate-200 mx-1"></div>

                  <button
                    type="button"
                    onClick={() => executeProjectNotesCommand('removeFormat')}
                    className="p-1.5 hover:bg-slate-250 text-slate-500 rounded transition-colors text-[9px] font-bold"
                    title="Clear Formatting"
                  >
                    Clear
                  </button>
                </div>

                {/* contentEditable editor */}
                <div
                  ref={projectNotesRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => setProjectNotes(e.currentTarget.innerHTML)}
                  className="w-full px-3 py-3 bg-white text-xs text-slate-700 font-medium outline-none min-h-[120px] max-h-[250px] overflow-y-auto"
                  style={{ wordBreak: 'break-word' }}
                />
              </div>
            </div>

            {/* Terms */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <FileText size={12} /> Terms &amp; Conditions
                <span className="ml-1 normal-case font-medium text-slate-300 text-[9px]">(auto-filled, editable)</span>
              </h3>
              <textarea value={terms} onChange={e => setTerms(e.target.value)} rows={6} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium outline-none focus:ring-2 focus:ring-indigo-400 transition-all resize-none" />
            </div>

            {/* Internal Notes */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Pencil size={12} /> Internal Notes
                <span className="ml-1 normal-case font-medium text-slate-300 text-[9px]">(not shown to client)</span>
              </h3>
              <textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={3} placeholder="Add any internal notes about this quotation..." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium outline-none focus:ring-2 focus:ring-indigo-400 transition-all resize-none" />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 pb-8">
              <button onClick={() => handleSave('Draft')} disabled={isSaving} className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all">
                <Save size={14} /> {isSaving ? 'Saving...' : 'Save as Draft'}
              </button>
              <button onClick={() => handleSave('Sent')} disabled={isSaving} className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-200">
                <Send size={14} /> {isSaving ? 'Saving...' : hasChanges && selectedQuotation && ['Manager Approved', 'Approved'].includes(selectedQuotation.status) ? 'Send Updated' : 'Mark as Sent'}
              </button>
              {selectedQuotation && ['Manager Approved', 'Approved'].includes(selectedQuotation.status) && !hasChanges && (
                <button onClick={() => { const q = buildCurrentQuotation(); if (q) generateQuotationPDF(q, projectNotes); }} className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-200">
                  <Download size={14} /> Download PDF
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {!isBuilderOpen && filteredDeals.length > 0 && (
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><FileText className="text-indigo-400" size={28} /></div>
            <p className="text-sm font-black text-slate-600 uppercase tracking-widest">Select a Deal</p>
            <p className="text-[11px] text-slate-400 mt-1">Click a deal from the list to open the quotation builder</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesQuotationBoard;
