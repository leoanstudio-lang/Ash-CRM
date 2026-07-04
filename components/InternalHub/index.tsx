import React, { useState, useEffect } from 'react';
import { subscribeToCollection, getHubRBAC } from '../../lib/db';
import {
  LayoutDashboard,
  ClipboardList,
  FolderOpen,
  MessageSquare,
  BookOpen,
  Vote,
  History,
  ShieldAlert,
  TrendingUp,
  Search,
  Users
} from 'lucide-react';
import {
  Employee,
  DailyImprovement,
  IssueReport,
  Suggestion,
  ProcessImprovement,
  ResourceRequest,
  Announcement,
  KBArticle,
  SOP,
  QuestionThread,
  EmployeeRecognition,
  TrainingCourse,
  Poll
} from '../../types';

import Dashboard from './Dashboard';
import Submissions from './Submissions';
import ContentLibrary from './ContentLibrary';
import QuestionsHelp from './QuestionsHelp';
import TrainingCenter from './TrainingCenter';
import PollsSurveys from './PollsSurveys';
import SubmissionHistory from './SubmissionHistory';
import AdminAnalytics from './AdminAnalytics';
import RBACSettings from './RBACSettings';

interface InternalHubProps {
  currentUser: Employee;
  employees?: Employee[];
}

export const DEFAULT_PERMISSIONS = {
  employee: {
    improvements: 'write',
    issues: 'write',
    suggestions: 'write',
    process: 'write',
    resources: 'write',
    announcements: 'read',
    kb: 'read',
    sop: 'read',
    questions: 'write',
    recognition: 'read',
    training: 'read',
    polls: 'read'
  },
  team_lead: {
    improvements: 'write',
    issues: 'write',
    suggestions: 'write',
    process: 'write',
    resources: 'write',
    announcements: 'read',
    kb: 'read',
    sop: 'read',
    questions: 'write',
    recognition: 'write',
    training: 'read',
    polls: 'read'
  },
  dept_manager: {
    improvements: 'manage',
    issues: 'manage',
    suggestions: 'manage',
    process: 'manage',
    resources: 'manage',
    announcements: 'write',
    kb: 'write',
    sop: 'write',
    questions: 'write',
    recognition: 'write',
    training: 'write',
    polls: 'write'
  },
  hr: {
    improvements: 'read',
    issues: 'read',
    suggestions: 'read',
    process: 'read',
    resources: 'manage',
    announcements: 'write',
    kb: 'write',
    sop: 'write',
    questions: 'write',
    recognition: 'write',
    training: 'write',
    polls: 'write'
  },
  admin: {
    improvements: 'manage',
    issues: 'manage',
    suggestions: 'manage',
    process: 'manage',
    resources: 'manage',
    announcements: 'write',
    kb: 'write',
    sop: 'write',
    questions: 'write',
    recognition: 'write',
    training: 'write',
    polls: 'write'
  },
  super_admin: {
    improvements: 'manage',
    issues: 'manage',
    suggestions: 'manage',
    process: 'manage',
    resources: 'manage',
    announcements: 'write',
    kb: 'write',
    sop: 'write',
    questions: 'write',
    recognition: 'write',
    training: 'write',
    polls: 'write'
  }
};

