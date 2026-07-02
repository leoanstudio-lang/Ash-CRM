import React, { useState, useEffect } from 'react';
import SearchableSelect from './SearchableSelect';
import { Client, Project, Priority, Service, Employee, Quotation, PaymentAlert, ProjectNote, MarketingServiceAllocation, MarketingReportEntry } from '../types';
import { PROJECT_STATUSES } from '../constants';
import {
  Plus, Search, Calendar, Clock, BarChart3, Settings2, Edit3,
  CheckCircle2, AlertCircle, TrendingUp, Layers, ChevronRight,
  Timer, X, Megaphone, Target, Zap, Trash2, ArrowLeft, Download, FileText,
  User, Check, AlertTriangle, ShieldAlert,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered
} from 'lucide-react';
import { addProjectToDB, updateProjectInDB, addPaymentAlertToDB, deleteProjectFromDB } from '../lib/db';
import jsPDF from 'jspdf';
import { loadWatermarkBase64, stampWatermarkAllPages } from '../lib/pdfWatermark';
import GoogleDocsWorkspace from './GoogleDocsWorkspace';

interface MarketingProps {
  clients: Client[];
  projects: Project[];
  setProjects?: React.Dispatch<React.SetStateAction<Project[]>>;
  services?: Service[];
  employees?: Employee[];
  quotations?: Quotation[];
  paymentAlerts?: PaymentAlert[];
}

interface RichTextEditorProps {
  initialValue: string;
  onInput: (html: string) => void;
  onPaste: (e: React.ClipboardEvent<HTMLDivElement>) => void;
  className: string;
  editorRef: React.RefObject<HTMLDivElement>;
  serviceId: string;
}

const RichTextEditor = React.memo(({ initialValue, onInput, onPaste, className, editorRef, serviceId }: RichTextEditorProps) => {
  React.useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== initialValue) {
      editorRef.current.innerHTML = initialValue;
    }
  }, [initialValue]);

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onInput={(e) => onInput(e.currentTarget.innerHTML)}
      onPaste={onPaste}
      className={className}
      style={{ wordBreak: 'break-word' }}
    />
  );
}, (prevProps, nextProps) => {
  return prevProps.serviceId === nextProps.serviceId;
});

