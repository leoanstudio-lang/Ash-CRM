import React, { useState, useEffect } from 'react';
import { Quotation, QuotationItem, Client, CompanyProfile, DynamicField, Service } from '../types';
import { FileText, Plus, Trash2, Download, CheckCircle, Clock, X, Building2, User, Phone, Mail, Navigation, FileSignature, Search, Calendar, Filter, ArrowUpRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { addQuotationToDB, updateQuotationInDB, addClientToDB, getCompanyProfile, subscribeToCollection, deleteQuotationFromDB } from '../lib/db';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface QuotationsProps {
    clients: Client[];
    services: Service[];
}

const Quotations: React.FC<QuotationsProps> = ({ clients, services }) => {
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);

    const [isCreating, setIsCreating] = useState(false);
    const [deletingQuotationId, setDeletingQuotationId] = useState<string | null>(null);

    // Filters & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [dateFilter, setDateFilter] = useState('');

    // Form State
    const [clientType, setClientType] = useState<'existing' | 'new'>('existing');
    const [selectedClientId, setSelectedClientId] = useState<string>('');

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

    useEffect(() => {
        // Fetch company profile for the letterhead
        getCompanyProfile().then(profile => {
            if (profile) setCompanyProfile(profile);
        });

        // Subscribe to live quotations
        const unsub = subscribeToCollection<Quotation>('quotations', (data) => {
            // Sort by newest first
            setQuotations(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        });
        return () => unsub();
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
        setNewClientName('');
        setNewClientCompany('');
        setNewClientEmail('');
        setNewClientPhone('');
        setClientAddress('');
        setItems([{ description: '', quantity: 1, unitPrice: 0, total: 0 }]);
        setDiscount(0);
        setIsCreating(false);
    };

    const handleSaveQuotation = async () => {
        // Basic validation
        if (clientType === 'existing' && !selectedClientId) return alert("Please select a client.");
        if (clientType === 'new' && !newClientName) return alert("Please enter client name.");
        if (items.some(i => !i.description)) return alert("All items must have a description.");

        // Generate strict QTN ID
        const qtnCount = quotations.length + 1;
        const qNumber = `QTN-${new Date().getFullYear()}-${qtnCount.toString().padStart(3, '0')}`;

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

        const newQtn: Omit<Quotation, 'id'> = {
            quotationNumber: qNumber,
            issueDate,
            validityDate,
            clientName: finalClientName,
            clientEmail: finalClientEmail,
            clientPhone: finalClientPhone,
            items,
            subtotal,
            discount: discount || 0,
            totalAmount,
            termsAndConditions: terms,
            status: 'Draft',
            createdAt: new Date().toISOString(),
            isNewClient: clientType === 'new'
        };

        if (clientType === 'existing' && selectedClientId) newQtn.clientId = selectedClientId;
        if (clientAddress) newQtn.clientAddress = clientAddress;

        try {
            await addQuotationToDB(newQtn);
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
            case 'Approved': return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200';
            case 'Rejected': return 'bg-red-100 text-red-700 hover:bg-red-200';
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
        // 1. HEADER SECTION
        // ==========================================
        let addedLogo = false;

        // Strict Left Header: ONLY Logo or Company Name
        if (co?.logoUrl) {
            try {
                const base64Logo = await loadImageAsBase64(co.logoUrl);
                // Calculate aspect ratio to fit nicely in the top left
                doc.addImage(base64Logo, 'PNG', 14, 15, 35, 12, '', 'FAST');
                addedLogo = true;
            } catch (err) {
                console.warn("Could not load logo for PDF, falling back to text:", err);
            }
        }

        doc.setTextColor(...deepEclipse);

        if (!addedLogo) {
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.text(co?.companyName || 'Your Company', 14, 22);
        }

        // Right Side: QUOTATION & Details Box
        doc.setFontSize(22);
        doc.setTextColor(...deepEclipse);
        doc.setFont("helvetica", "bold");
        doc.text("QUOTATION", 196, 22, { align: 'right' });

        doc.setFontSize(9);
        doc.setTextColor(...textMuted);
        doc.setFont("helvetica", "bold");
        doc.text("Quote No:", 150, 32);
        doc.text("Date:", 150, 38);
        doc.text("Valid Until:", 150, 44);

        doc.setTextColor(...deepEclipse);
        doc.setFont("helvetica", "normal");
        doc.text(q.quotationNumber, 196, 32, { align: 'right' });
        doc.text(formatDate(q.issueDate), 196, 38, { align: 'right' });
        doc.text(formatDate(q.validityDate), 196, 44, { align: 'right' });

        // Left Side Tagline (Filling the gap beautifully)
        let leftSideY = addedLogo ? 32 : 28; // Adjust Y coordinate based on whether logo or text was printed
        if (co?.tagline && co.tagline.trim() !== "") {
            doc.setFontSize(9);
            doc.setFont("helvetica", "italic");
            doc.setTextColor(...textMuted);

            // Split tagline in case it's a long quote
            const splitTagline = doc.splitTextToSize(co.tagline, 100);
            doc.text(splitTagline, 14, leftSideY);
        }

        // ==========================================
        // 2. DIVIDER
        // ==========================================
        let maxHeaderY = 50; // Tightened spacing to remove massive gap

        doc.setDrawColor(...lightGray);
        doc.setLineWidth(0.5);
        doc.line(14, maxHeaderY, 196, maxHeaderY);
        maxHeaderY += 10;

        // ==========================================
        // 3. CLIENT DETAILS (QUOTATION FOR)
        // ==========================================
        doc.setFontSize(8);
        doc.setTextColor(...textMuted);
        doc.setFont("helvetica", "bold");
        doc.text("QUOTATION FOR", 14, maxHeaderY);

        maxHeaderY += 6;
        doc.setFontSize(14);
        doc.setTextColor(...deepEclipse);
        doc.text(q.clientName, 14, maxHeaderY);

        maxHeaderY += 5;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...deepEclipse);

        if (q.clientEmail && q.clientEmail !== "No Email Registered" && q.clientEmail.trim() !== "") {
            doc.text(q.clientEmail, 14, maxHeaderY);
            maxHeaderY += 4.5;
        }
        if (q.clientPhone && q.clientPhone.trim() !== "") {
            doc.text(q.clientPhone, 14, maxHeaderY);
            maxHeaderY += 4.5;
        }
        if (q.clientAddress && q.clientAddress.trim() !== "") {
            const splitAddress = doc.splitTextToSize(q.clientAddress, 80);
            doc.text(splitAddress, 14, maxHeaderY);
            maxHeaderY += (splitAddress.length * 4.5);
        }

        // ==========================================
        // 4. ITEMS TABLE 
        // ==========================================
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
                halign: 'left' // Default left
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
            alternateRowStyles: {
                fillColor: [255, 255, 255]
            },
            margin: { left: 14, right: 14 },
            didParseCell: (data) => {
                // Force Right-Alignment specifically for the 'UNIT PRICE' and 'TOTAL' headers
                if (data.section === 'head' && (data.column.index === 3 || data.column.index === 4)) {
                    data.cell.styles.halign = 'right';
                }
                // Force Center alignment for the 'QTY' header
                if (data.section === 'head' && data.column.index === 2) {
                    data.cell.styles.halign = 'center';
                }
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
        const finalY = (doc as any).lastAutoTable.finalY || tableStartY + 50;

        // Exact Alignment Setup
        const rightEdge = 196; // Right margin exactly matching table column 
        const totalsBoxX = 135; // Shifted left to prevent text overlap with large numbers
        let totalsY = finalY + 15;

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
            doc.setTextColor(225, 29, 72); // rose-600
            doc.text(`-Rs. ${q.discount.toLocaleString()}`, rightEdge, totalsY, { align: 'right' });
        }

        // Final Total Line
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
        // 6. TERMS & CONDITIONS
        // ==========================================
        let termsY = finalY + 15;
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...deepEclipse);
        doc.text("TERMS & CONDITIONS", 14, termsY);

        termsY += 5;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...textMuted);
        const splitTerms = doc.splitTextToSize(q.termsAndConditions, 100);
        doc.text(splitTerms, 14, termsY, { lineHeightFactor: 1.5 });

        // ==========================================
        // 7. PAGE FOOTER (Professional Comprehensive)
        // ==========================================
        const pageHeight = doc.internal.pageSize.height;
        const footerStartY = pageHeight - 35;

        doc.setDrawColor(...lightGray);
        doc.setLineWidth(0.5);
        doc.line(14, footerStartY, 196, footerStartY);

        let footY = footerStartY + 6;

        // Render company name on the left inside footer
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...deepEclipse);
        doc.text(co?.companyName || 'Your Company', 14, footY);

        if (co?.tagline && co.tagline.trim() !== "") {
            footY += 4.5;
            doc.setFontSize(8);
            doc.setFont("helvetica", "italic");
            doc.setTextColor(...textMuted);
            doc.text(co.tagline, 14, footY);
        }

        // Render company contacts cleanly aligned right in the footer
        let rightFootY = footerStartY + 6;
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...textMuted);

        if (co?.contacts && co.contacts.length > 0) {
            // Limit to 4 contacts in footer, render them right-aligned, stacked
            let footerContacts = [...co.contacts];

            // Assume 0 is address, others are phone/email/web.
            // Let's print the address on the left and the others on the right.
            const address = footerContacts.shift()?.value || "";
            if (address) {
                const addSplit = doc.splitTextToSize(address, 80);
                footY += 6;
                doc.text(addSplit, 14, footY);
            }

            // Print remaining contacts on the right side
            footerContacts.slice(0, 3).forEach(c => {
                doc.text(c.value, 196, rightFootY, { align: 'right' });
                rightFootY += 4.5;
            });
        }

        // Output PDF
        const safeName = q.clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        doc.save(`Quotation_${safeName}_${q.quotationNumber}.pdf`);
    };

    // -------------------------------------------------------------------------------- //
    // MAIN APP UI
    // -------------------------------------------------------------------------------- //
    return (
        <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* Header & Mini Dashboard */}
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

            {/* Search and Filters Bar */}
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
                            <option value="Approved">Approved</option>
                            <option value="Rejected">Rejected</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                            ▼
                        </div>
                    </div>
                </div>
            </div>

            {/* List View */}
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
                                        <span className="text-xs font-bold text-slate-700">{q.quotationNumber}</span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex flex-col">
                                            <span className="font-black text-slate-800 text-sm">{q.clientName}</span>
                                            {q.isNewClient && <span className="text-[9px] font-bold uppercase tracking-wider text-blue-500 mt-0.5 border border-blue-200 bg-blue-50 w-fit px-1.5 rounded">New Client</span>}
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
                                    <td colSpan={6} className="py-24 text-center text-slate-400">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <FileSignature size={32} className="opacity-20" />
                                        </div>
                                        <p className="font-black text-xs uppercase tracking-[0.3em]">No quotations found</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* CREATE QUOTATION MODAL */}
            {
                isCreating && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex py-10 justify-center overflow-y-auto w-full">
                        <div className="bg-white w-full max-w-6xl min-h-full md:min-h-0 md:rounded-2xl shadow-xl flex flex-col my-auto border border-slate-200">
                            {/* Modal Header */}
                            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white rounded-t-2xl">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                        Create Quotation
                                    </h2>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Professional layout</p>
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
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Select Client <span className="text-rose-500">*</span></label>
                                                <select
                                                    value={selectedClientId}
                                                    onChange={(e) => setSelectedClientId(e.target.value)}
                                                    className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-medium"
                                                >
                                                    <option value="">-- Choose Existing Client --</option>
                                                    {clients.map(c => <option key={c.id} value={c.id}>{c.companyName || c.name} ({c.mobile})</option>)}
                                                </select>
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
                                <div className="w-full lg:w-[68%] p-6 flex flex-col gap-8">

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
                                    <CheckCircle size={16} /> Save Quotation
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            {/* DELETE CONFIRMATION MODAL */}
            {deletingQuotationId && (
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
            )}

        </div>
    );
};

export default Quotations;
