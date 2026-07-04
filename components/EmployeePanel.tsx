import React, { useState, useRef } from 'react';
import { Employee, Project, Priority, Client, Package, ManualTask, QuotationDemo, MarketingServiceAllocation, MarketingReportEntry, ProjectNote } from '../types';
import { LogOut, CheckCircle, Clock, AlertCircle, Calendar, ChevronRight, DollarSign, Wallet, PauseCircle, PlayCircle, Loader2, LayoutDashboard, Search, ChevronDown, Filter, Plus, PlaySquare, ArrowLeft, Layers, FileText, Download, Save, Trash2, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, Building2 } from 'lucide-react';
import { updateProjectInDB, updatePackageInDB, addPaymentAlertToDB, updateManualTaskInDB, updateQuotationDemoInDB } from '../lib/db';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import NewManualTaskModal from './NewManualTaskModal';
import jsPDF from 'jspdf';
import GoogleDocsWorkspace from './GoogleDocsWorkspace';
import { loadWatermarkBase64, stampWatermarkAllPages } from '../lib/pdfWatermark';
import InternalHub from './InternalHub';

type EmployeeView = 'dashboard' | 'pending' | 'waiting' | 'working' | 'demos' | 'internal_hub';

interface EmployeePanelProps {
  employee: Employee;
  projects: Project[];
  clients: Client[];
  manualTasks?: ManualTask[];
  quotationDemos?: QuotationDemo[];
  setProjects?: React.Dispatch<React.SetStateAction<Project[]>>;
  onLogout: () => void;
  employees?: Employee[];
  announcements?: any[];
  courses?: any[];
  issues?: any[];
}

