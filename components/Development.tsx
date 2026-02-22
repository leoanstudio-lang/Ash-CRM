
import React, { useState } from 'react';
import SearchableSelect from './SearchableSelect';
import { Client, Project, Priority, Service } from '../types';

import { PROJECT_STATUSES } from '../constants';
import { Plus, Search, Calendar, Clock, BarChart3, Settings2, Edit3, CheckCircle2, AlertCircle, TrendingUp, Layers, ChevronRight, Timer, X } from 'lucide-react';
import { addProjectToDB, updateProjectInDB, addPaymentAlertToDB } from '../lib/db';

interface DevelopmentProps {
  clients: Client[];
  projects: Project[];
  setProjects?: React.Dispatch<React.SetStateAction<Project[]>>; // Optional/Deprecated
  services?: Service[];
}

const Development: React.FC<DevelopmentProps> = ({ clients, projects, services = [] }) => {
  const [subSection, setSubSection] = useState<'Daily' | 'Control'>('Daily');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

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
        progress: Number(projectForm.progress)
      };
      await updateProjectInDB(editingProject.id, updates);
    } else {
      // Omit id, Firestore generates it
      const projectToAdd: any = {
        clientId: projectForm.clientId!,
        clientName: client?.name,
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
        progress: Number(projectForm.progress) || 0
      };
      await addProjectToDB(projectToAdd);
    }

    // Check if status is Completed/Closed/Waiting Client Feedback - trigger payment history FOR BALANCE
    if (!editingProject && Number(projectForm.advance) > 0) {
      // NEW PROJECT: Only log the advance as received
      try {
        await addPaymentAlertToDB({
          clientId: projectForm.clientId || '',
          clientName: client?.name || 'Unknown Client',
          projectId: 'PENDING_ID', // Replaced if needed, but usually fine for immediate standalone
          taskName: projectForm.serviceName || (projectForm.type === 'Web' ? 'Web Development' : 'Mobile App'),
          milestoneLabel: 'Advance',
          amount: Number(projectForm.advance),
          status: 'received',
          triggeredAt: new Date().toISOString(),
          resolvedAt: new Date().toISOString(),
          type: 'standalone', department: 'Development'
        });
      } catch (err) {
        console.error('Error creating advance payment record:', err);
      }
    } else if (editingProject && (projectForm.status === 'Completed' || projectForm.status === 'Closed' || projectForm.status === 'Waiting Client Feedback')) {
      // EXISTING PROJECT COMPLETED: Log only the remaining balance
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
            type: 'standalone', department: 'Development'
          });
        } catch (err) {
          console.error('Error creating development balance payment record:', err);
        }
      }
    } else if (projectForm.status === 'Waiting' || projectForm.status === 'Waiting for Mani') {
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
            type: 'standalone', department: 'Development'
          });
        } catch (err) {
          console.error('Error creating development waiting payment record:', err);
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
  };

  const openEdit = (project: Project) => {
    setEditingProject(project);
    setProjectForm({ ...project });
    setShowAddModal(true);
  };

  const updateProjectProgress = async (projectId: string, progress: number) => {
    await updateProjectInDB(projectId, { progress });
  };

  const updateProjectStatus = async (projectId: string, status: string) => {
    const updates: any = { status };
    if (status === 'Completed' || status === 'Closed' || status === 'Waiting Client Feedback') {
      updates.completedAt = new Date().toISOString();

      // Trigger payment alert for the BALANCE
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
              type: 'standalone', department: 'Development'
            });
          } catch (err) {
            console.error('Error creating development balance payment record:', err);
          }
        }
      }
    } else if (status === 'Waiting' || status === 'Waiting for Mani') {
      // Trigger waiting due payment alert
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
              type: 'standalone', department: 'Development'
            });
          } catch (err) {
            console.error('Error creating development waiting payment record:', err);
          }
        }
      }
    }
    await updateProjectInDB(projectId, updates);
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

    if (days < 0) return { text: `${Math.abs(days)}d Overdue`, color: 'text-red-600', bg: 'bg-red-50', iconColor: 'text-red-500' };
    if (days === 0) return { text: `Today`, color: 'text-orange-600', bg: 'bg-orange-50', iconColor: 'text-orange-500' };
    return { text: `${days}d Remaining`, color: 'text-blue-600', bg: 'bg-blue-50', iconColor: 'text-blue-500' };
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-1 p-1 bg-slate-200/50 rounded-2xl w-max border border-slate-200 shadow-sm mb-2">
        <button
          onClick={() => setSubSection('Daily')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${subSection === 'Daily' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Clock size={16} /> Daily Operation
          {dailyProjects.length > 0 && (
            <span className="bg-blue-600 text-white text-[10px] min-w-[20px] h-5 flex items-center justify-center rounded-full ml-1 px-1 font-black">
              {dailyProjects.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setSubSection('Control')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${subSection === 'Control' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Settings2 size={16} /> Control Centre
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
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
              <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{dailyProjects.length} Running Now</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {dailyProjects.length > 0 ? dailyProjects.map(project => {
              const remInfo = getRemainingDaysInfo(project.deadline);
              return (
                <div key={project.id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all duration-300 p-8 flex flex-col md:flex-row gap-8 items-stretch md:items-center relative group">
                  <div className={`absolute left-0 top-8 bottom-8 w-1.5 rounded-r-full ${remInfo.color === 'text-red-600' ? 'bg-red-500' : 'bg-blue-600'}`}></div>

                  <div className="flex-1 space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${project.priority === 'Urgent' ? 'bg-red-100 text-red-600' : project.priority === 'High' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600'}`}>
                        {project.priority} Priority
                      </span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{project.type} Solution</span>
                    </div>

                    <div>
                      <h4 className="text-2xl font-black text-slate-900 leading-tight">{project.clientName}</h4>
                      <p className="text-slate-500 mt-1 text-sm font-medium italic">"{project.description || 'Developing core framework components...'}"</p>
                    </div>

                    <div className="flex items-center gap-6 pt-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Start Date</span>
                        <span className="text-sm font-bold text-slate-700">{project.startDate}</span>
                      </div>
                      <ChevronRight size={14} className="text-slate-300" />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Deadline</span>
                        <span className="text-sm font-bold text-slate-700">{project.deadline}</span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full md:w-80 space-y-5 bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Production</span>
                      <span className="text-xl font-black text-blue-600">{project.progress}%</span>
                    </div>

                    <div className="space-y-2">
                      <div className="h-4 bg-slate-200 rounded-full overflow-hidden shadow-inner p-1">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-1000 shadow-sm"
                          style={{ width: `${project.progress}%` }}
                        ></div>
                      </div>
                      <input
                        type="range"
                        min="0" max="100"
                        value={project.progress}
                        onChange={(e) => updateProjectProgress(project.id, parseInt(e.target.value))}
                        className="w-full h-1.5 bg-transparent appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-black text-xs ${remInfo.bg} ${remInfo.color} shadow-sm border border-current opacity-80`}>
                        <Timer size={14} />
                        {remInfo.text}
                      </div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Updated: Just Now</div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-center gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Status</span>
                      <select
                        value={project.status}
                        onChange={(e) => updateProjectStatus(project.id, e.target.value)}
                        className="bg-white border-2 border-slate-100 rounded-2xl px-4 py-3 text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm hover:border-blue-200 transition-all cursor-pointer min-w-[160px]"
                      >
                        {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s === 'Waiting for Mani' ? 'Waiting' : s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="bg-white border-4 border-dashed border-slate-100 rounded-[4rem] py-40 text-center shadow-inner">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertCircle className="text-slate-200" size={40} />
                </div>
                <p className="text-slate-400 text-xl font-black uppercase tracking-widest">Queue is Empty</p>
                <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">No projects are active for today's timeline. Start a project in the Control Centre.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#0f172a] p-6 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group">
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><TrendingUp size={20} /></div>
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Master Pipeline</span>
              </div>
              <p className="text-2xl font-black relative z-10">₹{devProjects.reduce((sum, p) => sum + (p.totalAmount || 0), 0).toLocaleString()}</p>
              <p className="text-[10px] text-slate-400 mt-1 relative z-10">Live Revenue Inventory</p>
              <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-blue-600/10 rounded-full blur-2xl group-hover:scale-150 transition-transform"></div>
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative group overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><Layers size={20} /></div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Database</span>
              </div>
              <p className="text-2xl font-black text-slate-800">{devProjects.length} Projects</p>
              <p className="text-[10px] text-slate-400 mt-1">Stored master records</p>
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><CheckCircle2 size={20} /></div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Output</span>
              </div>
              <p className="text-2xl font-black text-slate-800">{devProjects.filter(p => p.status === 'Completed').length} Done</p>
              <p className="text-[10px] text-slate-400 mt-1">Successfully deployed</p>
            </div>

            <div className="bg-white p-2 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center">
              <button
                onClick={() => { resetForm(); setEditingProject(null); setShowAddModal(true); }}
                className="w-full h-full flex flex-col items-center justify-center gap-3 hover:bg-slate-50 transition-colors rounded-[2.2rem] border-2 border-dashed border-slate-200"
              >
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <Plus size={28} />
                </div>
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">New Master Record</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-10 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/30">
              <div className="flex items-center gap-3">
                <BarChart3 className="text-blue-500" size={24} />
                <div>
                  <h3 className="text-xl font-black text-slate-900">Project Master Control</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Manage All Development Assets</p>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="Filter ledger..." className="pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 w-72 shadow-inner" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="px-10 py-6">ID & Type</th>
                    <th className="px-10 py-6">Client Identity</th>
                    <th className="px-10 py-6">Timeline Log</th>
                    <th className="px-10 py-6">Financials</th>
                    <th className="px-10 py-6 text-right">Settings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {devProjects.map(project => (
                    <tr key={project.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-10 py-6">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-800 text-base">{project.type} Solution</span>
                          <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">REF: {project.id}</span>
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500">{project.clientName?.charAt(0)}</div>
                          <span className="text-sm font-bold text-slate-700">{project.clientName}</span>
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-700">{project.startDate}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">To {project.deadline}</span>
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        <div className="flex flex-col">
                          <span className="text-base font-black text-slate-900">₹{project.totalAmount.toLocaleString()}</span>
                          <span className="text-[9px] text-emerald-600 font-black uppercase tracking-tight">ADV: ₹{project.advance}</span>
                        </div>
                      </td>
                      <td className="px-10 py-6 text-right">
                        <button
                          onClick={() => openEdit(project)}
                          className="p-3 bg-white text-slate-400 hover:bg-blue-600 hover:text-white rounded-[1.2rem] transition-all shadow-sm border border-slate-200 group-hover:scale-110"
                        >
                          <Edit3 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-300 border border-white/20">
            <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">{editingProject ? 'Modify Project' : 'Initiate New Project'}</h3>
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
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                        <span>Progress</span>
                        <span className="text-blue-600">{projectForm.progress}%</span>
                      </div>
                      <input
                        type="range"
                        min="0" max="100"
                        className="w-full h-2 bg-slate-200 rounded-full cursor-pointer accent-blue-600"
                        value={projectForm.progress}
                        onChange={(e) => setProjectForm({ ...projectForm, progress: parseInt(e.target.value) })}
                      />
                    </div>
                    <select
                      className="w-full md:w-48 p-2.5 border border-slate-200 rounded-lg bg-white font-bold text-xs outline-none"
                      value={projectForm.status}
                      onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })}
                    >
                      {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s === 'Waiting for Mani' ? 'Waiting' : s}</option>)}
                    </select>
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
