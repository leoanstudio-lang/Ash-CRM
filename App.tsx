
import React, { useState, useEffect } from 'react';
import { Section, Client, Lead, Project, Employee, Notification, Service, Role, Package, PaymentAlert, Channel, Strategy, ManualTask, EmployeeNotification } from './types';
import Sidebar from './components/Sidebar';
import ExecutionCenter from './components/ExecutionCenter';
import Strategies from './components/Strategies';
import Development from './components/Development';
import GraphicsDesigning from './components/GraphicsDesigning';
import Marketing from './components/Marketing';
import SalesCRM from './components/SalesCRM';
import ClientDB from './components/ClientDB';
import Notifications from './components/Notifications';
import Settings from './components/Settings';
import Login from './components/Login';
import EmployeePanel from './components/EmployeePanel';
import History from './components/History';
import Payments from './components/Payments';
import QuotationsView from './components/Quotations';
import ContentStudio from './components/ContentStudio';
import RiskMonitorModal from './components/Strategies/RiskMonitorModal';
import AccountingLayout from './components/Accounting/AccountingLayout';
import InternalHub from './components/InternalHub';
import Attendance from './components/Attendance';
import { Bell, LogOut } from 'lucide-react';
import { subscribeToCollection, getCompanyProfile, saveCompanyProfile } from './lib/db';
import { auth, signOut } from './lib/firebase';
import { Quotation, QuotationDemo } from './types';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<Employee | null>(() => {
    const saved = localStorage.getItem('crm_current_user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [activeSection, setActiveSection] = useState<Section>('Execution Center');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [autoOpenProspectId, setAutoOpenProspectId] = useState<string | null>(null);
  const [autoOpenTab, setAutoOpenTab] = useState<'Execution Center' | 'inbound' | 'outbound'>('Execution Center');
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<Set<string>>(new Set());
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', isSidebarCollapsed.toString());
  }, [isSidebarCollapsed]);

  // Google Docs & Drive Permanent Authentication Callback Handler
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      // Clear code query param from URL so it doesn't run repeatedly on reload
      window.history.replaceState({}, document.title, window.location.pathname);
      
      const exchangeCodeForRefreshToken = async () => {
        try {
          const clientId = import.meta.env.VITE_GOOGLE_DOCS_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
          const clientSecret = import.meta.env.VITE_GOOGLE_DOCS_CLIENT_SECRET || import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '';
          
          if (!clientId || !clientSecret) {
            console.error('Google Client ID or Client Secret is not configured in .env.local');
            alert('Cannot exchange code: Google Client ID/Secret is missing in .env.local');
            return;
          }
          
          console.log('Exchanging auth code for tokens via local proxy...');
          const res = await fetch('/google-token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              code: code,
              grant_type: 'authorization_code',
              redirect_uri: window.location.origin
            }).toString()
          });
          
          if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText || `Failed to fetch tokens: ${res.status}`);
          }
          
          const data = await res.json();
          console.log('Token exchange response:', data);
          
          if (data.refresh_token) {
            // Save to company profile in Firestore
            const currentProfile = await getCompanyProfile() || {
              companyName: 'Ash Creative Studio',
              tagline: '',
              contacts: [],
              socials: []
            };
            
            await saveCompanyProfile({
              ...currentProfile,
              googleRefreshToken: data.refresh_token,
              googleClientId: clientId,
              googleClientSecret: clientSecret
            });
            
            // Also store access token locally so it is instantly available
            localStorage.setItem('google_doc_oauth_token', JSON.stringify({
              accessToken: data.access_token,
              expiresAt: Date.now() + (data.expires_in * 1000)
            }));
            
            alert('Successfully connected Google Docs & Drive permanently! Refresh token is saved to Firestore.');
            window.location.reload();
          } else {
            console.warn('No refresh token returned by Google OAuth. Ensure you approved permissions.');
            alert('Connected successfully, but Google did not return a refresh token. If you are re-connecting, please disconnect the app from your Google account settings first to force consent prompt.');
          }
        } catch (err: any) {
          console.error('Error exchanging authorization code:', err);
          alert(`Google connection failed: ${err.message}`);
        }
      };
      
      exchangeCodeForRefreshToken();
    }
  }, []);

  // Master State (Synced with Firestore)
  const [clients, setClients] = useState<Client[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [paymentAlerts, setPaymentAlerts] = useState<PaymentAlert[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [quotationDemos, setQuotationDemos] = useState<QuotationDemo[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [executionTasks, setExecutionTasks] = useState<any[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [strategyTodos, setStrategyTodos] = useState<any[]>([]);
  const [manualTasks, setManualTasks] = useState<ManualTask[]>([]);
  const [employeeNotifications, setEmployeeNotifications] = useState<EmployeeNotification[]>([]);
  const [hubIssues, setHubIssues] = useState<any[]>([]);
  const [hubResourceRequests, setHubResourceRequests] = useState<any[]>([]);
  const [hubAnnouncements, setHubAnnouncements] = useState<any[]>([]);
  const [hubCourses, setHubCourses] = useState<any[]>([]);
  const [hubImprovements, setHubImprovements] = useState<any[]>([]);
  const [hubSuggestions, setHubSuggestions] = useState<any[]>([]);

  // Content Studio
  const [contentMonths, setContentMonths] = useState<any[]>([]);
  const [contentCards, setContentCards] = useState<any[]>([]);
  const [contentAssets, setContentAssets] = useState<any[]>([]);

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
    const unsubQuotationDemos = subscribeToCollection<QuotationDemo>('quotationDemos', setQuotationDemos);
    const unsubCampaigns = subscribeToCollection<any>('campaigns', setCampaigns);
    const unsubExecutionTasks = subscribeToCollection<any>('executionTasks', setExecutionTasks);
    const unsubStrategies = subscribeToCollection<Strategy>('strategies', setStrategies);
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
    const unsubStrategyTodos = subscribeToCollection<any>('strategyTodos', setStrategyTodos);

    // Content Studio
    const unsubContentMonths = subscribeToCollection<any>('contentMonths', setContentMonths);
    const unsubContentCards = subscribeToCollection<any>('contentCards', setContentCards);
    const unsubContentAssets = subscribeToCollection<any>('contentAssets', setContentAssets);
    const unsubManualTasks = subscribeToCollection<ManualTask>('manualTasks', setManualTasks);
    const unsubEmployeeNotifications = subscribeToCollection<EmployeeNotification>('employeeNotifications', setEmployeeNotifications);
    const unsubHubIssues = subscribeToCollection<any>('issues', setHubIssues);
    const unsubHubResourceRequests = subscribeToCollection<any>('resourceRequests', setHubResourceRequests);
    const unsubHubAnnouncements = subscribeToCollection<any>('companyAnnouncements', setHubAnnouncements);
    const unsubHubCourses = subscribeToCollection<any>('trainingCourses', setHubCourses);
    const unsubHubImprovements = subscribeToCollection<any>('dailyImprovements', setHubImprovements);
    const unsubHubSuggestions = subscribeToCollection<any>('suggestions', setHubSuggestions);

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
      unsubExecutionTasks();
      unsubStrategies();
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
      unsubStrategyTodos();
      unsubContentMonths();
      unsubContentCards();
      unsubContentAssets();
      unsubManualTasks();
      unsubEmployeeNotifications();
      unsubQuotationDemos();
      unsubHubIssues();
      unsubHubResourceRequests();
      unsubHubAnnouncements();
      unsubHubCourses();
      unsubHubImprovements();
      unsubHubSuggestions();
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

  const handleLogin = async (user: Employee, ipAddress?: string, lateReason?: string, lateMinutes?: number) => {
    setCurrentUser(user);
    localStorage.setItem('crm_current_user', JSON.stringify(user));
    
    if (user.role === 'employee') {
      setActiveSection('Execution Center');
      try {
        const ip = ipAddress || 'Unknown';
        const { logEmployeeLoginWithReason } = await import('./lib/db');
        await logEmployeeLoginWithReason(user.id, user.name, ip, 'Desktop Browser', lateReason, lateMinutes);
      } catch (err) {
        console.error("Error logging employee login:", err);
      }
    }
  };

  const handleLogout = async () => {
    if (currentUser) {
      if (currentUser.role === 'admin' || currentUser.role === 'super_admin') {
        signOut(auth).catch(console.error);
      } else if (currentUser.role === 'employee') {
        try {
          const { logEmployeeLogout } = await import('./lib/db');
          await logEmployeeLogout(currentUser.id);
        } catch (err) {
          console.error("Error logging employee logout:", err);
        }
      }
    }
    setCurrentUser(null);
    localStorage.removeItem('crm_current_user');
  };

  // Keep currentUser synced with latest employees list
  useEffect(() => {
    if (employees.length === 0) return; // Wait until employees array is loaded from Firestore to prevent logout race condition on refresh
    if (currentUser && currentUser.role !== 'super_admin' && currentUser.role !== 'admin') {
      const latest = employees.find(emp => emp.id === currentUser.id);
      if (latest) {
        if (JSON.stringify(latest) !== JSON.stringify(currentUser)) {
          setCurrentUser(latest);
          localStorage.setItem('crm_current_user', JSON.stringify(latest));
        }
      } else {
        handleLogout();
      }
    }
  }, [employees, currentUser]);

  // Heartbeat & disruption logging for employees
  useEffect(() => {
    if (!currentUser || currentUser.role === 'admin' || currentUser.role === 'super_admin') return;

    let isSubscribed = true;

    const checkForDisruptionAndStartHeartbeat = async () => {
      try {
        const { db } = await import('./lib/firebase');
        const { doc, getDoc, updateDoc, setDoc } = await import('firebase/firestore');

        const localDate = new Date();
        const dateYMD = localDate.getFullYear() + '-' + 
                        String(localDate.getMonth() + 1).padStart(2, '0') + '-' + 
                        String(localDate.getDate()).padStart(2, '0');
        const docId = `${currentUser.id}_${dateYMD}`;
        const docRef = doc(db, 'attendance', docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && isSubscribed) {
          const record = docSnap.data();
          const sessions = record.sessions || [];
          const activeIdx = sessions.findIndex((s: any) => s.logoutTime === null);

          if (activeIdx !== -1) {
            const activeSession = sessions[activeIdx];
            if (activeSession.lastPingTime) {
              const lastPing = new Date(activeSession.lastPingTime).getTime();
              const now = Date.now();
              const gap = now - lastPing;

              // Gap greater than 3 minutes (180000ms) means system crash/PC shutdown
              if (gap > 180000) {
                const logId = `LOG_${Date.now()}`;
                await setDoc(doc(db, 'system_logs', logId), {
                  id: logId,
                  employeeId: currentUser.id,
                  employeeName: currentUser.name,
                  date: dateYMD,
                  offTime: activeSession.lastPingTime,
                  reenterTime: new Date().toISOString(),
                  type: 'disruption'
                });
              }
            }

            // Update lastPingTime to now to confirm recovery
            const updatedSessions = [...sessions];
            updatedSessions[activeIdx] = {
              ...activeSession,
              lastPingTime: new Date().toISOString()
            };
            await updateDoc(docRef, { sessions: updatedSessions });
          }
        }
      } catch (err) {
        console.error("Error checking disruption logs:", err);
      }
    };

    checkForDisruptionAndStartHeartbeat();

    // Heartbeat ticker (runs every 30 seconds)
    const interval = setInterval(async () => {
      try {
        const { db } = await import('./lib/firebase');
        const { doc, getDoc, updateDoc } = await import('firebase/firestore');

        const localDate = new Date();
        const dateYMD = localDate.getFullYear() + '-' + 
                        String(localDate.getMonth() + 1).padStart(2, '0') + '-' + 
                        String(localDate.getDate()).padStart(2, '0');
        const docId = `${currentUser.id}_${dateYMD}`;
        const docRef = doc(db, 'attendance', docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && isSubscribed) {
          const record = docSnap.data();
          const sessions = record.sessions || [];
          const activeIdx = sessions.findIndex((s: any) => s.logoutTime === null);

          if (activeIdx !== -1) {
            const updatedSessions = [...sessions];
            updatedSessions[activeIdx] = {
              ...updatedSessions[activeIdx],
              lastPingTime: new Date().toISOString()
            };
            await updateDoc(docRef, { sessions: updatedSessions });
          }
        }
      } catch (err) {
        console.error("Error posting heartbeat:", err);
      }
    }, 30000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [currentUser]);

  // Auto start a login session on a new day if the employee is still logged in
  useEffect(() => {
    if (currentUser && currentUser.role === 'employee') {
      const checkAndCreateSession = async () => {
        try {
          const { getAttendanceSettings, logEmployeeLoginWithReason } = await import('./lib/db');
          const settings = await getAttendanceSettings();
          
          let ip = 'Restore Session';
          if (settings?.ipRestrictionEnabled) {
            try {
              const { getUserPublicIP } = await import('./components/Login');
              ip = await getUserPublicIP();
            } catch {}
          }
          
          const localDate = new Date();
          const dateYMD = localDate.getFullYear() + '-' + 
                          String(localDate.getMonth() + 1).padStart(2, '0') + '-' + 
                          String(localDate.getDate()).padStart(2, '0');
          
          const { doc, getDoc } = await import('firebase/firestore');
          const { db } = await import('./lib/firebase');
          const docRef = doc(db, 'attendance', `${currentUser.id}_${dateYMD}`);
          const docSnap = await getDoc(docRef);
          
          if (!docSnap.exists() || !(docSnap.data()?.sessions?.length > 0)) {
            let lateReason = null;
            let lateMinutes = null;
            
            if (settings?.lateTrackingEnabled) {
              const [startHour, startMin] = (settings.officialStartTime || '09:00').split(':').map(Number);
              const shiftStartLocal = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), startHour, startMin, 0);
              const gracePeriodEnd = new Date(shiftStartLocal.getTime() + (settings.lateGracePeriod || 15) * 60 * 1000);
              
              if (localDate.getTime() > gracePeriodEnd.getTime()) {
                const diffMs = localDate.getTime() - shiftStartLocal.getTime();
                lateMinutes = Math.floor(diffMs / 60000);
                lateReason = 'System Auto-Restore Session';
              }
            }
            
            await logEmployeeLoginWithReason(currentUser.id, currentUser.name, ip, 'Desktop Browser', lateReason, lateMinutes);
          }
        } catch (e) {
          console.error("Auto session creation error:", e);
        }
      };
      checkAndCreateSession();
    }
  }, [currentUser]);

  // Only non-admin employees use the Firestore username/password login.
  // Admins MUST use Firebase Email Authentication exclusively.
  const allEmployees = employees.filter(e => e.role !== 'admin' && e.role !== 'super_admin');

  if (!currentUser) {
    return <Login employees={allEmployees} onLogin={handleLogin} />;
  }

  if (currentUser.role === 'employee') {
    return (
      <EmployeePanel
        employee={currentUser}
        projects={projects}
        clients={clients}
        manualTasks={manualTasks}
        quotationDemos={quotationDemos}
        setProjects={setProjects}
        onLogout={handleLogout}
        employees={employees}
        announcements={hubAnnouncements}
        courses={hubCourses}
        issues={hubIssues}
      />
    );
  }

  // Admin View Rendering
  const renderContent = () => {
    switch (activeSection) {
      case 'Execution Center': return <ExecutionCenter tasks={executionTasks} clients={clients} projects={projects} employees={employees} />;
      case 'Strategies': return <Strategies strategies={strategies} paymentAlerts={paymentAlerts} />;
      case 'Quotations': return <QuotationsView clients={clients} services={services} employees={employees} />;
      case 'Development': return <Development clients={clients} projects={projects} setProjects={setProjects} services={services} quotations={quotations} employees={employees} />;
      case 'Graphics Designing': return <GraphicsDesigning employees={employees} projects={projects} setProjects={setProjects} clients={clients} services={services} packages={packages} paymentAlerts={paymentAlerts} />;
      case 'Marketing': return <Marketing clients={clients} projects={projects} setProjects={setProjects} services={services} employees={employees} quotations={quotations} paymentAlerts={paymentAlerts} />;
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
        departments={['Development', 'Graphics Designing', 'Marketing']}
        quotations={quotations}
      />;
      case 'Client DB': return <ClientDB clients={clients} setClients={setClients} />;
      case 'History': return <History projects={projects} setProjects={setProjects} employees={employees} packages={packages} />;
      case 'Accounts': return <AccountingLayout />;
      case 'Payments': return <Payments paymentAlerts={paymentAlerts} packages={packages} clients={clients} />;
      case 'Content Studio': return <ContentStudio months={contentMonths} cards={contentCards} assets={contentAssets} />;
      case 'Internal Hub': return <InternalHub currentUser={currentUser} employees={employees} />;
      case 'Attendance': return <Attendance employees={employees} currentUser={currentUser} />;
      case 'Notification': return <Notifications
        notifications={notifications}
        employeeNotifications={employeeNotifications}
        clients={clients}
        onNotificationClick={handleNotificationClick}
        onDismiss={handleDismissNotification}
        onClearAll={handleClearAllNotifications}
      />;
      case 'Settings': return <Settings employees={employees} setEmployees={setEmployees} services={services} setServices={setServices} channels={channels} onLogout={handleLogout} />;
      default: return <ExecutionCenter tasks={executionTasks} clients={clients} projects={projects} employees={employees} />;
    }
  };

  // Sidebar dynamic counts
  const todayStr = new Date().toISOString().split('T')[0];

  // Calculate Strategy Badge Count
  const calculateStrategyBadge = () => {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const now = new Date();
    const currentMonth = monthNames[now.getMonth()];
    const currentYear = now.getFullYear();

    const currentStrategy = strategies.find(s => s.month === currentMonth && s.year === currentYear);

    if (currentStrategy) {
      const currentTodos = strategyTodos.filter(t => t.strategyId === currentStrategy.id);
      const pendingCurrent = currentTodos.filter(t => !t.isCompleted);
      if (pendingCurrent.length > 0) return pendingCurrent.length;
      if (currentTodos.length === 0) return 0;
    }

    const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonth = monthNames[nextDate.getMonth()];
    const nextYear = nextDate.getFullYear();

    const nextStrategy = strategies.find(s => s.month === nextMonth && s.year === nextYear);
    if (nextStrategy) {
      const pendingNext = strategyTodos.filter(t => t.strategyId === nextStrategy.id && !t.isCompleted);
      return pendingNext.length;
    }
    return 0;
  };

  // Calculate Content Studio Badge
  const calculateContentBadge = () => {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const now = new Date();

    let totalTarget = 0;
    contentMonths.forEach(m => {
      const targetMonthIndex = monthNames.indexOf(m.month);
      const targetYear = m.year;
      // Only include targets up to the current month to reflect the accumulated deficit
      if (targetYear < now.getFullYear() || (targetYear === now.getFullYear() && targetMonthIndex <= now.getMonth())) {
        totalTarget += (m.targetVideos || 0);
      }
    });

    const totalPublished = contentCards.filter(c => c.status === 'Posted').length;

    const balance = totalTarget - totalPublished;
    return balance > 0 ? balance : 0;
  };

  const counts = {
    'Execution Center': executionTasks.filter(t => t.status === 'Pending' || t.status === 'In Progress').length,
    Payments: paymentAlerts.filter(a => a.status === 'due' || a.status === 'pending' || a.status === 'waiting').length,
    Quotations: quotations.filter(q => q.status === 'Draft' || q.status === 'Sent').length,
    'Sales CRM': leads.filter(l => l.status === 'Lead Today').length,
    'Graphics Designing': projects.filter(p =>
      p.type === 'Graphic' &&
      ['Allocated', 'Pending', 'Waiting', 'In Progress', 'Client Feedback', 'Testing', 'Working'].includes(p.status) &&
      p.deadline && p.deadline.split('T')[0] <= todayStr
    ).length,
    'Marketing': projects.filter(p =>
      p.type === 'Marketing' &&
      ['Pending', 'Waiting', 'In Progress', 'Client Feedback', 'Working'].includes(p.status)
    ).length,
    'Client DB': clients.length,
    Notification: notifications.length + employeeNotifications.filter(n => n.status === 'pending_review').length,
    Development: projects.filter(p => p.type !== 'Graphic' && ['Allocated', 'Pending', 'Waiting', 'In Progress', 'Client Feedback', 'Testing', 'Working'].includes(p.status)).length,
    Strategies: calculateStrategyBadge(),
    'Content Studio': calculateContentBadge(),
    'Internal Hub': hubIssues.filter(i => i.status === 'Open').length +
                  hubResourceRequests.filter(r => r.status === 'Pending').length +
                  hubImprovements.filter(imp => imp.status === 'Submitted').length +
                  hubSuggestions.filter(s => s.status === 'New').length
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
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-2 md:p-3 rounded-2xl hover:bg-red-50 hover:text-red-600 text-slate-500 hover:border-red-150 border border-slate-100 shadow-sm bg-white transition-all flex items-center justify-center cursor-pointer"
            >
              <LogOut size={20} />
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

      {/* Global Admin Revenue Risk Monitor */}
      <RiskMonitorModal paymentAlerts={paymentAlerts} />
    </div>
  );
};

export default App;