const Marketing: React.FC<MarketingProps> = ({
  clients,
  projects,
  setProjects,
  services = [],
  employees = [],
  quotations = [],
  paymentAlerts = []
}) => {
  const [subSection, setSubSection] = useState<'Daily' | 'Control'>('Daily');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [activeWorkspaceProject, setActiveWorkspaceProject] = useState<Project | null>(null);

  // Keep the active workspace project state synchronized with master projects list from Firestore
  useEffect(() => {
    if (activeWorkspaceProject) {
      const updated = projects.find(p => p.id === activeWorkspaceProject.id);
      if (updated) {
        setActiveWorkspaceProject(updated);
      }
    }
  }, [projects, activeWorkspaceProject?.id]);

  const [workspaceTab, setWorkspaceTab] = useState<'overview' | 'reports' | 'notes' | 'financials'>('overview');
  const [selectedReportServiceId, setSelectedReportServiceId] = useState<string>('');
  const [notesText, setNotesText] = useState<string>('');
  const notesEditorRef = React.useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [creationSource, setCreationSource] = useState<'manual' | 'sales'>('manual');
  const [selectedQuotationId, setSelectedQuotationId] = useState<string>('');
  
  // Workspace sub-states
  const [newNoteText, setNewNoteText] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [viewingReportServiceId, setViewingReportServiceId] = useState<string | null>(null);

  const [projectForm, setProjectForm] = useState<Partial<Project>>({
    clientId: '',
    assignedEmployeeId: '',
    type: 'Marketing',
    priority: 'Medium',
    status: 'In Progress',
    startDate: '',
    deadline: '',
    totalAmount: 0,
    advance: 0,
    description: ''
  });

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  const getTodayLocal = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const today = getTodayLocal();
  const todayStr = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectForm.clientId || !projectForm.deadline || !projectForm.startDate) return;

    const client = clients.find(c => c.id === projectForm.clientId);
    const emp = employees.find(em => em.id === projectForm.assignedEmployeeId);

    const servicesAllocated: MarketingServiceAllocation[] = selectedServiceIds.map(sId => {
      const sObj = services.find(s => s.id === sId);
      return {
        serviceId: sId,
        serviceName: sObj ? sObj.name : 'Unknown Service',
        status: 'Pending',
        reportsHistory: []
      };
    });

    const primaryServiceObj = services.find(s => s.id === selectedServiceIds[0]);

    if (editingProject) {
      const existingAllocs = editingProject.servicesAllocated || [];
      const updatedAllocations = selectedServiceIds.map(sId => {
        const match = existingAllocs.find(x => x.serviceId === sId);
        if (match) return match;
        const sObj = services.find(s => s.id === sId);
        return {
          serviceId: sId,
          serviceName: sObj ? sObj.name : 'Unknown Service',
          status: 'Pending' as const,
          reportsHistory: []
        };
      });

      const updates = {
        ...projectForm,
        clientName: client?.name,
        assignedEmployeeName: emp?.name || '',
        serviceId: selectedServiceIds[0] || 'MKT_MASTER',
        serviceName: primaryServiceObj ? primaryServiceObj.name : 'Marketing',
        totalAmount: Number(projectForm.totalAmount),
        advance: Number(projectForm.advance),
        servicesAllocated: updatedAllocations
      };
      await updateProjectInDB(editingProject.id, updates);
    } else {
      const projectToAdd: any = {
        clientId: projectForm.clientId!,
        clientName: client?.name || '',
        assignedEmployeeId: projectForm.assignedEmployeeId || '',
        assignedEmployeeName: emp?.name || '',
        serviceId: selectedServiceIds[0] || 'MKT_MASTER',
        serviceName: primaryServiceObj ? primaryServiceObj.name : 'Marketing',
        type: 'Marketing',
        priority: (projectForm.priority as Priority) || 'Medium',
        startDate: projectForm.startDate!,
        deadline: projectForm.deadline!,
        totalAmount: Number(projectForm.totalAmount) || 0,
        advance: Number(projectForm.advance) || 0,
        description: projectForm.description || '',
        status: projectForm.status || 'In Progress',
        createdAt: new Date().toISOString(),
        servicesAllocated
      };
      await addProjectToDB(projectToAdd);
    }

    if (!editingProject && Number(projectForm.advance) > 0) {
      try {
        await addPaymentAlertToDB({
          clientId: projectForm.clientId || '',
          clientName: client?.name || 'Unknown Client',
          projectId: 'PENDING_ID',
          taskName: primaryServiceObj ? primaryServiceObj.name : 'Marketing',
          milestoneLabel: 'Advance',
          amount: Number(projectForm.advance),
          status: 'received',
          triggeredAt: new Date().toISOString(),
          resolvedAt: new Date().toISOString(),
          type: 'standalone',
          department: 'Marketing'
        });
      } catch (err) {
        console.error('Error creating advance payment record:', err);
      }
    }

    setShowAddModal(false);
    setEditingProject(null);
    resetForm();
  };

  const resetForm = () => {
    setProjectForm({
      clientId: '',
      assignedEmployeeId: '',
      type: 'Marketing',
      priority: 'Medium',
      status: 'In Progress',
      startDate: '',
      deadline: '',
      totalAmount: 0,
      advance: 0,
      description: ''
    });
    setSelectedServiceIds([]);
    setCreationSource('manual');
    setSelectedQuotationId('');
  };

  const handleDeleteProject = async (id: string, clientName: string) => {
    if (window.confirm(`Are you sure you want to permanently delete the marketing campaign for "${clientName}"? This action cannot be undone.`)) {
      try {
        await deleteProjectFromDB(id);
        if (activeWorkspaceProject?.id === id) {
          setActiveWorkspaceProject(null);
        }
      } catch (err) {
        console.error("Failed to delete project:", err);
        alert("An error occurred while deleting the project.");
      }
    }
  };

  const handleSelectQuotation = (qId: string) => {
    setSelectedQuotationId(qId);
    if (!qId) {
      resetForm();
      return;
    }
    const quote = quotations.find(q => q.id === qId);
    if (quote) {
      const matchedClient = clients.find(c =>
        c.name.toLowerCase() === quote.clientName.toLowerCase() ||
        c.companyName.toLowerCase() === quote.clientName.toLowerCase()
      );
      
      const desc = quote.items.map(item => `${item.description} (Qty: ${item.quantity})`).join('\n');

      setProjectForm({
        ...projectForm,
        clientId: matchedClient ? matchedClient.id : '',
        totalAmount: quote.totalAmount,
        advance: 0,
        description: desc,
        startDate: new Date().toISOString().split('T')[0],
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'Pending',
        priority: 'Medium',
        type: 'Marketing'
      });
    }
  };

  const openWorkspace = (project: Project) => {
    setActiveWorkspaceProject(project);
    setWorkspaceTab('overview');
    setProjectForm({ ...project });
    setNotesText(project.marketingNotes || '');
    setNewNoteText('');
    setSelectedServiceId('');
    setViewingReportServiceId(null);
  };

  React.useEffect(() => {
    if (workspaceTab === 'notes' && notesEditorRef.current && activeWorkspaceProject) {
      notesEditorRef.current.innerHTML = activeWorkspaceProject.marketingNotes || '';
      setNotesText(activeWorkspaceProject.marketingNotes || '');
    }
  }, [workspaceTab, activeWorkspaceProject?.id]);

  const executeNotesCommand = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    if (notesEditorRef.current) {
      setNotesText(notesEditorRef.current.innerHTML);
    }
  };

  const handleSaveNotesLedger = async () => {
    if (!activeWorkspaceProject) return;
    const finalHtml = notesEditorRef.current ? notesEditorRef.current.innerHTML : notesText;
    
    await updateProjectInDB(activeWorkspaceProject.id, { marketingNotes: finalHtml });
    setActiveWorkspaceProject({ ...activeWorkspaceProject, marketingNotes: finalHtml });
    alert("Notes Ledger successfully saved!");
  };

  const handleEditorPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    
    selection.deleteFromDocument();
    
    const range = selection.getRangeAt(0);
    const fragment = document.createDocumentFragment();
    const lines = text.split('\n');
    
    lines.forEach((line, idx) => {
      fragment.appendChild(document.createTextNode(line));
      if (idx < lines.length - 1) {
        fragment.appendChild(document.createElement('br'));
      }
    });
    
    range.insertNode(fragment);
    
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    
    const target = e.currentTarget as HTMLDivElement;
    if (target === notesEditorRef.current) {
      setNotesText(target.innerHTML);
    }
  };


  const handleAddService = async () => {
    if (!selectedServiceId || !activeWorkspaceProject) return;
    const service = services.find(s => s.id === selectedServiceId);
    if (!service) return;
    
    const existingServices = activeWorkspaceProject.servicesAllocated || [];
    if (existingServices.some(s => s.serviceId === selectedServiceId)) {
      alert("This service is already allocated.");
      return;
    }
    
    const newAlloc: MarketingServiceAllocation = {
      serviceId: service.id,
      serviceName: service.name,
      status: 'Pending',
      reportsHistory: []
    };
    
    const updatedAllocations = [...existingServices, newAlloc];
    const updatedProj = { ...activeWorkspaceProject, servicesAllocated: updatedAllocations };
    
    await updateProjectInDB(activeWorkspaceProject.id, { servicesAllocated: updatedAllocations });
    setActiveWorkspaceProject(updatedProj);
    setSelectedServiceId('');
  };

  const handleRemoveService = async (serviceId: string) => {
    if (!activeWorkspaceProject) return;
    if (!window.confirm("Are you sure you want to remove this service allocation? All reports history for this service will be deleted.")) return;
    
    const updatedAllocations = (activeWorkspaceProject.servicesAllocated || []).filter(s => s.serviceId !== serviceId);
    const updatedProj = { ...activeWorkspaceProject, servicesAllocated: updatedAllocations };
    
    await updateProjectInDB(activeWorkspaceProject.id, { servicesAllocated: updatedAllocations });
    setActiveWorkspaceProject(updatedProj);
  };

  const handleAssignEmployee = async (serviceId: string, employeeId: string) => {
    if (!activeWorkspaceProject) return;
    const emp = employees.find(e => e.id === employeeId);
    
    const updatedAllocations = (activeWorkspaceProject.servicesAllocated || []).map(s => {
      if (s.serviceId === serviceId) {
        return {
          ...s,
          assignedEmployeeId: employeeId || undefined,
          assignedEmployeeName: emp ? emp.name : undefined
        };
      }
      return s;
    });
    
    const updatedProj = { ...activeWorkspaceProject, servicesAllocated: updatedAllocations };
    await updateProjectInDB(activeWorkspaceProject.id, { servicesAllocated: updatedAllocations });
    setActiveWorkspaceProject(updatedProj);
  };

  const handleUpdateServiceStatus = async (serviceId: string, status: any) => {
    if (!activeWorkspaceProject) return;
    
    const updatedAllocations = (activeWorkspaceProject.servicesAllocated || []).map(s => {
      if (s.serviceId === serviceId) {
        return { ...s, status };
      }
      return s;
    });
    
    const updatedProj = { ...activeWorkspaceProject, servicesAllocated: updatedAllocations };
    await updateProjectInDB(activeWorkspaceProject.id, { servicesAllocated: updatedAllocations });
    setActiveWorkspaceProject(updatedProj);
  };

  const handleManualInvoiceNextMonth = async () => {
    if (!activeWorkspaceProject) return;
    const currentDeadline = new Date(activeWorkspaceProject.deadline);
    
    const nextStart = new Date(currentDeadline.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const nextEnd = new Date(currentDeadline.getTime() + 31 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const milestoneLabel = `Monthly Retainer: ${nextStart} to ${nextEnd}`;
    
    try {
      await addPaymentAlertToDB({
        clientId: activeWorkspaceProject.clientId,
        clientName: activeWorkspaceProject.clientName || 'Unknown Client',
        projectId: activeWorkspaceProject.id,
        taskName: activeWorkspaceProject.serviceName || 'Marketing',
        milestoneLabel: milestoneLabel,
        amount: activeWorkspaceProject.totalAmount,
        status: 'due',
        triggeredAt: new Date().toISOString(),
        type: 'standalone',
        department: 'Marketing'
      });
      alert("Next month retainer invoice has been issued to the Payments desk.");
    } catch (err) {
      console.error("Failed to create manual retainer alert:", err);
      alert("Error issuing invoice.");
    }
  };

  useEffect(() => {
    const checkReminders = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (const proj of mktProjects) {
        if (proj.status === 'Completed' || proj.status === 'Closed') continue;
        if (!proj.deadline) continue;
        
        const deadlineDate = new Date(proj.deadline);
        deadlineDate.setHours(0, 0, 0, 0);
        
        const diffTime = deadlineDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 3 && diffDays >= -15) {
          const milestoneLabel = `Monthly Retainer Balance - Period Ending ${proj.deadline}`;
          const alreadyAlerted = paymentAlerts.some(a => a.projectId === proj.id && a.milestoneLabel === milestoneLabel);
          
          if (!alreadyAlerted) {
            try {
              await addPaymentAlertToDB({
                clientId: proj.clientId,
                clientName: proj.clientName || 'Unknown Client',
                projectId: proj.id,
                taskName: proj.serviceName || 'Marketing',
                milestoneLabel: milestoneLabel,
                amount: (proj.totalAmount || 0) - (proj.advance || 0),
                status: 'due',
                triggeredAt: new Date().toISOString(),
                type: 'standalone',
                department: 'Marketing'
              });
            } catch (err) {
              console.error("Failed to auto-create reminder payment alert:", err);
            }
          }
        }
      }
    };
    
    if (mktProjects.length > 0 && paymentAlerts) {
      checkReminders();
    }
  }, [projects, paymentAlerts]);

  const openEdit = (project: Project) => {
    setEditingProject(project);
    setProjectForm({ ...project });
    const sIds = (project.servicesAllocated || []).map(s => s.serviceId);
    setSelectedServiceIds(sIds);
    setShowAddModal(true);
  };

  const updateProjectStatus = async (projectId: string, status: string) => {
    const updates: any = { status };
    if (status === 'Completed' || status === 'Closed') {
      updates.completedAt = new Date().toISOString();
      const project = mktProjects.find(p => p.id === projectId);
      if (project) {
        const balance = (project.totalAmount || 0) - (project.advance || 0);
        if (balance > 0) {
          try {
            await addPaymentAlertToDB({
              clientId: project.clientId,
              clientName: project.clientName || 'Unknown Client',
              projectId: project.id,
              taskName: project.serviceName || 'Marketing',
              milestoneLabel: 'Final Balance',
              amount: balance,
              status: 'due',
              triggeredAt: new Date().toISOString(),
              type: 'standalone',
              department: 'Marketing'
            });
          } catch (err) {
            console.error('Error creating marketing balance payment record:', err);
          }
        }
      }
    }
    await updateProjectInDB(projectId, updates);
    if (activeWorkspaceProject?.id === projectId) {
      setActiveWorkspaceProject(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const mktProjects = projects.filter(p => p.type === 'Marketing');

  const filteredProjects = mktProjects.filter(p =>
    !searchTerm ||
    p.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.serviceName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const dailyProjects = mktProjects.filter(p => {
    const start = parseLocalDate(p.startDate);
    const isStarted = today >= start;
    const isNotFinished = p.status !== 'Completed' && p.status !== 'Closed';
    return isStarted && isNotFinished;
  });

  const getRemainingDaysInfo = (deadline: string) => {
    const end = parseLocalDate(deadline);
    const diffTime = end.getTime() - today.getTime();
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (days < 0) return { text: `${Math.abs(days)}d Overdue`, color: 'text-red-650', bg: 'bg-red-50/50', iconColor: 'text-red-500' };
    if (days === 0) return { text: 'Due Today', color: 'text-orange-650', bg: 'bg-orange-50/50', iconColor: 'text-orange-500' };
    return { text: `${days}d Remaining`, color: 'text-slate-650', bg: 'bg-slate-50', iconColor: 'text-slate-500' };
  };

  const priorityColor = (priority: string) => {
    if (priority === 'Urgent') return 'bg-red-50 text-red-600 border border-red-100';
    if (priority === 'High') return 'bg-orange-50 text-orange-600 border border-orange-100';
    if (priority === 'Medium') return 'bg-slate-50 text-slate-700 border border-slate-200';
    return 'bg-slate-55 text-slate-600 border border-slate-100';
  };

  const downloadReportPDF = async (reportContent: string, serviceName: string, clientName: string) => {
    const doc = new jsPDF();
    const deepEclipse: [number, number, number] = [15, 23, 42];
    const textMuted: [number, number, number] = [100, 116, 139];
    const lightGray: [number, number, number] = [226, 232, 240];
    const pageWidth = doc.internal.pageSize.width;
    
    doc.setFillColor(...deepEclipse);
    doc.rect(0, 0, 210, 38, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('MARKETING CAMPAIGN REPORT', 15, 16);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(200, 200, 220);
    doc.text(`SERVICE: ${serviceName.toUpperCase()} | TARGET CLIENT: ${clientName.toUpperCase()}`, 15, 23);
    
    const logoImg = new Image();
    logoImg.src = '/LOGO-WHITE.png';
    
    const completePdfDrawing = async () => {
      let currentY = 48;
      doc.setDrawColor(...lightGray);
      doc.line(15, currentY, 195, currentY);
      currentY += 8;

      const container = document.createElement('div');
      container.innerHTML = reportContent;
      container.style.width = '688px'; // 182mm width at 96dpi
      container.style.padding = '0px';
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
        *:first-child { margin-top: 0 !important; margin-block-start: 0 !important; padding-top: 0 !important; }
        h1, h2, h3, p, li, img, blockquote { page-break-inside: avoid !important; break-inside: avoid !important; }
        h1 { font-size: 18px; font-weight: bold; color: #0f172a; margin-top: 12px; margin-bottom: 6px; }
        h2 { font-size: 15px; font-weight: bold; color: #0f172a; margin-top: 10px; margin-bottom: 5px; }
        h3 { font-size: 13px; font-weight: bold; color: #0f172a; margin-top: 8px; margin-bottom: 4px; }
        p { line-height: 1.6; color: #334155; font-size: 12px; margin-bottom: 8px; }
        ul { margin-top: 4px; padding-left: 18px; color: #334155; font-size: 12px; line-height: 1.6; list-style-type: disc; margin-bottom: 8px; }
        ol { margin-top: 4px; padding-left: 18px; color: #334155; font-size: 12px; line-height: 1.6; list-style-type: decimal; margin-bottom: 8px; }
        li { margin-bottom: 3px; }
        b, strong { font-weight: bold; }
        i, em { font-style: italic; }
        u { text-decoration: underline; }
      `;
      container.appendChild(style);
      document.body.appendChild(container);

      try {
        const topMargin = 20;
        await doc.html(container, {
          x: 15,
          y: currentY - topMargin,
          width: 180,
          windowWidth: 688,
          margin: [topMargin, 0, 30, 0],
          autoPaging: 'slice',
          html2canvas: {
            useCORS: true,
            logging: false
          }
        });
      } catch (err) {
        console.error("HTML PDF Render failed:", err);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const splitText = doc.splitTextToSize(container.innerText || '', pageWidth - 30);
        doc.text(splitText, 15, currentY);
      } finally {
        document.body.removeChild(container);
      }

      // Paginated Footer
      // Stamp watermark on all pages before drawing footer overlays
      const watermarkB64 = await loadWatermarkBase64();
      stampWatermarkAllPages(doc, watermarkB64);

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const pageHeight = doc.internal.pageSize.height;
        doc.setDrawColor(...lightGray);
        doc.setLineWidth(0.5);
        doc.line(15, pageHeight - 18, pageWidth - 15, pageHeight - 18);
        
        doc.setFontSize(7);
        doc.setTextColor(...textMuted);
        doc.setFont("helvetica", "bold");
        doc.text("ASH CRM - MARKETING REPORT DESK", 15, pageHeight - 12);
        doc.text(`PAGE ${i} OF ${pageCount}`, pageWidth - 15, pageHeight - 12, { align: 'right' });
      }

      doc.save(`MktReport_${clientName.replace(/\s+/g, '_')}_${serviceName.replace(/\s+/g, '_')}.pdf`);
    };

    logoImg.onload = () => {
      doc.addImage(logoImg, 'PNG', 170, 6, 25, 25);
      completePdfDrawing();
    };
    logoImg.onerror = () => {
      completePdfDrawing();
    };
  };

  return (
    <div className="space-y-5 font-sans antialiased text-slate-800 text-xs">
      {activeWorkspaceProject ? (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm animate-in fade-in duration-200 p-5">
          <div className="flex flex-col lg:flex-row gap-5">
            {/* Sidebar Controls */}
            <div className="w-full lg:w-56 shrink-0 space-y-3.5">
              <button
                onClick={() => { setActiveWorkspaceProject(null); }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[11px] font-bold transition w-full shadow-sm"
              >
                <ArrowLeft size={13} /> Back to Campaigns
              </button>
              
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-3.5">
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Target Account</span>
                  <h3 className="text-sm font-extrabold text-slate-800 leading-tight">{activeWorkspaceProject.clientName}</h3>
                </div>
                <div className="h-px bg-slate-250"></div>
                <div className="space-y-1">
                  <button
                    onClick={() => setWorkspaceTab('overview')}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${workspaceTab === 'overview' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-655 hover:bg-slate-200/50'}`}
                  >
                    Services & Allocations
                  </button>
                  <button
                    onClick={() => setWorkspaceTab('notes')}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${workspaceTab === 'notes' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-655 hover:bg-slate-200/50'}`}
                  >
                    Notes Ledger
                  </button>
                  <button
                    onClick={() => setWorkspaceTab('financials')}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${workspaceTab === 'financials' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-655 hover:bg-slate-200/50'}`}
                  >
                    Financials & Retainer
                  </button>
                </div>
              </div>
            </div>
            
            {/* Tab Workspace Panel */}
            <div className="flex-1 min-w-0">
              {workspaceTab === 'overview' && (
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-150">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 leading-tight">Campaign Operations</h3>
                      <p className="text-[10px] text-slate-400 font-medium">Manage active services and assign specialists.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Global Status</span>
                      <select
                        value={activeWorkspaceProject.status}
                        onChange={(e) => updateProjectStatus(activeWorkspaceProject.id, e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                      >
                        {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Allocations & Multi-Services Grid */}
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
                      <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Allocate New Digital Service</h4>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <select
                          value={selectedServiceId}
                          onChange={(e) => setSelectedServiceId(e.target.value)}
                          className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-750 focus:ring-1 focus:ring-slate-400 outline-none cursor-pointer"
                        >
                          <option value="">-- Select Marketing Service --</option>
                          {services
                            .filter(s => s.category === 'Digital Marketing' || s.category === 'SEO' || s.category === 'Marketing')
                            .map(s => (
                              <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
                            ))
                          }
                        </select>
                        <button
                          onClick={handleAddService}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-sm"
                        >
                          + Allocate Service
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center">
                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Active Services & Specializations</h4>
                        {(activeWorkspaceProject.servicesAllocated || []).length > 0 && (
                          <button
                            onClick={() => {
                              setSelectedReportServiceId(activeWorkspaceProject.servicesAllocated[0].serviceId);
                              setWorkspaceTab('reports');
                            }}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[9px] font-extrabold shadow-sm transition inline-flex items-center gap-1.5 uppercase tracking-wider font-sans"
                          >
                            <FileText size={10} /> Open Workspace Report / Logs
                          </button>
                        )}
                      </div>
                      {(activeWorkspaceProject.servicesAllocated || []).length === 0 ? (
                        <div className="py-6 border border-dashed border-slate-200 rounded-lg text-center text-xs font-bold uppercase tracking-widest text-slate-400">
                          No services allocated yet.
                        </div>
                      ) : (
                        <div className="border border-slate-250 rounded-lg overflow-hidden bg-white shadow-sm">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-slate-450 font-black uppercase text-[8px] tracking-wider">
                                <th className="px-4 py-3">Service Name</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Assigned Specialist</th>
                                <th className="px-4 py-3">Progress State</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                              {(activeWorkspaceProject.servicesAllocated || []).map(alloc => (
                                <tr key={alloc.serviceId} className="hover:bg-slate-50/40 transition-colors">
                                  <td className="px-4 py-3 font-extrabold text-slate-800 text-xs">{alloc.serviceName}</td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 border rounded text-[8px] font-black uppercase tracking-wider inline-block ${alloc.status === 'Finished' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : (alloc.status === 'Working' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-500 border-slate-150')}`}>
                                      {alloc.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <select
                                      value={alloc.assignedEmployeeId || ''}
                                      onChange={(e) => handleAssignEmployee(alloc.serviceId, e.target.value)}
                                      className="p-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-700 outline-none cursor-pointer w-44"
                                    >
                                      <option value="">-- Unassigned --</option>
                                      {employees
                                        .filter(e => e.department === 'Marketing' || e.role === 'admin')
                                        .map(e => <option key={e.id} value={e.id}>{e.name}</option>)
                                      }
                                    </select>
                                  </td>
                                  <td className="px-4 py-3">
                                    <select
                                      value={alloc.status}
                                      onChange={(e) => handleUpdateServiceStatus(alloc.serviceId, e.target.value as any)}
                                      className="p-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-700 outline-none cursor-pointer w-28"
                                    >
                                      <option value="Pending">Pending</option>
                                      <option value="Working">Working</option>
                                      <option value="Waiting">Waiting</option>
                                      <option value="Finished">Finished</option>
                                    </select>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <button
                                      onClick={() => handleRemoveService(alloc.serviceId)}
                                      className="p-1 text-slate-400 hover:text-red-550 rounded transition-colors"
                                      title="Remove Service"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {workspaceTab === 'notes' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-150 shrink-0">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 leading-tight">Shared Notes Ledger</h3>
                      <p className="text-xs text-slate-400 font-medium">Google Docs style note editor. Changes sync in real-time with specialists.</p>
                    </div>
                    <button
                      onClick={handleSaveNotesLedger}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm active:scale-[0.98]"
                    >
                      Save Notes Ledger
                    </button>
                  </div>

                  {/* WYSIWYG Editor Container */}
                  <div className="flex flex-col border border-slate-200 rounded-lg shadow-sm bg-white h-[450px] relative">
                    {/* Toolbar */}
                    <div className="flex items-center gap-1 p-2 bg-slate-50 border-b border-slate-200 shrink-0 flex-wrap">
                      <button
                        type="button"
                        onClick={() => executeNotesCommand('bold')}
                        className="p-1.5 hover:bg-slate-200 text-slate-655 rounded transition-colors"
                        title="Bold"
                      >
                        <Bold size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => executeNotesCommand('italic')}
                        className="p-1.5 hover:bg-slate-200 text-slate-655 rounded transition-colors"
                        title="Italic"
                      >
                        <Italic size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => executeNotesCommand('underline')}
                        className="p-1.5 hover:bg-slate-200 text-slate-655 rounded transition-colors"
                        title="Underline"
                      >
                        <Underline size={13} />
                      </button>
                      
                      <div className="w-px h-4 bg-slate-200 mx-1"></div>

                      <button
                        type="button"
                        onClick={() => executeNotesCommand('justifyLeft')}
                        className="p-1.5 hover:bg-slate-200 text-slate-655 rounded transition-colors"
                        title="Align Left"
                      >
                        <AlignLeft size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => executeNotesCommand('justifyCenter')}
                        className="p-1.5 hover:bg-slate-200 text-slate-655 rounded transition-colors"
                        title="Align Center"
                      >
                        <AlignCenter size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => executeNotesCommand('justifyRight')}
                        className="p-1.5 hover:bg-slate-200 text-slate-655 rounded transition-colors"
                        title="Align Right"
                      >
                        <AlignRight size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => executeNotesCommand('justifyFull')}
                        className="p-1.5 hover:bg-slate-200 text-slate-655 rounded transition-colors"
                        title="Justify"
                      >
                        <AlignJustify size={13} />
                      </button>

                      <div className="w-px h-4 bg-slate-200 mx-1"></div>

                      <button
                        type="button"
                        onClick={() => executeNotesCommand('insertUnorderedList')}
                        className="p-1.5 hover:bg-slate-200 text-slate-655 rounded transition-colors"
                        title="Bullet List"
                      >
                        <List size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => executeNotesCommand('insertOrderedList')}
                        className="p-1.5 hover:bg-slate-200 text-slate-655 rounded transition-colors"
                        title="Numbered List"
                      >
                        <ListOrdered size={13} />
                      </button>
                      
                      <div className="w-px h-4 bg-slate-200 mx-1"></div>

                      <button
                        type="button"
                        onClick={() => executeNotesCommand('removeFormat')}
                        className="p-1.5 hover:bg-slate-200 text-slate-500 rounded transition-colors text-[10px] font-bold"
                        title="Clear Formatting"
                      >
                        Clear
                      </button>
                    </div>

                    {/* contentEditable editor */}
                    <RichTextEditor
                      initialValue={activeWorkspaceProject.marketingNotes || ''}
                      onInput={(html) => setNotesText(html)}
                      onPaste={handleEditorPaste}
                      className="flex-1 p-4 text-xs font-medium text-slate-750 outline-none overflow-y-auto"
                      editorRef={notesEditorRef}
                      serviceId="notes"
                    />
                  </div>
                </div>
              )}

              {workspaceTab === 'reports' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-150">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 leading-tight">Service Reporting Hub</h3>
                      <p className="text-xs text-slate-400 font-medium">Select a campaign channel to view submitted specialist logs.</p>
                    </div>
                    <button
                      onClick={() => setWorkspaceTab('overview')}
                      className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-55 text-slate-700 rounded-lg text-[10px] font-bold transition flex items-center gap-1 shadow-sm border border-slate-200"
                    >
                      <ArrowLeft size={11} /> Back to Services
                    </button>
                  </div>

                  <div className="space-y-3">
                    {(() => {
                      const services = activeWorkspaceProject.servicesAllocated || [];
                      const serviceAlloc = services.find(s => s.serviceId === selectedReportServiceId) || services[0];

                      if (!serviceAlloc) {
                        return (
                          <div className="py-12 border border-dashed border-slate-250 rounded-lg text-center text-xs font-bold uppercase tracking-widest text-slate-400">
                            No campaign services allocated for this project.
                          </div>
                        );
                      }

                      return (
                        <GoogleDocsWorkspace
                          project={activeWorkspaceProject}
                          serviceAlloc={serviceAlloc}
                          client={clients.find(c => c.id === activeWorkspaceProject.clientId)}
                          employee={employees?.find(e => e.id === serviceAlloc.assignedEmployeeId) || { name: serviceAlloc.assignedEmployeeName || 'Specialist' } as any}
                          readOnly={true}
                        />
                      );
                    })()}
                  </div>
                </div>
              )}

              {workspaceTab === 'financials' && (() => {
                const start = parseLocalDate(activeWorkspaceProject.startDate);
                const end = parseLocalDate(activeWorkspaceProject.deadline);
                const diffTime = end.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                const currentMktAlerts = paymentAlerts.filter(a => a.projectId === activeWorkspaceProject.id && a.department === 'Marketing');

                return (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-150">
                      <div>
                        <h3 className="text-sm font-black text-slate-800 leading-tight">Financial Retainer Statement</h3>
                        <p className="text-xs text-slate-400 font-medium">Review subscription periods and Payment Desk alerts.</p>
                      </div>
                      <button
                        onClick={handleManualInvoiceNextMonth}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all active:scale-[0.98]"
                      >
                        Issue Next Retainer
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Subscription cycle dates */}
                      <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-2">
                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Retention Cycle</h4>
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-500">Period Start:</span>
                          <span className="font-extrabold text-slate-800">{activeWorkspaceProject.startDate}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-500">Period Deadline:</span>
                          <span className="font-extrabold text-slate-800">{activeWorkspaceProject.deadline}</span>
                        </div>
                        <div className="h-px bg-slate-200"></div>
                        <div className="flex justify-between items-center text-xs pt-1">
                          <span className="font-black text-slate-450 uppercase text-[8px] tracking-wider">Status:</span>
                          <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase ${diffDays < 0 ? 'bg-red-50 text-red-650 border border-red-100' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                            {diffDays < 0 ? `Period Expired (${Math.abs(diffDays)}d ago)` : `${diffDays} days left`}
                          </span>
                        </div>
                      </div>

                      {/* Cash overview */}
                      <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-2">
                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cycle Revenue</h4>
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-500">Retainer Fee:</span>
                          <span className="font-extrabold text-slate-800">₹{activeWorkspaceProject.totalAmount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-500">Advance Paid:</span>
                          <span className="font-extrabold text-slate-800">₹{activeWorkspaceProject.advance.toLocaleString()}</span>
                        </div>
                        <div className="h-px bg-slate-200"></div>
                        <div className="flex justify-between items-center text-xs pt-1">
                          <span className="font-black text-slate-450 uppercase text-[8px] tracking-wider">Balance Due:</span>
                          <span className="font-black text-slate-800 text-xs">₹{(activeWorkspaceProject.totalAmount - activeWorkspaceProject.advance).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Subscription Ledger Log from global payments */}
                    <div className="space-y-2 pt-2">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Payments History</h4>
                      {currentMktAlerts.length === 0 ? (
                        <div className="py-6 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-400 font-bold uppercase tracking-wider bg-slate-50/20">
                          No transactions resolved.
                        </div>
                      ) : (
                        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-black uppercase text-[8px]">
                                <th className="px-4 py-2">Invoice / Retainer Item</th>
                                <th className="px-4 py-2">Amount</th>
                                <th className="px-4 py-2">Date Triggered</th>
                                <th className="px-4 py-2 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                              {currentMktAlerts.map(alert => (
                                <tr key={alert.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-4 py-2">{alert.milestoneLabel}</td>
                                  <td className="px-4 py-2">₹{alert.amount.toLocaleString()}</td>
                                  <td className="px-4 py-2 font-normal text-slate-550">{new Date(alert.triggeredAt).toLocaleDateString()}</td>
                                  <td className="px-4 py-2 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${alert.status === 'received' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-500 border-red-100'}`}>
                                      {alert.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Main List Section */}
          <div className="flex gap-1 p-0.5 bg-slate-200/50 rounded-lg w-max border border-slate-200 shadow-sm mb-4">
            <button
              onClick={() => setSubSection('Daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${subSection === 'Daily' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Daily Queue
            </button>
            <button
              onClick={() => setSubSection('Control')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${subSection === 'Control' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Control Centre
            </button>
          </div>

          {subSection === 'Daily' ? (
            <div className="space-y-4 animate-in slide-in-from-left-4 duration-500">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Active Marketing Queue</h2>
                  <p className="text-slate-400 text-xs font-medium mt-0.5">
                    System Date: {todayStr}
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                    <div className="w-1.5 h-1.5 bg-slate-500 rounded-full"></div>
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{dailyProjects.length} Active</span>
                  </div>
                  <button
                    onClick={() => { resetForm(); setEditingProject(null); setShowAddModal(true); }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    <Plus size={13} /> New Campaign
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {dailyProjects.length > 0 ? dailyProjects.map(project => {
                  const remInfo = getRemainingDaysInfo(project.deadline);
                  const activeServices = (project.servicesAllocated || []).map(s => s.serviceName);

                  return (
                    <div key={project.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:border-slate-350 transition-all p-5 flex flex-col md:flex-row gap-6 items-stretch md:items-center relative group">
                      <div className="flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${priorityColor(project.priority)}`}>
                            {project.priority} Priority
                          </span>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1">
                            <Megaphone size={10} /> Marketing
                          </span>
                        </div>

                        <div>
                          <h4 className="text-lg font-black text-slate-900 leading-tight">{project.clientName}</h4>
                          <p className="text-slate-500 mt-0.5 text-xs font-medium">"{project.description || 'Marketing campaign in progress...'}"</p>
                        </div>

                        {activeServices.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {activeServices.map(name => (
                              <span key={name} className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 text-[9px] font-bold rounded">
                                {name}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-4 pt-1 border-t border-slate-50">
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Start Date</span>
                            <span className="text-xs font-bold text-slate-750">{project.startDate}</span>
                          </div>
                          <ChevronRight size={10} className="text-slate-300" />
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Renewal Deadline</span>
                            <span className="text-xs font-bold text-slate-750">{project.deadline}</span>
                          </div>
                          <div className="h-4 w-px bg-slate-200 mx-2"></div>
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Campaign Manager</span>
                            <span className="text-xs font-extrabold text-slate-800">{project.assignedEmployeeName || 'Unassigned'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-row md:flex-col justify-between md:justify-center items-center gap-3 min-w-[200px] border-t md:border-t-0 md:border-l border-slate-150 pt-3 md:pt-0 md:pl-6">
                        <div className="flex flex-col gap-1 w-full max-w-[130px]">
                          <span className="text-[8px] font-black text-slate-450 uppercase tracking-widest block">Days Remaining:</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-center border inline-block ${remInfo.bg} ${remInfo.color} border-current`}>
                            {remInfo.text}
                          </span>
                        </div>
                        <div className="h-px w-full bg-slate-100 hidden md:block"></div>
                        <div className="flex flex-col gap-2 w-full">
                          <select
                            value={project.status}
                            onChange={(e) => updateProjectStatus(project.id, e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                          >
                            {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <div className="flex w-full gap-1.5">
                            <button
                              onClick={() => openWorkspace(project)}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-slate-900 hover:bg-slate-850 text-white rounded-lg text-xs font-bold transition-all"
                            >
                              <Layers size={12} /> Workspace
                            </button>
                            <button
                              onClick={() => handleDeleteProject(project.id, project.clientName || 'Client')}
                              className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg border border-slate-200 hover:border-red-250 transition-all"
                              title="Delete Campaign"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="bg-white border border-dashed border-slate-200 rounded-lg py-24 text-center">
                    <Megaphone className="text-slate-350 mx-auto mb-3" size={32} />
                    <p className="text-slate-400 text-sm font-bold uppercase">No Active Campaigns</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-500">
              {/* KPI Strip */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Revenue Pipeline</span>
                    <TrendingUp size={16} className="text-slate-400" />
                  </div>
                  <p className="text-xl font-black text-slate-800">₹{mktProjects.reduce((sum, p) => sum + (p.totalAmount || 0), 0).toLocaleString()}</p>
                  <p className="text-[9px] text-slate-400">Total Marketing Budget</p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Active Records</span>
                    <Layers size={16} className="text-slate-400" />
                  </div>
                  <p className="text-xl font-black text-slate-800">{mktProjects.length}</p>
                  <p className="text-[9px] text-slate-400">Campaigns tracked</p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Completed campaigns</span>
                    <CheckCircle2 size={16} className="text-slate-400" />
                  </div>
                  <p className="text-xl font-black text-slate-800">{mktProjects.filter(p => p.status === 'Completed').length}</p>
                  <p className="text-[9px] text-slate-400">Delivered subscriptions</p>
                </div>
              </div>

              {/* Project Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="text-slate-400" size={20} />
                    <div>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Marketing Control Centre</h3>
                      <p className="text-[10px] text-slate-450 font-bold uppercase mt-0.5">Campaign master list</p>
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="text"
                      placeholder="Filter campaigns..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-slate-400 w-60 shadow-inner"
                    />
                  </div>
                </div>

                {filteredProjects.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-wider">No campaign records found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                          <th className="px-6 py-4">Client</th>
                          <th className="px-6 py-4">Campaign Services</th>
                          <th className="px-6 py-4">Timeline</th>
                          <th className="px-6 py-4">Financials</th>
                          <th className="px-6 py-4">Campaign Manager</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-xs text-slate-700">
                        {filteredProjects.map(project => {
                          const remInfo = getRemainingDaysInfo(project.deadline);
                          const activeServices = (project.servicesAllocated || []).map(s => s.serviceName);

                          return (
                            <tr key={project.id} className="hover:bg-slate-50/40 transition-colors">
                              <td className="px-6 py-4">
                                <span className="font-bold text-slate-800 block">{project.clientName}</span>
                                <span className={`text-[8px] font-black uppercase tracking-wide ${priorityColor(project.priority)} px-1.5 py-0.5 rounded inline-block mt-0.5`}>
                                  {project.priority}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                {activeServices.length === 0 ? (
                                  <span className="text-slate-400 italic">None</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                                    {activeServices.map(name => (
                                      <span key={name} className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 text-slate-650 text-[9px] rounded font-bold">
                                        {name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-700">{project.startDate}</span>
                                  <span className="text-[9px] text-slate-400 font-bold uppercase">To {project.deadline}</span>
                                  <span className={`text-[8px] font-black mt-0.5 ${remInfo.color}`}>{remInfo.text}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col">
                                  <span className="font-black text-slate-800">₹{(project.totalAmount || 0).toLocaleString()}</span>
                                  <span className="text-[8px] text-emerald-600 font-black uppercase">ADV: ₹{project.advance || 0}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 font-bold text-slate-800">
                                {project.assignedEmployeeName || 'Unassigned'}
                              </td>
                              <td className="px-6 py-4">
                                <select
                                  value={project.status}
                                  onChange={(e) => updateProjectStatus(project.id, e.target.value)}
                                  className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                                >
                                  {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => openWorkspace(project)}
                                    className="p-1 text-slate-450 hover:bg-slate-900 hover:text-white rounded transition-all border border-slate-100 hover:border-slate-900"
                                    title="Open Workspace"
                                  >
                                    <Layers size={13} />
                                  </button>
                                  <button
                                    onClick={() => openEdit(project)}
                                    className="p-1 text-slate-450 hover:bg-slate-900 hover:text-white rounded transition-all border border-slate-100 hover:border-slate-900"
                                    title="Edit Campaign"
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProject(project.id, project.clientName || 'Client')}
                                    className="p-1 text-slate-455 hover:bg-red-600 hover:text-white rounded transition-all border border-slate-100 hover:border-red-600"
                                    title="Delete Campaign"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-300 border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
                  <Megaphone size={16} className="text-slate-650" />
                  {editingProject ? 'Modify Marketing Project' : 'New Marketing Campaign'}
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Define core parameters and specialist resources.</p>
              </div>
              <button
                onClick={() => { setShowAddModal(false); setEditingProject(null); resetForm(); }}
                className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center transition-colors shadow-sm bg-white border border-slate-100"
              >
                <X className="text-slate-400" size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="p-6 space-y-4">
              {!editingProject && (
                <div className="flex gap-2 border-b border-slate-100 pb-3">
                  <button
                    type="button"
                    onClick={() => { setCreationSource('manual'); resetForm(); }}
                    className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition-all border ${creationSource === 'manual' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                  >
                    Manual Entry
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCreationSource('sales'); resetForm(); }}
                    className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition-all border ${creationSource === 'sales' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                  >
                    From Sales Department
                  </button>
                </div>
              )}

              {creationSource === 'sales' && !editingProject && (
                <div className="space-y-1.5 p-3 bg-slate-50 rounded-lg border border-slate-200 animate-in fade-in slide-in-from-top-1 duration-200">
                  <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Select Approved Quotation</label>
                  <select
                    value={selectedQuotationId}
                    onChange={(e) => handleSelectQuotation(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg bg-white font-bold text-xs text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="">-- Choose Quotation --</option>
                    {quotations
                      .filter(q => q.status === 'Approved')
                      .map(q => (
                        <option key={q.id} value={q.id}>
                          {q.quotationNumber} - {q.clientName} (₹{q.totalAmount.toLocaleString()})
                        </option>
                      ))
                    }
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <SearchableSelect
                    label="Assigned Client"
                    placeholder="Select Client..."
                    options={clients.map(c => ({ id: c.id, label: c.name, subLabel: c.companyName }))}
                    value={projectForm.clientId || ''}
                    onChange={(val) => setProjectForm({ ...projectForm, clientId: val })}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Campaign Manager / Lead</label>
                  <select
                    className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 font-bold text-xs text-slate-750 outline-none cursor-pointer"
                    value={projectForm.assignedEmployeeId || ''}
                    onChange={e => setProjectForm({ ...projectForm, assignedEmployeeId: e.target.value })}
                  >
                    <option value="">-- Choose Specialist --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Campaign Services (Select Multiple)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    {services
                      .filter(s => s.category === 'Digital Marketing' || s.category === 'SEO' || s.category === 'Marketing')
                      .map(s => {
                        const isChecked = selectedServiceIds.includes(s.id);
                        return (
                          <label key={s.id} className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedServiceIds(selectedServiceIds.filter(id => id !== s.id));
                                } else {
                                  setSelectedServiceIds([...selectedServiceIds, s.id]);
                                }
                              }}
                              className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            {s.name}
                          </label>
                        );
                      })
                    }
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Priority</label>
                  <select
                    className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 font-bold text-xs text-slate-700 outline-none cursor-pointer"
                    value={projectForm.priority}
                    onChange={e => setProjectForm({ ...projectForm, priority: e.target.value as any })}
                  >
                    <option value="Low">Low Priority</option>
                    <option value="Medium">Medium Standard</option>
                    <option value="High">High Urgency</option>
                    <option value="Urgent">Immediate Action</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Global Status</label>
                  <select
                    className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 font-bold text-xs text-slate-700 outline-none cursor-pointer"
                    value={projectForm.status}
                    onChange={e => setProjectForm({ ...projectForm, status: e.target.value })}
                  >
                    {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                  <input
                    required
                    type="date"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none"
                    value={projectForm.startDate}
                    onChange={e => setProjectForm({ ...projectForm, startDate: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Campaign Deadline</label>
                  <input
                    required
                    type="date"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none"
                    value={projectForm.deadline}
                    onChange={e => setProjectForm({ ...projectForm, deadline: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Contract Retainer Fee (₹)</label>
                  <input
                    type="number"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none"
                    value={projectForm.totalAmount}
                    onChange={e => setProjectForm({ ...projectForm, totalAmount: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Advance Amount (₹)</label>
                  <input
                    type="number"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none"
                    value={projectForm.advance}
                    onChange={e => setProjectForm({ ...projectForm, advance: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5 ml-1">Campaign Description</label>
                  <textarea
                    className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 h-20 outline-none text-xs font-medium resize-none"
                    placeholder="Describe this marketing campaign..."
                    value={projectForm.description}
                    onChange={e => setProjectForm({ ...projectForm, description: e.target.value })}
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs tracking-wider uppercase transition-all shadow-sm"
              >
                {editingProject ? 'Save Changes' : 'Launch Marketing Campaign'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Marketing;
