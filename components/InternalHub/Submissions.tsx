import React, { useState } from 'react';
import { Award, Lightbulb, Clock, CheckCircle, Plus, AlertCircle, Calendar, Users, Briefcase, Trash2, X, MessageSquare, Search } from 'lucide-react';
import { DailyImprovement, IssueReport, Suggestion, ProcessImprovement, ResourceRequest } from '../../types';
import { addDocToDB, updateDocInDB, deleteDocFromDB } from '../../lib/db';

interface SubmissionsProps {
  improvements: DailyImprovement[];
  issues: IssueReport[];
  suggestions: Suggestion[];
  processImprovements: ProcessImprovement[];
  resourceRequests: ResourceRequest[];
  currentUser: any;
  userRole: string;
  hasPermission: (section: string, action: string) => boolean;
  employees: any[];
  activeSubTab: 'improvements' | 'issues' | 'suggestions' | 'process' | 'resources';
}

const CATEGORIES = {
  improvements: ['Productivity', 'Quality', 'Cost Saving', 'Customer Experience', 'Automation', 'Process', 'Innovation', 'Documentation'],
  issues: ['CRM', 'Software', 'Hardware', 'Internet', 'Client', 'Communication', 'Process', 'HR', 'Finance', 'Operations', 'Other'],
  suggestions: ['Growth', 'Efficiency', 'Operations', 'Marketing', 'Product', 'Culture', 'Other'],
  resources: ['Laptop', 'Monitor', 'Canva License', 'Adobe Creative Cloud', 'Mouse', 'Keyboard', 'Office Equipment', 'Other']
};

