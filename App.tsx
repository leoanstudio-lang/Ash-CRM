
import React, { useState, useEffect } from 'react';
import { Section, Client, Lead, Project, Employee, Notification, Service, Role, Package, PaymentAlert, Channel } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Development from './components/Development';
import GraphicsDesigning from './components/GraphicsDesigning';
import SalesCRM from './components/SalesCRM';
import ClientDB from './components/ClientDB';
import Notifications from './components/Notifications';
import Settings from './components/Settings';
import Login from './components/Login';
import EmployeePanel from './components/EmployeePanel';
import History from './components/History';
import Payments from './components/Payments';
import QuotationsView from './components/Quotations';
import { Bell } from 'lucide-react';
import { subscribeToCollection } from './lib/db';
import { Quotation } from './types';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [activeSection, setActiveSection] = useState<Section>('Dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [autoOpenProspectId, setAutoOpenProspectId] = useState<string | null>(null);
  const [autoOpenTab, setAutoOpenTab] = useState<'dashboard' | 'inbound' | 'outbound'>('dashboard');
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<Set<string>>(new Set());
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', isSidebarCollapsed.toString());
  }, [isSidebarCollapsed]);

  // Master State (Synced with Firestore)
  const [clients, setClients] = useState<Client[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [paymentAlerts, setPaymentAlerts] = useState<PaymentAlert[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  // Outbound Separated Collections
  const [campaignProspects, setCampaignProspects] = useState<any[]>([]);
  const [campaignSequences, setCampaignSequences] = useState<any[]>([]);
  const [activeDeals, setActiveDeals] = useState<any[]>([]);
  const [nurturingLeads, setNurturingLeads] = useState<any[]>([]);
  const [noResponseLeads, setNoResponseLeads] = useState<any[]>([]);
  const [suppressedLeads, setSuppressedLeads] = useState<any[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);

  // Inbound Separated Collections
  const [inboundSources, setInboundSources] = useState<any[]>([]);
  const [inboundLeads, setInboundLeads] = useState<any[]>([]);
  const [inboundActiveDeals, setInboundActiveDeals] = useState<any[]>([]);
  const [inboundNurturing, setInboundNurturing] = useState<any[]>([]);
  const [inboundNoResponseLeads, setInboundNoResponseLeads] = useState<any[]>([]);
  const [inboundSuppressedLeads, setInboundSuppressedLeads] = useState<any[]>([]);

  // Firestore Subscriptions
  useEffect(() => {
    const unsubClients = subscribeToCollection<Client>('clients', setClients);
    const unsubLeads = subscribeToCollection<Lead>('leads', setLeads);
    const unsubProjects = subscribeToCollection<Project>('projects', setProjects);
    const unsubEmployees = subscribeToCollection<Employee>('employees', setEmployees);
    const unsubServices = subscribeToCollection<Service>('services', setServices);
    const unsubPackages = subscribeToCollection<Package>('packages', setPackages);
    const unsubPaymentAlerts = subscribeToCollection<PaymentAlert>('paymentAlerts', setPaymentAlerts);
    const unsubQuotations = subscribeToCollection<Quotation>('quotations', setQuotations);
    const unsubCampaigns = subscribeToCollection<any>('campaigns', setCampaigns);
    const unsubCampaignProspects = subscribeToCollection<any>('campaignProspects', setCampaignProspects);
    const unsubCampaignSequences = subscribeToCollection<any>('campaignSequences', setCampaignSequences);
    const unsubActiveDeals = subscribeToCollection<any>('activeDeals', setActiveDeals);
    const unsubNurturingLeads = subscribeToCollection<any>('nurturing', setNurturingLeads);
    const unsubNoResponseLeads = subscribeToCollection<any>('noResponsePool', setNoResponseLeads);
    const unsubSuppressedLeads = subscribeToCollection<any>('suppressionList', setSuppressedLeads);
    const unsubChannels = subscribeToCollection<Channel>('channels', setChannels);
    const unsubInboundSources = subscribeToCollection<any>('inboundSources', setInboundSources);
    const unsubInboundLeads = subscribeToCollection<any>('inboundLeads', setInboundLeads);
    const unsubInboundActiveDeals = subscribeToCollection<any>('inboundActiveDeals', setInboundActiveDeals);
    const unsubInboundNurturing = subscribeToCollection<any>('inboundNurturing', setInboundNurturing);
    const unsubInboundNoResponse = subscribeToCollection<any>('inboundNoResponsePool', setInboundNoResponseLeads);
    const unsubInboundSuppressed = subscribeToCollection<any>('inboundSuppressionList', setInboundSuppressedLeads);

    return () => {
      unsubClients();
      unsubLeads();
      unsubProjects();
      unsubEmployees();
      unsubServices();
      unsubPackages();
      unsubPaymentAlerts();
      unsubQuotations();
      unsubCampaigns();
      unsubCampaignProspects();
      unsubCampaignSequences();
      unsubActiveDeals();
      unsubNurturingLeads();
      unsubNoResponseLeads();
      unsubSuppressedLeads();
      unsubChannels();
      unsubInboundSources();
      unsubInboundLeads();
      unsubInboundActiveDeals();
      unsubInboundNurturing();
      unsubInboundNoResponse();
      unsubInboundSuppressed();
    };
  }, []);

  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Follow-up Notification Logic
  useEffect(() => {
    const checkFollowUps = () => {
      const today = new Date().toISOString().split('T')[0];

      const allActiveDeals = [
        ...activeDeals.map(d => ({ ...d, type: 'outbound' })),
        ...inboundActiveDeals.map(d => ({ ...d, type: 'inbound' }))
      ];

      // 1. Generate new due notifications
      const dueNotifications: Notification[] = [];
      allActiveDeals.forEach(deal => {
        if (deal.nextFollowUp) {
          const followUpDate = deal.nextFollowUp.split('T')[0];
          if (followUpDate <= today) {
            const id = `FU-${deal.id}`;
            // Only add if not manually dismissed
            if (!dismissedNotificationIds.has(id)) {
              dueNotifications.push({
                id,
                title: 'Follow-up Scheduled',
                message: `Time to follow up with ${deal.contactName || deal.name || 'Unknown'}. Source: ${deal.type === 'inbound' ? 'Inbound' : 'Outbound'}.`,
                type: 'alert',
                timestamp: 'Now',
                linkData: {
                  section: 'Sales CRM',
                  tab: deal.type as any,
                  prospectId: deal.id
                }
              });
            }
          }
        }
      });

      // 2. Filter out systemic notifications from the master list (keeping custom ones if any existed)
      // and only keep those that are still 'due' and NOT 'dismissed'
      setNotifications(dueNotifications);
    };

    // Sync periodically
    checkFollowUps();
    const interval = setInterval(checkFollowUps, 60000); // Re-check every minute
    return () => clearInterval(interval);
  }, [activeDeals, inboundActiveDeals, dismissedNotificationIds]);

  const handleNotificationClick = (linkData: any) => {
    if (linkData.section) {
      setActiveSection(linkData.section);
    }
    if (linkData.tab) {
      setAutoOpenTab(linkData.tab);
    }
    if (linkData.prospectId) {
      setAutoOpenProspectId(linkData.prospectId);
    }
  };

  const handleDismissNotification = (id: string) => {
    setDismissedNotificationIds(prev => new Set([...Array.from(prev), id]));
  };

  const handleClearAllNotifications = () => {
    const allIds = notifications.map(n => n.id);
    setDismissedNotificationIds(prev => new Set([...Array.from(prev), ...allIds]));
  };

  const handleLogin = (user: Employee) => {
    setCurrentUser(user);
    if (user.role === 'employee') setActiveSection('Dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  // Ensure Admin fallback is always available if not in DB
  const fallbackAdmin: Employee = {
    id: 'ADMIN_FALLBACK',
    name: 'Admin',
    mobile: '000',
    username: 'ashadmin',
    password: '8086',
    department: 'Management',
    role: 'admin'
  };

  const allEmployees = [...employees];
  if (!allEmployees.some(e => e.username === 'admin')) {
    allEmployees.push(fallbackAdmin);
  }

  if (!currentUser) {
    return <Login employees={allEmployees} onLogin={handleLogin} />;
  }

  if (currentUser.role === 'employee') {
    return (
      <EmployeePanel
        employee={currentUser}
        projects={projects}
        clients={clients}
        setProjects={setProjects} // Note: This prop will be ignored/refactored in EmployeePanel
        onLogout={handleLogout}
      />
    );
  }

  // Admin View Rendering
  const renderContent = () => {
    switch (activeSection) {
      case 'Dashboard': return <Dashboard clients={clients} projects={projects} leads={leads} />;
      case 'Quotations': return <QuotationsView clients={clients} services={services} />;
      case 'Development': return <Development clients={clients} projects={projects} setProjects={setProjects} services={services} />;
      case 'Graphics Designing': return <GraphicsDesigning employees={employees} projects={projects} setProjects={setProjects} clients={clients} services={services} packages={packages} paymentAlerts={paymentAlerts} />;
      case 'Sales CRM': return <SalesCRM
        leads={leads} setLeads={setLeads}
        setClients={setClients} services={services} campaigns={campaigns}
        campaignProspects={campaignProspects} campaignSequences={campaignSequences} activeDeals={activeDeals}
        nurturingLeads={nurturingLeads} noResponseLeads={noResponseLeads}
        suppressedLeads={suppressedLeads} channels={channels}
        inboundSources={inboundSources} inboundLeads={inboundLeads}
        inboundActiveDeals={inboundActiveDeals} inboundNurturing={inboundNurturing}
        inboundNoResponseLeads={inboundNoResponseLeads} inboundSuppressedLeads={inboundSuppressedLeads}
        autoOpenProspectId={autoOpenProspectId} autoOpenTab={autoOpenTab}
        onClearAutoOpen={() => setAutoOpenProspectId(null)}
      />;
      case 'Client DB': return <ClientDB clients={clients} setClients={setClients} />;
      case 'History': return <History projects={projects} setProjects={setProjects} employees={employees} packages={packages} />;
      case 'Payments': return <Payments paymentAlerts={paymentAlerts} packages={packages} clients={clients} />;
      case 'Notification': return <Notifications
        notifications={notifications}
        onNotificationClick={handleNotificationClick}
        onDismiss={handleDismissNotification}
        onClearAll={handleClearAllNotifications}
      />;
      case 'Settings': return <Settings employees={employees} setEmployees={setEmployees} services={services} setServices={setServices} channels={channels} onLogout={handleLogout} />;
      default: return <Dashboard clients={clients} projects={projects} leads={leads} />;
    }
  };

  // Sidebar dynamic counts
  const todayStr = new Date().toISOString().split('T')[0];
  const counts = {
    Payments: paymentAlerts.filter(a => a.status === 'due' || a.status === 'pending' || a.status === 'waiting').length,
    Quotations: quotations.filter(q => q.status === 'Draft' || q.status === 'Sent').length,
    'Sales CRM': leads.filter(l => l.status === 'Lead Today').length,
    'Graphics Designing': projects.filter(p =>
      p.type === 'Graphic' &&
      ['Allocated', 'Pending', 'Waiting', 'In Progress', 'Client Feedback', 'Testing', 'Working'].includes(p.status) &&
      p.deadline && p.deadline.split('T')[0] <= todayStr
    ).length,
    'Client DB': clients.length,
    Notification: notifications.length,
    Development: projects.filter(p => p.type !== 'Graphic' && ['Allocated', 'Pending', 'Waiting', 'In Progress', 'Client Feedback', 'Testing', 'Working'].includes(p.status)).length
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar Wrapper */}
      <div className={`fixed inset-y-0 left-0 z-50 transform lg:relative lg:translate-x-0 transition-all duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64'}`}>
        <Sidebar
          activeSection={activeSection}
          onSectionChange={(section) => {
            setActiveSection(section);
            setIsMobileSidebarOpen(false);
          }}
          onLogout={handleLogout}
          counts={counts}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
      </div>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 w-full">
        <header className="mb-6 md:mb-8 flex justify-between items-center px-2 md:px-4">
          <div className="flex items-center gap-4">
            <button
              className="p-2 lg:hidden bg-white text-slate-800 rounded-xl shadow-sm border border-slate-100"
              onClick={() => setIsMobileSidebarOpen(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-none truncate max-w-[200px] md:max-w-none">{activeSection}</h1>
              <p className="text-slate-500 mt-1 md:mt-2 font-medium text-xs md:text-base">Administrator Panel</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <button
              onClick={() => setActiveSection('Notification')}
              className="p-2 md:p-3 rounded-2xl hover:bg-slate-200 transition-all relative bg-white border border-slate-100 shadow-sm"
            >
              <Bell size={20} className="text-slate-600" />
              {notifications.length > 0 && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </button>
            <div className="flex items-center gap-4 pl-0 md:pl-4 md:border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-black text-slate-800 leading-none">{currentUser.name}</p>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Super Admin</p>
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black shadow-lg shadow-blue-600/20 text-lg">
                {currentUser.name.charAt(0)}
              </div>
            </div>
          </div>
        </header>
        <div className="max-w-7xl mx-auto pb-12 w-full">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