const InternalHub: React.FC<InternalHubProps> = ({ currentUser, employees = [] }) => {
  // Navigation states
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [activeSubTab, setActiveSubTab] = useState<string>('');

  // Main collections states
  const [improvements, setImprovements] = useState<DailyImprovement[]>([]);
  const [issues, setIssues] = useState<IssueReport[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [processImprovements, setProcessImprovements] = useState<ProcessImprovement[]>([]);
  const [resourceRequests, setResourceRequests] = useState<ResourceRequest[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [kbArticles, setKbArticles] = useState<KBArticle[]>([]);
  const [sops, setSops] = useState<SOP[]>([]);
  const [questions, setQuestions] = useState<QuestionThread[]>([]);
  const [recognitions, setRecognitions] = useState<EmployeeRecognition[]>([]);
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);

  // RBAC Config State
  const [rbacConfig, setRbacConfig] = useState<any>({ permissions: DEFAULT_PERMISSIONS });

  // Sync with Firestore Real-time Collections
  useEffect(() => {
    const unsubImps = subscribeToCollection<DailyImprovement>('dailyImprovements', setImprovements);
    const unsubIssues = subscribeToCollection<IssueReport>('issues', setIssues);
    const unsubSugs = subscribeToCollection<Suggestion>('suggestions', setSuggestions);
    const unsubProcs = subscribeToCollection<ProcessImprovement>('processImprovements', setProcessImprovements);
    const unsubRes = subscribeToCollection<ResourceRequest>('resourceRequests', setResourceRequests);
    const unsubAnns = subscribeToCollection<Announcement>('companyAnnouncements', setAnnouncements);
    const unsubKb = subscribeToCollection<KBArticle>('knowledgeBase', setKbArticles);
    const unsubSops = subscribeToCollection<SOP>('sopLibrary', setSops);
    const unsubQ = subscribeToCollection<QuestionThread>('questions', setQuestions);
    const unsubRecs = subscribeToCollection<EmployeeRecognition>('recognitions', setRecognitions);
    const unsubCourses = subscribeToCollection<TrainingCourse>('trainingCourses', setCourses);
    const unsubPolls = subscribeToCollection<Poll>('polls', setPolls);

    const loadRBAC = async () => {
      const config = await getHubRBAC();
      if (config && config.permissions) {
        setRbacConfig(config);
      }
    };
    loadRBAC();

    return () => {
      unsubImps();
      unsubIssues();
      unsubSugs();
      unsubProcs();
      unsubRes();
      unsubAnns();
      unsubKb();
      unsubSops();
      unsubQ();
      unsubRecs();
      unsubCourses();
      unsubPolls();
    };
  }, []);

  // Check action permissions dynamically
  const hasPermission = (section: string, action: 'read' | 'write' | 'manage'): boolean => {
    const role = currentUser?.role || 'employee';
    
    // Super admins always bypass RBAC checks
    if (role === 'super_admin' || role === 'admin') return true;

    const rolePerms = rbacConfig.permissions?.[role] || DEFAULT_PERMISSIONS[role as keyof typeof DEFAULT_PERMISSIONS] || {};
    const sectionPerm = rolePerms[section] || 'none';

    if (action === 'read') {
      return sectionPerm !== 'none';
    }
    if (action === 'write') {
      return sectionPerm === 'write' || sectionPerm === 'manage';
    }
    if (action === 'manage') {
      return sectionPerm === 'manage';
    }
    return false;
  };

  const handleNavigateToTab = (tab: string, sub: string = '') => {
    setActiveTab(tab);
    setActiveSubTab(sub);
  };

  const userRole = currentUser?.role || 'employee';
  const isAdmin = userRole === 'super_admin' || userRole === 'admin';

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full animate-in fade-in duration-300">
      {/* Sub-navigation Sidebar inside Hub */}
      <aside className="w-full lg:w-52 bg-white p-4 rounded-xl border border-slate-250 shrink-0 h-max space-y-3">
        <h4 className="font-bold text-slate-400 text-[9px] uppercase tracking-wider pl-2">Hub Navigation</h4>
        <nav className="space-y-1">
          {/* Dashboard */}
          <button
            onClick={() => handleNavigateToTab('dashboard')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white'
                : 'text-slate-650 hover:bg-slate-50'
            }`}
          >
            <LayoutDashboard size={14} /> Dashboard
          </button>

          {/* Submissions Section */}
          <div className="space-y-1 pt-2">
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider pl-3 block mb-1">Tickets & Logs</span>
            {[
              { id: 'improvements', label: 'Improvements' },
              { id: 'issues', label: 'Issue Reports' },
              { id: 'suggestions', label: 'Suggestions' },
              { id: 'process', label: 'Process Blueprints' },
              { id: 'resources', label: 'Resource Requests' }
            ].map((sub) => {
              const active = activeTab === 'submissions' && activeSubTab === sub.id;
              if (!hasPermission(sub.id, 'read') && sub.id !== 'process') return null;
              return (
                <button
                  key={sub.id}
                  onClick={() => handleNavigateToTab('submissions', sub.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] font-medium transition-all ${
                    active ? 'bg-slate-100 text-slate-900 font-bold border-l-2 border-blue-500' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <ClipboardList size={12} className="text-slate-400" /> {sub.label}
                </button>
              );
            })}
          </div>

          {/* Reading Library */}
          <div className="space-y-1 pt-2">
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider pl-3 block mb-1">Corporate Docs</span>
            {[
              { id: 'announcements', label: 'Announcements' },
              { id: 'kb', label: 'Knowledge Base' },
              { id: 'sop', label: 'SOP Accordions' },
              { id: 'recognition', label: 'Appreciation Feed' }
            ].map((sub) => {
              const active = activeTab === 'content' && activeSubTab === sub.id;
              if (!hasPermission(sub.id, 'read')) return null;
              return (
                <button
                  key={sub.id}
                  onClick={() => handleNavigateToTab('content', sub.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] font-medium transition-all ${
                    active ? 'bg-slate-100 text-slate-900 font-bold border-l-2 border-blue-500' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <FolderOpen size={12} className="text-slate-400" /> {sub.label}
                </button>
              );
            })}
          </div>

          {/* Social / Training / Surveys */}
          <div className="space-y-1 pt-2">
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider pl-3 block mb-1">Activities</span>
            {hasPermission('questions', 'read') && (
              <button
                onClick={() => handleNavigateToTab('qa')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] font-medium transition-all ${
                  activeTab === 'qa' ? 'bg-slate-100 text-slate-900 font-bold border-l-2 border-blue-500' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <MessageSquare size={12} className="text-slate-400" /> Team Q&A Forum
              </button>
            )}
            {hasPermission('training', 'read') && (
              <button
                onClick={() => handleNavigateToTab('training')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] font-medium transition-all ${
                  activeTab === 'training' ? 'bg-slate-100 text-slate-900 font-bold border-l-2 border-blue-500' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <BookOpen size={12} className="text-slate-400" /> Training Lessons
              </button>
            )}
            {hasPermission('polls', 'read') && (
              <button
                onClick={() => handleNavigateToTab('polls')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] font-medium transition-all ${
                  activeTab === 'polls' ? 'bg-slate-100 text-slate-900 font-bold border-l-2 border-blue-500' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Vote size={12} className="text-slate-400" /> Polls & Feedback
              </button>
            )}
            <button
              onClick={() => handleNavigateToTab('history')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] font-medium transition-all ${
                activeTab === 'history' ? 'bg-slate-100 text-slate-900 font-bold border-l-2 border-blue-500' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <History size={12} className="text-slate-400" /> Personal History
            </button>
          </div>

          {/* Admin panel settings */}
          {isAdmin && (
            <div className="space-y-1 pt-2">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider pl-3 block mb-1">Administrative</span>
              <button
                onClick={() => handleNavigateToTab('analytics')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] font-medium transition-all ${
                  activeTab === 'analytics' ? 'bg-slate-100 text-slate-900 font-bold border-l-2 border-blue-500' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <TrendingUp size={12} className="text-slate-400" /> Hub Analytics
              </button>
              <button
                onClick={() => handleNavigateToTab('rbac')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] font-medium transition-all ${
                  activeTab === 'rbac' ? 'bg-slate-100 text-slate-900 font-bold border-l-2 border-blue-500' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ShieldAlert size={12} className="text-slate-400" /> Access Permissions
              </button>
            </div>
          )}
        </nav>
      </aside>

      {/* Primary tab views routing rendering */}
      <main className="flex-1 min-w-0">
        {activeTab === 'dashboard' && (
          <Dashboard
            improvements={improvements}
            issues={issues}
            suggestions={suggestions}
            announcements={announcements}
            courses={courses}
            recognitions={recognitions}
            currentUser={currentUser}
            userRole={userRole}
            hasPermission={hasPermission}
            onNavigateToTab={handleNavigateToTab}
          />
        )}

        {activeTab === 'submissions' && (
          <Submissions
            improvements={improvements}
            issues={issues}
            suggestions={suggestions}
            processImprovements={processImprovements}
            resourceRequests={resourceRequests}
            currentUser={currentUser}
            userRole={userRole}
            hasPermission={hasPermission}
            employees={employees}
            activeSubTab={activeSubTab as any}
          />
        )}

        {activeTab === 'content' && (
          <ContentLibrary
            announcements={announcements}
            kbArticles={kbArticles}
            sops={sops}
            recognitions={recognitions}
            currentUser={currentUser}
            userRole={userRole}
            hasPermission={hasPermission}
            employees={employees}
            activeSubTab={activeSubTab as any}
          />
        )}

        {activeTab === 'qa' && (
          <QuestionsHelp
            questions={questions}
            currentUser={currentUser}
            userRole={userRole}
            hasPermission={hasPermission}
          />
        )}

        {activeTab === 'training' && (
          <TrainingCenter
            courses={courses}
            currentUser={currentUser}
            userRole={userRole}
            hasPermission={hasPermission}
          />
        )}

        {activeTab === 'polls' && (
          <PollsSurveys
            polls={polls}
            currentUser={currentUser}
            userRole={userRole}
            hasPermission={hasPermission}
          />
        )}

        {activeTab === 'history' && (
          <SubmissionHistory
            improvements={improvements}
            issues={issues}
            suggestions={suggestions}
            resourceRequests={resourceRequests}
            questions={questions}
            courses={courses}
            recognitions={recognitions}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'analytics' && (
          <AdminAnalytics
            improvements={improvements}
            issues={issues}
            suggestions={suggestions}
            kbArticles={kbArticles}
            courses={courses}
            employees={employees}
          />
        )}

        {activeTab === 'rbac' && (
          <RBACSettings
            rbacConfig={rbacConfig}
            setRbacConfig={setRbacConfig}
            currentUser={currentUser}
          />
        )}
      </main>
    </div>
  );
};

export default InternalHub;
