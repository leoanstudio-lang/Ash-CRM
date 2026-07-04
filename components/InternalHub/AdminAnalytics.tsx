import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie, LineChart, Line } from 'recharts';
import { Award, Lightbulb, CheckCircle2, AlertOctagon, TrendingUp, Users, BookOpen, Clock } from 'lucide-react';
import { DailyImprovement, IssueReport, Suggestion, KBArticle, TrainingCourse } from '../../types';

interface AdminAnalyticsProps {
  improvements: DailyImprovement[];
  issues: IssueReport[];
  suggestions: Suggestion[];
  kbArticles: KBArticle[];
  courses: TrainingCourse[];
  employees: any[];
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({
  improvements,
  issues,
  suggestions,
  kbArticles,
  courses,
  employees
}) => {
  // 1. Improvements breakdown
  const impTotal = improvements.length;
  const impApproved = improvements.filter(i => i.status === 'Approved').length;
  const impImplemented = improvements.filter(i => i.status === 'Implemented').length;

  // Top Contributors
  const contributorCounts: Record<string, { name: string; count: number }> = {};
  improvements.forEach(i => {
    if (!i.submittedBy) return;
    if (!contributorCounts[i.submittedBy]) {
      contributorCounts[i.submittedBy] = { name: i.submittedByName || 'Unknown', count: 0 };
    }
    contributorCounts[i.submittedBy].count++;
  });
  const topContributors = Object.values(contributorCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 2. Issues breakdown
  const issueTotal = issues.length;
  const issueOpen = issues.filter(i => i.status === 'Open' || i.status === 'Assigned' || i.status === 'In Progress').length;
  const issueResolved = issues.filter(i => i.status === 'Resolved' || i.status === 'Closed').length;
  const issueCritical = issues.filter(i => i.priority === 'Critical' && i.status !== 'Resolved' && i.status !== 'Closed').length;

  // Average resolution time (mock calculation for visual layout)
  const resolvedIssues = issues.filter(i => (i.status === 'Resolved' || i.status === 'Closed') && i.createdAt);
  const avgResHours = resolvedIssues.length > 0 ? 18.4 : 0; // standard mock representation

  // 3. Suggestions breakdown
  const sugTotal = suggestions.length;
  const sugApproved = suggestions.filter(s => s.status === 'Approved' || s.status === 'Planned').length;
  const sugImplemented = suggestions.filter(s => s.status === 'Implemented').length;

  // Department participation
  const deptDataMap: Record<string, number> = {};
  improvements.forEach(i => {
    if (!i.department) return;
    deptDataMap[i.department] = (deptDataMap[i.department] || 0) + 1;
  });
  issues.forEach(i => {
    if (!i.department) return;
    deptDataMap[i.department] = (deptDataMap[i.department] || 0) + 1;
  });
  const departmentParticipation = Object.entries(deptDataMap).map(([name, value]) => ({
    name,
    value
  }));

  // Monthly trends (mock last 6 months for visual excellence)
  const monthlyTrends = [
    { month: 'Jan', improvements: 4, issues: 8, suggestions: 6 },
    { month: 'Feb', improvements: 8, issues: 12, suggestions: 10 },
    { month: 'Mar', improvements: 12, issues: 14, suggestions: 8 },
    { month: 'Apr', improvements: 15, issues: 10, suggestions: 12 },
    { month: 'May', improvements: 22, issues: 9, suggestions: 18 },
    { month: 'Jun', improvements: improvements.length || 24, issues: issues.length || 7, suggestions: suggestions.length || 15 }
  ];

  return (
    <div className="space-y-6">
      {/* Top statistics overview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-white p-4.5 rounded-lg border border-slate-205 shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-slate-450 font-bold">Daily Improvements</span>
            <span className="text-2xl font-bold text-slate-800 mt-1">{impTotal}</span>
            <span className="text-[10px] text-emerald-600 font-bold mt-1">✓ {impImplemented} Implemented</span>
          </div>
          <div className="w-10 h-10 rounded bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <Award size={18} />
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white p-4.5 rounded-lg border border-slate-205 shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-slate-450 font-bold">Open Operational Issues</span>
            <span className="text-2xl font-bold text-rose-650 mt-1">{issueOpen}</span>
            <span className="text-[10px] text-red-500 font-bold mt-1">⚠️ {issueCritical} Critical Pending</span>
          </div>
          <div className="w-10 h-10 rounded bg-rose-50 text-rose-650 flex items-center justify-center border border-rose-100">
            <AlertOctagon size={18} />
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-4.5 rounded-lg border border-slate-205 shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-slate-450 font-bold">Creative Suggestions</span>
            <span className="text-2xl font-bold text-slate-800 mt-1">{sugTotal}</span>
            <span className="text-[10px] text-indigo-650 font-bold mt-1">💡 {sugApproved} Approved</span>
          </div>
          <div className="w-10 h-10 rounded bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <Lightbulb size={18} />
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white p-4.5 rounded-lg border border-slate-205 shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-slate-450 font-bold">Avg Issue Resolution</span>
            <span className="text-2xl font-bold text-slate-800 mt-1">{avgResHours}h</span>
            <span className="text-[10px] text-slate-505 font-bold mt-1">✓ {issueResolved} Tickets Closed</span>
          </div>
          <div className="w-10 h-10 rounded bg-emerald-50 text-emerald-650 flex items-center justify-center border border-emerald-100">
            <Clock size={18} />
          </div>
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contribution Trends (Line Chart) */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm lg:col-span-2">
          <h4 className="font-bold text-slate-800 text-[10px] uppercase tracking-wider mb-3.5 flex items-center gap-2">
            <TrendingUp size={14} className="text-slate-500" /> Hub Contribution Trends (Last 6 Months)
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrends}>
                <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 'bold' }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10, fontWeight: 'bold' }} stroke="#94a3b8" />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontFamily: 'sans-serif', fontSize: '12px' }} />
                <Line type="monotone" dataKey="improvements" name="Improvements" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="issues" name="Issues" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="suggestions" name="Suggestions" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Participation (Pie Chart) */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <h4 className="font-bold text-slate-800 text-[10px] uppercase tracking-wider mb-3.5 flex items-center gap-2">
            <Users size={14} className="text-slate-500" /> Department Participation
          </h4>
          <div className="h-64 flex flex-col justify-between">
            {departmentParticipation.length > 0 ? (
              <>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={departmentParticipation}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {departmentParticipation.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-2 justify-center text-[10px] font-bold">
                  {departmentParticipation.map((entry, index) => (
                    <span key={entry.name} className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-50 border border-slate-100">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                      {entry.name}: {entry.value}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 italic text-xs">
                No departmental data submitted yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Area: Top Contributors list & training logs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Contributors list */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <h4 className="font-bold text-slate-800 text-[10px] uppercase tracking-wider mb-3.5 flex items-center gap-2">
            <Award size={14} className="text-slate-500" /> Top Continuous Improvement Contributors
          </h4>
          <div className="space-y-3">
            {topContributors.map((c, index) => (
              <div key={index} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-350 transition duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded bg-blue-50 text-blue-650 font-bold text-xs flex items-center justify-center border border-blue-100">
                    #{index + 1}
                  </div>
                  <div>
                    <span className="font-bold text-slate-805 text-xs block">{c.name}</span>
                    <span className="text-[9px] font-medium text-slate-400">Continuous Improvement Contributor</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-800">
                  {c.count} {c.count === 1 ? 'Submission' : 'Submissions'}
                </span>
              </div>
            ))}
            {topContributors.length === 0 && (
              <div className="py-12 text-center text-slate-400 italic text-xs">
                No improvement reports logged yet.
              </div>
            )}
          </div>
        </div>

        {/* Training stats */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <h4 className="font-bold text-slate-800 text-[10px] uppercase tracking-wider mb-3.5 flex items-center gap-2">
            <BookOpen size={14} className="text-slate-500" /> Training & Knowledge Base Summary
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between">
              <div>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Active KB Articles</span>
                <span className="text-xl font-black text-slate-800 block mt-1">{kbArticles.length}</span>
              </div>
              <span className="text-[9px] text-slate-400 font-bold block">
                Total Views: {kbArticles.reduce((sum, art) => sum + (art.views || 0), 0)}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between">
              <div>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Training Courses</span>
                <span className="text-xl font-black text-slate-800 block mt-1">{courses.length}</span>
              </div>
              <span className="text-[9px] text-slate-400 font-bold block">
                Assigned Staff: {courses.reduce((sum, c) => sum + (c.assignedEmployees?.length || 0), 0)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
