import React, { useState, useEffect } from 'react';
import { Project, Employee, Client } from '../types';
import {
  Palette, Clock, CheckCircle2, AlertCircle, Plus, Send, Trash2,
  FileText, ExternalLink, Calendar, Check, ChevronRight, RefreshCw, X, LogOut,
  Building2, LayoutDashboard, ArrowLeft, Search, User, Layers, Link as LinkIcon, AlertTriangle, Menu
} from 'lucide-react';
import { updateProjectInDB, addPaymentAlertToDB } from '../lib/db';
import InternalHub from './InternalHub';

interface GraphicEmployeePanelProps {
  employee?: Employee;
  currentEmployee?: Employee;
  projects?: Project[];
  setProjects?: React.Dispatch<React.SetStateAction<Project[]>>;
  clients?: Client[];
  manualTasks?: any[];
  quotationDemos?: any[];
  onLogout?: () => void;
  employees?: Employee[];
  announcements?: any[];
  courses?: any[];
  issues?: any[];
}

const GraphicEmployeePanel: React.FC<GraphicEmployeePanelProps> = ({
  employee,
  currentEmployee,
  projects = [],
  setProjects,
  clients = [],
  onLogout,
  employees = [],
  announcements = [],
  courses = [],
  issues = []
}) => {
  const activeEmp = employee || currentEmployee;

  // Local state for projects to ensure INSTANT local UI updates on submit
  const [localProjects, setLocalProjects] = useState<Project[]>(projects || []);

  useEffect(() => {
    setLocalProjects(projects || []);
  }, [projects]);

  // View state: 'projects', 'completed', or 'internal_hub'
  const [currentTab, setCurrentTab] = useState<'projects' | 'completed' | 'internal_hub'>('projects');
  
  // Completed project selected for log viewing (read-only)
  const [selectedCompletedProject, setSelectedCompletedProject] = useState<Project | null>(null);
  const [completedLogSearch, setCompletedLogSearch] = useState('');
  
  // Navigation State: Level 1 (!selectedClient), Level 2 (selectedClient && !selectedProject), Level 3 (selectedProject)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Search terms
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [logSearchTerm, setLogSearchTerm] = useState('');

  // Add Deliverable Task Log Modal State
  const [showLogWorkModal, setShowLogWorkModal] = useState<boolean>(false);
  const [logFileName, setLogFileName] = useState<string>('');
  const [logWorkLink, setLogWorkLink] = useState<string>('');
  const [logNote, setLogNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Mobile Menu Drawer State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Completion Confirmation Pop-up State
  const [showCompletionModal, setShowCompletionModal] = useState<boolean>(false);
  const [pendingCompletionProject, setPendingCompletionProject] = useState<Project | null>(null);

  // Safe Arrays
  const safeProjects = Array.isArray(localProjects) ? localProjects : [];
  const safeClients = Array.isArray(clients) ? clients : [];
  const safeEmployees = Array.isArray(employees) ? employees : [];
  const safeAnnouncements = Array.isArray(announcements) ? announcements : [];
  const safeCourses = Array.isArray(courses) ? courses : [];
  const safeIssues = Array.isArray(issues) ? issues : [];

  if (!activeEmp) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-800 font-sans">
        <div className="bg-white border border-slate-200 p-8 rounded-2xl text-center shadow-sm max-w-sm">
          <AlertCircle className="mx-auto text-amber-500 mb-2" size={36} />
          <h3 className="text-sm font-extrabold text-slate-900 uppercase">Employee Session Not Found</h3>
          <p className="text-xs text-slate-500 mt-1">Please log out and log in again.</p>
          {onLogout && (
            <button
              onClick={onLogout}
              className="mt-4 bg-slate-900 text-white font-bold text-xs px-4 py-2 rounded-xl"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    );
  }

  // Internal Hub Badge Count Calculation
  const unreadAnnouncementsCount = safeAnnouncements.filter(a => a && !a.readBy?.includes(activeEmp.id)).length;
  const assignedIssuesCount = safeIssues.filter(i => 
    i && i.assignedTo === activeEmp.id && 
    (i.status === 'Open' || i.status === 'Assigned' || i.status === 'In Progress')
  ).length;
  const incompleteCoursesCount = safeCourses.filter(c => 
    c && (c.assignedEmployees?.includes(activeEmp.id) || c.department === 'All Departments' || c.department === activeEmp.department) && 
    !c.completedBy?.some((comp: any) => comp.employeeId === activeEmp.id)
  ).length;
  const hubBadgeCount = unreadAnnouncementsCount + assignedIssuesCount + incompleteCoursesCount;

  // Filter projects assigned to this graphic designer (ACTIVE PROJECTS ONLY - COMPLETED PROJECTS DISAPPEAR FROM EMPLOYEE PANEL)
  const myAssignedProjects = safeProjects
    .filter((p, index, self) => p && p.id && self.findIndex(o => o && o.id === p.id) === index)
    .filter(p => p.assignedEmployeeId === activeEmp.id && p.status !== 'Completed' && p.status !== 'Finished');

  // Filter completed projects assigned to this designer (read-only view)
  const myCompletedProjects = safeProjects
    .filter((p, index, self) => p && p.id && self.findIndex(o => o && o.id === p.id) === index)
    .filter(p => p.assignedEmployeeId === activeEmp.id && (p.status === 'Completed' || p.status === 'Finished'))
    .sort((a, b) => new Date(b.completedAt || b.createdAt || 0).getTime() - new Date(a.completedAt || a.createdAt || 0).getTime());

  // Clients that have graphic projects assigned to this designer
  const myGraphicClients = safeClients.filter(c => c && c.id && (
    myAssignedProjects.some(p => p.clientId === c.id)
  ));

  // Filter Graphic Clients by search
  const filteredGraphicClients = myGraphicClients.filter(c => c && (
    (c.name || '').toLowerCase().includes((clientSearchTerm || '').toLowerCase()) ||
    (c.companyName || '').toLowerCase().includes((clientSearchTerm || '').toLowerCase()) ||
    (c.email || '').toLowerCase().includes((clientSearchTerm || '').toLowerCase()) ||
    (c.mobile || '').includes(clientSearchTerm || '')
  ));

  // SORT CLIENTS
  const sortedGraphicClients = [...filteredGraphicClients].sort((a, b) => {
    const aActiveCount = myAssignedProjects.filter(p => p && p.clientId === a.id).length;
    const bActiveCount = myAssignedProjects.filter(p => p && p.clientId === b.id).length;
    return bActiveCount - aActiveCount;
  });

  // Calculate days remaining details
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

  // Open Log Work Modal for current selected project
  const openLogModalForSelectedProject = () => {
    if (!selectedProject) return;
    setLogWorkLink(selectedProject.workLink || '');
    setLogFileName('');
    setLogNote('');
    setShowLogWorkModal(true);
  };

  // DELETE TASK LOG
  const handleDeleteTaskLog = async (project: Project, logId: string) => {
    if (!window.confirm("Are you sure you want to delete this task log entry?")) return;
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
        status: 'In Progress'
      };

      // 1. Update active selectedProject state immediately
      setSelectedProject(prev => prev ? { ...prev, ...updates } : null);

      // 2. INSTANT LOCAL STATE UPDATE
      setLocalProjects(prev => prev.map(p => {
        if (p.id === project.id) {
          return {
            ...p,
            ...updates
          };
        }
        return p;
      }));

      // 3. INSTANT GLOBAL APP STATE UPDATE
      if (setProjects) {
        setProjects(prev => prev.map(p => {
          if (p.id === project.id) {
            return {
              ...p,
              ...updates
            };
          }
          return p;
        }));
      }

      // 4. BACKEND DB SYNC
      await updateProjectInDB(project.id, updates);
    } catch (err) {
      console.error('Failed to delete task log:', err);
      alert('Failed to delete task log entry.');
    }
  };

  // Submit Deliverable Task Log
  const handleLogWorkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const targetProj = safeProjects.find(p => p && p.id === selectedProject.id) || selectedProject;
      const existingLogs = targetProj.deliverableLogs || [];

      const total = targetProj.totalDeliverables || 1;
      const finalWorkLink = logWorkLink.trim() || targetProj.workLink || '';

      const newLogItem = {
        id: `log_${Date.now()}`,
        date: new Date().toISOString(),
        count: 1,
        fileName: logFileName.trim() || `Task ${existingLogs.length + 1}`,
        workLink: finalWorkLink || '',
        note: logNote.trim() || '',
        completedBy: activeEmp.id || '',
        completedByName: activeEmp.name || 'Designer'
      };

      const updatedLogs = [...existingLogs, newLogItem];
      const newCompleted = updatedLogs.length;
      const isReachingCompletion = newCompleted >= total;
      const progressPct = Math.min(100, Math.round((newCompleted / total) * 100));

      const updates: any = {
        completedDeliverables: newCompleted,
        deliverableLogs: updatedLogs,
        workLink: finalWorkLink,
        progress: progressPct,
        status: isReachingCompletion ? 'Completed' : 'In Progress'
      };

      if (isReachingCompletion) {
        updates.completedAt = new Date().toISOString();
      }

      // 1. INSTANT LOCAL STATE UPDATE
      setLocalProjects(prev => prev.map(p => {
        if (p.id === targetProj.id) {
          return {
            ...p,
            ...updates
          };
        }
        return p;
      }));

      // 2. INSTANT GLOBAL APP STATE UPDATE
      if (setProjects) {
        setProjects(prev => prev.map(p => {
          if (p.id === targetProj.id) {
            return {
              ...p,
              ...updates
            };
          }
          return p;
        }));
      }

      // 3. BACKEND DB SYNC
      await updateProjectInDB(targetProj.id, updates);

      // Trigger remaining balance payment alert in Accounts if 100% completed
      if (isReachingCompletion) {
        const totalAmt = targetProj.totalAmount || 0;
        const advanceAmt = targetProj.advance || 0;
        const balanceDue = totalAmt - advanceAmt;

        if (balanceDue > 0) {
          const clientObj = safeClients.find(c => c && c.id === targetProj.clientId);
          await addPaymentAlertToDB({
            projectId: targetProj.id,
            packageId: undefined,
            clientId: targetProj.clientId,
            clientName: clientObj?.name || targetProj.clientName || 'Client',
            amount: balanceDue,
            milestoneLabel: `Balance Payment - ${targetProj.serviceName || 'Graphic Service'}`,
            department: targetProj.department || 'Graphics Designing',
            status: 'due',
            type: 'standalone',
            triggeredAt: new Date().toISOString()
          });
        }
      }

      setShowLogWorkModal(false);
      setLogFileName('');
      setLogWorkLink('');
      setLogNote('');

      // IF THIS WAS THE LAST TASK, SHOW COMPLETION CONFIRMATION POP-UP & DISAPPEAR PROJECT
      if (isReachingCompletion) {
        setPendingCompletionProject({ ...targetProj, ...updates });
        setShowCompletionModal(true);
      } else {
        setSelectedProject(prev => prev ? { ...prev, ...updates } : null);
      }

    } catch (err) {
      console.error('Failed to log work:', err);
      alert('An error occurred while logging deliverable work.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm Final Project Completion & Disappear Project from Employee Queue
  const handleConfirmProjectCompletion = async () => {
    if (pendingCompletionProject) {
      const targetP = pendingCompletionProject;
      const totalAmt = Number(targetP.totalAmount) || 0;
      const advanceAmt = Number(targetP.advance) || 0;
      const balanceDue = totalAmt - advanceAmt;

      const updates: Partial<Project> = {
        status: 'Completed',
        completedAt: new Date().toISOString()
      };

      await updateProjectInDB(targetP.id, updates);

      if (balanceDue > 0) {
        const clientObj = safeClients.find(c => c && c.id === targetP.clientId);
        await addPaymentAlertToDB({
          projectId: targetP.id,
          packageId: undefined,
          clientId: targetP.clientId,
          clientName: clientObj?.name || targetP.clientName || 'Client',
          amount: balanceDue,
          milestoneLabel: `Balance Payment - ${targetP.serviceName || 'Graphic Service'}`,
          department: targetP.department || 'Graphics Designing',
          status: 'due',
          type: 'standalone',
          triggeredAt: new Date().toISOString()
        });
      }
    }

    setShowCompletionModal(false);
    setPendingCompletionProject(null);
    setSelectedProject(null);
    setSelectedClient(null);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">
      {/* MOBILE TOP HEADER BAR */}
      <header className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors cursor-pointer"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center font-extrabold text-xs text-white">
              {activeEmp.name ? activeEmp.name.charAt(0).toUpperCase() : 'G'}
            </div>
            <div>
              <h4 className="font-extrabold text-xs text-white leading-tight">{activeEmp.name}</h4>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">{activeEmp.department || 'Graphic'}</span>
            </div>
          </div>
        </div>
        <span className="text-[10px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-full uppercase tracking-wider">
          {currentTab === 'internal_hub' ? 'Internal Hub' : currentTab === 'completed' ? 'Completed' : 'Projects'}
        </span>
      </header>

      {/* MOBILE SLIDE-OVER DRAWER OVERLAY */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[80vw] bg-slate-900 text-slate-300 flex flex-col h-full shadow-2xl z-10 p-5 space-y-4 animate-in slide-in-from-left duration-200 border-r border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center font-black text-sm text-white">
                  {activeEmp.name ? activeEmp.name.charAt(0).toUpperCase() : 'G'}
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-white leading-none">{activeEmp.name}</h4>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-1">{activeEmp.department || 'Graphic'}</span>
                </div>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto">
              <button
                onClick={() => {
                  setCurrentTab('projects');
                  setSelectedClient(null);
                  setSelectedProject(null);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 ${
                  currentTab === 'projects'
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700/60'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <LayoutDashboard size={15} className={currentTab === 'projects' ? 'text-white' : 'text-slate-400'} />
                  <span>Assigned Projects</span>
                </div>
                <span className="bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                  {myAssignedProjects.length}
                </span>
              </button>

              <button
                onClick={() => {
                  setCurrentTab('completed');
                  setSelectedCompletedProject(null);
                  setCompletedLogSearch('');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 ${
                  currentTab === 'completed'
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700/60'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={15} className={currentTab === 'completed' ? 'text-emerald-400' : 'text-slate-400'} />
                  <span>Completed Projects</span>
                </div>
                {myCompletedProjects.length > 0 && (
                  <span className="bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                    {myCompletedProjects.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => { setCurrentTab('internal_hub'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 ${
                  currentTab === 'internal_hub'
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700/60'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Building2 size={15} className={currentTab === 'internal_hub' ? 'text-white' : 'text-slate-400'} />
                  <span>Internal Hub</span>
                </div>
                {hubBadgeCount > 0 && (
                  <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                    {hubBadgeCount}
                  </span>
                )}
              </button>
            </nav>

            {onLogout && (
              <div className="pt-3 border-t border-slate-800">
                <button
                  onClick={() => { setIsMobileMenuOpen(false); onLogout(); }}
                  className="w-full flex items-center gap-2 px-3.5 py-2.5 text-red-400 hover:bg-red-950/40 rounded-xl text-xs font-bold transition-all"
                >
                  <LogOut size={15} /> Logout
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* DESKTOP SIDEBAR NAVIGATION */}
      <aside className="hidden md:flex w-64 bg-slate-900 border-r border-slate-800 flex-col flex-shrink-0 select-none">
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center font-extrabold text-white text-base">
            {activeEmp.name ? activeEmp.name.charAt(0).toUpperCase() : 'G'}
          </div>
          <div className="truncate">
            <h2 className="text-sm font-extrabold text-white truncate">{activeEmp.name}</h2>
            <p className="text-[11px] font-medium text-slate-400 truncate">
              {activeEmp.department || 'Graphics Designing'}
            </p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <button
            onClick={() => {
              setCurrentTab('projects');
              setSelectedClient(null);
              setSelectedProject(null);
            }}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 ${
              currentTab === 'projects'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700/60'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <LayoutDashboard size={15} className={currentTab === 'projects' ? 'text-white' : 'text-slate-400'} />
              <span>Assigned Projects</span>
            </div>
            <span className="bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-extrabold px-2 py-0.5 rounded-md">
              {myAssignedProjects.length}
            </span>
          </button>

          <button
            onClick={() => {
              setCurrentTab('completed');
              setSelectedCompletedProject(null);
              setCompletedLogSearch('');
            }}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 ${
              currentTab === 'completed'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700/60'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={15} className={currentTab === 'completed' ? 'text-emerald-400' : 'text-slate-400'} />
              <span>Completed Projects</span>
            </div>
            {myCompletedProjects.length > 0 && (
              <span className="bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                {myCompletedProjects.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setCurrentTab('internal_hub')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 ${
              currentTab === 'internal_hub'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700/60'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Building2 size={15} className={currentTab === 'internal_hub' ? 'text-white' : 'text-slate-400'} />
              <span>Internal Hub</span>
            </div>
            {hubBadgeCount > 0 && (
              <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                {hubBadgeCount}
              </span>
            )}
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-red-400 hover:bg-red-950/30 rounded-xl text-xs font-bold transition-all"
            >
              <LogOut size={15} /> Logout
            </button>
          )}
        </div>
      </aside>

      {/* MAIN WORKSPACE BODY */}
      <main className="flex-1 bg-slate-50 text-slate-800 overflow-y-auto flex flex-col">
        {currentTab === 'internal_hub' ? (
          <div className="p-6 flex-1 bg-slate-50">
            <InternalHub currentUser={activeEmp} employees={safeEmployees} />
          </div>
        ) : currentTab === 'completed' ? (
          /* COMPLETED PROJECTS TAB */
          selectedCompletedProject ? (
            /* COMPLETED PROJECT LOG VIEW (READ-ONLY) */
            <div className="p-6 space-y-6 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-b border-slate-200/80 pb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedCompletedProject(null)}
                    className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 transition-all shadow-xs flex items-center gap-1 text-xs font-bold"
                  >
                    <ArrowLeft size={15} /> Back to Completed
                  </button>
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                      {selectedCompletedProject.serviceName}
                      <span className="text-xs font-semibold text-white bg-emerald-600 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <CheckCircle2 size={11} /> Completed
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {selectedCompletedProject.clientName} • {selectedCompletedProject.deliverableLogs?.length || 0} Task Logs
                    </p>
                  </div>
                </div>
              </div>

              {/* Search + Logs */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <FileText size={15} className="text-emerald-600" />
                    Task Logs ({(() => {
                      const logs = selectedCompletedProject.deliverableLogs || [];
                      return logs.filter(l =>
                        (l.fileName || '').toLowerCase().includes(completedLogSearch.toLowerCase()) ||
                        (l.note || '').toLowerCase().includes(completedLogSearch.toLowerCase())
                      ).length;
                    })()})
                  </h3>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                    <input
                      type="text"
                      placeholder="Search logs..."
                      value={completedLogSearch}
                      onChange={e => setCompletedLogSearch(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-slate-800 text-xs pl-8 pr-3 py-1.5 rounded-xl focus:outline-none focus:border-slate-900 shadow-xs"
                    />
                  </div>
                </div>

                {(() => {
                  const allLogs = (selectedCompletedProject.deliverableLogs || []).slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                  const filtered = allLogs.filter(l =>
                    (l.fileName || '').toLowerCase().includes(completedLogSearch.toLowerCase()) ||
                    (l.note || '').toLowerCase().includes(completedLogSearch.toLowerCase())
                  );
                  if (filtered.length === 0) {
                    return (
                      <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center shadow-xs space-y-2">
                        <FileText className="mx-auto text-slate-300 mb-1" size={40} />
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">No Task Logs Found</h4>
                        <p className="text-xs text-slate-500">No task log entries were added for this project.</p>
                      </div>
                    );
                  }
                  return (
                    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden divide-y divide-slate-100">
                      <div className="bg-slate-50 text-slate-500 font-bold text-[11px] uppercase tracking-wider px-6 py-3.5 grid grid-cols-12 gap-4 items-center border-b border-slate-200/60">
                        <div className="col-span-2">Date</div>
                        <div className="col-span-5">File / Deliverable Title</div>
                        <div className="col-span-5">Work Link</div>
                      </div>
                      {filtered.map(log => (
                        <div key={log.id} className="px-6 py-3.5 grid grid-cols-12 gap-4 items-center hover:bg-slate-50/80 text-xs">
                          <div className="col-span-2 text-slate-500 font-medium">
                            {new Date(log.date).toLocaleDateString('en-GB')}
                          </div>
                          <div className="col-span-5 truncate">
                            <span className="font-semibold text-slate-800 truncate block">{log.fileName}</span>
                            {log.note && <span className="text-[11px] text-slate-400 truncate block">{log.note}</span>}
                          </div>
                          <div className="col-span-5 truncate">
                            {log.workLink ? (
                              <a
                                href={log.workLink.startsWith('http') ? log.workLink : `https://${log.workLink}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline bg-blue-50 px-2 py-0.5 rounded border border-blue-100"
                              >
                                <LinkIcon size={11} /> View Folder <ExternalLink size={10} />
                              </a>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">No link</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            /* COMPLETED PROJECTS LIST */
            <div className="p-6 space-y-6 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Completed Projects</h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Your completed graphic design projects — click any to view its task logs</p>
                </div>
                <span className="text-xs font-semibold text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {myCompletedProjects.length} Completed
                </span>
              </div>

              {myCompletedProjects.length === 0 ? (
                <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center shadow-xs space-y-2">
                  <CheckCircle2 className="mx-auto text-slate-300 mb-1" size={40} />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">No Completed Projects Yet</h4>
                  <p className="text-xs text-slate-500">Completed projects will appear here once a project is marked as done.</p>
                </div>
              ) : (
                <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden divide-y divide-slate-100">
                  <div className="bg-slate-50 text-slate-500 font-bold text-[11px] uppercase tracking-wider px-6 py-3.5 grid grid-cols-12 gap-4 items-center border-b border-slate-200/60">
                    <div className="col-span-5">Project Name</div>
                    <div className="col-span-3">Client</div>
                    <div className="col-span-2">Logs</div>
                    <div className="col-span-2 text-right">Completed</div>
                  </div>
                  {myCompletedProjects.map(project => (
                    <button
                      key={project.id}
                      onClick={() => setSelectedCompletedProject(project)}
                      className="w-full px-6 py-4 grid grid-cols-12 gap-4 items-center hover:bg-emerald-50/40 text-xs text-left group transition-colors"
                    >
                      <div className="col-span-5">
                        <span className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors block truncate">
                          {project.serviceName || 'Graphic Project'}
                        </span>
                        <span className="text-[11px] text-slate-400 block">{project.department || 'Graphics Designing'}</span>
                      </div>
                      <div className="col-span-3 font-medium text-slate-600 truncate">{project.clientName || '—'}</div>
                      <div className="col-span-2">
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 font-bold text-[11px] px-2 py-0.5 rounded-md">
                          <FileText size={10} />
                          {project.deliverableLogs?.length || 0} logs
                        </span>
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-1 text-emerald-600 font-bold">
                        <span className="hidden sm:block text-[11px]">
                          {project.completedAt ? new Date(project.completedAt).toLocaleDateString('en-GB') : '—'}
                        </span>
                        <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        ) : !selectedClient ? (
          /* LEVEL 1: CLIENT ACCOUNTS LISTING */
          <div className="p-6 space-y-6 flex-1">
            {/* Top Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Graphic Designer Work Desk
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Select an assigned client account below to view active projects and submit task logs
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {myAssignedProjects.length} Active Design Tasks
                </span>
              </div>
            </div>

            {/* Search Bar */}
            {myGraphicClients.length > 0 && (
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-xs max-w-sm">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="text"
                    placeholder="Search client accounts..."
                    value={clientSearchTerm}
                    onChange={(e) => setClientSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs pl-8 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-slate-900 focus:bg-white"
                  />
                </div>
              </div>
            )}

            {/* CLIENT TABLE */}
            {sortedGraphicClients.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center shadow-xs space-y-2">
                <Palette className="mx-auto text-slate-300 mb-1" size={40} />
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">No Active Graphic Projects</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  You currently have no active graphic design projects assigned to your queue.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden divide-y divide-slate-100">
                <div className="bg-slate-50 text-slate-500 font-bold text-[11px] uppercase tracking-wider px-6 py-3.5 grid grid-cols-12 gap-4 items-center border-b border-slate-200/60">
                  <div className="col-span-4">Client / Company</div>
                  <div className="col-span-3">Work Progress</div>
                  <div className="col-span-2">Remaining Days</div>
                  <div className="col-span-2">Pending Work</div>
                  <div className="col-span-1 text-right">Action</div>
                </div>

                {sortedGraphicClients.map(client => {
                  if (!client) return null;
                  const clientProjs = myAssignedProjects.filter(p => p && p.clientId === client.id);

                  const totalDeliverables = clientProjs.reduce((acc, p) => acc + (p?.totalDeliverables || 0), 0);
                  const completedDeliverables = clientProjs.reduce((acc, p) => acc + (p?.deliverableLogs?.length || p?.completedDeliverables || 0), 0);
                  const pendingDeliverables = Math.max(0, totalDeliverables - completedDeliverables);
                  const progressPct = totalDeliverables > 0 ? Math.round((completedDeliverables / totalDeliverables) * 100) : 0;

                  let deadlineInfo = { days: 999, text: 'No Active Task', level: 'neutral' };
                  if (clientProjs.length > 0) {
                    const sortedDeadlines = [...clientProjs]
                      .filter(p => p.deadline)
                      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
                    
                    if (sortedDeadlines.length > 0) {
                      deadlineInfo = getDaysRemainingDetails(sortedDeadlines[0].deadline);
                    }
                  }

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
                        <div className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center font-bold text-xs">
                          {client.name ? client.name.charAt(0).toUpperCase() : 'C'}
                        </div>

                        <div className="truncate">
                          <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                            {client.name}
                          </h3>
                          <p className="text-[11px] text-slate-500 font-normal truncate">
                            {client.companyName || 'Client'}
                          </p>
                        </div>
                      </div>

                      <div className="col-span-3 space-y-1">
                        <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                          <span className="text-[11px]">Progress:</span>
                          <span className="text-[11px] font-semibold text-slate-900">
                            {completedDeliverables} / {totalDeliverables} ({progressPct}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-slate-900 h-full rounded-full transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>

                      <div className="col-span-2">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                          deadlineInfo.level === 'critical'
                            ? 'text-red-600 font-bold'
                            : deadlineInfo.level === 'warning'
                            ? 'text-amber-600'
                            : 'text-slate-600'
                        }`}>
                          <Clock size={13} className={deadlineInfo.level === 'critical' ? 'text-red-500' : 'text-slate-400'} />
                          {deadlineInfo.text}
                        </span>
                      </div>

                      <div className="col-span-2">
                        <span className={`text-xs font-semibold ${
                          pendingDeliverables === 0
                            ? 'text-emerald-600'
                            : pendingDeliverables > 5
                            ? 'text-rose-600 font-bold'
                            : 'text-slate-700'
                        }`}>
                          {pendingDeliverables === 0 ? '0 Pending (Done)' : `${pendingDeliverables} Tasks Pending`}
                        </span>
                      </div>

                      <div className="col-span-1 text-right">
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
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : !selectedProject ? (
          /* LEVEL 2: INSIDE CLIENT DESK (PROJECTS LIST FOR CLIENT) */
          <div className="p-6 space-y-6 flex-1">
            {/* Header & Back Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-b border-slate-200/80 pb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedClient(null)}
                  className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 transition-all shadow-xs flex items-center gap-1 text-xs font-bold"
                >
                  <ArrowLeft size={15} /> Back to Clients
                </button>

                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    {selectedClient.name}
                    {selectedClient.companyName && (
                      <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {selectedClient.companyName}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Assigned Projects Desk • {myAssignedProjects.filter(p => p.clientId === selectedClient.id).length} Active Service Project(s)
                  </p>
                </div>
              </div>
            </div>

            {/* PROJECTS TABLE */}
            {(() => {
              const activeProjs = myAssignedProjects.filter(p => p.clientId === selectedClient.id);

              return (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Layers size={15} className="text-blue-600" /> Active Service Projects ({activeProjs.length})
                  </h3>

                  {activeProjs.length === 0 ? (
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center shadow-xs space-y-2">
                      <Palette className="mx-auto text-slate-300 mb-1" size={40} />
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">No Active Projects</h4>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        No active service projects assigned for this client currently.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden divide-y divide-slate-100">
                      <div className="bg-slate-50 text-slate-500 font-bold text-[11px] uppercase tracking-wider px-6 py-3.5 grid grid-cols-12 gap-4 items-center border-b border-slate-200/60">
                        <div className="col-span-4">Service / Project Name</div>
                        <div className="col-span-3">Work Progress</div>
                        <div className="col-span-3">Remaining Days</div>
                        <div className="col-span-2 text-right">Action</div>
                      </div>

                      {activeProjs.map(project => {
                        if (!project) return null;
                        const total = project.totalDeliverables || 1;
                        const completed = project.deliverableLogs ? project.deliverableLogs.length : (project.completedDeliverables || 0);
                        const progressPct = Math.min(100, Math.round((completed / total) * 100));
                        const daysInfo = getDaysRemainingDetails(project.deadline);

                        return (
                          <div
                            key={project.id}
                            onClick={() => setSelectedProject(project)}
                            className="px-6 py-4 grid grid-cols-12 gap-4 items-center transition-colors hover:bg-slate-50/80 cursor-pointer group text-xs"
                          >
                            <div className="col-span-4">
                              <h4 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                                {project.serviceName || 'Graphic Service'}
                              </h4>
                              {project.description && (
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                  {project.description}
                                </p>
                              )}
                            </div>

                            <div className="col-span-3 space-y-1">
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

                            <div className="col-span-3">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                                daysInfo.level === 'critical'
                                  ? 'text-red-600 font-bold'
                                  : daysInfo.level === 'warning'
                                  ? 'text-amber-600'
                                  : 'text-slate-600'
                              }`}>
                                <Clock size={13} className={daysInfo.level === 'critical' ? 'text-red-500' : 'text-slate-400'} />
                                {daysInfo.text}
                              </span>
                            </div>

                            <div className="col-span-2 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedProject(project);
                                }}
                                className="inline-flex items-center gap-1 text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors"
                              >
                                <span>Open Project</span>
                                <ChevronRight size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ) : (
          /* LEVEL 3: INSIDE SPECIFIC PROJECT DESK (TASK LOGS FOR THIS SPECIFIC PROJECT) */
          <div className="p-6 space-y-6 flex-1">
            {/* Header & Back Button + SINGLE TOP BUTTON: + Task Log */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-b border-slate-200/80 pb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedProject(null)}
                  className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 transition-all shadow-xs flex items-center gap-1 text-xs font-bold"
                >
                  <ArrowLeft size={15} /> Back to Projects
                </button>

                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    {selectedProject.serviceName}
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      {selectedClient.name}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Project Deliverables Desk • Progress: <strong className="text-blue-600">{selectedProject.deliverableLogs?.length || selectedProject.completedDeliverables || 0}/{selectedProject.totalDeliverables || 1} Tasks Completed</strong>
                  </p>
                </div>
              </div>

              {/* SINGLE BUTTON ON TOP: + Task Log */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => openLogModalForSelectedProject()}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-2 active:scale-95"
                >
                  <Plus size={15} /> + Task Log
                </button>
              </div>
            </div>

            {/* DELIVERABLE TASK LOGS FOR THIS SPECIFIC PROJECT */}
            {(() => {
              const currentProjObj = safeProjects.find(p => p && p.id === selectedProject.id) || selectedProject;
              const projectLogs = currentProjObj.deliverableLogs || [];
              
              // Sort latest task logs first
              const sortedProjectLogs = [...projectLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

              // Filter task logs by search term
              const filteredProjectLogs = sortedProjectLogs.filter(log => (
                (log.fileName || '').toLowerCase().includes(logSearchTerm.toLowerCase()) ||
                (log.note || '').toLowerCase().includes(logSearchTerm.toLowerCase()) ||
                (log.completedByName || '').toLowerCase().includes(logSearchTerm.toLowerCase())
              ));

              return (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <FileText size={15} className="text-blue-600" /> Deliverable Task Logs for {currentProjObj.serviceName} ({filteredProjectLogs.length})
                    </h3>

                    {/* Search Bar for Task Logs */}
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
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">No Task Logs Added Yet</h4>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        {logSearchTerm ? 'No task logs match your search term.' : 'Click "+ Task Log" button above to record a task log entry.'}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden divide-y divide-slate-100">
                      {/* Table Header Row */}
                      <div className="bg-slate-50 text-slate-500 font-bold text-[11px] uppercase tracking-wider px-6 py-3.5 grid grid-cols-12 gap-4 items-center border-b border-slate-200/60">
                        <div className="col-span-2">Date</div>
                        <div className="col-span-4">File / Deliverable Title</div>
                        <div className="col-span-5">Work Link</div>
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

                          {/* Work Link */}
                          <div className="col-span-5 truncate">
                            {log.workLink ? (
                              <a
                                href={log.workLink.startsWith('http') ? log.workLink : `https://${log.workLink}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline bg-blue-50 px-2 py-0.5 rounded border border-blue-100"
                              >
                                <LinkIcon size={11} /> View Folder <ExternalLink size={10} />
                              </a>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">No link</span>
                            )}
                          </div>

                          {/* DELETE LOG ENTRY BUTTON */}
                          <div className="col-span-1 text-right">
                            <button
                              onClick={() => handleDeleteTaskLog(currentProjObj, log.id)}
                              title="Delete Task Log Entry"
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
              );
            })()}
          </div>
        )}
      </main>

      {/* LOG DELIVERABLES WORK MODAL */}
      {showLogWorkModal && selectedProject && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-200 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Add Task Log Entry</h3>
                <p className="text-xs text-slate-500">For Project: <strong className="text-slate-800">{selectedProject.serviceName}</strong></p>
              </div>
              <button
                onClick={() => setShowLogWorkModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg bg-slate-100 transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleLogWorkSubmit} className="space-y-3">
              {/* Stats Target Banner */}
              {(() => {
                const targetP = safeProjects.find(p => p.id === selectedProject.id) || selectedProject;
                const done = targetP.deliverableLogs ? targetP.deliverableLogs.length : (targetP.completedDeliverables || 0);
                const total = targetP.totalDeliverables || 1;
                const left = Math.max(0, total - done);

                return (
                  <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs font-medium text-slate-700">
                    <span>Target: <strong className="text-slate-900">{total} Tasks</strong></span>
                    <span>Done: <strong className="text-blue-600">{done}</strong></span>
                    <span>Remaining: <strong className="text-amber-600 font-bold">{left} Left</strong></span>
                  </div>
                );
              })()}

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Deliverable Title / Task Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Poster 1 - Product Launch"
                  value={logFileName}
                  onChange={(e) => setLogFileName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl focus:outline-none focus:border-slate-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center gap-1">
                  <LinkIcon size={12} className="text-blue-600" />
                  <span>Project Work Link (Drive / Figma / Canva URL)</span>
                </label>
                <input
                  type="text"
                  placeholder="https://drive.google.com/drive/folders/..."
                  value={logWorkLink}
                  onChange={(e) => setLogWorkLink(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-slate-900 focus:bg-white font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Pre-filled with previous project link.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Notes on task..."
                  value={logNote}
                  onChange={(e) => setLogNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs p-2.5 rounded-xl focus:outline-none focus:border-slate-900 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowLogWorkModal(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROJECT COMPLETION CONFIRMATION MODAL */}
      {showCompletionModal && pendingCompletionProject && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-3xl p-6 text-center space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-slate-800">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-1">
              <CheckCircle2 size={32} />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-slate-900">Project Completed! 🎉</h3>
              <p className="text-xs text-slate-600 mt-1">
                You have completed all <strong className="text-slate-900">{pendingCompletionProject.totalDeliverables} tasks</strong> for project <strong className="text-blue-600">{pendingCompletionProject.serviceName}</strong>.
              </p>
              <p className="text-[11px] text-slate-400 mt-2">
                This project will now be marked as Completed and moved to the Admin Audit view.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-2">
              <button
                onClick={handleConfirmProjectCompletion}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs py-2.5 rounded-xl shadow-xs transition-all active:scale-95"
              >
                Confirm & Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphicEmployeePanel;
