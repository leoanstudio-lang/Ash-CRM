import React, { useState, useEffect, useRef } from 'react';
import { Quotation, QuotationItem, Client, CompanyProfile, DynamicField, Service, QuotationDemo, Employee } from '../types';
import { FileText, Plus, Trash2, Download, CheckCircle, Clock, X, Building2, User, Phone, Mail, Navigation, FileSignature, Search, Calendar, Filter, ArrowUpRight, CheckCircle2, AlertCircle, PlaySquare, Pencil, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, List, ListOrdered } from 'lucide-react';
import { addQuotationToDB, updateQuotationInDB, addClientToDB, getCompanyProfile, subscribeToCollection, deleteQuotationFromDB, addQuotationDemoToDB, updateQuotationDemoInDB, deleteQuotationDemoFromDB, generateProfessionalQuotationId } from '../lib/db';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadWatermarkBase64, stampWatermarkAllPages } from '../lib/pdfWatermark';

interface QuotationsProps {
    clients: Client[];
    services: Service[];
    employees: Employee[];
}

const Quotations: React.FC<QuotationsProps> = ({ clients, services, employees }) => {
    const generateRandomCode = (length: number) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };

    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [demos, setDemos] = useState<QuotationDemo[]>([]);
    const [activeTab, setActiveTab] = useState<'Quotations' | 'Demos'>('Quotations');
    const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);

    const [isCreating, setIsCreating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingQuotationId, setEditingQuotationId] = useState<string | null>(null);
    const [deletingQuotationId, setDeletingQuotationId] = useState<string | null>(null);

    // Filters & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [dateFilter, setDateFilter] = useState('');

    // Demo Filters
    const [demoSearchTerm, setDemoSearchTerm] = useState('');
    const [demoStatusFilter, setDemoStatusFilter] = useState<string>('All');

    // Form State
    const [clientType, setClientType] = useState<'existing' | 'new'>('existing');
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [clientSearchTerm, setClientSearchTerm] = useState('');
    const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsClientDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // New Client Form
    const [newClientName, setNewClientName] = useState('');
    const [newClientCompany, setNewClientCompany] = useState('');
    const [newClientEmail, setNewClientEmail] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');
    const [clientAddress, setClientAddress] = useState(''); // Optional

    // Quotation Details
    const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
    const [validityDate, setValidityDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]); // 30 days
    const [items, setItems] = useState<QuotationItem[]>([{ description: '', quantity: 1, unitPrice: 0, total: 0 }]);
    const [discount, setDiscount] = useState<number>(0);
    const [terms, setTerms] = useState("1. 50% Advance payment required to commence work.\n2. Quotation is valid for 30 days.\n3. Final deliverables securely handed over upon receipt of balance payment.\n4. Revisions beyond scope will be billed additionally.");
    const [projectNotes, setProjectNotes] = useState('');

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

    // Custom HTML Setup
    const [isCustomHtml, setIsCustomHtml] = useState<boolean>(false);
    const [customHtmlContent, setCustomHtmlContent] = useState<string>('');

    // Demo Creation State
    const [isCreatingDemo, setIsCreatingDemo] = useState(false);
    const [demoServiceId, setDemoServiceId] = useState('');
    const [demoDescription, setDemoDescription] = useState('');
    const [demoAssignedEmployee, setDemoAssignedEmployee] = useState('');
    const [demoAllocationDate, setDemoAllocationDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        // Fetch company profile for the letterhead
        getCompanyProfile().then(profile => {
            if (profile) setCompanyProfile(profile);
        });

        // Subscribe to live quotations
        const unsubQuotations = subscribeToCollection<Quotation>('quotations', (data) => {
            // Sort by newest first
            setQuotations(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        });

        const unsubDemos = subscribeToCollection<QuotationDemo>('quotationDemos', (data) => {
            setDemos(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        });

        return () => {
            unsubQuotations();
            unsubDemos();
        };
    }, []);

    // Derived Data for Dashboard & Filters
    const filteredQuotations = quotations.filter(q => {
        const matchesSearch = q.quotationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            q.clientName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || q.status === statusFilter;
        const matchesDate = !dateFilter || q.issueDate === dateFilter;
        return matchesSearch && matchesStatus && matchesDate;
    });

    const totalQuoted = quotations.reduce((sum, q) => sum + q.totalAmount, 0);
    const totalApproved = quotations.filter(q => q.status === 'Approved').reduce((sum, q) => sum + q.totalAmount, 0);
    const totalPending = quotations.filter(q => q.status === 'Draft' || q.status === 'Sent').reduce((sum, q) => sum + q.totalAmount, 0);

    const handleAddItem = () => {
        setItems([...items, { description: '', quantity: 1, unitPrice: 0, total: 0 }]);
    };

    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleItemChange = (index: number, field: keyof QuotationItem, value: string | number) => {
        const newItems = [...items];
        const item = { ...newItems[index] };

        if (field === 'description') {
            item.description = value as string;
        } else {
            item[field] = Number(value) as never;
        }

        // Auto calculate total
        if (field === 'quantity' || field === 'unitPrice') {
            item.total = item.quantity * item.unitPrice;
        }

        newItems[index] = item;
        setItems(newItems);
    };

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const totalAmount = subtotal - (discount || 0);

    const handleDeleteClick = (id: string) => {
        setDeletingQuotationId(id);
    };

    const handleEditClick = (q: Quotation) => {
        // Populate all form states with quotation data
        setIssueDate(q.issueDate);
        setValidityDate(q.validityDate);

        // Find if it's an existing client or new
        if (q.clientId) {
            setClientType('existing');
            setSelectedClientId(q.clientId);
        } else {
            setClientType('new');
            // Check if clientName was derived from company or name
            // For now, just set both or try to guess. 
            // Since we don't save separate company/person name for 'new' type in DB yet, 
            // we'll just put finalClientName in both for editing.
            setNewClientName(q.clientName);
            setNewClientCompany(q.clientName);
            setNewClientEmail(q.clientEmail || '');
            setNewClientPhone(q.clientPhone || '');
        }

        setClientAddress(q.clientAddress || '');
        setItems(q.items && q.items.length > 0 ? [...q.items] : [{ description: '', quantity: 1, unitPrice: 0, total: 0 }]);
        setDiscount(q.discount || 0);
        setTerms(q.termsAndConditions || '');
        setProjectNotes((q as any).projectNotes || '');
        setIsCustomHtml(!!q.isCustomHtml);
        setCustomHtmlContent(q.customHtmlContent || '');

        setEditingQuotationId(q.id);
        setIsEditing(true);
        setIsCreating(true);
    };

    const confirmDelete = async () => {
        if (!deletingQuotationId) return;
        try {
            await deleteQuotationFromDB(deletingQuotationId);
            setDeletingQuotationId(null);
        } catch (error) {
            console.error("Error deleting quotation:", error);
            alert("Failed to delete quotation.");
        }
    };

    const resetForm = () => {
        setClientType('existing');
        setSelectedClientId('');
        setClientSearchTerm('');
        setIsClientDropdownOpen(false);
        setNewClientName('');
        setNewClientCompany('');
        setNewClientEmail('');
        setNewClientPhone('');
        setClientAddress('');
        setItems([{ description: '', quantity: 1, unitPrice: 0, total: 0 }]);
        setDiscount(0);
        setTerms("1. 50% Advance payment required to commence work.\n2. Quotation is valid for 30 days.\n3. Final deliverables securely handed over upon receipt of balance payment.\n4. Revisions beyond scope will be billed additionally.");
        setIsCustomHtml(false);
        setCustomHtmlContent('');
        setProjectNotes('');
        setIsCreating(false);
        setIsEditing(false);
        setEditingQuotationId(null);
    };

    const handleSaveQuotation = async () => {
        // Basic validation
        if (clientType === 'existing' && !selectedClientId) return alert("Please select a client.");
        if (clientType === 'new' && !newClientName) return alert("Please enter client name.");
        if (!isCustomHtml && items.some(i => !i.description)) return alert("All items must have a description.");
        if (isCustomHtml && !customHtmlContent.trim()) return alert("Please enter Custom HTML content.");

        let finalTotalAmount = totalAmount;
        let finalSubtotal = subtotal;

        if (isCustomHtml) {
            const userInput = window.prompt("Enter the Total Value (Amount) for this Custom Quotation (for Dashboard metrics):");
            if (userInput === null) {
                return; // User cancelled
            }
            const val = parseFloat(userInput.replace(/[^\d.]/g, ''));
            finalTotalAmount = isNaN(val) ? 0 : val;
            finalSubtotal = finalTotalAmount;
        }

        // Generate professional sequential QTN ID
        let qNumber = await generateProfessionalQuotationId();
        if (isEditing && editingQuotationId) {
            const existing = quotations.find(q => q.id === editingQuotationId);
            if (existing) qNumber = existing.quotationNumber;
        }

        let finalClientName = '';
        let finalClientEmail = '';
        let finalClientPhone = '';

        if (clientType === 'existing') {
            const c = clients.find(cl => cl.id === selectedClientId);
            if (c) {
                finalClientName = c.companyName || c.name;
                finalClientEmail = c.email;
                finalClientPhone = c.mobile;
            }
        } else {
            finalClientName = newClientCompany || newClientName;
            finalClientEmail = newClientEmail;
            finalClientPhone = newClientPhone;
        }

        const qtnData: Omit<Quotation, 'id'> = {
            quotationNumber: qNumber,
            issueDate,
            validityDate,
            clientName: finalClientName,
            clientEmail: finalClientEmail,
            clientPhone: finalClientPhone,
            items: isCustomHtml ? [] : items,
            subtotal: finalSubtotal,
            discount: isCustomHtml ? 0 : (discount || 0),
            totalAmount: finalTotalAmount,
            termsAndConditions: isCustomHtml ? '' : terms,
            projectNotes: isCustomHtml ? '' : projectNotes.trim(),
            status: isEditing ? (quotations.find(q => q.id === editingQuotationId)?.status || 'Draft') : 'Draft',
            createdAt: isEditing ? (quotations.find(q => q.id === editingQuotationId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
            isNewClient: clientType === 'new',
            isCustomHtml,
            customHtmlContent: isCustomHtml ? customHtmlContent : undefined
        };

        if (clientType === 'existing' && selectedClientId) qtnData.clientId = selectedClientId;
        if (clientAddress) qtnData.clientAddress = clientAddress;

        if (isEditing && editingQuotationId) {
            const existing = quotations.find(q => q.id === editingQuotationId);
            if (existing) {
                if (existing.salesDealId) (qtnData as any).salesDealId = existing.salesDealId;
                if (existing.salesType) (qtnData as any).salesType = existing.salesType;
                if (existing.sourceCampaignName) (qtnData as any).sourceCampaignName = existing.sourceCampaignName;
            }
        }

        try {
            if (isEditing && editingQuotationId) {
                await updateQuotationInDB(editingQuotationId, qtnData);
            } else {
                await addQuotationToDB(qtnData);
            }
            resetForm();
        } catch (err) {
            console.error(err);
            alert("Error saving quotation.");
        }
    };
    const handleStatusChange = async (qtn: Quotation, newStatus: Quotation['status']) => {
        try {
            await updateQuotationInDB(qtn.id, { status: newStatus });

            // Automation hook: If Approved AND was a new client, add to main Client DB
            if (newStatus === 'Approved' && qtn.isNewClient) {
                // Check if already exist to prevent dupes (basic check)
                const exists = clients.some(c => c.mobile === qtn.clientPhone || c.name === qtn.clientName);
                if (!exists) {
                    await addClientToDB({
                        name: qtn.clientName,
                        companyName: qtn.clientName,
                        mobile: qtn.clientPhone || '',
                        email: qtn.clientEmail || '',
                        serviceEnquired: 'From Quotation',
                        dateAdded: new Date().toISOString().split('T')[0],
                        status: 'Active'
                    });
                    // Mark as no longer new so it doesn't trigger again if status flips
                    await updateQuotationInDB(qtn.id, { isNewClient: false });
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Draft': return 'bg-slate-100 text-slate-600 hover:bg-slate-200';
            case 'Sent': return 'bg-blue-100 text-blue-700 hover:bg-blue-200';
            case 'Manager Approved': return 'bg-purple-100 text-purple-700 hover:bg-purple-200';
            case 'Approved': return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200';
            case 'Rejected': return 'bg-red-100 text-red-700 hover:bg-red-200';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    const handleDemoStatusChange = async (demo: QuotationDemo, newStatus: QuotationDemo['status']) => {
        try {
            await updateQuotationDemoInDB(demo.id, { status: newStatus });

            // Automatically inject into Client DB upon approval if the demo was created for a new lead
            if (newStatus === 'Approved' && demo.isNewClient) {
                const exists = clients.some(c => c.mobile === demo.clientPhone || c.name === demo.clientName);
                if (!exists) {
                    await addClientToDB({
                        name: demo.clientName,
                        companyName: demo.clientName,
                        mobile: demo.clientPhone || '',
                        email: demo.clientEmail || '',
                        serviceEnquired: demo.serviceName,
                        dateAdded: new Date().toISOString().split('T')[0],
                        status: 'Active'
                    });
                    // Mark as no longer new so it assumes safety if toggled again
                    await updateQuotationDemoInDB(demo.id, { isNewClient: false });
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    const getDemoStatusColor = (status: string) => {
        switch (status) {
            case 'Pending': return 'bg-slate-100 text-slate-600 hover:bg-slate-200';
            case 'Completed': return 'bg-blue-100 text-blue-700 hover:bg-blue-200';
            case 'Approved': return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    // -------------------------------------------------------------------------------- //
    // DIRECT PDF GENERATION LOGIC (Replacing window.print)
    // -------------------------------------------------------------------------------- //
    // -------------------------------------------------------------------------------- //
    // DIRECT PDF GENERATION LOGIC (Replacing window.print)
    const generateQuotationPDF = async (q: Quotation) => {
        const doc = new jsPDF();
        const co = companyProfile;

        // Brand Colors
        const deepEclipse: [number, number, number] = [10, 0, 40];   // #0A0028
        const textMuted: [number, number, number] = [100, 116, 139]; // Slate 500
        const lightGray: [number, number, number] = [226, 232, 240]; // Slate 200

        // Helper to load image as base64 using Fetch -> Blob to completely bypass strict Canvas CORS/Taint issues
        const loadImageAsBase64 = async (url: string): Promise<string> => {
            try {
                // Fetch the image as a raw blob first
                const response = await fetch(url, { mode: 'cors' });
                if (!response.ok) throw new Error("Network response was not ok");
                const blob = await response.blob();

                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        if (typeof reader.result === 'string') {
                            resolve(reader.result);
                        } else {
                            reject("Failed to convert blob to base64");
                        }
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch (err) {
                // If standard fetch fails (strict CORS blocking entirely), try the Image object as a fallback
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.crossOrigin = 'Anonymous';
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.drawImage(img, 0, 0);
                            resolve(canvas.toDataURL('image/png'));
                        } else {
                            reject('No canvas context');
                        }
                    };
                    img.onerror = reject;
                    img.src = url;
                });
            }
        };

        // Date formatter helper
        const formatDate = (dateStr: string) => {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        };

        // ==========================================
        // 1. HEADER SECTION — Brand Dark Band (Package Report Style)
        // ==========================================
        const pageWidth = doc.internal.pageSize.width;
        const royalPurple: [number, number, number] = [108, 46, 247]; // #6C2EF7
        const white: [number, number, number] = [255, 255, 255];

        // === DARK BRAND BAND (full width) ===
        doc.setFillColor(...deepEclipse);
        doc.rect(0, 0, pageWidth, 46, 'F'); // same width as package report

        // Company Name — White, bold, left
        doc.setTextColor(...white);
        doc.setFont("helvetica", "bold");

        // Draw Company Name Text directly instead of logo
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(...white);
        doc.text(co?.companyName || 'Ash Creative Studio', 14, 18);
        let bandTextY = 23;
        if (co?.tagline && co.tagline.trim() !== "") {
            doc.setFontSize(8);
            doc.setFont("helvetica", "italic");
            doc.setTextColor(200, 190, 230); // slightly muted white-purple
            doc.text(co.tagline, 14, bandTextY);
            bandTextY += 5;
        }

        // Company Contacts — sort: phone first, email second, address last
        if (co?.contacts && co.contacts.length > 0) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(180, 170, 210);

            const getContactPriority = (val: string) => {
                if (val.includes('@')) return 2;                         // email
                if (val.replace(/\D/g, '').length >= 10) return 1;      // phone — 10+ pure digits
                return 3;                                               // address
            };
            const sortedContacts = [...co.contacts].sort((a, b) => getContactPriority(a.value) - getContactPriority(b.value));

            sortedContacts.slice(0, 3).forEach(contact => {
                if (bandTextY < 42) {
                    doc.text(contact.value, 14, bandTextY);
                    bandTextY += 4.5;
                }
            });
        }


        // "QUOTATION" Title — White, large, bold, right-aligned on band
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...white);
        doc.text("QUOTATION", pageWidth - 14, 28, { align: 'right' });

        // === QUOTE DETAILS ROW — Below the dark band ===
        const detailsY = 56;
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...deepEclipse);
        doc.text("Quote No:", 14, detailsY);
        doc.text("Date:", 90, detailsY);
        doc.text("Valid Until:", 155, detailsY);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(...textMuted);

        doc.text(q.quotationNumber, 34, detailsY);
        doc.text(formatDate(q.issueDate), 104, detailsY);
        doc.text(formatDate(q.validityDate), 175, detailsY);

        // === SEPARATOR LINE ===
        doc.setDrawColor(...lightGray);
        doc.setLineWidth(0.5);
        doc.line(14, detailsY + 5, pageWidth - 14, detailsY + 5);

        // ==========================================
        // 2. CLIENT DETAILS (QUOTATION FOR)
        // ==========================================
        let maxHeaderY = detailsY + 15;
        doc.setFontSize(8);
        doc.setTextColor(...textMuted);
        doc.setFont("helvetica", "bold");
        doc.text("QUOTATION FOR", 14, maxHeaderY);

        maxHeaderY += 6;
        doc.setFontSize(14);
        doc.setTextColor(...deepEclipse);
        doc.setFont("helvetica", "bold");
        doc.text(q.clientName, 14, maxHeaderY);

        maxHeaderY += 5.5; // Gap between client name and their contact details matching the next line spacing
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...textMuted);

        // 1. Address
        if (q.clientAddress && q.clientAddress.trim() !== "") {
            const cleanAddr = q.clientAddress.replace(/^[,\s*]+|[,\s*]+$/g, '').trim();
            if (cleanAddr) {
                const splitAddress = doc.splitTextToSize(cleanAddr, 80);
                doc.text(splitAddress, 14, maxHeaderY);
                maxHeaderY += (splitAddress.length * 4.5);
            }
        }

        // 2. Phone / Mobile
        if (q.clientPhone && q.clientPhone.trim() !== "") {
            let cp = q.clientPhone.replace(/[\*\,]/g, '');
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
        if (q.clientEmail && q.clientEmail !== "No Email Registered" && q.clientEmail.trim() !== "") {
            doc.text(q.clientEmail.trim(), 14, maxHeaderY);
            maxHeaderY += 4.5;
        }


        // ==========================================
        // 4. ITEMS TABLE OR CUSTOM HTML
        // ==========================================
        if (q.isCustomHtml && q.customHtmlContent) {
            const container = document.createElement('div');
            container.innerHTML = q.customHtmlContent;
            container.style.width = '688px'; // matches width:182mm at 96dpi (182/210*794)
            container.style.padding = '0px'; // no padding — doc.html margins handle spacing
            container.style.position = 'absolute';
            container.style.top = '0px';
            container.style.left = '0px';
            container.style.zIndex = '-9999';
            container.style.opacity = '1';
            container.style.backgroundColor = 'white';
            container.style.color = '#0f172a';

            const style = document.createElement('style');
            style.innerHTML = `
                * { box-sizing: border-box; font-family: 'Inter', sans-serif; }
                /* Zero out top margin on the very first element so there's no gap after client section */
                *:first-child { margin-top: 0 !important; margin-block-start: 0 !important; padding-top: 0 !important; }
                h1, h2, h3, h4, h5, h6 { color: #0A0028; margin-top: 0; }
                p { line-height: 1.7; color: #64748b; font-size: 14px; margin-top: 0; }
                ul { margin-top: 6px; padding-left: 18px; color: #64748b; font-size: 13px; line-height: 1.8; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 20px; }
                th { background-color: #f8fafc; color: #64748b; font-weight: 800; text-align: left; padding: 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 2px solid #e2e8f0; }
                td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #0f172a; }
                .total-row td { font-weight: bold; font-size: 15px; border-top: 2px solid #e2e8f0; }
                .text-right { text-align: right; }
                hr { border: none; border-top: 1px solid #e2e8f0; margin: 20px 0; }
            `;

            container.appendChild(style);
            document.body.appendChild(container);

            try {
                const topMargin = 25; // 25mm clears the 14mm continuation header on page 2+ and adds padding
                await doc.html(container, {
                    x: 14,
                    y: (maxHeaderY + 4) - topMargin, // Subtract margin on page 1 so jsPDF doesn't double-add the gap
                    width: 182,
                    windowWidth: 688,
                    margin: [topMargin, 0, 38, 0], // top=25mm, right=0, bottom=38mm (for footer), left=0
                    autoPaging: 'slice', // 'slice' instead of 'text' prevents text shifting and line height mismatch glitches
                    html2canvas: {
                        useCORS: true,
                        logging: false
                    }
                });
            } catch (err) {
                console.error("Custom HTML render failed", err);
            } finally {
                document.body.removeChild(container);
            }
        } else {
            const tableStartY = maxHeaderY + 8;
            const tableBody = q.items.map((item, idx) => [
                idx + 1,
                item.description,
                item.quantity,
                `Rs. ${item.unitPrice.toLocaleString()}`,
                `Rs. ${item.total.toLocaleString()}`
            ]);

            autoTable(doc, {
                startY: tableStartY,
                head: [['#', 'DESCRIPTION', 'QTY', 'UNIT PRICE', 'TOTAL']],
                body: tableBody,
                theme: 'plain',
                headStyles: {
                    fillColor: [248, 250, 252],
                    textColor: textMuted,
                    fontStyle: 'bold',
                    fontSize: 8,
                    halign: 'left'
                },
                bodyStyles: {
                    fontSize: 9,
                    textColor: deepEclipse,
                },
                columnStyles: {
                    0: { cellWidth: 12, halign: 'left' },
                    1: { cellWidth: 83, halign: 'left' },
                    2: { cellWidth: 15, halign: 'center' },
                    3: { cellWidth: 35, halign: 'right' },
                    4: { cellWidth: 35, halign: 'right', fontStyle: 'bold', textColor: deepEclipse }
                },
                alternateRowStyles: { fillColor: [255, 255, 255] },
                margin: { top: 20, left: 14, right: 14, bottom: 40 }, // Prevent overlapping header & continuation overlaps
                didParseCell: (data) => {
                    if (data.section === 'head' && (data.column.index === 3 || data.column.index === 4)) data.cell.styles.halign = 'right';
                    if (data.section === 'head' && data.column.index === 2) data.cell.styles.halign = 'center';
                },
                didDrawPage: (data) => {
                    doc.setDrawColor(...lightGray);
                    doc.setLineWidth(0.5);
                    doc.line(14, data.settings.startY, 196, data.settings.startY);
                },
                didDrawCell: (data) => {
                    if (data.row.section === 'body') {
                        doc.setDrawColor(241, 245, 249);
                        doc.setLineWidth(0.5);
                        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
                    }
                }
            });

            // ==========================================
            // 5. TOTALS SECTION
            // ==========================================
            let finalY = (doc as any).lastAutoTable.finalY + 10;
            const pageHeight = doc.internal.pageSize.height;

            // Check if totals + terms fit on current page before footer (which is at pageHeight - 35)
            if (finalY > pageHeight - 75) {
                doc.addPage();
                finalY = 20;
            }

            const rightEdge = 196;
            const totalsBoxX = 135;
            let totalsY = finalY;

            doc.setFontSize(9);
            doc.setTextColor(...textMuted);
            doc.setFont("helvetica", "normal");
            doc.text("Subtotal", totalsBoxX, totalsY);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...deepEclipse);
            doc.text(`Rs. ${q.subtotal.toLocaleString()}`, rightEdge, totalsY, { align: 'right' });

            if (q.discount && q.discount > 0) {
                totalsY += 8;
                doc.setFont("helvetica", "normal");
                doc.setTextColor(...textMuted);
                doc.text("Discount", totalsBoxX, totalsY);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(225, 29, 72);
                doc.text(`-Rs. ${q.discount.toLocaleString()}`, rightEdge, totalsY, { align: 'right' });
            }

            totalsY += 8;
            doc.setDrawColor(...lightGray);
            doc.setLineWidth(0.5);
            doc.line(totalsBoxX, totalsY, rightEdge, totalsY);

            totalsY += 8;
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...deepEclipse);
            doc.text("TOTAL AMOUNT", totalsBoxX, totalsY);

            doc.setFontSize(14);
            doc.text(`Rs. ${q.totalAmount.toLocaleString()}`, rightEdge, totalsY, { align: 'right' });

            // ==========================================
            // 6. PROJECT NOTES (between totals and terms)
            // ==========================================
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

            const pNotes = cleanHTMLToPlainText(((q as any).projectNotes || '').trim());
            if (pNotes) {
                let notesY = totalsY + 15;
                if (notesY > pageHeight - 60) {
                    doc.addPage();
                    notesY = 20;
                }
                doc.setFontSize(8);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(...deepEclipse);
                doc.text("PROJECT NOTES", 14, notesY);
                notesY += 5;
                doc.setFont("helvetica", "normal");
                doc.setTextColor(...textMuted);
                const splitNotes = doc.splitTextToSize(pNotes, 175);
                doc.text(splitNotes, 14, notesY, { lineHeightFactor: 1.6 });
                totalsY = notesY + (splitNotes.length * 5.5);
            }

            // ==========================================
            // 7. TERMS & CONDITIONS
            // ==========================================
            let termsY = totalsY + 15;
            if (termsY > pageHeight - 50) {
                doc.addPage();
                termsY = 20;
            }

            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...deepEclipse);
            doc.text("TERMS & CONDITIONS", 14, termsY);

            termsY += 5;
            doc.setFont("helvetica", "normal");
            doc.setTextColor(...textMuted);
            const splitTerms = doc.splitTextToSize(q.termsAndConditions, 100);
            doc.text(splitTerms, 14, termsY, { lineHeightFactor: 1.5 });
        }

        // ==========================================
        // 7. DYNAMIC PAGINATED FOOTER + PAGE FRAME
        // ==========================================
        // Stamp watermark on all pages before drawing footer overlays
        const watermarkB64 = await loadWatermarkBase64();
        stampWatermarkAllPages(doc, watermarkB64);

        const pageCount = doc.getNumberOfPages();
        const royalPurple2: [number, number, number] = [108, 46, 247];
        const footerBandHeight = 28;

        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            const pageHeight = doc.internal.pageSize.height;
            const footerBandY = pageHeight - footerBandHeight;

            // === CONTINUATION MINI-HEADER (Pages 2+) ===
            if (i > 1) {
                doc.setFillColor(...deepEclipse);
                doc.rect(0, 0, pageWidth, 14, 'F');
                doc.setFontSize(8);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(255, 255, 255);
                doc.text(co?.companyName || 'Your Company', 14, 9);
                doc.text(`${q.quotationNumber} — continued`, pageWidth - 14, 9, { align: 'right' });
            }

            // === FOOTER: White background, purple accent line ===
            // Purple separator line (Package Report style)
            doc.setDrawColor(...royalPurple2);
            doc.setLineWidth(0.6);
            doc.line(14, footerBandY, pageWidth - 14, footerBandY);

            // Left: Company Name in dark
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...deepEclipse);
            doc.text(co?.companyName || 'Your Company', 14, footerBandY + 8);

            // Left: Tagline in muted
            if (co?.tagline && co.tagline.trim() !== "") {
                doc.setFontSize(7.5);
                doc.setFont("helvetica", "italic");
                doc.setTextColor(...textMuted);
                doc.text(co.tagline, 14, footerBandY + 14);
            }

            // Center: Page number (only if multi-page)
            if (pageCount > 1) {
                doc.setFontSize(8);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(...royalPurple2);
                doc.text(`${i}/${pageCount}`, pageWidth / 2, footerBandY + 10, { align: 'center' });
            }
            // Right: Dynamic Social Icons from /public/ folder
            // Map label → fallback if needed, but primarily dynamic
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

                // Use fallback map if it exists (for legacy case-sensitivity), otherwise construct dynamically
                const iconFile = fallbackIconMap[labelKey] || `${labelKey}.png`;
                const iconUrl = `/${iconFile}`;
                try {
                    // Fetch icon as base64
                    const resp = await fetch(iconUrl);
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

                    // Make icon clickable
                    const url = social.value.startsWith('http') ? social.value : `https://${social.value}`;
                    doc.link(iconX, iconY, iconSize, iconSize, { url });

                    rightX -= (iconSize + spacing);
                } catch {
                    // If icon fails to load, skip gracefully
                }
            }
        }

        // Output PDF
        const safeName = q.clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        doc.save(`Quotation_${safeName}_${q.quotationNumber}.pdf`);
    };

    const handleSaveDemo = async () => {
        if (!demoServiceId) return alert("Please select a service.");
        if (!demoDescription) return alert("Please enter a description for the demo.");
        if (clientType === 'existing' && !selectedClientId) return alert("Please select a client.");
        if (clientType === 'new' && !newClientName) return alert("Please enter client name.");

        let finalClientName = '';
        let finalClientEmail = '';
        let finalClientPhone = '';

        if (clientType === 'existing') {
            const c = clients.find(cl => cl.id === selectedClientId);
            if (c) {
                finalClientName = c.companyName || c.name;
                finalClientEmail = c.email;
                finalClientPhone = c.mobile;
            }
        } else {
            // New client behavior: use Company Name if available, otherwise Person Name
            finalClientName = newClientCompany || newClientName;
            finalClientEmail = newClientEmail;
            finalClientPhone = newClientPhone;
        }

        const service = services.find(s => s.id === demoServiceId);

        const newDemo: Omit<QuotationDemo, 'id'> = {
            clientName: finalClientName,
            clientEmail: finalClientEmail,
            clientPhone: finalClientPhone,
            serviceId: demoServiceId,
            serviceName: service?.name || 'Unknown Service',
            description: demoDescription,
            assignedEmployeeId: demoAssignedEmployee,
            allocatedDate: demoAllocationDate,
            status: 'Pending',
            createdAt: new Date().toISOString(),
            isNewClient: clientType === 'new'
        };

        // Only add clientId if it's an existing client
        if (clientType === 'existing' && selectedClientId) {
            newDemo.clientId = selectedClientId;
        }

        try {
            await addQuotationDemoToDB(newDemo);

            // Success: Close and Reset everything
            setIsCreatingDemo(false);
            setDemoDescription('');
            setDemoServiceId('');
            setDemoAssignedEmployee('');
            setDemoAllocationDate(new Date().toISOString().split('T')[0]);

            // Shared Client State Reset
            setClientType('existing');
            setSelectedClientId('');
            setNewClientName('');
            setNewClientCompany('');
            setNewClientEmail('');
            setNewClientPhone('');
            setClientAddress('');
            setClientSearchTerm('');
            setIsClientDropdownOpen(false);

        } catch (err) {
            console.error(err);
            alert("Error saving demo.");
        }
    };

    // Derived Data for Demos
    const filteredDemos = demos.filter(d => {
        const matchesSearch = (d.clientName || '').toLowerCase().includes(demoSearchTerm.toLowerCase()) ||
            (d.serviceName || '').toLowerCase().includes(demoSearchTerm.toLowerCase());
        const matchesStatus = demoStatusFilter === 'All' || d.status === demoStatusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleDeleteDemoClick = (id: string) => {
        if (window.confirm("Are you sure you want to delete this demo?")) {
            deleteQuotationDemoFromDB(id);
        }
    };

    // -------------------------------------------------------------------------------- //
    // MAIN APP UI
    // -------------------------------------------------------------------------------- //
    return (
        <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* Header Settings & Tabs */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 inline-flex">
                    <button
                        onClick={() => setActiveTab('Quotations')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'Quotations' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                            }`}
                    >
                        <FileText size={14} /> Quotations
                    </button>
                    <button
                        onClick={() => setActiveTab('Demos')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'Demos' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                            }`}
                    >
                        <PlaySquare size={14} /> Demos
                    </button>
                </div>
            </div>

            {/* Mini Dashboard depending on Tab */}
            {activeTab === 'Quotations' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Main Header Card */}
                    <div className="col-span-1 md:col-span-2 flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 md:p-8 bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-50 pointer-events-none"></div>
                        <div className="relative z-10">
                            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Quotations</h2>
                            <p className="text-sm font-medium text-slate-500 mt-1 flex items-center gap-2">
                                <FileText size={16} className="text-blue-500" />
                                Manage and send professional proposals
                            </p>
                        </div>

                        <button
                            onClick={() => setIsCreating(true)}
                            className="relative z-10 inline-flex items-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-2xl text-sm font-black uppercase tracking-wider hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 active:scale-95 group overflow-hidden w-full sm:w-auto justify-center mt-4 sm:mt-0"
                        >
                            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-400/0 via-white/20 to-blue-400/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"></div>
                            <Plus size={18} /> Create Quotation
                        </button>
                    </div>


                    {/* Dashboard Stats */}
                    <div className="col-span-1 bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 p-6 flex flex-col justify-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-2xl -mr-10 -mt-10 opacity-60"></div>
                        <div className="flex items-center gap-2 text-slate-500 mb-2 relative z-10">
                            <CheckCircle2 size={16} className="text-emerald-500" />
                            <span className="text-xs font-black uppercase tracking-widest">Approved</span>
                        </div>
                        <p className="text-2xl font-black text-slate-900 relative z-10">₹{totalApproved.toLocaleString()}</p>
                    </div>

                    <div className="col-span-1 bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 p-6 flex flex-col justify-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full blur-2xl -mr-10 -mt-10 opacity-60"></div>
                        <div className="flex items-center gap-2 text-slate-500 mb-2 relative z-10">
                            <AlertCircle size={16} className="text-amber-500" />
                            <span className="text-xs font-black uppercase tracking-widest">Pending</span>
                        </div>
                        <p className="text-2xl font-black text-slate-900 relative z-10">₹{totalPending.toLocaleString()}</p>
                    </div>
                </div>
            )}

            {activeTab === 'Demos' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Main Header Card */}
                    <div className="col-span-1 md:col-span-4 flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 md:p-8 bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-50 pointer-events-none"></div>
                        <div className="relative z-10">
                            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Creative Demos</h2>
                            <p className="text-sm font-medium text-slate-500 mt-1 flex items-center gap-2">
                                <PlaySquare size={16} className="text-violet-500" />
                                Assign and test demo tasks before quoting
                            </p>
                        </div>

                        <button
                            onClick={() => setIsCreatingDemo(true)}
                            className="relative z-10 inline-flex items-center gap-2 px-6 py-3.5 bg-violet-600 text-white rounded-2xl text-sm font-black uppercase tracking-wider hover:bg-violet-700 transition-all shadow-lg shadow-violet-600/30 hover:shadow-xl hover:shadow-violet-600/40 active:scale-95 group overflow-hidden w-full sm:w-auto justify-center mt-4 sm:mt-0"
                        >
                            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-violet-400/0 via-white/20 to-violet-400/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"></div>
                            <Plus size={18} /> Create Demo
                        </button>
                    </div>
                </div>
            )}

            {/* Search and Filters Bar */}
            {activeTab === 'Quotations' ? (
                <div className="flex flex-col sm:flex-row gap-4 w-full">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search quotations by number or client name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all"
                        />
                    </div>

                    <div className="flex gap-4 sm:w-auto w-full">
                        <div className="relative flex-1 sm:flex-none">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Calendar className="h-4 w-4 text-slate-400" />
                            </div>
                            <input
                                type="date"
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="block w-full sm:w-40 pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all uppercase tracking-wider"
                            />
                        </div>

                        <div className="relative flex-1 sm:flex-none">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 z-10">
                                <Filter className="h-4 w-4" />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="block w-full sm:w-40 pl-11 pr-8 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all appearance-none uppercase tracking-wider cursor-pointer"
                            >
                                <option value="All">All Status</option>
                                <option value="Draft">Draft</option>
                                <option value="Sent">Sent</option>
                                <option value="Manager Approved">Manager Approved</option>
                                <option value="Approved">Approved</option>
                                <option value="Rejected">Rejected</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                                ▼
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col sm:flex-row gap-4 w-full">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search demos by client or service..."
                            value={demoSearchTerm}
                            onChange={(e) => setDemoSearchTerm(e.target.value)}
                            className="block w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-violet-500 outline-none shadow-sm transition-all"
                        />
                    </div>

                    <div className="flex gap-4 sm:w-auto w-full">
                        <div className="relative flex-1 sm:flex-none">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 z-10">
                                <Filter className="h-4 w-4" />
                            </div>
                            <select
                                value={demoStatusFilter}
                                onChange={(e) => setDemoStatusFilter(e.target.value)}
                                className="block w-full sm:w-40 pl-11 pr-8 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 focus:ring-2 focus:ring-violet-500 outline-none shadow-sm transition-all appearance-none uppercase tracking-wider cursor-pointer"
                            >
                                <option value="All">All Status</option>
                                <option value="Pending">Pending</option>
                                <option value="Completed">Completed</option>
                                <option value="Approved">Approved</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                                ▼
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* List View */}
            {activeTab === 'Quotations' && (
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.25em]">
                                    <th className="px-8 py-5">Quote No</th>
                                    <th className="px-8 py-5">Client Name</th>
                                    <th className="px-8 py-5">Date</th>
                                    <th className="px-8 py-5">Amount</th>
                                    <th className="px-8 py-5">Status</th>
                                    <th className="px-8 py-5 text-right flex-shrink-0">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredQuotations.map(q => (
                                    <tr key={q.id} className="hover:bg-slate-50/80 transition-all duration-300 group">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs font-bold text-slate-700">{q.quotationNumber}</span>
                                                {(q as any).isUpdated && (
                                                    <span className="text-[8px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded animate-pulse">
                                                        UPDATED
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-800 text-sm">{q.clientName}</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {q.isNewClient && <span className="text-[9px] font-bold uppercase tracking-wider text-blue-500 border border-blue-200 bg-blue-50 w-fit px-1.5 rounded">New Client</span>}
                                                    {q.salesDealId && (
                                                        <span className="text-[9px] font-bold uppercase tracking-wider text-purple-600 border border-purple-200 bg-purple-50 w-fit px-1.5 rounded flex items-center gap-1" title={q.sourceCampaignName || ''}>
                                                            <span>💼 Sales ({q.salesType})</span>
                                                            {q.sourceCampaignName && <span className="opacity-70 font-normal">| {q.sourceCampaignName}</span>}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="text-xs font-medium text-slate-500">{new Date(q.issueDate).toLocaleDateString('en-GB')}</span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="text-sm font-black text-slate-900">₹{q.totalAmount.toLocaleString()}</span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className={`relative inline-flex items-center justify-center`}>
                                                <select
                                                    value={q.status}
                                                    onChange={(e) => handleStatusChange(q, e.target.value as Quotation['status'])}
                                                    className={`text-[10px] font-black uppercase tracking-wider pl-4 pr-8 py-2 rounded-xl border border-slate-200 outline-none cursor-pointer appearance-none text-center transition-all ${getStatusColor(q.status)}`}
                                                >
                                                    <option value="Draft">Draft</option>
                                                    <option value="Sent">Sent</option>
                                                    <option value="Manager Approved">Manager Approved</option>
                                                    <option value="Approved">Approved</option>
                                                    <option value="Rejected">Rejected</option>
                                                </select>
                                                <div className="absolute z-10 right-3 pointer-events-none text-current opacity-70">
                                                    ▼
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right flex justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleEditClick(q)}
                                                className="p-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-800 hover:text-white transition-all shadow-sm active:scale-95 border border-slate-100 hover:border-slate-800 flex items-center justify-center"
                                                title="Edit Quotation"
                                            >
                                                <Pencil size={14} className="stroke-[2.5]" />
                                            </button>
                                            <button
                                                onClick={() => generateQuotationPDF(q)}
                                                className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95 border border-blue-100 hover:border-blue-600 flex items-center justify-center"
                                                title="Export Direct PDF"
                                            >
                                                <Download size={14} className="stroke-[2.5]" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteClick(q.id)}
                                                className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm active:scale-95 border border-red-100 hover:border-red-600 flex items-center justify-center"
                                                title="Delete Quotation"
                                            >
                                                <Trash2 size={14} className="stroke-[2.5]" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredQuotations.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-slate-500 font-medium">No quotations found matching your criteria.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Demos List View */}
            {activeTab === 'Demos' && (
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.25em]">
                                    <th className="px-8 py-5">Client Name</th>
                                    <th className="px-8 py-5">Service</th>
                                    <th className="px-8 py-5">Allocated On</th>
                                    <th className="px-8 py-5">Employee</th>
                                    <th className="px-8 py-5">Status</th>
                                    <th className="px-8 py-5 text-right flex-shrink-0">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredDemos.map(d => (
                                    <tr key={d.id} className="hover:bg-slate-50/80 transition-all duration-300 group">
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-800 text-sm">{d.clientName}</span>
                                                {d.isNewClient && <span className="text-[9px] font-bold uppercase tracking-wider text-violet-500 mt-0.5 border border-violet-200 bg-violet-50 w-fit px-1.5 rounded">New Client</span>}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="text-xs font-bold text-slate-700">{d.serviceName}</span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="text-xs font-medium text-slate-500">{new Date(d.allocatedDate).toLocaleDateString('en-GB')}</span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="text-xs font-medium text-slate-500">
                                                {employees.find(e => e.id === d.assignedEmployeeId)?.name || 'Unassigned'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className={`relative inline-flex items-center justify-center`}>
                                                <select
                                                    value={d.status}
                                                    onChange={(e) => handleDemoStatusChange(d, e.target.value as QuotationDemo['status'])}
                                                    className={`text-[10px] font-black uppercase tracking-wider pl-4 pr-8 py-2 rounded-xl border border-slate-200 outline-none cursor-pointer appearance-none text-center transition-all ${getDemoStatusColor(d.status)}`}
                                                >
                                                    <option value="Pending">Pending</option>
                                                    <option value="Completed">Completed</option>
                                                    <option value="Approved">Approved</option>
                                                </select>
                                                <div className="absolute z-10 right-3 pointer-events-none text-current opacity-70">
                                                    ▼
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right flex justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleDeleteDemoClick(d.id)}
                                                className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm active:scale-95 border border-red-100 hover:border-red-600 flex items-center justify-center"
                                                title="Delete Demo"
                                            >
                                                <Trash2 size={14} className="stroke-[2.5]" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredDemos.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-slate-500 font-medium">No demos found matching your criteria.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* CREATE QUOTATION MODAL */}
            {
                isCreating && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex py-10 justify-center overflow-y-auto w-full">
                        <div className="bg-white w-full max-w-6xl min-h-full md:min-h-0 md:rounded-2xl shadow-xl flex flex-col my-auto border border-slate-200">
                            {/* Modal Header */}
                            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white rounded-t-2xl">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                        {isEditing ? 'Edit Quotation' : 'Create Quotation'}
                                    </h2>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                        {isEditing ? 'Update existing proposal' : 'Professional layout'}
                                    </p>
                                </div>
                                <button onClick={resetForm} className="w-8 h-8 bg-slate-50 text-slate-500 rounded-lg flex items-center justify-center hover:bg-slate-100 hover:text-slate-700 transition-all">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Modal Body - Horizontal Split Layout */}
                            <div className="flex flex-col lg:flex-row gap-0 overflow-y-auto">

                                {/* LEFT SIDE: Client Form */}
                                <div className="w-full lg:w-[32%] bg-slate-50/50 border-r border-slate-100 p-6 flex flex-col">
                                    {/* Type Switcher */}
                                    <div className="flex bg-slate-200/50 p-1 rounded-lg w-full mb-6">
                                        <button
                                            type="button"
                                            onClick={() => setClientType('existing')}
                                            className={`flex-1 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-md transition-all ${clientType === 'existing' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Existing Client
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setClientType('new')}
                                            className={`flex-1 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-md transition-all ${clientType === 'new' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            New Client
                                        </button>
                                    </div>

                                    <div className="flex flex-col gap-5">
                                        {clientType === 'existing' ? (
                                            <div className="relative" ref={dropdownRef}>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Select Client <span className="text-rose-500">*</span></label>

                                                {/* Replaced native select with custom searchable dropdown */}
                                                <div
                                                    className={`w-full p-3 border ${isClientDropdownOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200'} rounded-xl bg-white flex justify-between items-center cursor-pointer transition-all`}
                                                    onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                                                >
                                                    <span className={`text-sm font-medium truncate ${selectedClientId ? 'text-slate-800' : 'text-slate-400'}`}>
                                                        {selectedClientId
                                                            ? (() => {
                                                                const c = clients.find(c => c.id === selectedClientId);
                                                                return c ? `${c.companyName || c.name} (${c.mobile})` : 'Select Client';
                                                            })()
                                                            : '-- Choose Existing Client --'}
                                                    </span>
                                                    <Navigation size={14} className={`text-slate-400 transition-transform duration-200 ${isClientDropdownOpen ? 'rotate-180' : 'rotate-90'}`} />
                                                </div>

                                                {isClientDropdownOpen && (
                                                    <div className="absolute z-[100] w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-72 flex flex-col overflow-hidden">
                                                        <div className="p-2 border-b border-slate-100 flex items-center bg-slate-50/50">
                                                            <Search size={14} className="text-slate-400 ml-2 shrink-0" />
                                                            <input
                                                                type="text"
                                                                placeholder="Search by name, company, or phone..."
                                                                className="w-full p-2 outline-none text-sm bg-transparent"
                                                                value={clientSearchTerm}
                                                                onChange={(e) => setClientSearchTerm(e.target.value)}
                                                                onClick={(e) => e.stopPropagation()}
                                                                autoFocus
                                                            />
                                                        </div>
                                                        <div className="overflow-y-auto flex-1 p-1 custom-scrollbar">
                                                            <div
                                                                className={`p-3 text-sm rounded-lg cursor-pointer transition-colors ${!selectedClientId ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                                                                onClick={() => { setSelectedClientId(''); setIsClientDropdownOpen(false); setClientSearchTerm(''); }}
                                                            >
                                                                -- Choose Existing Client --
                                                            </div>
                                                            {clients.filter(c => {
                                                                const searchStr = (`${c.companyName || ''} ${c.name || ''} ${c.mobile || ''}`).toLowerCase();
                                                                return searchStr.includes(clientSearchTerm.toLowerCase());
                                                            }).map(c => (
                                                                <div
                                                                    key={c.id}
                                                                    className={`p-3 text-sm rounded-lg cursor-pointer transition-colors truncate flex items-center justify-between ${selectedClientId === c.id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                                                                    onClick={() => { setSelectedClientId(c.id); setIsClientDropdownOpen(false); setClientSearchTerm(''); }}
                                                                >
                                                                    <span className="truncate">{c.companyName || c.name}</span>
                                                                    <span className={`text-xs ml-2 shrink-0 ${selectedClientId === c.id ? 'text-blue-500' : 'text-slate-400'}`}>({c.mobile})</span>
                                                                </div>
                                                            ))}
                                                            {clients.filter(c => (`${c.companyName || ''} ${c.name || ''} ${c.mobile || ''}`).toLowerCase().includes(clientSearchTerm.toLowerCase())).length === 0 && (
                                                                <div className="p-4 text-center text-sm text-slate-400 flex flex-col items-center justify-center gap-2">
                                                                    <Search size={16} className="opacity-50" />
                                                                    <span>No clients found matching "{clientSearchTerm}"</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <>
                                                <div>
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Building2 size={12} /> Company Name</label>
                                                    <input
                                                        value={newClientCompany}
                                                        onChange={(e) => setNewClientCompany(e.target.value)}
                                                        placeholder="e.g. Acme Corp"
                                                        className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-medium"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><User size={12} /> Contact Person <span className="text-rose-500">*</span></label>
                                                    <input
                                                        value={newClientName}
                                                        onChange={(e) => setNewClientName(e.target.value)}
                                                        placeholder="e.g. John Doe"
                                                        className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-medium"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Phone size={12} /> Phone Number</label>
                                                    <input
                                                        value={newClientPhone}
                                                        onChange={(e) => setNewClientPhone(e.target.value)}
                                                        placeholder="e.g. +91 9876543210"
                                                        className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-medium"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Mail size={12} /> Email Address</label>
                                                    <input
                                                        value={newClientEmail}
                                                        onChange={(e) => setNewClientEmail(e.target.value)}
                                                        placeholder="e.g. john@acme.com"
                                                        type="email"
                                                        className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-medium"
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {/* Optional Address (Applies to both) */}
                                        <div className="pt-2 border-t border-slate-200/50">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Navigation size={12} /> To Address (Optional)</label>
                                            <textarea
                                                value={clientAddress}
                                                onChange={(e) => setClientAddress(e.target.value)}
                                                placeholder="Physical address or additional contact details to display on quotation..."
                                                rows={2}
                                                className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-medium resize-y"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* RIGHT SIDE: Items & Totals */}
                                <div className="w-full lg:w-[68%] p-6 flex flex-col gap-6">

                                    {/* Layout Toggle */}
                                    <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
                                        <button
                                            type="button"
                                            onClick={() => setIsCustomHtml(false)}
                                            className={`px-4 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-md transition-all ${!isCustomHtml ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Standard Layout
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsCustomHtml(true)}
                                            className={`px-4 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-md transition-all ${isCustomHtml ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Custom HTML
                                        </button>
                                    </div>

                                    {!isCustomHtml ? (
                                        <>
                                            {/* Items Table */}
                                            <div>
                                                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                                    <table className="w-full text-left">
                                                        <thead>
                                                            <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                                <th className="px-4 py-3 min-w-[280px]">Item Description</th>
                                                                <th className="px-3 py-3 w-20 text-center">Qty</th>
                                                                <th className="px-3 py-3 w-32 text-right">Unit Rate (₹)</th>
                                                                <th className="px-4 py-3 w-32 text-right">Total (₹)</th>
                                                                <th className="px-2 py-3 w-12 text-center">Act</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {items.map((item, idx) => (
                                                                <tr key={idx} className="bg-white">
                                                                    <td className="p-2 relative">
                                                                        <input
                                                                            list={`service-suggestions-${idx}`}
                                                                            value={item.description}
                                                                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                                                            placeholder="Type or select a service..."
                                                                            className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                                        />
                                                                        <datalist id={`service-suggestions-${idx}`}>
                                                                            {services.map(s => <option key={s.id} value={s.name} />)}
                                                                        </datalist>
                                                                    </td>
                                                                    <td className="p-2">
                                                                        <input
                                                                            type="number"
                                                                            min="1"
                                                                            value={item.quantity || ''}
                                                                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                                                            className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-bold text-center outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                                        />
                                                                    </td>
                                                                    <td className="p-2">
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            value={item.unitPrice || ''}
                                                                            onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                                                                            className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-bold text-right outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                                        />
                                                                    </td>
                                                                    <td className="p-2 text-right px-4">
                                                                        <span className="font-bold text-slate-900 text-sm">₹{item.total.toLocaleString()}</span>
                                                                    </td>
                                                                    <td className="p-2 text-center">
                                                                        <button
                                                                            onClick={() => handleRemoveItem(idx)}
                                                                            disabled={items.length === 1}
                                                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-30 flex items-center justify-center w-full"
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleAddItem}
                                                    className="mt-3 px-4 py-2 bg-slate-50 text-slate-600 hover:text-slate-900 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-100 border border-slate-200/50 transition-all flex items-center gap-2"
                                                >
                                                    <Plus size={14} /> Add Row
                                                </button>
                                            </div>

                                            {/* Project Notes */}
                                            <div className="flex flex-col mt-4 mb-4">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Project Notes (shown to client in PDF)</label>
                                                
                                                {/* Rich Text Editor Container */}
                                                <div className="flex flex-col border border-slate-200 rounded-xl shadow-sm bg-white overflow-hidden relative mb-2">
                                                    {/* Toolbar */}
                                                    <div className="flex items-center gap-1 p-2 bg-slate-50 border-b border-slate-200 shrink-0 flex-wrap">
                                                        <button
                                                            type="button"
                                                            onClick={() => executeProjectNotesCommand('bold')}
                                                            className="p-1.5 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                                            title="Bold"
                                                        >
                                                            <Bold size={12} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => executeProjectNotesCommand('italic')}
                                                            className="p-1.5 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                                            title="Italic"
                                                        >
                                                            <Italic size={12} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => executeProjectNotesCommand('underline')}
                                                            className="p-1.5 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                                            title="Underline"
                                                        >
                                                            <Underline size={12} />
                                                        </button>
                                                        
                                                        <div className="w-px h-4 bg-slate-200 mx-1"></div>

                                                        <button
                                                            type="button"
                                                            onClick={() => executeProjectNotesCommand('justifyLeft')}
                                                            className="p-1.5 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                                            title="Align Left"
                                                        >
                                                            <AlignLeft size={12} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => executeProjectNotesCommand('justifyCenter')}
                                                            className="p-1.5 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                                            title="Align Center"
                                                        >
                                                            <AlignCenter size={12} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => executeProjectNotesCommand('justifyRight')}
                                                            className="p-1.5 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                                            title="Align Right"
                                                        >
                                                            <AlignRight size={12} />
                                                        </button>
                                                        
                                                        <div className="w-px h-4 bg-slate-200 mx-1"></div>

                                                        <button
                                                            type="button"
                                                            onClick={() => executeProjectNotesCommand('insertUnorderedList')}
                                                            className="p-1.5 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                                            title="Bullet List"
                                                        >
                                                            <List size={12} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => executeProjectNotesCommand('insertOrderedList')}
                                                            className="p-1.5 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                                            title="Numbered List"
                                                        >
                                                            <ListOrdered size={12} />
                                                        </button>
                                                        
                                                        <div className="w-px h-4 bg-slate-200 mx-1"></div>

                                                        <button
                                                            type="button"
                                                            onClick={() => executeProjectNotesCommand('removeFormat')}
                                                            className="p-1.5 hover:bg-slate-200 text-slate-500 rounded transition-colors text-[9px] font-bold"
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

                                            {/* Bottom Info: Terms & Totals Side-by-Side */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end mt-auto">
                                                {/* Terms */}
                                                <div className="flex flex-col">
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Terms & Conditions</label>
                                                    <textarea
                                                        value={terms}
                                                        onChange={(e) => setTerms(e.target.value)}
                                                        rows={5}
                                                        className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none text-xs leading-relaxed text-slate-600 resize-y"
                                                    />
                                                </div>

                                                {/* Totals Box Minimal */}
                                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col gap-3">
                                                    <div className="flex justify-between items-center text-sm font-medium text-slate-500">
                                                        <span>Subtotal</span>
                                                        <span className="text-slate-900 font-bold">₹{subtotal.toLocaleString()}</span>
                                                    </div>

                                                    <div className="flex justify-between items-center text-sm font-medium text-slate-500">
                                                        <span>Discount (₹)</span>
                                                        <input
                                                            type="number"
                                                            value={discount || ''}
                                                            onChange={(e) => setDiscount(Number(e.target.value))}
                                                            className="w-24 px-2 py-1.5 bg-white border border-slate-200 rounded-md text-right text-slate-900 font-bold outline-none focus:border-blue-500 text-sm"
                                                        />
                                                    </div>

                                                    <div className="pt-3 border-t border-slate-200 flex justify-between items-end mt-1">
                                                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-800">Final Total</span>
                                                        <span className="text-2xl font-black text-blue-600 leading-none">₹{totalAmount.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex-1 flex flex-col min-h-[400px]">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                                                <span>Custom HTML Code</span>
                                                <span className="text-blue-500 normal-case font-medium">Rendered directly onto PDF body</span>
                                            </label>
                                            <textarea
                                                value={customHtmlContent}
                                                onChange={(e) => setCustomHtmlContent(e.target.value)}
                                                placeholder="<div class='custom-proposal'>...</div>\n\nPaste your HTML & Inline CSS here..."
                                                className="w-full flex-1 p-4 border border-slate-200 rounded-xl bg-slate-900 text-green-400 font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-600 resize-none"
                                            />
                                        </div>
                                    )}

                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="px-6 py-2.5 font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-all text-xs uppercase tracking-wider"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveQuotation}
                                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-xs font-black uppercase tracking-wider hover:bg-blue-700 transition-all shadow-md flex items-center gap-2"
                                >
                                    <CheckCircle size={16} /> {isEditing ? 'Update Quotation' : 'Save Quotation'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            {/* CREATE DEMO MODAL */}
            {
                isCreatingDemo && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-300">
                            {/* Header */}
                            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-violet-600">
                                <div>
                                    <h2 className="text-xl font-black text-white">Create Creative Demo</h2>
                                    <p className="text-violet-200 text-xs font-medium mt-0.5">Assign sample work before quoting</p>
                                </div>
                                <button onClick={() => setIsCreatingDemo(false)} className="text-violet-200 hover:text-white hover:bg-violet-500 p-2 rounded-xl transition-all">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Body - Scrollable */}
                            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6 bg-slate-50/50">

                                {/* Client Setup (Mirrors Quotation) */}
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                    <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setClientType('existing')}
                                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${clientType === 'existing' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                                        >
                                            Existing Client
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setClientType('new')}
                                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${clientType === 'new' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                                        >
                                            New Client <span className="text-[8px] bg-violet-100 text-violet-600 px-1 py-0.5 rounded ml-1">TEST</span>
                                        </button>
                                    </div>

                                    {clientType === 'existing' ? (
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Select Existing Client</label>
                                            <select
                                                value={selectedClientId}
                                                onChange={(e) => setSelectedClientId(e.target.value)}
                                                className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-violet-500 outline-none transition-all text-sm font-medium"
                                            >
                                                <option value="">-- Choose Client --</option>
                                                {clients.map(c => (
                                                    <option key={c.id} value={c.id}>{c.companyName || c.name} {c.mobile ? `(${c.mobile})` : ''}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Client / Company Name *</label>
                                                <input
                                                    value={newClientName}
                                                    onChange={(e) => setNewClientName(e.target.value)}
                                                    placeholder="e.g. Acme Corp"
                                                    className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-violet-500 outline-none transition-all text-sm font-medium"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Phone</label>
                                                    <input
                                                        value={newClientPhone}
                                                        onChange={(e) => setNewClientPhone(e.target.value)}
                                                        placeholder="+91..."
                                                        className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-violet-500 outline-none transition-all text-sm font-medium"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Email</label>
                                                    <input
                                                        value={newClientEmail}
                                                        onChange={(e) => setNewClientEmail(e.target.value)}
                                                        placeholder="contact@email.com"
                                                        className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-violet-500 outline-none transition-all text-sm font-medium"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Demo Details */}
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Service Required *</label>
                                        <select
                                            value={demoServiceId}
                                            onChange={(e) => setDemoServiceId(e.target.value)}
                                            className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-violet-500 outline-none transition-all text-sm font-medium"
                                        >
                                            <option value="">-- Choose Service --</option>
                                            {services.map(s => (
                                                <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Demo Description / Requirements *</label>
                                        <textarea
                                            value={demoDescription}
                                            onChange={(e) => setDemoDescription(e.target.value)}
                                            placeholder="Detailed description of what needs to be designed/developed..."
                                            rows={4}
                                            className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-violet-500 outline-none transition-all text-sm font-medium resize-none"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Assign To</label>
                                            <select
                                                value={demoAssignedEmployee}
                                                onChange={(e) => setDemoAssignedEmployee(e.target.value)}
                                                className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-violet-500 outline-none transition-all text-sm font-medium"
                                            >
                                                <option value="">-- Any Employee --</option>
                                                {employees.filter(e => e.role === 'employee').map(e => (
                                                    <option key={e.id} value={e.id}>{e.name} ({e.department})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Allocated Date</label>
                                            <input
                                                type="date"
                                                value={demoAllocationDate}
                                                onChange={(e) => setDemoAllocationDate(e.target.value)}
                                                className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-violet-500 outline-none transition-all text-sm font-bold text-slate-600 uppercase tracking-wider"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                                <button
                                    type="button"
                                    onClick={() => setIsCreatingDemo(false)}
                                    className="px-6 py-2.5 font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-all text-xs uppercase tracking-wider"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveDemo}
                                    className="px-6 py-2.5 bg-violet-600 text-white rounded-lg text-xs font-black uppercase tracking-wider hover:bg-violet-700 transition-all shadow-md flex items-center gap-2"
                                >
                                    <PlaySquare size={16} /> Init Demo
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* DELETE CONFIRMATION MODAL */}
            {
                deletingQuotationId && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-6 text-center">
                                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
                                    <AlertCircle size={32} className="text-red-500" />
                                </div>
                                <h3 className="text-lg font-black text-slate-900 mb-2">Delete Quotation?</h3>
                                <p className="text-sm text-slate-500 font-medium">This action cannot be undone. Are you sure you want to permanently delete this quotation?</p>
                            </div>
                            <div className="p-4 grid grid-cols-2 gap-3 bg-slate-50 border-t border-slate-100">
                                <button
                                    onClick={() => setDeletingQuotationId(null)}
                                    className="py-2.5 font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 hover:text-slate-900 rounded-xl transition-all text-xs uppercase tracking-wider"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="py-2.5 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-red-700 transition-all shadow-md flex items-center justify-center gap-2"
                                >
                                    <Trash2 size={16} /> Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default Quotations;