const Submissions: React.FC<SubmissionsProps> = ({
  improvements,
  issues,
  suggestions,
  processImprovements,
  resourceRequests,
  currentUser,
  userRole,
  hasPermission,
  employees,
  activeSubTab
}) => {
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Daily Improvements Form State
  const [impTitle, setImpTitle] = useState('');
  const [impDesc, setImpDesc] = useState('');
  const [impCat, setImpCat] = useState('Productivity');
  const [impImpact, setImpImpact] = useState('');
  const [impTimeSaved, setImpTimeSaved] = useState('');

  // 2. Issues Form State
  const [issTitle, setIssTitle] = useState('');
  const [issDesc, setIssDesc] = useState('');
  const [issCat, setIssCat] = useState('CRM');
  const [issPriority, setIssPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');

  // 3. Suggestions Form State
  const [sugTitle, setSugTitle] = useState('');
  const [sugDesc, setSugDesc] = useState('');
  const [sugBenefit, setSugBenefit] = useState('');
  const [sugDiff, setSugDiff] = useState<'Low' | 'Medium' | 'High'>('Medium');

  // 4. Process Form State
  const [procCurrent, setProcCurrent] = useState('');
  const [procProposed, setProcProposed] = useState('');
  const [procBenefits, setProcBenefits] = useState('');
  const [procTimeSaved, setProcTimeSaved] = useState('');
  const [procOutcome, setProcOutcome] = useState('');

  // 5. Resource Form State
  const [resName, setResName] = useState('');
  const [resReason, setResReason] = useState('');
  const [resPriority, setResPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [resRequiredDate, setResRequiredDate] = useState('');

  // Manager action states
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [managerNotes, setManagerNotes] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('');

  // Form submits
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const baseRecord = {
      submittedBy: currentUser.id,
      submittedByName: currentUser.name,
      department: currentUser.department || 'Graphic',
      createdAt: new Date().toISOString()
    };

    try {
      if (activeSubTab === 'improvements') {
        const record: Omit<DailyImprovement, 'id'> = {
          ...baseRecord,
          title: impTitle,
          description: impDesc,
          category: impCat as any,
          businessImpact: impImpact,
          timeSaved: "",
          attachments: [],
          status: 'Submitted',
          submittedDate: new Date().toISOString().split('T')[0]
        };
        await addDocToDB('dailyImprovements', record);
        setImpTitle('');
        setImpDesc('');
        setImpImpact('');
        setImpTimeSaved('');
      } else if (activeSubTab === 'issues') {
        const record: Omit<IssueReport, 'id'> = {
          ...baseRecord,
          title: issTitle,
          description: issDesc,
          category: issCat as any,
          priority: issPriority,
          attachments: [],
          status: 'Open'
        };
        await addDocToDB('issues', record);
        setIssTitle('');
        setIssDesc('');
      } else if (activeSubTab === 'suggestions') {
        const record: Omit<Suggestion, 'id'> = {
          ...baseRecord,
          title: sugTitle,
          description: sugDesc,
          businessBenefit: sugBenefit,
          difficulty: sugDiff,
          attachments: [],
          status: 'New'
        };
        await addDocToDB('suggestions', record);
        setSugTitle('');
        setSugDesc('');
        setSugBenefit('');
      } else if (activeSubTab === 'process') {
        const record: Omit<ProcessImprovement, 'id'> = {
          ...baseRecord,
          currentProcess: procCurrent,
          proposedProcess: procProposed,
          benefits: procBenefits,
          timeSaved: procTimeSaved,
          expectedOutcome: procOutcome,
          attachments: []
        };
        await addDocToDB('processImprovements', record);
        setProcCurrent('');
        setProcProposed('');
        setProcBenefits('');
        setProcTimeSaved('');
        setProcOutcome('');
      } else if (activeSubTab === 'resources') {
        const record: Omit<ResourceRequest, 'id'> = {
          ...baseRecord,
          resourceName: resName,
          reason: resReason,
          priority: resPriority,
          requiredDate: resRequiredDate,
          status: 'Pending'
        };
        await addDocToDB('resourceRequests', record);
        setResName('');
        setResReason('');
        setResRequiredDate('');
      }

      setShowCreate(false);
    } catch (err) {
      console.error(err);
      alert('Error creating record in database.');
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const updates: any = {};
      if (activeSubTab === 'improvements') {
        updates.status = newStatus;
        if (managerNotes) updates.managerComments = managerNotes;
      } else if (activeSubTab === 'issues') {
        updates.status = newStatus;
        if (managerNotes) updates.resolutionNotes = managerNotes;
        if (selectedAssignee) {
          const emp = employees.find(e => e.id === selectedAssignee);
          if (emp) {
            updates.assignedTo = emp.id;
            updates.assignedToName = emp.name;
          }
        }
      } else if (activeSubTab === 'suggestions') {
        updates.status = newStatus;
        if (managerNotes) updates.managerFeedback = managerNotes;
      } else if (activeSubTab === 'resources') {
        updates.status = newStatus;
        if (managerNotes) updates.managerNotes = managerNotes;
      }

      const colName = activeSubTab === 'improvements' ? 'dailyImprovements'
        : activeSubTab === 'issues' ? 'issues'
        : activeSubTab === 'suggestions' ? 'suggestions'
        : 'resourceRequests';

      await updateDocInDB(colName, id, updates);
      setEditingRecordId(null);
      setManagerNotes('');
      setSelectedAssignee('');
    } catch (err) {
      console.error(err);
      alert('Error updating status.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to permanently delete this submission?')) {
      const colName = activeSubTab === 'improvements' ? 'dailyImprovements'
        : activeSubTab === 'issues' ? 'issues'
        : activeSubTab === 'suggestions' ? 'suggestions'
        : activeSubTab === 'process' ? 'processImprovements'
        : 'resourceRequests';

      await deleteDocFromDB(colName, id);
    }
  };

  const hasWritePerm = hasPermission(activeSubTab, 'write') || hasPermission(activeSubTab, 'manage');
  const hasManagePerm = hasPermission(activeSubTab, 'manage');

  // Filter records based on role and tab
  const getFilteredRecords = () => {
    let rawList: any[] = [];
    if (activeSubTab === 'improvements') rawList = improvements;
    else if (activeSubTab === 'issues') rawList = issues;
    else if (activeSubTab === 'suggestions') rawList = suggestions;
    else if (activeSubTab === 'process') rawList = processImprovements;
    else if (activeSubTab === 'resources') rawList = resourceRequests;

    // Filter by own creations if standard employee and not HR/Manager
    if (!hasManagePerm) {
      rawList = rawList.filter(item => item.submittedBy === currentUser.id);
    }

    return rawList
      .filter(item => {
        if (!filterStatus) return true;
        return item.status === filterStatus;
      })
      .filter(item => {
        if (!filterPriority) return true;
        return item.priority === filterPriority;
      })
      .filter(item => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (item.title || item.resourceName || '').toLowerCase().includes(q) || (item.description || item.reason || '').toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.createdAt || b.submittedDate || '').getTime() - new Date(a.createdAt || a.submittedDate || '').getTime());
  };

  const filteredRecords = getFilteredRecords();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Implemented':
      case 'Delivered':
      case 'Resolved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Under Review':
      case 'In Progress':
      case 'Planned':
      case 'Ordered':
      case 'Assigned':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Rejected':
      case 'Closed':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'Submitted':
      case 'Open':
      case 'New':
      case 'Pending':
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]';
      case 'High':
        return 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]';
      case 'Medium':
        return 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]';
      case 'Low':
      default:
        return 'bg-slate-500 shadow-[0_0_8px_rgba(100,116,139,0.4)]';
    }
  };

  return (
    <div className="space-y-6">
      {/* Submissions stats & actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2 capitalize">
            {activeSubTab === 'improvements' && <><Award className="text-blue-600" size={22} /> Daily Improvements</>}
            {activeSubTab === 'issues' && <><AlertCircle className="text-rose-600" size={22} /> Operations Issue Reporting</>}
            {activeSubTab === 'suggestions' && <><Lightbulb className="text-amber-500" size={22} /> Suggestions & Ideas</>}
            {activeSubTab === 'process' && <><Briefcase className="text-indigo-600" size={22} /> Process Improvement Proposals</>}
            {activeSubTab === 'resources' && <><Clock className="text-purple-600" size={22} /> Resource Requests</>}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {activeSubTab === 'improvements' && 'Track time-saving or quality improvements you accomplished today.'}
            {activeSubTab === 'issues' && 'Report software bugs, software licenses, or CRM hurdles.'}
            {activeSubTab === 'suggestions' && 'Post innovative concepts to expand client acquisition or workflows.'}
            {activeSubTab === 'process' && 'Describe current workflows and propose optimized blueprints.'}
            {activeSubTab === 'resources' && 'Submit requests for software licenses, office hardware, and monitors.'}
          </p>
        </div>
        <div className="flex gap-2">
          {hasWritePerm && (
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shrink-0"
            >
              <Plus size={15} /> New Submission
            </button>
          )}
        </div>
      </div>

      {/* Floating Create form overlay */}
      {showCreate && (
        <form onSubmit={handleCreateSubmit} className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4 animate-in fade-in duration-200">
          <h4 className="font-bold text-slate-800 text-sm">New {activeSubTab} Ticket Details</h4>
          
          {activeSubTab === 'improvements' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Improvement Title</label>
                  <input
                    required
                    placeholder="e.g. Automated invoices sync with Stripe"
                    value={impTitle}
                    onChange={e => setImpTitle(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Category</label>
                  <select
                    value={impCat}
                    onChange={e => setImpCat(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {CATEGORIES.improvements.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Expected Business Impact</label>
                <input
                  required
                  placeholder="e.g. Reduced billing latency, error-free logs"
                  value={impImpact}
                  onChange={e => setImpImpact(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Explanations</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Explain details..."
                  value={impDesc}
                  onChange={e => setImpDesc(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed"
                />
              </div>
            </div>
          )}

          {activeSubTab === 'issues' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Issue Title</label>
                  <input
                    required
                    placeholder="e.g. Client DB sync latency"
                    value={issTitle}
                    onChange={e => setIssTitle(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-850 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Priority</label>
                  <select
                    value={issPriority}
                    onChange={e => setIssPriority(e.target.value as any)}
                    className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-850 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Low">⚪ Low</option>
                    <option value="Medium">🔵 Medium</option>
                    <option value="High">🟠 High</option>
                    <option value="Critical">🔴 Critical</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Category</label>
                <select
                  value={issCat}
                  onChange={e => setIssCat(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {CATEGORIES.issues.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Detailed hurdle description</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Explain..."
                  value={issDesc}
                  onChange={e => setIssDesc(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed"
                />
              </div>
            </div>
          )}

          {activeSubTab === 'suggestions' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Idea Title</label>
                  <input
                    required
                    placeholder="e.g. Host webinars for marketing outbound leads"
                    value={sugTitle}
                    onChange={e => setSugTitle(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Estimated Difficulty</label>
                  <select
                    value={sugDiff}
                    onChange={e => setSugDiff(e.target.value as any)}
                    className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Low">Low difficulty</option>
                    <option value="Medium">Medium difficulty</option>
                    <option value="High">High difficulty</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Business Benefits</label>
                <input
                  required
                  placeholder="e.g. Higher retention rate, +15% conversion"
                  value={sugBenefit}
                  onChange={e => setSugBenefit(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Detailed Suggestion</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Explain details..."
                  value={sugDesc}
                  onChange={e => setSugDesc(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-850 text-xs focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed"
                />
              </div>
            </div>
          )}

          {activeSubTab === 'process' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Current Process Workflow</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="How is it done right now?"
                    value={procCurrent}
                    onChange={e => setProcCurrent(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Proposed Process Workflow</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="How do you recommend doing it?"
                    value={procProposed}
                    onChange={e => setProcProposed(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Benefits</label>
                  <input
                    required
                    placeholder="e.g. 5x faster deployment"
                    value={procBenefits}
                    onChange={e => setProcBenefits(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Time Saved</label>
                  <input
                    required
                    placeholder="e.g. 2 hours per week"
                    value={procTimeSaved}
                    onChange={e => setProcTimeSaved(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Expected Outcome</label>
                  <input
                    required
                    placeholder="e.g. 0 downtime releases"
                    value={procOutcome}
                    onChange={e => setProcOutcome(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'resources' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Resource Name</label>
                  <select
                    value={resName}
                    onChange={e => setResName(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-850 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select Resource...</option>
                    {CATEGORIES.resources.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Priority</label>
                  <select
                    value={resPriority}
                    onChange={e => setResPriority(e.target.value as any)}
                    className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-850 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Reason for request</label>
                  <input
                    required
                    placeholder="e.g. Adobe License for Graphic tasks"
                    value={resReason}
                    onChange={e => setResReason(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Required By Date</label>
                  <input
                    required
                    type="date"
                    value={resRequiredDate}
                    onChange={e => setResRequiredDate(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-850 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold">Submit Ticket</button>
          </div>
        </form>
      )}

      {/* Filters Bar */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-450" size={14} />
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          {activeSubTab !== 'process' && (
            <div>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer min-w-[120px] outline-none"
              >
                <option value="">All Statuses</option>
                {activeSubTab === 'improvements' && (
                  <>
                    <option value="Submitted">Submitted</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Approved">Approved</option>
                    <option value="Implemented">Implemented</option>
                    <option value="Rejected">Rejected</option>
                  </>
                )}
                {activeSubTab === 'issues' && (
                  <>
                    <option value="Open">Open</option>
                    <option value="Assigned">Assigned</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Waiting">Waiting</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                  </>
                )}
                {activeSubTab === 'suggestions' && (
                  <>
                    <option value="New">New</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Approved">Approved</option>
                    <option value="Planned">Planned</option>
                    <option value="Implemented">Implemented</option>
                    <option value="Rejected">Rejected</option>
                  </>
                )}
                {activeSubTab === 'resources' && (
                  <>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Ordered">Ordered</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Rejected">Rejected</option>
                  </>
                )}
              </select>
            </div>
          )}

          {(activeSubTab === 'issues' || activeSubTab === 'resources') && (
            <div>
              <select
                value={filterPriority}
                onChange={e => setFilterPriority(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer min-w-[120px] outline-none"
              >
                <option value="">All Priority</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                {activeSubTab === 'issues' && <option value="Critical">Critical</option>}
              </select>
            </div>
          )}

          {(filterStatus || filterPriority || searchQuery) && (
            <button
              onClick={() => { setFilterStatus(''); setFilterPriority(''); setSearchQuery(''); }}
              className="px-3 py-2 bg-red-50 text-red-650 border border-red-200 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-red-100 transition"
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* Grid rendering cards list */}
      <div className="space-y-4">
        {filteredRecords.map((item) => {
          const isManagerEditing = editingRecordId === item.id;
          return (
            <div key={item.id} className="bg-white p-5 rounded-lg border border-slate-200 relative group hover:border-slate-350 transition duration-200">
              {/* Delete ticket */}
              {!item.status || item.status === 'Submitted' || item.status === 'Open' || item.status === 'Pending' || item.status === 'New' || hasManagePerm ? (
                <button
                  onClick={() => handleDelete(item.id)}
                  className="absolute top-4 right-4 p-2 text-slate-350 hover:text-red-500 rounded-lg hover:bg-slate-50 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={16} />
                </button>
              ) : null}

              <div className="flex flex-col lg:flex-row justify-between gap-6">
                <div className="flex-1 space-y-4">
                  {/* Category and Submitter metadata header */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {item.priority && (
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${getPriorityColor(item.priority)}`}></span>
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase">{item.priority} Priority</span>
                      </span>
                    )}
                    {item.category && (
                      <span className="px-2 py-0.5 bg-slate-50 text-slate-500 border border-slate-150 rounded text-[9px] font-black uppercase tracking-wider">{item.category}</span>
                    )}
                    <span className="text-[10px] text-slate-400 font-bold">Submitted by: {item.submittedByName} ({item.department})</span>
                    <span className="text-[9px] text-slate-300 font-bold">•</span>
                    <span className="text-[9px] text-slate-400 font-bold">
                      {new Date(item.createdAt || item.submittedDate || '').toLocaleDateString()}
                    </span>
                  </div>

                  {/* Title & Description details */}
                  <div>
                    <h4 className="text-base font-black text-slate-850 leading-tight">
                      {item.title || item.resourceName || (activeSubTab === 'process' ? 'Process Improvement Proposal' : 'Detail Ticket')}
                    </h4>

                    {activeSubTab === 'process' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                          <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">Current Workflow</span>
                          <p className="text-xs text-slate-650 font-medium whitespace-pre-wrap">{item.currentProcess}</p>
                        </div>
                        <div className="p-3.5 bg-blue-50/20 rounded-lg border border-blue-200/50 space-y-1">
                          <span className="text-[8px] uppercase tracking-wider text-blue-600 font-bold">Proposed Workflow</span>
                          <p className="text-xs text-slate-800 font-semibold whitespace-pre-wrap">{item.proposedProcess}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 mt-2 leading-relaxed font-semibold italic opacity-95">"{item.description || item.reason || 'No description notes.'}"</p>
                    )}
                  </div>

                  {/* Additional parameters grids */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                    {activeSubTab !== 'improvements' && item.timeSaved && (
                      <div className="flex flex-col">
                        <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest">Time Saved</span>
                        <span className="text-xs font-black text-slate-700 mt-0.5">{item.timeSaved}</span>
                      </div>
                    )}
                    {item.businessImpact && (
                      <div className="flex flex-col">
                        <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest">Business Impact</span>
                        <span className="text-xs font-black text-slate-700 mt-0.5">{item.businessImpact}</span>
                      </div>
                    )}
                    {item.businessBenefit && (
                      <div className="flex flex-col">
                        <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest">Business Benefit</span>
                        <span className="text-xs font-black text-slate-700 mt-0.5">{item.businessBenefit}</span>
                      </div>
                    )}
                    {item.difficulty && (
                      <div className="flex flex-col">
                        <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest">Difficulty</span>
                        <span className="text-xs font-black text-slate-700 mt-0.5 capitalize">{item.difficulty}</span>
                      </div>
                    )}
                    {item.requiredDate && (
                      <div className="flex flex-col">
                        <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest">Required By</span>
                        <span className="text-xs font-black text-slate-700 mt-0.5">{new Date(item.requiredDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    {item.assignedToName && (
                      <div className="flex flex-col">
                        <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest">Assigned To</span>
                        <span className="text-xs font-black text-blue-600 mt-0.5">{item.assignedToName}</span>
                      </div>
                    )}
                  </div>

                  {/* Manager/Admin feedback history display */}
                  {(item.managerComments || item.resolutionNotes || item.managerFeedback || item.managerNotes) && (
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex gap-2.5 mt-3">
                      <MessageSquare className="text-slate-400 shrink-0 mt-0.5" size={14} />
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Manager Comments</span>
                        <p className="text-xs text-slate-650 mt-0.5 font-medium italic">
                          "{item.managerComments || item.resolutionNotes || item.managerFeedback || item.managerNotes}"
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Status Column */}
                {activeSubTab !== 'process' && (
                  <div className="flex flex-col gap-3 justify-center lg:border-l border-slate-50 lg:pl-6 min-w-[180px]">
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] font-black text-slate-450 uppercase tracking-widest mb-1.5">Ticket Status</span>
                      <span className={`px-4 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest text-center block w-full ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                    </div>

                    {hasManagePerm && !isManagerEditing && (
                      <button
                        onClick={() => setEditingRecordId(item.id)}
                        className="w-full mt-1.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-slate-200 transition text-center"
                      >
                        Manage Status
                      </button>
                    )}
 
                    {isManagerEditing && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5 mt-2 animate-in slide-in-from-top-2">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Update Ticket</span>
                          <button onClick={() => setEditingRecordId(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>

                        {/* Status Selectors */}
                        <div>
                          <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Set Status</label>
                          <select
                            defaultValue={item.status}
                            id={`status-select-${item.id}`}
                            className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold bg-white"
                          >
                            {activeSubTab === 'improvements' && (
                              <>
                                <option value="Submitted">Submitted</option>
                                <option value="Under Review">Under Review</option>
                                <option value="Approved">Approved</option>
                                <option value="Implemented">Implemented</option>
                                <option value="Rejected">Rejected</option>
                              </>
                            )}
                            {activeSubTab === 'issues' && (
                              <>
                                <option value="Open">Open</option>
                                <option value="Assigned">Assigned</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Waiting">Waiting</option>
                                <option value="Resolved">Resolved</option>
                                <option value="Closed">Closed</option>
                              </>
                            )}
                            {activeSubTab === 'suggestions' && (
                              <>
                                <option value="New">New</option>
                                <option value="Under Review">Under Review</option>
                                <option value="Approved">Approved</option>
                                <option value="Planned">Planned</option>
                                <option value="Implemented">Implemented</option>
                                <option value="Rejected">Rejected</option>
                              </>
                            )}
                            {activeSubTab === 'resources' && (
                              <>
                                <option value="Pending">Pending</option>
                                <option value="Approved">Approved</option>
                                <option value="Ordered">Ordered</option>
                                <option value="Delivered">Delivered</option>
                                <option value="Rejected">Rejected</option>
                              </>
                            )}
                          </select>
                        </div>

                        {/* Issue Assignee Selector */}
                        {activeSubTab === 'issues' && (
                          <div>
                            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Assign To</label>
                            <select
                              value={selectedAssignee}
                              onChange={e => setSelectedAssignee(e.target.value)}
                              className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold bg-white"
                            >
                              <option value="">Select Assignee...</option>
                              {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Feedback Comment */}
                        <div>
                          <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Feedback Note</label>
                          <textarea
                            rows={2}
                            placeholder="Add manager comments..."
                            value={managerNotes}
                            onChange={e => setManagerNotes(e.target.value)}
                            className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white font-medium outline-none"
                          />
                        </div>

                        <button
                          onClick={() => {
                            const selectedStatus = (document.getElementById(`status-select-${item.id}`) as HTMLSelectElement).value;
                            handleUpdateStatus(item.id, selectedStatus);
                          }}
                          className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition"
                        >
                          Submit Update
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredRecords.length === 0 && (
          <div className="py-16 bg-white rounded-lg border border-slate-200 shadow-sm text-center">
            <Briefcase className="mx-auto text-slate-350 mb-3" size={44} />
            <p className="text-slate-400 italic text-xs">No records log matches your search criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Submissions;
