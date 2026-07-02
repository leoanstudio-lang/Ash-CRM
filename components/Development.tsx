import React, { useState, useEffect, useRef } from 'react';
import SearchableSelect from './SearchableSelect';
import { Client, Project, Priority, Service, ProjectNote, Quotation, MarketingServiceAllocation, Employee } from '../types';
import { PROJECT_STATUSES } from '../constants';
import {
  Plus, Search, Calendar, Clock, BarChart3, Settings2, Edit3,
  AlertCircle, TrendingUp, Layers, ChevronRight,
  X, FileText, Download, Landmark, Trash2, ArrowLeft,
  Bold, Italic, Underline, List, ListOrdered, Link as LinkIcon, Eraser,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Image as ImageIcon
} from 'lucide-react';
import { addProjectToDB, updateProjectInDB, addPaymentAlertToDB, getCompanyProfile, deleteProjectFromDB } from '../lib/db';
import jsPDF from 'jspdf';
import GoogleDocsWorkspace from './GoogleDocsWorkspace';

interface DevelopmentProps {
  clients: Client[];
  projects: Project[];
  setProjects?: React.Dispatch<React.SetStateAction<Project[]>>;
  services?: Service[];
  quotations?: Quotation[];
  employees?: Employee[];
}

const Development: React.FC<DevelopmentProps> = ({ clients, projects, services = [], quotations = [], employees = [] }) => {
  const [subSection, setSubSection] = useState<'Daily' | 'Control'>('Daily');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [activeWorkspaceProject, setActiveWorkspaceProject] = useState<Project | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<'overview' | 'documentation' | 'notes' | 'financials'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [creationSource, setCreationSource] = useState<'sales' | 'manual'>('manual');
  const [selectedQuotationId, setSelectedQuotationId] = useState<string>('');

  const [newNoteText, setNewNoteText] = useState('');

  // Keep the active workspace project state synchronized with master projects list from Firestore
  useEffect(() => {
    if (activeWorkspaceProject) {
      const updated = projects.find(p => p.id === activeWorkspaceProject.id);
      if (updated) {
        setActiveWorkspaceProject(updated);
      }
    }
  }, [projects, activeWorkspaceProject?.id]);
  const [projectForm, setProjectForm] = useState<Partial<Project>>({
    clientId: '',
    serviceId: '',
    type: 'Web',
    priority: 'Medium',
    status: 'In Progress',
    startDate: '',
    deadline: '',
    totalAmount: 0,
    advance: 0,
    description: '',
    progress: 0
  });

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
    const service = services.find(s => s.id === projectForm.serviceId);

    if (editingProject) {
      const updates = {
        ...projectForm,
        clientName: client?.name,
        serviceName: service?.name,
        totalAmount: Number(projectForm.totalAmount),
        advance: Number(projectForm.advance),
        progress: 0
      };
      await updateProjectInDB(editingProject.id, updates);
    } else {
      const projectToAdd: any = {
        clientId: projectForm.clientId!,
        clientName: client?.name || '',
        serviceId: service ? service.id : 'DEV_MASTER',
        serviceName: service ? service.name : (projectForm.type === 'Web' ? 'Web Development' : 'Mobile App'),
        type: projectForm.type as any,
        priority: (projectForm.priority as Priority) || 'Medium',
        startDate: projectForm.startDate!,
        deadline: projectForm.deadline!,
        totalAmount: Number(projectForm.totalAmount) || 0,
        advance: Number(projectForm.advance) || 0,
        description: projectForm.description || '',
        status: projectForm.status || 'In Progress',
        progress: 0,
        documentation: '',
        notes: [],
        createdAt: new Date().toISOString()
      };
      await addProjectToDB(projectToAdd);
    }

    // Trigger payment logic
    if (!editingProject && Number(projectForm.advance) > 0) {
      try {
        await addPaymentAlertToDB({
          clientId: projectForm.clientId || '',
          clientName: client?.name || 'Unknown Client',
          projectId: 'PENDING_ID',
          taskName: projectForm.serviceName || (projectForm.type === 'Web' ? 'Web Development' : 'Mobile App'),
          milestoneLabel: 'Advance',
          amount: Number(projectForm.advance),
          status: 'received',
          triggeredAt: new Date().toISOString(),
          resolvedAt: new Date().toISOString(),
          type: 'standalone',
          department: 'Development'
        });
      } catch (err) {
        console.error('Error creating advance payment record:', err);
      }
    } else if (editingProject && (projectForm.status === 'Completed' || projectForm.status === 'Closed' || projectForm.status === 'Waiting Client Feedback')) {
      const balance = (Number(projectForm.totalAmount) || 0) - (Number(projectForm.advance) || 0);
      if (balance > 0) {
        try {
          await addPaymentAlertToDB({
            clientId: projectForm.clientId || editingProject?.clientId || '',
            clientName: client?.name || editingProject?.clientName || 'Unknown Client',
            projectId: editingProject?.id,
            taskName: projectForm.serviceName || (editingProject?.serviceName) || (projectForm.type === 'Web' ? 'Web Development' : 'Mobile App'),
            milestoneLabel: 'Final Balance',
            amount: balance,
            status: 'due',
            triggeredAt: new Date().toISOString(),
            type: 'standalone',
            department: 'Development'
          });
        } catch (err) {
          console.error('Error creating development balance payment record:', err);
        }
      }
    }

    setShowAddModal(false);
    setEditingProject(null);
    resetForm();
  };

  const resetForm = () => {
    setProjectForm({
      clientId: '',
      type: 'Web',
      priority: 'Medium',
      status: 'In Progress',
      startDate: '',
      deadline: '',
      totalAmount: 0,
      advance: 0,
      description: '',
      progress: 0
    });
    setCreationSource('manual');
    setSelectedQuotationId('');
  };

  const handleDeleteProject = async (id: string, clientName: string) => {
    if (window.confirm(`Are you sure you want to permanently delete the project for "${clientName}"? This action cannot be undone.`)) {
      try {
        await deleteProjectFromDB(id);
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
        type: 'Web'
      });
    }
  };

  const openEdit = (project: Project) => {
    setEditingProject(project);
    setProjectForm({ ...project });
    setShowAddModal(true);
  };

  const openWorkspace = (project: Project) => {
    setActiveWorkspaceProject(project);
    setWorkspaceTab('overview');
    setProjectForm({ ...project });
    setNewNoteText('');
  };

  const updateProjectStatus = async (projectId: string, status: string) => {
    const updates: any = { status };
    if (status === 'Completed' || status === 'Closed' || status === 'Waiting Client Feedback') {
      updates.completedAt = new Date().toISOString();
      const project = projects.find(p => p.id === projectId);
      if (project) {
        const balance = (project.totalAmount || 0) - (project.advance || 0);
        if (balance > 0) {
          try {
            await addPaymentAlertToDB({
              clientId: project.clientId,
              clientName: project.clientName || 'Unknown Client',
              projectId: project.id,
              taskName: project.serviceName || project.type + ' Solution',
              milestoneLabel: 'Final Balance',
              amount: balance,
              status: 'due',
              triggeredAt: new Date().toISOString(),
              type: 'standalone',
              department: 'Development'
            });
          } catch (err) {
            console.error('Error creating development balance payment record:', err);
          }
        }
      }
    }
    await updateProjectInDB(projectId, updates);
    if (activeWorkspaceProject && activeWorkspaceProject.id === projectId) {
      setActiveWorkspaceProject({ ...activeWorkspaceProject, status });
    }
  };

  // Google Docs Workspace integrated - legacy handlers removed

  // --- Workspace Keep Notes Operations ---
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceProject || !newNoteText.trim()) return;

    const currentNotes = activeWorkspaceProject.notes || [];
    const updatedNotes: ProjectNote[] = [
      {
        id: `N-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        text: newNoteText.trim(),
        createdAt: new Date().toISOString()
      },
      ...currentNotes
    ];

    await updateProjectInDB(activeWorkspaceProject.id, { notes: updatedNotes });
    setActiveWorkspaceProject({ ...activeWorkspaceProject, notes: updatedNotes });
    setNewNoteText('');
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!activeWorkspaceProject || !window.confirm("Delete this note?")) return;

    const currentNotes = activeWorkspaceProject.notes || [];
    const updatedNotes = currentNotes.filter(n => n.id !== noteId);

    await updateProjectInDB(activeWorkspaceProject.id, { notes: updatedNotes });
    setActiveWorkspaceProject({ ...activeWorkspaceProject, notes: updatedNotes });
  };

  const devProjects = projects.filter(p => ['Web', 'Full Dev', 'Mobile'].includes(p.type));

  const dailyProjects = devProjects.filter(p => {
    const start = parseLocalDate(p.startDate);
    const isStarted = today >= start;
    const isNotFinished = p.status !== 'Completed' && p.status !== 'Closed';
    return isStarted && isNotFinished;
  });

  const getRemainingDaysInfo = (deadline: string) => {
    const end = parseLocalDate(deadline);
    const diffTime = end.getTime() - today.getTime();
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (days < 0) return { text: `${Math.abs(days)}d Overdue`, color: 'text-red-600', bg: 'bg-red-50' };
    if (days === 0) return { text: `Due Today`, color: 'text-orange-600', bg: 'bg-orange-50' };
    return { text: `${days}d Left`, color: 'text-blue-600', bg: 'bg-blue-50' };
  };

  const priorityColor = (priority: string) => {
    if (priority === 'Urgent') return 'bg-red-50 text-red-700 border-red-100';
    if (priority === 'High') return 'bg-orange-50 text-orange-700 border-orange-100';
    if (priority === 'Medium') return 'bg-blue-50 text-blue-700 border-blue-100';
    return 'bg-slate-50 text-slate-700 border-slate-100';
  };

  const getStatusBadgeColor = (status: string) => {
    if (status === 'Completed' || status === 'Closed') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (status === 'In Progress' || status === 'Working') return 'bg-blue-50 text-blue-700 border-blue-100';
    if (status === 'Pending') return 'bg-amber-50 text-amber-700 border-amber-100';
    return 'bg-slate-50 text-slate-700 border-slate-100';
  };

  // Filter project master list
  const filteredDevProjects = devProjects.filter(p =>
    !searchTerm ||
    p.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.serviceName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Editor CSS styles block injected inline */}
      <style>{`
        .rich-editor h1, .rich-editor h2, .rich-editor h3 {
          color: #0f172a;
          font-weight: 700;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
        }
        .rich-editor h1 { font-size: 1.5rem; }
        .rich-editor h2 { font-size: 1.25rem; }
        .rich-editor h3 { font-size: 1.1rem; }
        .rich-editor p { margin-bottom: 0.75rem; line-height: 1.6; }
        .rich-editor ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 0.75rem; }
        .rich-editor ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 0.75rem; }
        .rich-editor li { margin-bottom: 0.25rem; }
        .rich-editor a { color: #2563eb; text-decoration: underline; }
        .rich-editor b, .rich-editor strong { font-weight: bold; }
        .rich-editor i, .rich-editor em { font-style: italic; }
        .rich-editor u { text-decoration: underline; }
        .rich-editor img { max-width: 100%; height: auto; cursor: pointer; border: 1px solid transparent; }
        .rich-editor img:hover { border: 1px dashed #3b82f6; }
      `}</style>

      {activeWorkspaceProject ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
          {/* Workspace Header */}
          <div className="px-8 py-5 border-b border-slate-200 bg-[#0f172a] text-white flex justify-between items-center">
            <div className="space-y-1">
              <button
                onClick={() => setActiveWorkspaceProject(null)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors uppercase tracking-widest font-black"
              >
                <ArrowLeft size={14} /> Back to Projects
              </button>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white px-2 py-0.5 rounded">
                  {activeWorkspaceProject.type} Development
                </span>
                <span className="text-slate-400 text-xs font-bold">REF: {activeWorkspaceProject.id}</span>
              </div>
              <h3 className="text-2xl font-black tracking-tight">{activeWorkspaceProject.clientName}</h3>
            </div>
            
            <div className="flex items-center gap-3">
            </div>
          </div>

          {/* Workspace Navigation & Split Content */}
          <div className="flex min-h-[60vh]">
            
            {/* Sidebar Navigation */}
            <div className="w-64 bg-slate-50 border-r border-slate-200 p-6 flex flex-col gap-2 shrink-0">
              <button
                onClick={() => setWorkspaceTab('overview')}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-left transition-all ${workspaceTab === 'overview' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200/50'}`}
              >
                <Settings2 size={15} /> Overview & Controls
              </button>
              <button
                onClick={() => setWorkspaceTab('documentation')}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-left transition-all ${workspaceTab === 'documentation' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200/50'}`}
              >
                <FileText size={15} /> Documentation
              </button>
              <button
                onClick={() => setWorkspaceTab('notes')}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-left transition-all ${workspaceTab === 'notes' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200/50'}`}
              >
                <FileText size={15} /> Project Notes
                {(activeWorkspaceProject.notes || []).length > 0 && (
                  <span className={`ml-auto text-[9px] font-black rounded-full w-5 h-5 flex items-center justify-center ${workspaceTab === 'notes' ? 'bg-white text-blue-600' : 'bg-slate-200 text-slate-600'}`}>
                    {(activeWorkspaceProject.notes || []).length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setWorkspaceTab('financials')}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-left transition-all ${workspaceTab === 'financials' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200/50'}`}
              >
                <Landmark size={15} /> Financial Ledger
              </button>

              <div className="mt-auto p-4 bg-slate-100 rounded-2xl text-xs space-y-2 border border-slate-200/60">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold uppercase">Status:</span>
                  <span className={`px-2 py-0.5 border rounded text-[9px] font-black uppercase ${getStatusBadgeColor(activeWorkspaceProject.status)}`}>
                    {activeWorkspaceProject.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Content Tab Render */}
            <div className="flex-1 p-8 bg-white overflow-y-auto">
              
              {/* Tab 1: Overview Form */}
              {workspaceTab === 'overview' && (
                <form onSubmit={handleSaveProject} className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Kickoff Date</label>
                      <input
                        type="date"
                        value={projectForm.startDate}
                        onChange={e => setProjectForm({ ...projectForm, startDate: e.target.value })}
                        className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Final Deadline</label>
                      <input
                        type="date"
                        value={projectForm.deadline}
                        onChange={e => setProjectForm({ ...projectForm, deadline: e.target.value })}
                        className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Priority</label>
                      <select
                        value={projectForm.priority}
                        onChange={e => setProjectForm({ ...projectForm, priority: e.target.value as any })}
                        className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs outline-none cursor-pointer"
                      >
                        <option value="Low">Low Priority</option>
                        <option value="Medium">Medium Standard</option>
                        <option value="High">High Urgency</option>
                        <option value="Urgent">Immediate Action</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Service Domain</label>
                      <select
                        value={projectForm.serviceId}
                        onChange={e => {
                          const svc = services.find(s => s.id === e.target.value);
                          setProjectForm({
                            ...projectForm,
                            serviceId: e.target.value,
                            serviceName: svc?.name
                          });
                        }}
                        className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs outline-none cursor-pointer"
                      >
                        <option value="">Select Service...</option>
                        {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>

                    <div className="col-span-2 space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Project Status</label>
                      <select
                        className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs outline-none cursor-pointer"
                        value={projectForm.status}
                        onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })}
                      >
                        {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    <div className="col-span-2 space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Internal Details & Description</label>
                      <textarea
                        rows={4}
                        value={projectForm.description}
                        onChange={e => setProjectForm({ ...projectForm, description: e.target.value })}
                        placeholder="Log scope details, instructions, or keys here..."
                        className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50 text-xs font-semibold outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs uppercase tracking-[0.2em] transition-all shadow-md active:scale-[0.98]"
                  >
                    Apply Changes to Workspace
                  </button>
                </form>
              )}              {/* Tab 2: Documentation (Google Docs Workspace integration) */}
              {workspaceTab === 'documentation' && (() => {
                const serviceAlloc: MarketingServiceAllocation = (activeWorkspaceProject.servicesAllocated && activeWorkspaceProject.servicesAllocated.length > 0)
                  ? activeWorkspaceProject.servicesAllocated[0]
                  : {
                      serviceId: activeWorkspaceProject.serviceId || 'DEV_MASTER',
                      serviceName: activeWorkspaceProject.serviceName || (activeWorkspaceProject.type === 'Web' ? 'Web Development' : 'Mobile App'),
                      status: activeWorkspaceProject.status as any,
                      assignedEmployeeId: activeWorkspaceProject.assignedEmployeeId || '',
                      assignedEmployeeName: activeWorkspaceProject.assignedEmployeeName || ''
                    };

                const projectWithAlloc = {
                  ...activeWorkspaceProject,
                  servicesAllocated: activeWorkspaceProject.servicesAllocated && activeWorkspaceProject.servicesAllocated.length > 0
                    ? activeWorkspaceProject.servicesAllocated
                    : [serviceAlloc]
                };

                return (
                  <div className="space-y-4 flex flex-col">
                    <div className="flex justify-between items-center shrink-0">
                      <div>
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">Project Documentation Workspace</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Dynamically synchronized Google Docs editor for development details</p>
                      </div>
                    </div>

                    <GoogleDocsWorkspace
                      project={projectWithAlloc}
                      serviceAlloc={serviceAlloc}
                      client={clients.find(c => c.id === activeWorkspaceProject.clientId)}
                      employee={employees?.find(e => e.id === serviceAlloc.assignedEmployeeId) || { name: 'Specialist' } as any}
                    />
                  </div>
                );
              })()}

              {/* Tab 3: Keep Notes */}
              {workspaceTab === 'notes' && (
                <div className="space-y-6">
                  <form onSubmit={handleAddNote} className="space-y-2">
                    <textarea
                      rows={3}
                      required
                      placeholder="Add Keep note (e.g. competitor names, quick checklists, ideas)..."
                      value={newNoteText}
                      onChange={e => setNewNoteText(e.target.value)}
                      className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50 text-xs font-semibold outline-none focus:ring-1 focus:ring-blue-500 resize-none shadow-inner"
                    />
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow"
                    >
                      <Plus size={14} /> Add Keep Note
                    </button>
                  </form>

                  {/* Note Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(activeWorkspaceProject.notes || []).length > 0 ? (
                      (activeWorkspaceProject.notes || []).map((n) => (
                        <div key={n.id} className="bg-amber-50/40 border border-amber-200/80 rounded-2xl p-5 relative group flex flex-col justify-between min-h-[120px] hover:border-amber-300 transition-colors shadow-sm">
                          <button
                            onClick={() => handleDeleteNote(n.id)}
                            className="absolute top-3 right-3 p-1.5 bg-white text-slate-400 hover:text-red-600 rounded-lg shadow-sm border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete Note"
                          >
                            <Trash2 size={13} />
                          </button>
                          <p className="text-slate-700 text-xs font-semibold whitespace-pre-line leading-relaxed pr-6">{n.text}</p>
                          <span className="text-[9px] font-black text-amber-600 tracking-wider uppercase mt-4 block">
                            {new Date(n.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-2 py-12 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                        <FileText size={32} className="text-slate-300 mx-auto mb-2" />
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">No keep notes recorded</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 4: Financials Ledger */}
              {workspaceTab === 'financials' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-1">Financial Statement & Ledger</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Official invoice records and payments tracker for development contract</p>
                  </div>
                  
                  {/* Ledger Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm max-w-3xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 border-b border-slate-200 font-black uppercase tracking-wider text-[9px]">
                          <th className="px-6 py-4">Transaction Entry</th>
                          <th className="px-6 py-4 text-right">Debit</th>
                          <th className="px-6 py-4 text-right">Credit</th>
                          <th className="px-6 py-4 text-right">Balance</th>
                          <th className="px-6 py-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-slate-800">
                        <tr>
                          <td className="px-6 py-4 font-sans font-bold text-slate-800">Contract Value (Net Budget)</td>
                          <td className="px-6 py-4 text-right">₹{(activeWorkspaceProject.totalAmount || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 text-right text-slate-300">—</td>
                          <td className="px-6 py-4 text-right">₹{(activeWorkspaceProject.totalAmount || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 text-center font-sans">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold uppercase text-[8px]">Invoiced</span>
                          </td>
                        </tr>

                        {activeWorkspaceProject.advance > 0 && (
                          <tr>
                            <td className="px-6 py-4 font-sans text-emerald-700 font-bold">Advance Payment Received</td>
                            <td className="px-6 py-4 text-right text-slate-300">—</td>
                            <td className="px-6 py-4 text-right text-emerald-600">₹{(activeWorkspaceProject.advance || 0).toLocaleString()}</td>
                            <td className="px-6 py-4 text-right">
                              ₹{((activeWorkspaceProject.totalAmount || 0) - (activeWorkspaceProject.advance || 0)).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-center font-sans">
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold uppercase text-[8px]">Cleared</span>
                            </td>
                          </tr>
                        )}

                        {(() => {
                          const balance = (activeWorkspaceProject.totalAmount || 0) - (activeWorkspaceProject.advance || 0);
                          const isFullyPaid = balance <= 0;
                          return (
                            <tr className="bg-slate-50 font-sans font-extrabold text-sm">
                              <td className="px-6 py-5 text-slate-900 uppercase tracking-wider text-xs">Total Outstanding Balance</td>
                              <td className="px-6 py-5 text-right text-slate-300 font-mono">—</td>
                              <td className="px-6 py-5 text-right text-slate-300 font-mono">—</td>
                              <td className={`px-6 py-5 text-right font-mono ${isFullyPaid ? 'text-emerald-700' : 'text-red-700'}`}>
                                ₹{balance.toLocaleString()}
                              </td>
                              <td className="px-6 py-5 text-center">
                                <span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider ${isFullyPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                  {isFullyPaid ? 'Settled' : 'Due'}
                                </span>
                              </td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Main List Section */}
          <div className="flex gap-1 p-1 bg-slate-200/50 rounded-2xl w-max border border-slate-200 shadow-sm mb-6">
            <button
              onClick={() => setSubSection('Daily')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${subSection === 'Daily' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              📅 Daily Queue
            </button>
            <button
              onClick={() => setSubSection('Control')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${subSection === 'Control' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              ⚙️ Control Centre
            </button>
          </div>

          {subSection === 'Daily' ? (
            <div className="space-y-6 animate-in slide-in-from-left-4 duration-500">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Active Operation Queue</h2>
                  <p className="text-slate-500 mt-1 font-medium flex items-center gap-2">
                    <Calendar size={16} className="text-blue-500" /> System Date: {todayStr}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                    <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{dailyProjects.length} Active Solutions</span>
                  </div>
                  <button
                    onClick={() => { resetForm(); setEditingProject(null); setShowAddModal(true); }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-[0.98] shadow-md shadow-blue-600/10"
                  >
                    <Plus size={14} /> New Project
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {dailyProjects.length > 0 ? dailyProjects.map(project => {
                  const remInfo = getRemainingDaysInfo(project.deadline);
                  return (
                    <div key={project.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 p-6 flex flex-col lg:flex-row gap-6 justify-between items-stretch lg:items-center relative group">
                      <div className="flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${priorityColor(project.priority)}`}>
                            {project.priority}
                          </span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{project.type} Development</span>
                          {project.serviceName && (
                            <span className="text-[9px] font-bold text-blue-600 bg-blue-50/50 px-2 py-0.5 rounded border border-blue-100">
                              {project.serviceName}
                            </span>
                          )}
                        </div>

                        <div>
                          <h4 className="text-xl font-extrabold text-slate-900 leading-tight">{project.clientName}</h4>
                          {project.description && (
                            <p className="text-slate-500 mt-0.5 text-xs font-medium line-clamp-1">"{project.description}"</p>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                          <div className="flex items-center gap-1">
                            <Calendar size={12} className="text-slate-400" />
                            <span>{project.startDate}</span>
                          </div>
                          <ChevronRight size={10} className="text-slate-300" />
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400">Due:</span>
                            <span className="font-bold text-slate-700">{project.deadline}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${remInfo.bg} ${remInfo.color}`}>
                            {remInfo.text}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-row sm:flex-col justify-end items-center gap-3 border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-6 min-w-[170px]">
                        <div className="w-full">
                          <select
                            value={project.status}
                            onChange={(e) => updateProjectStatus(project.id, e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-extrabold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 hover:border-slate-300 transition-all cursor-pointer"
                          >
                            {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>

                        <div className="flex w-full gap-2">
                          <button
                            onClick={() => openWorkspace(project)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-950 text-white hover:bg-slate-900 rounded-xl text-xs font-bold transition-all active:scale-[0.98]"
                          >
                            <Layers size={13} /> Open Workspace
                          </button>
                          <button
                            onClick={() => handleDeleteProject(project.id, project.clientName)}
                            className="p-2 text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-all active:scale-[0.98]"
                            title="Delete Project"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl py-24 text-center">
                    <AlertCircle className="text-slate-300 mx-auto mb-4" size={36} />
                    <p className="text-slate-500 font-black text-sm uppercase tracking-widest">Active queue is empty</p>
                    <p className="text-slate-400 text-xs mt-1">Initialize a project in the Control Centre to get started.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-500">
              {/* Key Stats Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#0f172a] p-5 rounded-2xl text-white shadow relative overflow-hidden group">
                  <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest block mb-1">Active Pipeline</span>
                  <p className="text-xl font-black">₹{devProjects.reduce((sum, p) => sum + (p.totalAmount || 0), 0).toLocaleString()}</p>
                  <span className="text-[10px] text-slate-400 mt-1 block">Live Project Inventory</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">Total Assets</span>
                  <p className="text-xl font-black text-slate-800">{devProjects.length} Projects</p>
                  <span className="text-[10px] text-slate-400 mt-1 block">Stored ledger records</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">Completed</span>
                  <p className="text-xl font-black text-slate-800">{devProjects.filter(p => p.status === 'Completed' || p.status === 'Closed').length} Done</p>
                  <span className="text-[10px] text-slate-400 mt-1 block">Production delivered</span>
                </div>

                <button
                  onClick={() => { resetForm(); setEditingProject(null); setShowAddModal(true); }}
                  className="bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors p-5 rounded-2xl flex flex-col justify-center items-center text-center group"
                >
                  <Plus size={20} className="text-blue-600 mb-1 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-black text-blue-700 uppercase tracking-wider">New Project Record</span>
                </button>
              </div>

              {/* Master List Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
                  <div className="flex items-center gap-2.5">
                    <BarChart3 className="text-blue-500" size={20} />
                    <div>
                      <h3 className="text-lg font-black text-slate-900">Project Master Control</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Manage all active and completed assets</p>
                    </div>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search project database..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-1 focus:ring-blue-500 shadow-inner"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                        <th className="px-6 py-4">ID & Type</th>
                        <th className="px-6 py-4">Client Identity</th>
                        <th className="px-6 py-4">Timeline Log</th>
                        <th className="px-6 py-4">Financials</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Workspace</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredDevProjects.length > 0 ? filteredDevProjects.map(project => (
                        <tr key={project.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4.5">
                            <div className="flex flex-col">
                              <span className="font-extrabold text-slate-800 text-sm">{project.serviceName || project.type}</span>
                              <span className="text-[9px] text-slate-400 font-black uppercase">REF: {project.id}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4.5">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500">
                                {project.clientName?.charAt(0)}
                              </div>
                              <span className="text-xs font-bold text-slate-800">{project.clientName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4.5">
                            <div className="flex flex-col text-xs">
                              <span className="font-semibold text-slate-700">{project.startDate}</span>
                              <span className="text-[9px] text-slate-400 font-bold uppercase">To {project.deadline}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4.5">
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-slate-900">₹{project.totalAmount.toLocaleString()}</span>
                              <span className="text-[9px] text-emerald-600 font-black uppercase">ADV: ₹{project.advance.toLocaleString()}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4.5">
                            <span className={`px-2 py-0.5 border rounded-md text-[9px] font-black uppercase tracking-wider ${getStatusBadgeColor(project.status)}`}>
                              {project.status}
                            </span>
                          </td>
                          <td className="px-6 py-4.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openWorkspace(project)}
                                className="p-2 text-slate-400 hover:bg-slate-900 hover:text-white rounded-lg transition-all border border-slate-100 hover:border-slate-900"
                                title="Open Workspace"
                              >
                                <Layers size={13} />
                              </button>
                              <button
                                onClick={() => openEdit(project)}
                                className="p-2 text-slate-400 hover:bg-blue-600 hover:text-white rounded-lg transition-all border border-slate-100 hover:border-blue-600"
                                title="Edit Core Info"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteProject(project.id, project.clientName)}
                                className="p-2 text-slate-400 hover:bg-red-600 hover:text-white rounded-lg transition-all border border-slate-100 hover:border-red-600"
                                title="Delete Project"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-xs text-slate-400 font-bold">No projects matched your criteria.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* --- ADD / EDIT CORE MODAL --- */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-300 border border-white/20">
            <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">{editingProject ? 'Modify Project Parameters' : 'Initiate New Project'}</h3>
                <p className="text-xs text-slate-500 font-medium">Define parameters for global production tracking.</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-10 h-10 rounded-full hover:bg-slate-200 flex items-center justify-center transition-colors shadow-sm bg-white border border-slate-100"
              >
                <X className="text-slate-400" size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="p-8 space-y-5">
              {!editingProject && (
                <div className="flex gap-4 border-b border-slate-100 pb-4">
                  <button
                    type="button"
                    onClick={() => { setCreationSource('manual'); resetForm(); }}
                    className={`flex-1 py-3 text-center rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${creationSource === 'manual' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                  >
                    ✏️ Manual Entry
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCreationSource('sales'); resetForm(); }}
                    className={`flex-1 py-3 text-center rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${creationSource === 'sales' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                  >
                    💼 From Sales Department
                  </button>
                </div>
              )}

              {creationSource === 'sales' && !editingProject && (
                <div className="space-y-1.5 p-4 bg-blue-50/50 rounded-2xl border border-blue-100 animate-in fade-in slide-in-from-top-1 duration-200">
                  <label className="block text-[10px] font-black text-blue-700 uppercase tracking-widest ml-1">Select Approved Quotation / Won Deal</label>
                  <select
                    value={selectedQuotationId}
                    onChange={(e) => handleSelectQuotation(e.target.value)}
                    className="w-full p-3 border border-blue-200 rounded-xl bg-white font-bold text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer"
                  >
                    <option value="">-- Choose Quotation/Deal --</option>
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <SearchableSelect
                    label="Assigned Client"
                    placeholder="Select Master Client..."
                    options={clients.map(c => ({ id: c.id, label: c.name, subLabel: c.companyName }))}
                    value={projectForm.clientId || ''}
                    onChange={(val) => setProjectForm({ ...projectForm, clientId: val })}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Service / Domain</label>
                  <select
                    required
                    className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={projectForm.serviceId}
                    onChange={e => {
                      const svc = services.find(s => s.id === e.target.value);
                      setProjectForm({
                        ...projectForm,
                        serviceId: e.target.value,
                        type: (svc?.category && ['Web Development', 'Mobile Development', 'SEO'].some(c => svc.category.includes(c))) ? (svc?.category === 'Mobile Development' ? 'Mobile' : 'Web') : 'Web'
                      });
                    }}
                  >
                    <option value="">Select Service...</option>
                    {services
                      .filter(s => s.category === 'Web Development' || s.category === 'Mobile Development' || s.category === 'App Development')
                      .map(s => <option key={s.id} value={s.id}>{s.name} ({s.category})</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Priority</label>
                  <select
                    className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none"
                    value={projectForm.priority}
                    onChange={e => setProjectForm({ ...projectForm, priority: e.target.value as any })}
                  >
                    <option value="Low">Low Priority</option>
                    <option value="Medium">Medium Standard</option>
                    <option value="High">High Urgency</option>
                    <option value="Urgent">Immediate Action</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kickoff Date</label>
                  <input
                    required
                    type="date"
                    className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none"
                    value={projectForm.startDate}
                    onChange={e => setProjectForm({ ...projectForm, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Final Delivery</label>
                  <input
                    required
                    type="date"
                    className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none"
                    value={projectForm.deadline}
                    onChange={e => setProjectForm({ ...projectForm, deadline: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Net Budget</label>
                    <input
                      type="number"
                      className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none"
                      value={projectForm.totalAmount}
                      onChange={e => setProjectForm({ ...projectForm, totalAmount: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Advance</label>
                    <input
                      type="number"
                      className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs text-slate-700 outline-none"
                      value={projectForm.advance}
                      onChange={e => setProjectForm({ ...projectForm, advance: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="md:col-span-3 space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex flex-col md:flex-row gap-6 items-center bg-slate-50 px-5 py-4 rounded-xl border border-slate-100">
                    <div className="flex-1 w-full space-y-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Status Classification</span>
                      <select
                        className="w-full p-2.5 border border-slate-200 rounded-lg bg-white font-bold text-xs outline-none cursor-pointer"
                        value={projectForm.status}
                        onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })}
                      >
                        {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Internal Description / Notes</label>
                  <textarea
                    className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50 h-20 focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium resize-none"
                    placeholder="Enter production details..."
                    value={projectForm.description}
                    onChange={e => setProjectForm({ ...projectForm, description: e.target.value })}
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-blue-600 text-white font-black rounded-xl shadow-lg hover:bg-blue-700 active:scale-[0.98] transition-all uppercase tracking-[0.2em] text-xs shadow-blue-600/20"
              >
                {editingProject ? 'Save Changes' : 'Authorize Production'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Development;