const EmployeePanel: React.FC<EmployeePanelProps> = ({ 
  employee, 
  projects, 
  clients, 
  manualTasks = [], 
  quotationDemos = [], 
  onLogout, 
  employees = [], 
  announcements = [], 
  courses = [], 
  issues = [] 
}) => {
  if (employee.department === 'Marketing') {
    return (
      <MarketingEmployeePanel 
        employee={employee} 
        projects={projects} 
        clients={clients} 
        onLogout={onLogout} 
        employees={employees} 
        announcements={announcements} 
        courses={courses} 
        issues={issues} 
      />
    );
  }

  const [currentView, setCurrentView] = useState<EmployeeView>('dashboard');

  // Hub badge calculation for standard employees
  const unreadAnnouncementsCount = announcements.filter(a => !a.readBy?.includes(employee.id)).length;
  const assignedIssuesCount = issues.filter(i => 
    i.assignedTo === employee.id && 
    (i.status === 'Open' || i.status === 'Assigned' || i.status === 'In Progress')
  ).length;
  const incompleteCoursesCount = courses.filter(c => 
    (c.assignedEmployees?.includes(employee.id) || c.department === 'All Departments' || c.department === employee.department) && 
    !c.completedBy?.some((comp: any) => comp.employeeId === employee.id)
  ).length;
  const hubBadgeCount = unreadAnnouncementsCount + assignedIssuesCount + incompleteCoursesCount;
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTaskSuccess, setNewTaskSuccess] = useState(false);

  // --- Finish Confirmation Popup ---
  const [finishPopup, setFinishPopup] = useState<{
    type: 'project' | 'manual';
    taskId: string;
    taskName: string;
  } | null>(null);
  const [finishFileName, setFinishFileName] = useState('');
  const [isFinishing, setIsFinishing] = useState(false);
  const fileNameInputRef = React.useRef<HTMLInputElement>(null);

  // --- New Filter State ---
  const [taskSearch, setTaskSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState<'all' | 'custom' | 'specific'>('all');
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [specificDate, setSpecificDate] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Use local date to respect user's timezone (e.g., IST)
  // ... date logic remains same ...
  const now = new Date();
  const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  // Filter: Assigned to me AND (Start Date is today or in the past)
  // Sort: Past Pending (Backlog) First, then Today's tasks
  // My assigned tasks from projects
  const myProjectTasks = projects
    .filter(p => p.assignedEmployeeId === employee.id && p.startDate <= today)
    .sort((a, b) => {
      const isBacklogA = a.startDate < today && a.status !== 'Finished';
      const isBacklogB = b.startDate < today && b.status !== 'Finished';
      if (isBacklogA && !isBacklogB) return -1;
      if (!isBacklogA && isBacklogB) return 1;
      const priorityOrder = { 'Urgent': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
      return (priorityOrder[a.priority as keyof typeof priorityOrder] || 2) - (priorityOrder[b.priority as keyof typeof priorityOrder] || 2);
    });

  // Employee's own manual tasks (all regardless of admin confirmation - so employee can track them)
  const myManualTasks = manualTasks
    .filter(t => t.createdBy === employee.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Employee's assigned creative demos
  const myDemos = quotationDemos
    .filter(d => d.assignedEmployeeId === employee.id)
    .sort((a, b) => new Date(a.allocatedDate).getTime() - new Date(b.allocatedDate).getTime());

  const updateStatus = async (projectId: string, newStatus: string, deliveryFileName?: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const updates: Partial<Project> = { status: newStatus };

    // Save the file name the employee entered when finishing
    if (newStatus === 'Finished' && deliveryFileName) {
      updates.deliveryFileName = deliveryFileName;
    }

    // If status is finished, the work is done. We need to alert the admin to collect the remaining payment.
    if (newStatus === 'Finished') {
      updates.progress = 100;
      updates.completedAt = new Date().toISOString(); // Track completion time

      // If standalone task (no package), calculate remaining balance and create a DUE payment alert
      if (!project.packageId) {
        const balance = (project.totalAmount || 0) - (project.advance || 0);
        if (balance > 0) {
          try {
            await addPaymentAlertToDB({
              clientId: project.clientId,
              clientName: project.clientName || 'Unknown Client',
              projectId: project.id,
              taskName: project.serviceName,
              milestoneLabel: 'Final Balance',
              amount: balance,
              status: 'due',
              triggeredAt: new Date().toISOString(),
              type: 'standalone',
              department: 'Graphics Designing'
            });
          } catch (err) {
            console.error('Error creating standalone final balance payment alert:', err);
          }
        }
      }
    }

    // If standalone task is set to Waiting, the work is done but pending final client payment
    if (newStatus === 'Waiting' && !project.packageId) {
      const balanceAmount = (project.totalAmount || 0) - (project.advance || 0);

      if (balanceAmount > 0) {
        try {
          await addPaymentAlertToDB({
            clientId: project.clientId,
            clientName: project.clientName || 'Unknown Client',
            projectId: project.id,
            taskName: project.serviceName,
            milestoneLabel: 'Final Balance', // Descriptive tag representing pending revenue for the independent work
            amount: balanceAmount,
            status: 'due',
            triggeredAt: new Date().toISOString(),
            type: 'standalone', department: 'Graphics Designing'
          });
        } catch (err) {
          console.error('Error creating standalone waiting payment alert:', err);
        }
      }
    }

    await updateProjectInDB(projectId, updates);

    // If task is linked to a package and is now Finished, update completedCount AND check milestones
    if (newStatus === 'Finished' && project.packageId) {
      try {
        const pkgDoc = await getDoc(doc(db, 'packages', project.packageId));
        if (pkgDoc.exists()) {
          const pkgData = pkgDoc.data() as Package;
          const lineItems = [...(pkgData.lineItems || [])];
          const idx = project.packageLineItemIndex;

          // Step 1: Increment the relevant line item's completedCount (stored value)
          if (idx !== undefined && idx >= 0 && idx < lineItems.length) {
            lineItems[idx] = { ...lineItems[idx], completedCount: (lineItems[idx].completedCount || 0) + 1 };
          }

          // Step 2: Calculate total completed by directly querying the database (prevents race condition)
          const projectsRef = collection(db, 'projects');
          const q = query(projectsRef, where('packageId', '==', project.packageId));
          const querySnapshot = await getDocs(q);
          const allLinkedProjects = querySnapshot.docs.map(d => d.data() as Project);

          // Count all completed ones from the true live state, but if our CURRENT task isn't saved as finished yet, we add 1.
          // Because updateProjectInDB is async and we don't await its final db propagation instantly sometimes.
          const dbCompleted = allLinkedProjects.filter(p =>
            p.status === 'Finished' || p.status === 'Completed' || p.status === 'Closed'
          ).length;

          // Determine if the current task was already counted as finished in that split second
          const currentTaskInDb = allLinkedProjects.find(p => p.id === project.id);
          const wasCurrentTaskCounted = currentTaskInDb && (currentTaskInDb.status === 'Finished' || currentTaskInDb.status === 'Completed' || currentTaskInDb.status === 'Closed');

          const totalCompleted = wasCurrentTaskCounted ? dbCompleted : dbCompleted + 1;

          // Step 3: Check each milestone — if upcoming and threshold crossed, trigger it
          const milestones = [...(pkgData.paymentMilestones || [])];
          let milestonesChanged = false;

          for (let i = 0; i < milestones.length; i++) {
            const ms = milestones[i];
            if (ms.status === 'upcoming' && totalCompleted >= ms.triggerAtQuantity) {
              // Milestone triggered! Change to 'due' 
              milestones[i] = { ...ms, status: 'due' };
              milestonesChanged = true;

              // Create a payment alert
              await addPaymentAlertToDB({
                clientId: pkgData.clientId,
                clientName: pkgData.clientName,
                packageId: project.packageId,
                packageName: pkgData.packageName,
                milestoneLabel: ms.label,
                amount: ms.amountDue,
                status: 'due',
                triggeredAt: new Date().toISOString(),
                type: 'package', department: 'Graphics Designing'
              });
            }
          }

          // Save updates to package
          const pkgUpdates: any = { lineItems };
          if (milestonesChanged) {
            pkgUpdates.paymentMilestones = milestones;
          }
          await updatePackageInDB(project.packageId, pkgUpdates);
        }
      } catch (err) {
        console.error('Error updating package progress/milestones:', err);
      }
    }
  };

  // Update status of a MANUAL (employee-created) task
  const updateManualTaskStatus = async (taskId: string, newStatus: ManualTask['status'], deliveryFileName?: string) => {
    const task = manualTasks.find(t => t.id === taskId);
    if (!task) return;

    const updates: Partial<ManualTask> = { status: newStatus };

    if (newStatus === 'Finished') {
      updates.finishedDate = new Date().toISOString().split('T')[0];
      if (deliveryFileName) (updates as any).deliveryFileName = deliveryFileName;
    }

    await updateManualTaskInDB(taskId, updates);

    // Trigger payment alert if admin has set a value
    if ((newStatus === 'Finished' || newStatus === 'Waiting') && task.adminConfirmed && task.totalAmount) {
      const balance = task.totalAmount - (task.advance || 0);
      if (balance > 0) {
        try {
          await addPaymentAlertToDB({
            clientId: task.clientId,
            clientName: task.clientName,
            taskName: task.description.substring(0, 50),
            milestoneLabel: newStatus === 'Finished' ? 'Task Completed - Final Balance' : 'Payment Due - Work Delivered',
            amount: balance,
            status: 'due',
            triggeredAt: new Date().toISOString(),
            type: 'standalone',
            department: task.department,
          });
        } catch (err) {
          console.error('Error creating payment alert for manual task:', err);
        }
      }
    }
  };

  // Update status of a Demos task
  const updateDemoStatus = async (demoId: string, newStatus: QuotationDemo['status']) => {
    const demo = quotationDemos.find(d => d.id === demoId);
    if (!demo) return;

    // Employee can mark a demo as "Completed". "Approved" is reserved for Admin in Quotations page.
    await updateQuotationDemoInDB(demoId, { status: newStatus });
  };

  const getPriorityColor = (p: Priority) => {
    switch (p) {
      case 'Urgent': return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]';
      case 'High': return 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]';
      case 'Medium': return 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.4)]';
      default: return 'bg-slate-500 shadow-[0_0_10px_rgba(100,116,139,0.4)]';
    }
  };

  // Active tasks from projects
  const activeTasks = myProjectTasks.filter(t => t.status !== 'Finished');
  const activeManualTasks = myManualTasks.filter(t => t.status !== 'Finished');
  const activeDemos = myDemos.filter(d => d.status !== 'Approved' && d.status !== 'Completed');

  // Stats for the top bar
  // Treat 'Allocated' as 'Pending' for stats to ensure visibility
  const pendingCount = activeTasks.filter(t => t.status === 'Pending' || t.status === 'Allocated').length
    + activeManualTasks.filter(t => t.status === 'Pending').length + activeDemos.filter(d => d.status === 'Pending').length;
  const workingCount = activeTasks.filter(t => t.status === 'Working').length
    + activeManualTasks.filter(t => t.status === 'Working').length;
  const waitingCount = activeTasks.filter(t => t.status === 'Waiting').length
    + activeManualTasks.filter(t => t.status === 'Waiting').length;
  const demosCount = activeDemos.length;

  // Filter project tasks based on current view
  const getFilteredProjectTasks = () => {
    let tasks = activeTasks;
    switch (currentView) {
      case 'pending': tasks = activeTasks.filter(t => t.status === 'Pending' || t.status === 'Allocated'); break;
      case 'waiting': tasks = activeTasks.filter(t => t.status === 'Waiting'); break;
      case 'working': tasks = activeTasks.filter(t => t.status === 'Working'); break;
      default: break;
    }
    return tasks
      .filter(p => {
        if (!taskSearch.trim()) return true;
        const q = taskSearch.toLowerCase();
        return (p.serviceName || '').toLowerCase().includes(q) || (p.clientName || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
      })
      .filter(p => !filterPriority || p.priority === filterPriority)
      .filter(p => {
        if (selectedDateFilter === 'all') return true;
        if (selectedDateFilter === 'custom') {
          if (!customDateRange.start || !customDateRange.end) return true;
          const projectDate = new Date(p.startDate || p.createdAt || '');
          const start = new Date(customDateRange.start);
          const end = new Date(customDateRange.end);
          end.setHours(23, 59, 59, 999);
          return projectDate >= start && projectDate <= end;
        }
        if (selectedDateFilter === 'specific') {
          if (!specificDate) return true;
          const pDate = new Date(p.startDate || p.createdAt || '').toISOString().split('T')[0];
          return pDate === specificDate;
        }
        return true;
      });
  };

  // Filter manual tasks based on current view
  const getFilteredManualTasks = () => {
    let tasks = activeManualTasks;
    switch (currentView) {
      case 'pending': tasks = activeManualTasks.filter(t => t.status === 'Pending'); break;
      case 'waiting': tasks = activeManualTasks.filter(t => t.status === 'Waiting'); break;
      case 'working': tasks = activeManualTasks.filter(t => t.status === 'Working'); break;
      default: break;
    }
    if (taskSearch.trim()) {
      const q = taskSearch.toLowerCase();
      tasks = tasks.filter(t => t.description.toLowerCase().includes(q) || t.clientName.toLowerCase().includes(q) || (t.companyName || '').toLowerCase().includes(q));
    }
    if (filterPriority) tasks = tasks.filter(t => t.priority === filterPriority);
    return tasks;
  };

  const filteredProjectTasks = getFilteredProjectTasks();
  const filteredManualTasks = getFilteredManualTasks();
  const filteredDemos = currentView === 'demos'
    ? activeDemos
    : activeDemos.filter(d => d.status === currentView.charAt(0).toUpperCase() + currentView.slice(1));
  const totalFilteredTasks = filteredProjectTasks.length + filteredManualTasks.length + (currentView === 'demos' ? filteredDemos.length : 0);

  // Get view title
  const getViewTitle = () => {
    switch (currentView) {
      case 'pending': return 'Pending Tasks';
      case 'waiting': return 'Waiting Tasks';
      case 'working': return 'Working Tasks';
      case 'demos': return 'My Allocated Demos';
      case 'dashboard':
      default: return 'Currently Available';
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mini Sidebar */}
      <aside className="hidden lg:flex w-16 md:w-64 bg-[#0f172a] text-slate-300 flex-col border-r border-slate-800 shadow-xl z-20">
        <div className="p-4 flex flex-col items-center md:items-start">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg mb-6">
            <span className="text-white font-black text-sm">Y</span>
          </div>
          <nav className="space-y-2 w-full">
            {/* Dashboard */}
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-black transition-all uppercase text-[9px] tracking-widest ${currentView === 'dashboard'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
            >
              <LayoutDashboard size={16} />
              <span className="hidden lg:block flex-1 text-left">Dashboard</span>
            </button>

            {/* Pending */}
            <button
              onClick={() => setCurrentView('pending')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-black transition-all uppercase text-[9px] tracking-widest ${currentView === 'pending'
                ? 'bg-slate-600 text-white shadow-lg shadow-slate-600/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
            >
              <Loader2 size={16} />
              <span className="hidden lg:block flex-1 text-left">Pending</span>
              {pendingCount > 0 && (
                <span className="ml-auto bg-slate-800 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>

            {/* Waiting */}
            <button
              onClick={() => setCurrentView('waiting')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-black transition-all uppercase text-[9px] tracking-widest ${currentView === 'waiting'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
            >
              <PauseCircle size={16} />
              <span className="hidden lg:block flex-1 text-left">Waiting</span>
              {waitingCount > 0 && (
                <span className="ml-auto bg-rose-800 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  {waitingCount}
                </span>
              )}
            </button>

            {/* Working */}
            <button
              onClick={() => setCurrentView('working')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-black transition-all uppercase text-[9px] tracking-widest ${currentView === 'working'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
            >
              <PlayCircle size={16} />
              <span className="hidden lg:block flex-1 text-left">Working</span>
              {workingCount > 0 && (
                <span className="ml-auto bg-indigo-800 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  {workingCount}
                </span>
              )}
            </button>

            {/* Demos */}
            <button
              onClick={() => setCurrentView('demos')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-black transition-all uppercase text-[9px] tracking-widest ${currentView === 'demos'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
            >
              <PlaySquare size={16} />
              <span className="hidden lg:block flex-1 text-left">Demos</span>
              {demosCount > 0 && (
                <span className="ml-auto bg-violet-800 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  {demosCount}
                </span>
              )}
            </button>

            {/* Internal Hub */}
            <button
              onClick={() => setCurrentView('internal_hub')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-black transition-all uppercase text-[9px] tracking-widest ${currentView === 'internal_hub'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
            >
              <Building2 size={16} />
              <span className="hidden lg:block flex-1 text-left">Internal Hub</span>
              {hubBadgeCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                  {hubBadgeCount}
                </span>
              )}
            </button>
          </nav>
        </div>
        <div className="mt-auto p-4">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-all font-black uppercase text-[9px] tracking-widest"
          >
            <LogOut size={16} />
            <span className="hidden lg:block">Exit</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-4 md:p-6 relative w-full overflow-hidden">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">Hello, {employee.name.split(' ')[0]}!</h1>
            <p className="text-slate-500 mt-1 font-medium tracking-wide text-xs">{getViewTitle()}</p>          </div>
          <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-black text-slate-800 leading-none">{employee.name}</p>
              <p className="text-[9px] text-slate-400 uppercase tracking-widest mt-1 font-black">{employee.department} OP</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black shadow-lg shadow-indigo-600/20 text-sm">
              {employee.name.charAt(0)}
            </div>
          </div>
        </header>

        {/* Mobile Navigation (Visible only on mobile since sidebar is hidden) */}
        <div className="lg:hidden mb-4">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all ${currentView === 'dashboard'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:bg-slate-50'
                }`}
            >
              <LayoutDashboard size={14} />
              <span>Home</span>
            </button>
            <button
              onClick={() => setCurrentView('pending')}
              className={`relative flex flex-col items-center gap-1 px-2 py-2 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all ${currentView === 'pending'
                ? 'bg-slate-600 text-white shadow-md'
                : 'text-slate-400 hover:bg-slate-50'
                }`}
            >
              <Loader2 size={14} />
              <span>Pending</span>
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setCurrentView('waiting')}
              className={`relative flex flex-col items-center gap-1 px-2 py-2 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all ${currentView === 'waiting'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:bg-slate-50'
                }`}
            >
              <PauseCircle size={14} />
              <span>Waiting</span>
              {waitingCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                  {waitingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setCurrentView('working')}
              className={`relative flex flex-col items-center gap-1 px-2 py-2 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all ${currentView === 'working'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:bg-slate-50'
                }`}
            >
              <PlayCircle size={14} />
              <span>Working</span>
              {workingCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                  {workingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setCurrentView('demos')}
              className={`relative flex flex-col items-center gap-1 px-2 py-2 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all ${currentView === 'demos'
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-slate-400 hover:bg-slate-50'
                }`}
            >
              <PlaySquare size={14} />
              <span>Demos</span>
              {demosCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-violet-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                  {demosCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setCurrentView('internal_hub')}
              className={`relative flex flex-col items-center gap-1 px-2 py-2 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all ${currentView === 'internal_hub'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:bg-slate-50'
                }`}
            >
              <Building2 size={14} />
              <span>Hub</span>
              {hubBadgeCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                  {hubBadgeCount}
                </span>
              )}
            </button>
          </div>
          <button
            onClick={onLogout}
            className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition-all"
          >
            <LogOut size={14} /> Exit
          </button>
        </div>

        {currentView === 'internal_hub' ? (
          <div className="flex-1 overflow-y-auto">
            <InternalHub currentUser={employee} employees={employees} />
          </div>
        ) : (
          <>
            {/* Top Stats Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white px-5 py-4 rounded-[1.5rem] border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">Pending</span>
              <span className="text-2xl font-black text-slate-800 mt-0.5">{activeTasks.filter(t => t.status === 'Pending' || t.status === 'Allocated').length}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
              <Loader2 size={18} />
            </div>
          </div>
          <div className="bg-white px-5 py-4 rounded-[1.5rem] border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-widest text-indigo-400 font-bold">Working</span>
              <span className="text-2xl font-black text-indigo-600 mt-0.5">{workingCount}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
              <PlayCircle size={18} />
            </div>
          </div>
          <div className="bg-white px-5 py-4 rounded-[1.5rem] border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-widest text-rose-400 font-bold">Waiting</span>
              <span className="text-2xl font-black text-rose-500 mt-0.5">{waitingCount}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500">
              <PauseCircle size={18} />
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-4 mb-8">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search tasks, clients..."
                className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                value={taskSearch}
                onChange={e => setTaskSearch(e.target.value)}
              />
            </div>

            {/* Priority Filter */}
            <div className="relative">
              <select
                value={filterPriority}
                onChange={e => setFilterPriority(e.target.value)}
                className="w-full sm:w-auto px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest appearance-none outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[140px]"
              >
                <option value="">All Priority</option>
                <option value="Urgent">🔴 Urgent</option>
                <option value="High">🟠 High</option>
                <option value="Medium">🔵 Medium</option>
                <option value="Low">⚪ Low</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>

            {/* Date Filter Dropdown */}
            <div className="relative group min-w-[160px]">
              <select
                value={selectedDateFilter}
                onChange={(e) => {
                  const val = e.target.value as 'all' | 'custom' | 'specific';
                  setSelectedDateFilter(val);
                  if (val === 'custom' || val === 'specific') {
                    setShowDatePicker(true);
                  } else {
                    setShowDatePicker(false);
                  }
                }}
                className="w-full sm:w-auto px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest appearance-none outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">ALL DATES</option>
                <option value="custom">CUSTOM RANGE</option>
                <option value="specific">SPECIFIC DATE</option>
              </select>
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />

              {/* Popover for Dates */}
              {showDatePicker && (selectedDateFilter === 'custom' || selectedDateFilter === 'specific') && (
                <div className="absolute top-full right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-50 min-w-[300px] animate-in slide-in-from-top-2">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-slate-800 text-sm">
                      {selectedDateFilter === 'custom' ? 'Select Date Range' : 'Select Specific Date'}
                    </h4>
                    <button onClick={() => setShowDatePicker(false)} className="text-slate-400 hover:text-slate-600">
                      ✕
                    </button>
                  </div>

                  {selectedDateFilter === 'custom' ? (
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

            {/* Clear Filters */}
            {(taskSearch || filterPriority || selectedDateFilter !== 'all') && (
              <button
                onClick={() => {
                  setTaskSearch('');
                  setFilterPriority('');
                  setSelectedDateFilter('all');
                  setCustomDateRange({ start: '', end: '' });
                  setSpecificDate('');
                  setShowDatePicker(false);
                }}
                className="px-4 py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all"
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Task List Container */}
        <div className="flex-1 overflow-y-auto space-y-6 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 sticky top-0 bg-slate-50 z-10 pt-2">
            <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase text-[10px] tracking-[0.2em]">
              <Clock size={14} className="text-indigo-600" />
              {getViewTitle()}
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Auto-Sync Active</span>
              <button
                onClick={() => { setShowNewTaskModal(true); setNewTaskSuccess(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm hover:bg-blue-700 transition"
              >
                <Plus size={12} />
                New Task
              </button>
            </div>
          </div>



          <div className="space-y-4">

            {/* === DEMOS TASKS === */}
            {currentView === 'demos' && filteredDemos.map(demo => (
              <div key={demo.id} className="bg-white px-6 py-5 rounded-[2rem] border border-violet-100 shadow-sm hover:shadow-lg hover:border-violet-300 transition-all duration-300 relative group overflow-hidden">
                <div className="absolute top-0 right-0 py-1.5 px-4 bg-violet-500 text-white text-[9px] font-black uppercase tracking-widest rounded-bl-xl shadow-sm z-10">Creative Demo</div>
                <div className="flex flex-col lg:flex-row justify-between gap-6 relative z-0 mt-3">
                  <div className="flex-1">
                    <h4 className="text-lg font-black text-slate-900 tracking-tight">{demo.clientName}</h4>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed italic opacity-80">"{demo.description || 'Awaiting production details...'}"</p>

                    <div className="grid grid-cols-2 gap-4 mt-6 p-3 bg-violet-50 rounded-2xl border border-violet-100/50">
                      <div className="flex flex-col">
                        <span className="text-[8px] text-violet-400 font-black uppercase tracking-widest mb-0.5">Service Required</span>
                        <span className="text-xs font-black text-slate-800">
                          {demo.serviceName}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] text-violet-400 font-black uppercase tracking-widest mb-0.5">Date Allocated</span>
                        <span className="text-xs font-black text-slate-800">
                          {new Date(demo.allocatedDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 justify-center lg:border-l border-slate-100 lg:pl-6 min-w-[200px]">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center mb-1">Status Control</p>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => updateDemoStatus(demo.id, 'Pending')}
                        className={`w-full px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-between group/btn ${(demo.status === 'Pending') ? 'bg-slate-800 text-white shadow-md shadow-slate-800/20' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                      >
                        <span>Pending</span>
                        {(demo.status === 'Pending') && <CheckCircle size={12} className="text-white" />}
                      </button>
                      <button
                        onClick={() => updateDemoStatus(demo.id, 'Completed')}
                        className={`w-full px-3 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2`}
                      >
                        <span>Mark Completed</span>
                        <CheckCircle size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* === PROJECT TASKS === */}
            {currentView !== 'demos' && filteredProjectTasks.map(task => (
              <div key={task.id} className="bg-white px-6 py-5 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-lg hover:border-indigo-100 transition-all duration-300 relative group">
                <div className="flex flex-col lg:flex-row justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`}></span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{task.priority} Priority</span>
                    </div>
                    <h4 className="text-lg font-black text-slate-900 tracking-tight">{task.serviceName}</h4>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed italic opacity-80">"{task.description || 'Awaiting production details...'}"</p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex flex-col">
                        <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Entity</span>
                        <span className="text-xs font-black text-slate-800">
                          {clients.find(c => c.id === task.clientId)?.companyName || task.clientName || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Delivery</span>
                        <span className={`text-xs font-black ${task.deadline === today ? 'text-rose-600' : (task.deadline < today ? 'text-red-600' : 'text-slate-800')}`}>
                          {task.deadline === today ? 'TODAY' : task.deadline}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 justify-center lg:border-l border-slate-100 lg:pl-6 min-w-[200px]">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center mb-1">Status Control</p>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => updateStatus(task.id, 'Pending')}
                        className={`w-full px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-between group/btn ${(task.status === 'Pending' || task.status === 'Allocated') ? 'bg-slate-800 text-white shadow-md shadow-slate-800/20' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                      >
                        <span>Pending</span>
                        {(task.status === 'Pending' || task.status === 'Allocated') && <CheckCircle size={12} className="text-white" />}
                      </button>
                      <button
                        onClick={() => updateStatus(task.id, 'Working')}
                        className={`w-full px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-between group/btn ${task.status === 'Working' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                      >
                        <span>Working</span>
                        {task.status === 'Working' && <CheckCircle size={12} className="text-white" />}
                      </button>
                      <button
                        onClick={() => updateStatus(task.id, 'Waiting')}
                        className={`w-full px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-between group/btn ${task.status === 'Waiting' ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                      >
                        <span>Waiting</span>
                        {task.status === 'Waiting' && <CheckCircle size={12} className="text-white" />}
                      </button>
                      <div className="h-px bg-slate-100 my-0.5"></div>
                      <button
                        onClick={() => {
                          setFinishFileName('');
                          setFinishPopup({ type: 'project', taskId: task.id, taskName: task.serviceName });
                          setTimeout(() => fileNameInputRef.current?.focus(), 50);
                        }}
                        className="w-full px-3 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <span>Finish</span>
                        <CheckCircle size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* === MANUAL TASKS === */}
            {filteredManualTasks.map(task => (
              <div key={task.id} className="bg-white px-6 py-5 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-lg hover:border-indigo-100 transition-all duration-300 relative group">

                <div className="flex flex-col lg:flex-row justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`}></span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{task.priority} Priority</span>
                    </div>
                    <h4 className="text-lg font-black text-slate-900 tracking-tight">{task.companyName || task.clientName}</h4>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed italic opacity-80">"{task.description}"</p>

                    <div className="grid grid-cols-2 gap-4 mt-6 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex flex-col">
                        <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Client</span>
                        <span className="text-xs font-black text-slate-800">{task.companyName || task.clientName}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Started</span>
                        <span className="text-xs font-black text-slate-800">{task.startDate}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 justify-center lg:border-l border-slate-100 lg:pl-6 min-w-[200px]">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center mb-1">Status Control</p>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => updateManualTaskStatus(task.id, 'Pending')}
                        className={`w-full px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-between ${task.status === 'Pending' ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                      >
                        <span>Pending</span>
                        {task.status === 'Pending' && <CheckCircle size={12} className="text-white" />}
                      </button>
                      <button
                        onClick={() => updateManualTaskStatus(task.id, 'Working')}
                        className={`w-full px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-between ${task.status === 'Working' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                      >
                        <span>Working</span>
                        {task.status === 'Working' && <CheckCircle size={12} className="text-white" />}
                      </button>
                      <button
                        onClick={() => updateManualTaskStatus(task.id, 'Waiting')}
                        className={`w-full px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-between ${task.status === 'Waiting' ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                      >
                        <span>Waiting</span>
                        {task.status === 'Waiting' && <CheckCircle size={12} className="text-white" />}
                      </button>
                      <div className="h-px bg-slate-100 my-0.5"></div>
                      <button
                        onClick={() => {
                          setFinishFileName('');
                          setFinishPopup({ type: 'manual', taskId: task.id, taskName: task.description?.substring(0, 40) || 'this task' });
                          setTimeout(() => fileNameInputRef.current?.focus(), 50);
                        }}
                        className="w-full px-3 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <span>Finish</span>
                        <CheckCircle size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Empty State */}
            {totalFilteredTasks === 0 && (
              <div className="py-16 text-center bg-white border-2 border-dashed border-slate-100 rounded-[2rem] shadow-sm">
                <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="text-emerald-500" size={28} />
                </div>
                <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-sm">All Tasks Cleared</p>
                <p className="text-slate-400 text-[10px] mt-1 opacity-60">Production queue idle.</p>
                <button
                  onClick={() => setShowNewTaskModal(true)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition"
                >
                  <Plus size={14} />
                  Create a New Task
                </button>
              </div>
            )}
          </div>
        </div>
      </>
    )}
  </main>

      {/* New Manual Task Modal */}
      {showNewTaskModal && (
        <NewManualTaskModal
          employee={employee}
          clients={clients}
          onClose={() => setShowNewTaskModal(false)}
          onSuccess={() => {
            setShowNewTaskModal(false);
            setNewTaskSuccess(true);
          }}
        />
      )}

      {/* ── Finish Confirmation Popup ── */}
      {finishPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setFinishPopup(null); }}
        >
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
            {/* Icon + Title */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <CheckCircle className="text-emerald-500" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 leading-tight">Mark as Finished</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5 truncate max-w-[260px]">{finishPopup.taskName}</p>
              </div>
            </div>

            {/* File Name Input */}
            <div className="mb-6">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                Delivered File Name <span className="text-rose-500">*</span>
              </label>
              <input
                ref={fileNameInputRef}
                type="text"
                value={finishFileName}
                onChange={e => setFinishFileName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') setFinishPopup(null);
                  if (e.key === 'Enter' && finishFileName.trim()) {
                    // trigger confirm
                    document.getElementById('finish-confirm-btn')?.click();
                  }
                }}
                placeholder="e.g. BeccaBerry_Logo_v2_final.psd"
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 focus:border-emerald-500 rounded-xl text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400"
              />
              <p className="text-[10px] text-slate-400 mt-2 font-medium">
                Enter the exact file name or a short description of the work you are delivering. This will be saved to the work history and the package report.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setFinishPopup(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              >
                Cancel
              </button>
              <button
                id="finish-confirm-btn"
                disabled={!finishFileName.trim() || isFinishing}
                onClick={async () => {
                  if (!finishFileName.trim() || isFinishing) return;
                  setIsFinishing(true);
                  try {
                    if (finishPopup.type === 'project') {
                      await updateStatus(finishPopup.taskId, 'Finished', finishFileName.trim());
                    } else {
                      await updateManualTaskStatus(finishPopup.taskId, 'Finished', finishFileName.trim());
                    }
                    setFinishPopup(null);
                  } finally {
                    setIsFinishing(false);
                  }
                }}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                {isFinishing ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><CheckCircle size={14} /> Confirm Finish</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface MarketingEmployeePanelProps {
  employee: Employee;
  projects: Project[];
  clients: Client[];
  onLogout: () => void;
  employees?: Employee[];
  announcements?: any[];
  courses?: any[];
  issues?: any[];
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

const MarketingEmployeePanel: React.FC<MarketingEmployeePanelProps> = ({ 
  employee, 
  projects, 
  clients, 
  onLogout, 
  employees = [], 
  announcements = [], 
  courses = [], 
  issues = [] 
}) => {
  const [marketingView, setMarketingView] = useState<'campaigns' | 'internal_hub'>('campaigns');

  // Hub badge calculation for marketing employees
  const unreadAnnouncementsCount = announcements.filter(a => !a.readBy?.includes(employee.id)).length;
  const assignedIssuesCount = issues.filter(i => 
    i.assignedTo === employee.id && 
    (i.status === 'Open' || i.status === 'Assigned' || i.status === 'In Progress')
  ).length;
  const incompleteCoursesCount = courses.filter(c => 
    (c.assignedEmployees?.includes(employee.id) || c.department === 'All Departments' || c.department === employee.department) && 
    !c.completedBy?.some((comp: any) => comp.employeeId === employee.id)
  ).length;
  const hubBadgeCount = unreadAnnouncementsCount + assignedIssuesCount + incompleteCoursesCount;
  const [activeProjId, setActiveProjId] = useState<string | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<'services' | 'reports' | 'notes'>('services');
  const [reportTexts, setReportTexts] = useState<Record<string, string>>({});
  const [selectedReportServiceId, setSelectedReportServiceId] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({});
  const [newNoteText, setNewNoteText] = useState('');
  const [notesText, setNotesText] = useState<string>('');

  const editorRef = useRef<HTMLDivElement>(null);
  const notesEditorRef = useRef<HTMLDivElement>(null);

  const myMarketingProjects = projects.filter(proj => {
    if (proj.type !== 'Marketing') return false;
    const allocs = proj.servicesAllocated || [];
    return allocs.some(alloc => alloc.assignedEmployeeId === employee.id);
  });

  const activeProj = projects.find(p => p.id === activeProjId);

  React.useEffect(() => {
    if (activeProj) {
      const initialTexts: Record<string, string> = {};
      const myServices = (activeProj.servicesAllocated || []).filter(alloc => alloc.assignedEmployeeId === employee.id);
      myServices.forEach(alloc => {
        initialTexts[alloc.serviceId] = alloc.report || '';
      });
      setReportTexts(initialTexts);
      setSaveStatus({});
      if (myServices.length > 0) {
        setSelectedReportServiceId(prev => {
          if (prev && myServices.some(s => s.serviceId === prev)) return prev;
          return myServices[0].serviceId;
        });
      }
    }
  }, [activeProjId, projects]);

  React.useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = reportTexts[selectedReportServiceId] || '';
    }
  }, [selectedReportServiceId, workspaceTab]);

  const executeCommand = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setReportTexts(prev => ({
        ...prev,
        [selectedReportServiceId]: editorRef.current!.innerHTML
      }));
    }
  };

  const handleUpdateServiceStatus = async (serviceId: string, status: any) => {
    if (!activeProj) return;
    const updatedAllocations = (activeProj.servicesAllocated || []).map(s => {
      if (s.serviceId === serviceId) {
        return { ...s, status };
      }
      return s;
    });
    await updateProjectInDB(activeProj.id, { servicesAllocated: updatedAllocations });
  };

  const handleSubmitReport = async (serviceId: string) => {
    if (!activeProj) return;
    const reportText = editorRef.current ? editorRef.current.innerHTML : (reportTexts[serviceId] || '');

    setSaveStatus(prev => ({ ...prev, [serviceId]: 'saving' }));

    const updatedAllocations = (activeProj.servicesAllocated || []).map(s => {
      if (s.serviceId === serviceId) {
        return {
          ...s,
          report: reportText
        };
      }
      return s;
    });

    try {
      await updateProjectInDB(activeProj.id, { servicesAllocated: updatedAllocations });
      setSaveStatus(prev => ({ ...prev, [serviceId]: 'saved' }));
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [serviceId]: 'idle' }));
      }, 3000);
    } catch (err) {
      console.error("Failed to save report:", err);
      alert("Error saving report to database.");
      setSaveStatus(prev => ({ ...prev, [serviceId]: 'idle' }));
    }
  };

  React.useEffect(() => {
    if (workspaceTab === 'notes' && notesEditorRef.current && activeProj) {
      notesEditorRef.current.innerHTML = activeProj.marketingNotes || '';
      setNotesText(activeProj.marketingNotes || '');
    }
  }, [workspaceTab, activeProjId]);

  const executeNotesCommand = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    if (notesEditorRef.current) {
      setNotesText(notesEditorRef.current.innerHTML);
    }
  };

  const handleSaveNotesLedger = async () => {
    if (!activeProj) return;
    const finalHtml = notesEditorRef.current ? notesEditorRef.current.innerHTML : notesText;
    await updateProjectInDB(activeProj.id, { marketingNotes: finalHtml });
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
    if (target === editorRef.current) {
      setReportTexts(prev => ({
        ...prev,
        [selectedReportServiceId]: target.innerHTML
      }));
    } else if (target === notesEditorRef.current) {
      setNotesText(target.innerHTML);
    }
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
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-xs">
      {/* Sidebar Navigation */}
      <aside className="w-56 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 shrink-0">
        <div className="p-5 flex flex-col items-start gap-3">
          <div className="w-8 h-8 bg-slate-800 rounded flex items-center justify-center border border-slate-700">
            <span className="text-white font-extrabold text-sm">M</span>
          </div>
          <div>
            <h4 className="font-bold text-xs text-white tracking-tight leading-none">{employee.name}</h4>
            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block mt-1">Marketing Specialist</span>
          </div>
        </div>

        <div className="h-px bg-slate-800 mx-5 mb-4"></div>

        <nav className="flex-1 px-3 space-y-1">
          <button
            onClick={() => {
              setMarketingView('campaigns');
              setActiveProjId(null);
            }}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              marketingView === 'campaigns' && !activeProjId ? 'bg-slate-850 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-850 hover:text-white'
            }`}
          >
            <LayoutDashboard size={13} /> My Campaigns
          </button>

          <button
            onClick={() => setMarketingView('internal_hub')}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-between gap-2 ${
              marketingView === 'internal_hub' ? 'bg-slate-850 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-850/50 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Building2 size={13} className={marketingView === 'internal_hub' ? 'text-white' : 'text-slate-400'} /> 
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
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-950/30 rounded-lg text-xs font-bold transition"
          >
            <LogOut size={13} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Workspace Body */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {marketingView === 'internal_hub' ? (
          <div className="flex-1 overflow-y-auto p-5 bg-slate-105">
            <InternalHub currentUser={employee} employees={employees} />
          </div>
        ) : activeProj ? (
          <div className="flex-1 flex flex-col overflow-hidden p-5 animate-in fade-in duration-200 bg-slate-100/40">
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={() => setActiveProjId(null)}
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition shadow-sm"
              >
                <ArrowLeft size={12} /> Dashboard
              </button>
              <div className="h-4 w-px bg-slate-350"></div>
              <div>
                <h3 className="text-base font-extrabold text-slate-800 leading-none">{activeProj.clientName}</h3>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-1">Marketing workspace</span>
              </div>
            </div>

            <div className="flex gap-1 p-0.5 bg-slate-200/50 rounded-lg w-max border border-slate-200 shadow-sm mb-4">
              <button
                onClick={() => setWorkspaceTab('services')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${workspaceTab === 'services' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Services & Status
              </button>
              <button
                onClick={() => setWorkspaceTab('notes')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${workspaceTab === 'notes' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Notes Ledger
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
              {workspaceTab === 'services' && (() => {
                const myServices = (activeProj.servicesAllocated || []).filter(alloc => alloc.assignedEmployeeId === employee.id);
                
                return (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-sm font-black text-slate-800 leading-tight">My Active Services</h4>
                        <p className="text-[10px] text-slate-400 font-medium">Review assigned services and update active delivery status.</p>
                      </div>
                      {myServices.length > 0 && (
                        <button
                          onClick={() => {
                            setSelectedReportServiceId(myServices[0].serviceId);
                            setWorkspaceTab('reports');
                          }}
                          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-md transition inline-flex items-center gap-1.5 uppercase tracking-wider text-[10px] font-sans"
                        >
                          <FileText size={12} /> Open Workspace Report / Logs
                        </button>
                      )}
                    </div>

                    {myServices.length === 0 ? (
                      <div className="py-12 border border-dashed border-slate-250 rounded-lg text-center text-xs font-bold uppercase text-slate-400">
                        No active services assigned to your name in this campaign.
                      </div>
                    ) : (
                      <div className="border border-slate-250 rounded-lg overflow-hidden bg-white shadow-sm">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-450 font-black uppercase text-[8px] tracking-wider">
                              <th className="px-4 py-2.5">Service Name</th>
                              <th className="px-4 py-2.5">Status</th>
                              <th className="px-4 py-2.5">Action Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                            {myServices.map(service => (
                              <tr key={service.serviceId} className="hover:bg-slate-50/40 transition-colors">
                                <td className="px-4 py-3 font-extrabold text-slate-800 text-xs">{service.serviceName}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 border rounded text-[8px] font-black uppercase tracking-wider inline-block ${service.status === 'Finished' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : (service.status === 'Working' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-500 border-slate-150')}`}>
                                    {service.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <select
                                    value={service.status}
                                    onChange={(e) => handleUpdateServiceStatus(service.serviceId, e.target.value)}
                                    className="p-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-755 outline-none cursor-pointer w-32"
                                  >
                                    <option value="Pending">Pending</option>
                                    <option value="Working">Working</option>
                                    <option value="Waiting">Waiting</option>
                                    <option value="Finished">Finished</option>
                                  </select>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}

              {workspaceTab === 'reports' && (() => {
                const myServices = (activeProj.servicesAllocated || []).filter(alloc => alloc.assignedEmployeeId === employee.id);
                
                return (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-150">
                      <div>
                        <h4 className="text-sm font-black text-slate-800 leading-tight">Service Reporting Hub</h4>
                        <p className="text-xs text-slate-400 font-medium">Select a campaign channel to submit your formatted daily log report.</p>
                      </div>
                      <button
                        onClick={() => setWorkspaceTab('services')}
                        className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[10px] font-bold transition flex items-center gap-1 shadow-sm border border-slate-200"
                      >
                        <ArrowLeft size={11} /> Back to Services
                      </button>
                    </div>

                    {myServices.length === 0 ? (
                      <div className="py-12 border border-dashed border-slate-200 rounded-lg text-center text-xs font-bold uppercase text-slate-400">
                        No active services assigned to your name in this campaign.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {(() => {
                          const serviceAlloc = myServices.find(s => s.serviceId === selectedReportServiceId) || myServices[0];

                          if (!serviceAlloc) {
                            return (
                              <div className="py-12 border border-dashed border-slate-200 rounded-lg text-center text-xs font-bold uppercase tracking-widest text-slate-400">
                                No active services assigned to your name.
                              </div>
                            );
                          }

                          return (
                            <GoogleDocsWorkspace
                              project={activeProj}
                              serviceAlloc={serviceAlloc}
                              client={clients.find(c => c.id === activeProj.clientId)}
                              employee={employee}
                            />
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })()}

              {workspaceTab === 'notes' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-150 shrink-0">
                    <div>
                      <h4 className="text-sm font-black text-slate-800 leading-tight">Shared Notes Ledger</h4>
                      <p className="text-xs text-slate-400 font-medium">Google Docs style note editor. Changes sync in real-time with admins.</p>
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
                        className="p-1.5 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                        title="Bold"
                      >
                        <Bold size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => executeNotesCommand('italic')}
                        className="p-1.5 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                        title="Italic"
                      >
                        <Italic size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => executeNotesCommand('underline')}
                        className="p-1.5 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                        title="Underline"
                      >
                        <Underline size={13} />
                      </button>
                      
                      <div className="w-px h-4 bg-slate-200 mx-1"></div>

                      <button
                        type="button"
                        onClick={() => executeNotesCommand('justifyLeft')}
                        className="p-1.5 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                        title="Align Left"
                      >
                        <AlignLeft size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => executeNotesCommand('justifyCenter')}
                        className="p-1.5 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                        title="Align Center"
                      >
                        <AlignCenter size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => executeNotesCommand('justifyRight')}
                        className="p-1.5 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                        title="Align Right"
                      >
                        <AlignRight size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => executeNotesCommand('justifyFull')}
                        className="p-1.5 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                        title="Justify"
                      >
                        <AlignJustify size={13} />
                      </button>

                      <div className="w-px h-4 bg-slate-200 mx-1"></div>

                      <button
                        type="button"
                        onClick={() => executeNotesCommand('insertUnorderedList')}
                        className="p-1.5 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                        title="Bullet List"
                      >
                        <List size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => executeNotesCommand('insertOrderedList')}
                        className="p-1.5 hover:bg-slate-200 text-slate-600 rounded transition-colors"
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
                      initialValue={activeProj.marketingNotes || ''}
                      onInput={(html) => setNotesText(html)}
                      onPaste={handleEditorPaste}
                      className="flex-1 p-4 text-xs font-medium text-slate-750 outline-none overflow-y-auto"
                      editorRef={notesEditorRef}
                      serviceId="notes"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Assigned Marketing Campaigns</h2>
              <p className="text-xs text-slate-400 font-medium">Access campaigns to submit report entries.</p>
            </div>

            {myMarketingProjects.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-200 rounded-lg py-24 text-center">
                <Layers className="text-slate-350 mx-auto mb-3" size={32} />
                <p className="text-slate-400 text-sm font-bold uppercase">No Campaigns Allocated</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myMarketingProjects.map(proj => {
                  const myAllocatedServices = (proj.servicesAllocated || [])
                    .filter(s => s.assignedEmployeeId === employee.id)
                    .map(s => s.serviceName);

                  return (
                    <div key={proj.id} className="bg-white rounded-lg border border-slate-200 shadow-sm hover:border-slate-350 transition-all p-5 flex flex-col justify-between gap-5 relative group overflow-hidden">
                      <div className="space-y-3">
                        <div>
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Target Account</span>
                          <h4 className="text-base font-extrabold text-slate-900 leading-tight truncate">{proj.clientName}</h4>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block">My Services</span>
                          <div className="flex flex-wrap gap-1">
                            {myAllocatedServices.map(name => (
                              <span key={name} className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 text-slate-750 text-[9px] rounded font-bold">
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-1 border-t border-slate-100">
                          <div>
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Campaign Start</span>
                            <span className="text-xs font-bold text-slate-700">{proj.startDate}</span>
                          </div>
                          <div>
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Next Renewal</span>
                            <span className="text-xs font-bold text-slate-700">{proj.deadline}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => { setActiveProjId(proj.id); setWorkspaceTab('services'); }}
                        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-sm"
                      >
                        Open Workspace
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default EmployeePanel;
