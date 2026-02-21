import React, { useState } from 'react';
import { Employee, Project, Priority, Client, Package } from '../types';
import { LogOut, CheckCircle, Clock, AlertCircle, Calendar, ChevronRight, DollarSign, Wallet, PauseCircle, PlayCircle, Loader2, LayoutDashboard, Search, ChevronDown, Filter } from 'lucide-react';
import { updateProjectInDB, updatePackageInDB, addPaymentAlertToDB } from '../lib/db';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

type EmployeeView = 'dashboard' | 'pending' | 'waiting' | 'working';

interface EmployeePanelProps {
  employee: Employee;
  projects: Project[];
  clients: Client[];
  setProjects?: React.Dispatch<React.SetStateAction<Project[]>>; // Optional/Deprecated
  onLogout: () => void;
}

const EmployeePanel: React.FC<EmployeePanelProps> = ({ employee, projects, clients, onLogout }) => {
  const [currentView, setCurrentView] = useState<EmployeeView>('dashboard');

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
  const myTasks = projects
    .filter(p => p.assignedEmployeeId === employee.id && p.startDate <= today)
    .sort((a, b) => {
      // 1. Prioritize Backlog (Past Start Date & Not Finished)
      const isBacklogA = a.startDate < today && a.status !== 'Finished';
      const isBacklogB = b.startDate < today && b.status !== 'Finished';

      if (isBacklogA && !isBacklogB) return -1;
      if (!isBacklogA && isBacklogB) return 1;

      // 2. Secondary Sort: Priority (Optional, keeping High priority on top within groups)
      const priorityOrder = { 'Urgent': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
      return (priorityOrder[a.priority as keyof typeof priorityOrder] || 2) - (priorityOrder[b.priority as keyof typeof priorityOrder] || 2);
    });

  const updateStatus = async (projectId: string, newStatus: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const updates: Partial<Project> = { status: newStatus };

    // If status is finished, the amount is automatically treated as received
    if (newStatus === 'Finished') {
      updates.receivedAmount = project.totalAmount;
      updates.progress = 100;
      updates.completedAt = new Date().toISOString(); // Track completion time

      // If standalone task (no package), create a RECEIVED payment record
      if (!project.packageId) {
        try {
          await addPaymentAlertToDB({
            clientId: project.clientId,
            clientName: project.clientName || 'Unknown Client',
            projectId: project.id,
            taskName: project.serviceName,
            milestoneLabel: 'Full Payment',
            amount: project.totalAmount,
            status: 'received',
            triggeredAt: new Date().toISOString(),
            resolvedAt: new Date().toISOString(),
            type: 'standalone'
          });
        } catch (err) {
          console.error('Error creating standalone payment record:', err);
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
                type: 'package'
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

  const getPriorityColor = (p: Priority) => {
    switch (p) {
      case 'Urgent': return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]';
      case 'High': return 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]';
      case 'Medium': return 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.4)]';
      default: return 'bg-slate-500 shadow-[0_0_10px_rgba(100,116,139,0.4)]';
    }
  };

  // Stats for the top bar
  const activeTasks = myTasks.filter(t => t.status !== 'Finished');
  // Treat 'Allocated' as 'Pending' for stats to ensure visibility
  const pendingCount = activeTasks.filter(t => t.status === 'Pending' || t.status === 'Allocated').length;
  const workingCount = activeTasks.filter(t => t.status === 'Working').length;
  const waitingCount = activeTasks.filter(t => t.status === 'Waiting').length;

  // Filter tasks based on current view
  const getFilteredTasks = () => {
    let tasks = activeTasks;
    switch (currentView) {
      case 'pending':
        tasks = activeTasks.filter(t => t.status === 'Pending' || t.status === 'Allocated');
        break;
      case 'waiting':
        tasks = activeTasks.filter(t => t.status === 'Waiting');
        break;
      case 'working':
        tasks = activeTasks.filter(t => t.status === 'Working');
        break;
      case 'dashboard':
      default:
        tasks = activeTasks; // Show all active tasks
        break;
    }

    // Apply additional filters
    return tasks
      // Search filter
      .filter(p => {
        if (!taskSearch.trim()) return true;
        const q = taskSearch.toLowerCase();
        return (
          (p.serviceName || '').toLowerCase().includes(q) ||
          (p.clientName || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
        );
      })
      // Priority filter
      .filter(p => !filterPriority || p.priority === filterPriority)
      // Date filter (Date Range or Specific Date)
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

  const filteredTasks = getFilteredTasks();

  // Get view title
  const getViewTitle = () => {
    switch (currentView) {
      case 'pending': return 'Pending Tasks';
      case 'waiting': return 'Waiting Tasks';
      case 'working': return 'Working Tasks';
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
          <div className="grid grid-cols-4 gap-2 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
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
          </div>
          <button
            onClick={onLogout}
            className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition-all"
          >
            <LogOut size={14} /> Exit
          </button>
        </div>

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
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Auto-Sync Active</span>
          </div>

          <div className="space-y-4">
            {filteredTasks.map(task => (

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
                      {/* Pending Button - Active if Pending OR Allocated */}
                      <button
                        onClick={() => updateStatus(task.id, 'Pending')}
                        className={`w-full px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-between group/btn ${(task.status === 'Pending' || task.status === 'Allocated')
                          ? 'bg-slate-800 text-white shadow-md shadow-slate-800/20'
                          : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                          }`}
                      >
                        <span>Pending</span>
                        {(task.status === 'Pending' || task.status === 'Allocated') && <CheckCircle size={12} className="text-white" />}
                      </button>

                      {/* Working Button */}
                      <button
                        onClick={() => updateStatus(task.id, 'Working')}
                        className={`w-full px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-between group/btn ${task.status === 'Working' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                      >
                        <span>Working</span>
                        {task.status === 'Working' && <CheckCircle size={12} className="text-white" />}
                      </button>

                      {/* Waiting Button */}
                      <button
                        onClick={() => updateStatus(task.id, 'Waiting')}
                        className={`w-full px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-between group/btn ${task.status === 'Waiting' ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                      >
                        <span>Waiting</span>
                        {task.status === 'Waiting' && <CheckCircle size={12} className="text-white" />}
                      </button>

                      <div className="h-px bg-slate-100 my-0.5"></div>

                      {/* Finished Button */}
                      <button
                        onClick={() => updateStatus(task.id, 'Finished')}
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
            {filteredTasks.length === 0 && (
              <div className="py-16 text-center bg-white border-2 border-dashed border-slate-100 rounded-[2rem] shadow-sm">
                <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="text-emerald-500" size={28} />
                </div>
                <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-sm">All Tasks Cleared</p>
                <p className="text-slate-400 text-[10px] mt-1 opacity-60">Production queue idle.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default EmployeePanel;
