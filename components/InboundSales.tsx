import React, { useState, useMemo, useEffect } from 'react';
import { Lead, Campaign, Employee, Service, Client } from '../types';
import { addLeadToDB, updateLeadInDB, deleteLeadFromDB, addCampaignToDB, updateCampaignInDB, addClientToDB } from '../lib/db';
import {
  BarChart3, Magnet, RadioTower, Sprout, Target,
  Plus, Search, Calendar, ChevronRight, AlertTriangle,
  Clock, CheckCircle2, TrendingUp, Download, Phone, Mail, UserPlus, FileText, X
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SalesCRMProps {
  leads: Lead[];
  campaigns?: Campaign[];
  employees: Employee[];
  services: Service[];
}

type TabName = 'dashboard' | 'inbound' | 'outbound' | 'nurturing' | 'action';

const PROBABILITIES = {
  'New Prospect': 0.1,
  'Contacted': 0.2,
  'Qualified': 0.4,
  'Proposal Sent': 0.6,
  'Negotiation': 0.8,
  'Closed Won': 1.0,
  'Closed Lost': 0.0
};

export default function SalesCRM({ leads, campaigns = [], employees, services }: SalesCRMProps) {
  const [activeTab, setActiveTab] = useState<TabName>('dashboard');
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  const [showAddLead, setShowAddLead] = useState(false);
  const [showAddCampaign, setShowAddCampaign] = useState(false);

  // Form states
  const [leadForm, setLeadForm] = useState<Partial<Lead>>({
    name: '', mobile: '', email: '', projectName: '', type: 'Inbound', source: 'Website', status: 'New Prospect', value: 0
  });

  const [campaignForm, setCampaignForm] = useState<Partial<Campaign>>({
    name: '', targetRegion: '', channel: 'Email', status: 'Active', campaignCost: 0
  });

  // Initialize Google Contacts client
  useEffect(() => {
    import('../lib/googleContacts').then(({ initGoogleClient }) => {
      initGoogleClient((token) => {
        setGoogleToken(token);
      });
    });
  }, []);

  // --- Helpers for SLA & Forecasting ---
  const calculateDaysInStage = (dateString: string) => {
    if (!dateString) return 0;
    const diff = new Date().getTime() - new Date(dateString).getTime();
    return Math.floor(diff / (1000 * 3600 * 24));
  };

  const getWeightedValue = (lead: Lead) => {
    const prob = PROBABILITIES[lead.status] || 0;
    return (lead.value || 0) * prob;
  };

  // Auto lead scorer utility
  const recalculateLeadScore = async (lead: Lead, action: 'replied' | 'interested' | 'proposal' | 'no_response' | 'missed_followup') => {
    let current = lead.leadScore || 0;
    if (action === 'replied') current += 10;
    if (action === 'interested') current += 20;
    if (action === 'proposal') current += 15;
    if (action === 'no_response') current -= 5;
    if (action === 'missed_followup') current -= 10;

    await updateLeadInDB(lead.id, { leadScore: current });
  };

  // The critical manual Google Sync action that forcefully converts to Client
  const handleSaveToGoogleAndConvert = async (lead: Lead) => {
    if (!googleToken) {
      import('../lib/googleContacts').then(({ requestGoogleToken }) => {
        requestGoogleToken();
      });
      return;
    }

    try {
      const { saveContactToGoogle } = await import('../lib/googleContacts');
      const resourceName = await saveContactToGoogle(googleToken, {
        firstName: lead.name,
        email: lead.email,
        phone: lead.mobile,
        company: lead.projectName,
        jobTitle: 'Client'
      });

      console.log('Synced to Google Contacts:', resourceName);

      // 1. Create native Client record in Client DB
      const clientPayload: Omit<Client, 'id'> = {
        name: lead.name,
        companyName: lead.projectName || 'Unknown Company',
        mobile: lead.mobile,
        email: lead.email,
        serviceEnquired: lead.source || 'Converted from CRM',
        dateAdded: new Date().toISOString().split('T')[0],
        status: 'Active'
      };
      await addClientToDB(clientPayload);

      // 2. Update the Lead to Closed Won & log sync (or we could delete it, but closing preserves forecasting)
      await updateLeadInDB(lead.id, {
        googleResourceName: resourceName,
        status: 'Closed Won',
        stageEnteredAt: new Date().toISOString()
      });

      alert('Successfully synced to Google Contacts and converted formally to Client DB!');
    } catch (e) {
      console.error(e);
      alert('Failed to sync. Please ensure popups are allowed for Google Login.');
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    const newLead = {
      ...leadForm,
      leadScore: 0,
      isNurturing: false,
      stageEnteredAt: new Date().toISOString(),
      dateAdded: new Date().toISOString().split('T')[0],
      daysInStage: 0,
      nextFollowUp: new Date().toISOString().split('T')[0]
    } as Omit<Lead, 'id'>;
    await addLeadToDB(newLead);
    setShowAddLead(false);
    setLeadForm({ name: '', mobile: '', email: '', projectName: '', type: 'Inbound', source: 'Website', status: 'New Prospect', value: 0 });
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    const newCamp = {
      ...campaignForm,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
    } as Omit<Campaign, 'id'>;
    await addCampaignToDB(newCamp);
    setShowAddCampaign(false);
    setCampaignForm({ name: '', targetRegion: '', channel: 'Email', status: 'Active', campaignCost: 0 });
  };

  // --- Render Tabs ---
  return (
    <div className="space-y-6">

      {/* Top Main Navigation */}
      <div className="flex overflow-x-auto hide-scrollbar gap-2 p-1 bg-white border border-slate-200 rounded-2xl shadow-sm">
        <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
          <BarChart3 size={18} /> Dashboard
        </button>
        <button onClick={() => setActiveTab('inbound')} className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'inbound' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:bg-slate-50'}`}>
          <Magnet size={18} /> Inbound Funnel
        </button>
        <button onClick={() => setActiveTab('outbound')} className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'outbound' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-slate-500 hover:bg-slate-50'}`}>
          <RadioTower size={18} /> Outbound Engine
        </button>
        <button onClick={() => setActiveTab('nurturing')} className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'nurturing' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:bg-slate-50'}`}>
          <Sprout size={18} /> Nurturing Center
        </button>
        <button onClick={() => setActiveTab('action')} className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'action' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'text-slate-500 hover:bg-slate-50'}`}>
          <Target size={18} /> Action Desk
        </button>

        <div className="flex-1" />
        <button onClick={() => setShowAddCampaign(true)} className="flex items-center gap-2 px-5 py-3 bg-amber-100 text-amber-700 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-amber-200 transition-colors whitespace-nowrap">
          <RadioTower size={18} /> New Campaign
        </button>
        <button onClick={() => setShowAddLead(true)} className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 whitespace-nowrap">
          <Plus size={18} /> Add Lead
        </button>
      </div>

      {activeTab === 'dashboard' && <DashboardTab leads={leads} campaigns={campaigns} employees={employees} />}
      {activeTab === 'inbound' && <InboundTab leads={leads} employees={employees} handleSync={handleSaveToGoogleAndConvert} />}
      {activeTab === 'outbound' && <OutboundTab leads={leads} campaigns={campaigns} employees={employees} services={services} handleSync={handleSaveToGoogleAndConvert} />}
      {activeTab === 'nurturing' && <NurturingTab leads={leads} handleSync={handleSaveToGoogleAndConvert} />}
      {activeTab === 'action' && <ActionTab leads={leads} handleSync={handleSaveToGoogleAndConvert} />}

      {/* --- ADD LEAD MODAL --- */}
      {showAddLead && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <Plus className="text-blue-600" /> New Pipeline Lead
              </h2>
              <button type="button" onClick={() => setShowAddLead(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors"><X size={20} className="text-slate-500" /></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form id="add-lead-form" onSubmit={handleCreateLead} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Type</label>
                  <select required value={leadForm.type} onChange={(e) => setLeadForm({ ...leadForm, type: e.target.value as 'Inbound' | 'Outbound' })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all">
                    <option value="Inbound">Inbound</option>
                    <option value="Outbound">Outbound</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Source / Channel</label>
                  <select required value={leadForm.source} onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value as any })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all">
                    <option value="Website">Website</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Referral">Referral</option>
                    <option value="Call">Call</option>
                    <option value="Social Media">Social Media</option>
                    <option value="LinkedIn Campaign">LinkedIn Campaign</option>
                    <option value="Email Campaign">Email Campaign</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {leadForm.type === 'Outbound' && (
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Link to Campaign</label>
                    <select value={leadForm.campaignId || ''} onChange={(e) => setLeadForm({ ...leadForm, campaignId: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all">
                      <option value="">Select a Campaign (Optional)</option>
                      {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="space-y-2 col-span-full">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Project/Company Name</label>
                  <input required type="text" value={leadForm.projectName} onChange={(e) => setLeadForm({ ...leadForm, projectName: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" placeholder="Enter business name" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Contact Person</label>
                  <input required type="text" value={leadForm.name} onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" placeholder="John Doe" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Phone (WhatsApp)</label>
                  <input required type="text" value={leadForm.mobile} onChange={(e) => setLeadForm({ ...leadForm, mobile: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" placeholder="+1234567890" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Email Address</label>
                  <input type="email" value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" placeholder="john@example.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Estimated Value (₹)</label>
                  <input required type="number" value={leadForm.value || ''} onChange={(e) => setLeadForm({ ...leadForm, value: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" placeholder="100000" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Status</label>
                  <select required value={leadForm.status} onChange={(e) => setLeadForm({ ...leadForm, status: e.target.value as any })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all">
                    {Object.keys(PROBABILITIES).map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </form>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 rounded-b-[2rem]">
              <button type="button" onClick={() => setShowAddLead(false)} className="px-6 py-3 rounded-xl text-sm font-black text-slate-600 hover:bg-slate-200 transition-colors uppercase tracking-widest">Cancel</button>
              <button type="submit" form="add-lead-form" className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">Add Lead</button>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD CAMPAIGN MODAL --- */}
      {showAddCampaign && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-amber-50/50">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <RadioTower className="text-amber-500" /> Launch Campaign
              </h2>
              <button type="button" onClick={() => setShowAddCampaign(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors"><X size={20} className="text-slate-500" /></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form id="add-campaign-form" onSubmit={handleCreateCampaign} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Campaign Name</label>
                  <input required type="text" value={campaignForm.name} onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all" placeholder="e.g. Q3 Dubai Outreach" />
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Target Region</label>
                    <input required type="text" value={campaignForm.targetRegion} onChange={(e) => setCampaignForm({ ...campaignForm, targetRegion: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all" placeholder="e.g. UAE" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Channel</label>
                    <select required value={campaignForm.channel} onChange={(e) => setCampaignForm({ ...campaignForm, channel: e.target.value as any })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all">
                      <option value="Email">Email</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="LinkedIn">LinkedIn</option>
                      <option value="FB">FB Ads</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Estimated Cost (₹)</label>
                  <input required type="number" value={campaignForm.campaignCost || ''} onChange={(e) => setCampaignForm({ ...campaignForm, campaignCost: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all" placeholder="50000" />
                </div>
              </form>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 rounded-b-[2rem]">
              <button type="button" onClick={() => setShowAddCampaign(false)} className="px-6 py-3 rounded-xl text-sm font-black text-slate-600 hover:bg-slate-200 transition-colors uppercase tracking-widest">Cancel</button>
              <button type="submit" form="add-campaign-form" className="px-6 py-3 bg-amber-500 text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20">Launch</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------- 
// 1. DASHBOARD TAB
// -------------------------------------------------------------
function DashboardTab({ leads, campaigns, employees }: { leads: Lead[], campaigns: Campaign[], employees: Employee[] }) {
  const activeDeals = leads.filter(l => !['Closed Won', 'Closed Lost'].includes(l.status) && !l.isNurturing);
  const totalDealValue = activeDeals.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
  const weightedValue = activeDeals.reduce((sum, l) => {
    const prob = PROBABILITIES[l.status] || 0;
    return sum + ((Number(l.value) || 0) * prob);
  }, 0);

  const closedWonCount = leads.filter(l => l.status === 'Closed Won').length;
  const closedLostCount = leads.filter(l => l.status === 'Closed Lost').length;
  const totalResolved = closedWonCount + closedLostCount;
  const conversionRate = totalResolved > 0 ? ((closedWonCount / totalResolved) * 100).toFixed(1) : '0.0';

  const exportExecutiveReport = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Executive Sales Report", 14, 22);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);

    autoTable(doc, {
      startY: 40,
      head: [['Metric', 'Value']],
      body: [
        ['Total Active Deals', activeDeals.length.toString()],
        ['Total Pipeline Value', `Rs. ${totalDealValue.toLocaleString()}`],
        ['Weighted Forecast Revenue', `Rs. ${weightedValue.toLocaleString()}`],
        ['Total Closed Won', closedWonCount.toString()],
        ['Total Closed Lost', closedLostCount.toString()],
        ['Overall Conversion Rate', `${conversionRate}%`]
      ],
      headStyles: { fillColor: [15, 23, 42], fontSize: 11, fontStyle: 'bold' }
    });

    doc.save("Executive_Sales_Report.pdf");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Executive Overview</h2>
          <p className="text-xs text-slate-500 font-medium">Pipeline visibility and revenue forecasting.</p>
        </div>
        <button onClick={exportExecutiveReport} className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20">
          <Download size={16} /> Export PDF
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Metric Cards */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5"><BarChart3 size={64} /></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Pipeline Value</p>
          <p className="text-3xl font-black text-slate-900">₹{totalDealValue.toLocaleString()}</p>
          <p className="text-xs font-bold text-slate-500 mt-2">{activeDeals.length} Active Deals</p>
        </div>
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-6 rounded-3xl border border-indigo-400 shadow-lg shadow-indigo-500/20 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={64} /></div>
          <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Weighted Forecast</p>
          <p className="text-3xl font-black text-white">₹{weightedValue.toLocaleString()}</p>
          <p className="text-xs font-bold text-indigo-100 mt-2">Adjusted by closing probability</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5"><CheckCircle2 size={64} /></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Closed Won</p>
          <p className="text-3xl font-black text-emerald-600">{closedWonCount}</p>
          <p className="text-xs font-bold text-slate-500 mt-2">{conversionRate}% Conversion Rate</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5"><AlertTriangle size={64} /></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Closed Lost</p>
          <p className="text-3xl font-black text-rose-600">{closedLostCount}</p>
          <p className="text-xs font-bold text-slate-500 mt-2">Monitor lost reasons closely</p>
        </div>
      </div>

      {/* Stage Breakdown */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm overflow-hidden">
        <h3 className="font-black text-slate-900 mb-6 uppercase tracking-widest text-xs">Pipeline Stage Mechanics</h3>
        <div className="space-y-4">
          {Object.entries(PROBABILITIES).filter(([k]) => k !== 'Closed Won' && k !== 'Closed Lost').map(([stage, prob]) => {
            const stageLeads = activeDeals.filter(l => l.status === stage);
            const stageVal = stageLeads.reduce((s, l) => s + (Number(l.value) || 0), 0);
            const stageWeighted = stageVal * prob;
            return (
              <div key={stage} className="flex items-center gap-4">
                <div className="w-32 flex-shrink-0 text-right">
                  <p className="text-xs font-black text-slate-700">{stage}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{(prob * 100).toFixed(0)}% Probability</p>
                </div>
                <div className="flex-1 bg-slate-50 h-8 rounded-xl overflow-hidden shadow-inner flex border border-slate-100">
                  <div className="h-full bg-indigo-500 flex items-center px-3" style={{ width: `${Math.max(10, (stageVal / totalDealValue) * 100 || 0)}%` }}>
                    <span className="text-[10px] font-black text-white">{stageLeads.length} deals</span>
                  </div>
                </div>
                <div className="w-40 flex-shrink-0 text-left">
                  <p className="text-xs font-black text-emerald-600">₹{stageWeighted.toLocaleString()}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Weighted Value</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- 
// 2. INBOUND TAB (Kanban)
// -------------------------------------------------------------
function InboundTab({ leads, employees, handleSync }: any) {
  const inboundLeads = leads.filter((l: Lead) => l.type === 'Inbound' && !l.isNurturing);
  const stages = ['New Prospect', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Closed Won'];

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 overflow-x-auto">
      <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-black text-slate-900">Inbound Funnel</h2>
          <p className="text-xs text-slate-500">Strict stage-to-stage flow for warm leads.</p>
        </div>
      </div>
      <div className="flex gap-4 min-w-[1200px] h-[70vh] overflow-y-auto hide-scrollbar">
        {stages.map(stage => {
          const colLeads = inboundLeads.filter((l: Lead) => l.status === stage);
          return (
            <div key={stage} className="flex-1 bg-slate-50/50 rounded-2xl p-4 border border-slate-100 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">{stage}</h3>
                <span className="bg-white text-slate-500 text-[10px] font-black px-2 py-1 rounded-lg border border-slate-200">{colLeads.length}</span>
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto hide-scrollbar pr-1">
                {colLeads.map((lead: Lead) => {
                  const daysInStage = Math.floor((new Date().getTime() - new Date(lead.stageEnteredAt || lead.dateAdded).getTime()) / (1000 * 3600 * 24));
                  const isSlaBreach = stage === 'New Prospect' && daysInStage >= 1;
                  const isStagnant = stage !== 'New Prospect' && daysInStage >= 14;

                  return (
                    <div key={lead.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-400 transition-all group cursor-pointer relative">
                      {isSlaBreach && <div className="absolute -top-2 -right-2 bg-rose-500 text-white text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full shadow-lg shadow-rose-500/20 animate-pulse">🔴 SLA Breach</div>}
                      {isStagnant && !isSlaBreach && <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full shadow-lg shadow-amber-500/20">⚠ Stagnant</div>}

                      <p className="font-black text-sm text-slate-900 group-hover:text-blue-600 transition-colors truncate">{lead.projectName}</p>
                      <p className="text-xs font-bold text-slate-500 truncate">{lead.name}</p>

                      <div className="mt-3 flex justify-between items-end">
                        <div>
                          <p className="text-lg font-black text-emerald-600 leading-none">₹{(lead.value || 0).toLocaleString()}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{daysInStage}d in stage</p>
                        </div>
                        <button onClick={() => handleSync(lead)} className="text-[10px] font-black text-white bg-blue-600 px-2 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest">Target Sync</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------- 
// 3. OUTBOUND TAB
// -------------------------------------------------------------
function OutboundTab({ leads, campaigns, employees, services, handleSync }: any) {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <h2 className="text-xl font-black text-slate-900 tracking-tight mb-6">Outbound Campaigns Engine</h2>
        <div className="space-y-4">
          {campaigns.map((camp: Campaign) => {
            const campLeads = leads.filter((l: Lead) => l.campaignId === camp.id);
            const closedWonVal = campLeads.filter((l: Lead) => l.status === 'Closed Won').reduce((s: number, l: Lead) => s + (l.value || 0), 0);
            const roi = camp.campaignCost > 0 ? (((closedWonVal - camp.campaignCost) / camp.campaignCost) * 100).toFixed(1) : 0;

            return (
              <div key={camp.id} className="border border-slate-200 rounded-2xl p-5 hover:border-amber-400 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-black text-lg text-slate-800">{camp.name}</h3>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{camp.channel} • {camp.targetRegion}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-emerald-600">{roi}% ROI</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Revenue: ₹{closedWonVal.toLocaleString()}</p>
                  </div>
                </div>
                {/* Visual mini-funnel for campaign */}
                <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <div className="bg-slate-50 px-3 py-2 rounded-xl flex-1 text-center border">Total: {campLeads.length}</div>
                  <ChevronRight size={14} className="opacity-30" />
                  <div className="bg-slate-50 px-3 py-2 rounded-xl flex-1 text-center border">Contacted: {campLeads.filter((l: Lead) => l.campaignStatus !== 'Not Contacted').length}</div>
                  <ChevronRight size={14} className="opacity-30" />
                  <div className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded-xl flex-1 text-center border border-emerald-200">Interested: {campLeads.filter((l: Lead) => l.campaignStatus === 'Interested').length}</div>
                </div>
              </div>
            );
          })}
          {campaigns.length === 0 && <p className="text-sm font-bold text-slate-500 text-center py-12">No active outbound campaigns.</p>}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- 
// 4. NURTURING TAB
// -------------------------------------------------------------
function NurturingTab({ leads, handleSync }: any) {
  const nurtured = leads.filter((l: Lead) => l.isNurturing);
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
      <h2 className="text-xl font-black text-slate-900 tracking-tight mb-2">Nurturing Center</h2>
      <p className="text-xs text-slate-500 font-medium mb-6">Long-term reactivation storage. Prevents active pipeline clutter.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {nurtured.map((l: Lead) => (
          <div key={l.id} className="p-5 border border-slate-200 rounded-2xl bg-emerald-50/30">
            <h4 className="font-black text-slate-800">{l.projectName}</h4>
            <p className="text-xs font-bold text-slate-500 mb-3">{l.name}</p>
            <div className="bg-white p-3 rounded-xl text-xs font-bold text-slate-600 border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Reason for Nurture</p>
              {l.nurtureReason || 'Not specified'}
            </div>
            <div className="mt-4 flex justify-between items-center text-[10px] font-black">
              <span className="text-slate-400">Next Follow: {l.nurtureNextFollowUp || 'TBD'}</span>
              <button onClick={() => updateLeadInDB(l.id, { isNurturing: false })} className="text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg uppercase tracking-widest border border-indigo-200 shadow-sm">Re-activate</button>
            </div>
          </div>
        ))}
        {nurtured.length === 0 && <p className="text-sm font-bold text-slate-500 col-span-full text-center py-12">No leads in nurturing currently.</p>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------- 
// 5. ACTION DESK TAB
// -------------------------------------------------------------
function ActionTab({ leads, handleSync }: any) {
  const sortedPriority = [...leads]
    .filter(l => !['Closed Won', 'Closed Lost'].includes(l.status) && !l.isNurturing)
    .sort((a, b) => (b.leadScore || 0) - (a.leadScore || 0));

  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Action Desk (Priority Leads)</h2>
          <p className="text-xs text-slate-500 font-medium">Auto-scored by intent. Work these leads first.</p>
        </div>
      </div>

      <div className="space-y-3">
        {sortedPriority.slice(0, 10).map((l: Lead, idx: number) => (
          <div key={l.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${idx < 3 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                {l.leadScore || 0}
              </div>
              <div>
                <h4 className="font-black text-slate-800">{l.projectName}</h4>
                <p className="text-xs font-bold text-slate-400">{l.name} • {l.status}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block mr-4">
                <p className="text-sm font-black text-emerald-600">₹{(l.value || 0).toLocaleString()}</p>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{l.source}</p>
              </div>
              <button className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors" title="Google Sync to Client DB" onClick={() => handleSync(l)}>
                <UserPlus size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
