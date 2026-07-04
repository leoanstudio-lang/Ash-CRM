import React, { useState } from 'react';
import { Award, Lightbulb, Clock, CheckCircle2, AlertCircle, FileText, Search, User, Filter } from 'lucide-react';
import { DailyImprovement, IssueReport, Suggestion, ResourceRequest, QuestionThread, TrainingCourse, EmployeeRecognition } from '../../types';

interface SubmissionHistoryProps {
  improvements: DailyImprovement[];
  issues: IssueReport[];
  suggestions: Suggestion[];
  resourceRequests: ResourceRequest[];
  questions: QuestionThread[];
  courses: TrainingCourse[];
  recognitions: EmployeeRecognition[];
  currentUser: any;
}

const SubmissionHistory: React.FC<SubmissionHistoryProps> = ({
  improvements,
  issues,
  suggestions,
  resourceRequests,
  questions,
  courses,
  recognitions,
  currentUser
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'improvements' | 'issues' | 'suggestions' | 'resources' | 'questions' | 'training' | 'awards'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Gather all logs from current employee
  const myImps = improvements.filter(i => i.submittedBy === currentUser.id).map(item => ({
    id: item.id,
    type: 'improvement',
    label: 'Daily Improvement',
    title: item.title,
    date: item.submittedDate || item.createdAt || '',
    status: item.status,
    notes: item.managerComments,
    details: `Category: ${item.category} | Impact: ${item.businessImpact}`
  }));

  const myIssues = issues.filter(i => i.submittedBy === currentUser.id).map(item => ({
    id: item.id,
    type: 'issue',
    label: 'Issue Reported',
    title: item.title,
    date: item.createdAt || '',
    status: item.status,
    notes: item.resolutionNotes,
    details: `Category: ${item.category} | Priority: ${item.priority} | Assigned: ${item.assignedToName || 'Unassigned'}`
  }));

  const mySugs = suggestions.filter(s => s.submittedBy === currentUser.id).map(item => ({
    id: item.id,
    type: 'suggestion',
    label: 'Idea Submitted',
    title: item.title,
    date: item.createdAt || '',
    status: item.status,
    notes: item.managerFeedback,
    details: `Benefit: ${item.businessBenefit} | Difficulty: ${item.difficulty}`
  }));

  const myResources = resourceRequests.filter(r => r.submittedBy === currentUser.id).map(item => ({
    id: item.id,
    type: 'resource',
    label: 'Resource Request',
    title: item.resourceName,
    date: item.createdAt || '',
    status: item.status,
    notes: item.managerNotes,
    details: `Reason: ${item.reason} | Priority: ${item.priority} | Needed by: ${new Date(item.requiredDate).toLocaleDateString()}`
  }));

  const myQuestions = questions.filter(q => q.submittedBy === currentUser.id).map(item => ({
    id: item.id,
    type: 'question',
    label: 'Q&A Thread',
    title: item.title,
    date: item.createdAt || '',
    status: item.acceptedAnswerId ? 'Answered' : 'Open',
    notes: undefined,
    details: `Replies: ${item.repliesCount || 0} | Tags: ${item.tags?.join(', ') || 'none'}`
  }));

  // Completions list
  const myCompletedCourses: any[] = [];
  courses.forEach(c => {
    const comp = c.completedBy?.find(cb => cb.employeeId === currentUser.id);
    if (comp) {
      myCompletedCourses.push({
        id: `${c.id}-comp`,
        type: 'training',
        label: 'Course Finished',
        title: c.title,
        date: comp.completionDate || '',
        status: 'Completed',
        notes: `Score achieved: ${comp.score}%`,
        details: c.description
      });
    }
  });

  const myAwards = recognitions.filter(r => r.recipientId === currentUser.id).map(item => ({
    id: item.id,
    type: 'award',
    label: 'Recognition Received',
    title: item.type,
    date: item.date || '',
    status: 'Awarded',
    notes: `Message: "${item.message}"`,
    details: `Appreciated by: ${item.recognizedBy}`
  }));

  // Combine everything
  const allLogs = [
    ...myImps,
    ...myIssues,
    ...mySugs,
    ...myResources,
    ...myQuestions,
    ...myCompletedCourses,
    ...myAwards
  ];

  // Apply filters
  const filteredLogs = allLogs
    .filter(log => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'improvements') return log.type === 'improvement';
      if (activeFilter === 'issues') return log.type === 'issue';
      if (activeFilter === 'suggestions') return log.type === 'suggestion';
      if (activeFilter === 'resources') return log.type === 'resource';
      if (activeFilter === 'questions') return log.type === 'question';
      if (activeFilter === 'training') return log.type === 'training';
      if (activeFilter === 'awards') return log.type === 'award';
      return true;
    })
    .filter(log => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return log.title.toLowerCase().includes(q) || log.details.toLowerCase().includes(q);
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Implemented':
      case 'Delivered':
      case 'Resolved':
      case 'Completed':
      case 'Awarded':
      case 'Answered':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'Under Review':
      case 'In Progress':
      case 'Planned':
      case 'Ordered':
      case 'Assigned':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'Rejected':
      case 'Closed':
        return 'bg-red-50 text-red-700 border-red-100';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-100';
    }
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'improvement': return <Award className="text-blue-500" size={16} />;
      case 'issue': return <AlertCircle className="text-rose-500" size={16} />;
      case 'suggestion': return <Lightbulb className="text-amber-500" size={16} />;
      case 'resource': return <Clock className="text-purple-500" size={16} />;
      case 'question': return <FileText className="text-slate-500" size={16} />;
      case 'training': return <CheckCircle2 className="text-emerald-500" size={16} />;
      case 'award': return <Award className="text-amber-600" size={16} />;
      default: return <User className="text-slate-400" size={16} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Filter controls */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Filter className="text-slate-500" size={20} /> Your Activity Logs & History
          </h3>
          <p className="text-xs text-slate-500 mt-1">Review all contributions, tickets, and learning milestones logged in your account.</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
          <input
            type="text"
            placeholder="Search history..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all min-w-[220px]"
          />
        </div>
      </div>

      {/* Categories select options list */}
      <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg w-max max-w-full border border-slate-200">
        {[
          { id: 'all', label: 'All History' },
          { id: 'improvements', label: 'Improvements' },
          { id: 'issues', label: 'Issues' },
          { id: 'suggestions', label: 'Suggestions' },
          { id: 'resources', label: 'Resources' },
          { id: 'questions', label: 'Q&As' },
          { id: 'training', label: 'Training' },
          { id: 'awards', label: 'Awards' }
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id as any)}
            className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition ${
              activeFilter === f.id ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-850'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Logs Render list */}
      <div className="space-y-4">
        {filteredLogs.map((log) => (
          <div
            key={log.id}
            className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:border-slate-350 transition duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                {getLogIcon(log.type)}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[8px] font-black uppercase tracking-wider">{log.label}</span>
                  <span className="text-[10px] text-slate-400 font-bold">{new Date(log.date).toLocaleDateString()}</span>
                </div>
                <h4 className="text-sm font-black text-slate-800 leading-tight">{log.title}</h4>
                <p className="text-[10.5px] text-slate-500 font-semibold leading-relaxed">{log.details}</p>
                {log.notes && (
                  <p className="text-[10px] text-slate-400 font-medium italic pt-1">Notes: {log.notes}</p>
                )}
              </div>
            </div>

            <div className="shrink-0 flex items-center sm:border-l border-slate-100 sm:pl-4 min-w-[120px] justify-end">
              <span className={`px-3 py-1 rounded border text-[9px] font-bold uppercase tracking-wider text-center ${getStatusStyle(log.status)}`}>
                {log.status}
              </span>
            </div>
          </div>
        ))}

        {filteredLogs.length === 0 && (
          <div className="py-16 bg-white rounded-lg border border-slate-200 shadow-sm text-center">
            <Filter className="mx-auto text-slate-350 mb-3" size={40} />
            <p className="text-slate-400 italic text-xs">No matching personal logs found.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubmissionHistory;
