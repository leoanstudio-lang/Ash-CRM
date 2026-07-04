import React from 'react';
import { Award, Lightbulb, Clock, CheckCircle, AlertCircle, Plus, Calendar, Megaphone, BookOpen } from 'lucide-react';
import { DailyImprovement, IssueReport, Suggestion, Announcement, TrainingCourse, EmployeeRecognition } from '../../types';

interface DashboardProps {
  improvements: DailyImprovement[];
  issues: IssueReport[];
  suggestions: Suggestion[];
  announcements: Announcement[];
  courses: TrainingCourse[];
  recognitions: EmployeeRecognition[];
  currentUser: any;
  userRole: string;
  hasPermission: (section: string, action: string) => boolean;
  onNavigateToTab: (tab: string, subTab?: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  improvements,
  issues,
  suggestions,
  announcements,
  courses,
  recognitions,
  currentUser,
  userRole,
  hasPermission,
  onNavigateToTab
}) => {
  // Statistics calculations
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Today's improvements submitted by current user
  const todayImprovements = improvements.filter(i => i.submittedBy === currentUser.id && i.submittedDate === todayStr);

  // Open issues assigned to current user
  const openAssignedIssues = issues.filter(i => 
    i.assignedTo === currentUser.id && 
    (i.status === 'Open' || i.status === 'Assigned' || i.status === 'In Progress')
  );

  // Pending suggestions submitted by current user
  const pendingSuggestions = suggestions.filter(s => s.submittedBy === currentUser.id && s.status === 'New');

  // Unread announcements
  const unreadAnnouncements = announcements.filter(a => !a.readBy?.includes(currentUser.id));

  // Pending training courses assigned to current user
  const pendingCourses = courses.filter(c => 
    (c.assignedEmployees?.includes(currentUser.id) || c.department === 'All Departments' || c.department === currentUser.department) && 
    !c.completedBy?.some(comp => comp.employeeId === currentUser.id)
  );

  // Recognitions received by current user
  const receivedAppreciations = recognitions.filter(r => r.recipientId === currentUser.id);

  // Quick Action triggers
  const actions = [
    { title: 'Submit Improvement', desc: 'Log today\'s workflow optimization', icon: <Award size={18} />, tab: 'submissions', sub: 'improvements' },
    { title: 'Report Issue', desc: 'Flag software, CRM, or IT issues', icon: <AlertCircle size={18} />, tab: 'submissions', sub: 'issues' },
    { title: 'Submit Suggestion', desc: 'Propose ideas for company growth', icon: <Lightbulb size={18} />, tab: 'submissions', sub: 'suggestions' },
    { title: 'Request Resource', desc: 'Request equipment or app licenses', icon: <Clock size={18} />, tab: 'submissions', sub: 'resources' },
    { title: 'Ask Question', desc: 'Ask team members for assistance', icon: <BookOpen size={18} />, tab: 'qa', sub: '' }
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Hero Banner */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900 leading-tight">Welcome to your Internal Hub, {currentUser.name.split(' ')[0]}</h2>
          <p className="text-xs text-slate-500 max-w-lg leading-relaxed">
            Collaborate, log daily workflow improvements, report bugs, view docs, and send team appreciations.
          </p>
        </div>
        <div className="px-3 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] uppercase font-bold tracking-wider text-slate-600 shrink-0">
          Role: {userRole.replace('_', ' ')}
        </div>
      </div>

      {/* Quick Action cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {actions.map((act) => (
          <button
            key={act.title}
            onClick={() => onNavigateToTab(act.tab, act.sub)}
            className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm text-left flex flex-col justify-between hover:border-slate-350 hover:bg-slate-50 transition duration-200 group"
          >
            <div className="w-8 h-8 rounded bg-slate-100 text-slate-600 flex items-center justify-center">
              {act.icon}
            </div>
            <div className="mt-3">
              <span className="font-bold text-xs text-slate-800 block leading-tight">{act.title}</span>
              <span className="text-[10px] text-slate-400 font-medium block mt-1 leading-tight">{act.desc}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Main dashboard columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Communications, Training, Recognitions */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Announcements */}
          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-3">
            <h4 className="font-bold text-slate-800 text-[10px] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Megaphone className="text-slate-500" size={13} /> Unread Announcements ({unreadAnnouncements.length})
            </h4>
            <div className="space-y-2.5">
              {unreadAnnouncements.slice(0, 3).map((ann) => (
                <div
                  key={ann.id}
                  onClick={() => onNavigateToTab('content', 'announcements')}
                  className="p-3 bg-slate-50 border border-slate-200 hover:bg-slate-100 cursor-pointer rounded-lg flex justify-between items-start gap-4 transition"
                >
                  <div className="space-y-1">
                    <span className="text-[8px] bg-blue-50 text-blue-750 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-blue-150">{ann.category}</span>
                    <span className="font-bold text-slate-800 text-xs block pt-0.5">{ann.title}</span>
                    <p className="text-[10.5px] text-slate-500 line-clamp-2 leading-normal">{ann.content}</p>
                  </div>
                  <span className="text-[9px] text-slate-400 font-bold shrink-0">{new Date(ann.date).toLocaleDateString()}</span>
                </div>
              ))}
              {unreadAnnouncements.length === 0 && (
                <p className="text-slate-400 italic text-[11px] py-1">No unread announcements. You are fully updated!</p>
              )}
            </div>
          </div>

          {/* Pending Trainings */}
          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-3">
            <h4 className="font-bold text-slate-800 text-[10px] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <BookOpen className="text-slate-500" size={13} /> Assigned Training Courses ({pendingCourses.length})
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingCourses.slice(0, 4).map((c) => (
                <div
                  key={c.id}
                  onClick={() => onNavigateToTab('training')}
                  className="p-3.5 bg-slate-50 border border-slate-200 hover:border-slate-350 cursor-pointer rounded-lg flex flex-col justify-between gap-3 transition"
                >
                  <div>
                    <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{c.department}</span>
                    <span className="font-bold text-slate-800 text-xs block mt-0.5 truncate">{c.title}</span>
                    <p className="text-[10px] text-slate-400 line-clamp-2 mt-1 leading-normal">{c.description}</p>
                  </div>
                  <span className="text-[10px] font-bold text-blue-600">Launch Module →</span>
                </div>
              ))}
              {pendingCourses.length === 0 && (
                <p className="col-span-full text-slate-400 italic text-[11px] py-1">No pending courses assigned to you.</p>
              )}
            </div>
          </div>

        </div>

        {/* Right Column: User's Daily Stats */}
        <div className="space-y-6">
          
          {/* Recognition Card Appreciations */}
          <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-sm space-y-3">
            <h4 className="font-bold text-slate-850 text-[10px] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Award className="text-slate-505" size={13} /> Appreciations Received ({receivedAppreciations.length})
            </h4>
            <div className="space-y-2.5">
              {receivedAppreciations.slice(0, 2).map((rec) => (
                <div key={rec.id} className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg space-y-1.5">
                  <div className="flex gap-1.5 items-center">
                    <span className="text-xs">🌟</span>
                    <span className="font-bold text-xs text-slate-800">{rec.type}</span>
                  </div>
                  <p className="text-[10.5px] text-slate-600 italic font-medium leading-relaxed">
                    "{rec.message}"
                  </p>
                  <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold pt-1">
                    <span>From: {rec.recognizedBy}</span>
                    <span>{new Date(rec.date).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
              {receivedAppreciations.length === 0 && (
                <p className="text-slate-400 italic text-[11px] py-2 text-center">No appreciation awards logged yet.</p>
              )}
            </div>
          </div>

          {/* Today's actions logs list */}
          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-3">
            <h4 className="font-bold text-slate-850 text-[10px] uppercase tracking-wider border-b border-slate-100 pb-2">Your Submissions Summary</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold p-2.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500">Today's Improvements</span>
                <span className="px-2 py-0.5 bg-white border border-slate-300 rounded text-slate-800 font-bold">{todayImprovements.length}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-semibold p-2.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500">Open Assigned Issues</span>
                <span className={`px-2 py-0.5 border rounded font-bold ${openAssignedIssues.length > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-slate-300 text-slate-800'}`}>
                  {openAssignedIssues.length}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs font-semibold p-2.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500">Pending Ideas</span>
                <span className="px-2 py-0.5 bg-white border border-slate-300 rounded text-slate-800 font-bold">{pendingSuggestions.length}</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default Dashboard;
