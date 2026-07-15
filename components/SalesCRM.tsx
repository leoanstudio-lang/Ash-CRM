import React from 'react';
import { Lead, Client, Service, Campaign, Channel, Quotation, Employee } from '../types';
import SalesDashboard from './SalesDashboard';
import SalesInbound from './SalesInbound';
import SalesOutbound from './SalesOutbound';
import SalesIncentives from './SalesIncentives';

interface SalesCRMProps {
    leads: Lead[];
    setLeads?: React.Dispatch<React.SetStateAction<Lead[]>>;
    setClients?: React.Dispatch<React.SetStateAction<Client[]>>;
    services: Service[];
    campaigns?: Campaign[];

    // Outbound Engine Data
    campaignProspects?: any[];
    campaignSequences?: any[];
    activeDeals?: any[];
    nurturingLeads?: any[];
    noResponseLeads?: any[];
    suppressedLeads?: any[];
    channels: Channel[];

    // Inbound Engine Data
    inboundSources?: any[];
    inboundLeads?: any[];
    inboundActiveDeals?: any[];
    inboundNurturing?: any[];
    inboundNoResponseLeads?: any[];
    inboundSuppressedLeads?: any[];

    // Auto-open logic
    autoOpenProspectId?: string | null;
    autoOpenTab?: 'dashboard' | 'inbound' | 'outbound';
    onClearAutoOpen?: () => void;
    departments?: string[]; // Dynamic list of departments for routing
    quotations?: Quotation[];
    currentUser?: Employee;
    employees?: Employee[];
}

const SalesCRM: React.FC<SalesCRMProps> = ({
    leads, setLeads, setClients, services, campaigns,
    campaignProspects = [], campaignSequences = [], activeDeals = [], nurturingLeads = [], noResponseLeads = [], suppressedLeads = [], channels,
    inboundSources = [], inboundLeads = [], inboundActiveDeals = [], inboundNurturing = [], inboundNoResponseLeads = [], inboundSuppressedLeads = [],
    autoOpenProspectId, autoOpenTab, onClearAutoOpen,
    departments = ['Development', 'Graphics Designing', 'Marketing'],
    quotations = [],
    currentUser,
    employees = []
}) => {
    const [activeTab, setActiveTab] = React.useState<'dashboard' | 'inbound' | 'outbound'>(autoOpenTab || 'dashboard');
    const [adminActiveTab, setAdminActiveTab] = React.useState<'dashboard' | 'incentives'>('dashboard');
    const [inspectedEmployee, setInspectedEmployee] = React.useState<Employee | null>(null);

    React.useEffect(() => {
        if (autoOpenTab) {
            setActiveTab(autoOpenTab);
        }
    }, [autoOpenTab]);

    // Check if the current user is a sales representative (employee role and sales department)
    const isSalesEmployee = currentUser && currentUser.role === 'employee' && currentUser.department?.toLowerCase().includes('sales');
    const isAdmin = !currentUser || currentUser.role === 'admin' || currentUser.role === 'super_admin';
    const showTabs = isSalesEmployee || !!inspectedEmployee;
    const showAdminTabs = isAdmin && !inspectedEmployee;

    React.useEffect(() => {
        if (!showTabs) {
            setActiveTab('dashboard');
        }
    }, [showTabs]);

    // The active representative we filter data for (either the inspected employee or the logged-in rep)
    const activeRep = inspectedEmployee || (isSalesEmployee ? currentUser : null);

    // Filter lists for the logged-in or inspected Sales Employee
    const filteredProspects = React.useMemo(() => {
        if (!activeRep) return campaignProspects;
        return campaignProspects.filter(p => p.assignedEmployeeId === activeRep.id);
    }, [campaignProspects, activeRep]);

    const filteredActiveDeals = React.useMemo(() => {
        if (!activeRep) return activeDeals;
        return activeDeals.filter(d => d.assignedEmployeeId === activeRep.id);
    }, [activeDeals, activeRep]);

    const filteredNurturingLeads = React.useMemo(() => {
        if (!activeRep) return nurturingLeads;
        return nurturingLeads.filter(l => l.assignedEmployeeId === activeRep.id);
    }, [nurturingLeads, activeRep]);

    const filteredNoResponseLeads = React.useMemo(() => {
        if (!activeRep) return noResponseLeads;
        return noResponseLeads.filter(l => l.assignedEmployeeId === activeRep.id);
    }, [noResponseLeads, activeRep]);

    const filteredSuppressedLeads = React.useMemo(() => {
        if (!activeRep) return suppressedLeads;
        return suppressedLeads.filter(l => l.assignedEmployeeId === activeRep.id);
    }, [suppressedLeads, activeRep]);

    const filteredInboundLeads = React.useMemo(() => {
        if (!activeRep) return inboundLeads;
        return inboundLeads.filter(l => l.assignedEmployeeId === activeRep.id);
    }, [inboundLeads, activeRep]);

    const filteredInboundActiveDeals = React.useMemo(() => {
        if (!activeRep) return inboundActiveDeals;
        return inboundActiveDeals.filter(d => d.assignedEmployeeId === activeRep.id);
    }, [inboundActiveDeals, activeRep]);

    const filteredInboundNurturing = React.useMemo(() => {
        if (!activeRep) return inboundNurturing;
        return inboundNurturing.filter(l => l.assignedEmployeeId === activeRep.id);
    }, [inboundNurturing, activeRep]);

    const filteredInboundNoResponseLeads = React.useMemo(() => {
        if (!activeRep) return inboundNoResponseLeads;
        return inboundNoResponseLeads.filter(l => l.assignedEmployeeId === activeRep.id);
    }, [inboundNoResponseLeads, activeRep]);

    const filteredInboundSuppressedLeads = React.useMemo(() => {
        if (!activeRep) return inboundSuppressedLeads;
        return inboundSuppressedLeads.filter(l => l.assignedEmployeeId === activeRep.id);
    }, [inboundSuppressedLeads, activeRep]);

    const filteredLeads = React.useMemo(() => {
        if (!activeRep) return leads;
        return leads.filter(l => l.assignedEmployeeId === activeRep.id);
    }, [leads, activeRep]);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Inspection mode banner */}
            {inspectedEmployee && (
                <div className="bg-blue-50 border border-blue-200 rounded-3xl p-5 flex justify-between items-center animate-in slide-in-from-top-4 duration-300 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-extrabold text-sm">
                            🔍
                        </div>
                        <div>
                            <p className="text-xs font-black text-slate-805">Inspection Mode Active</p>
                            <p className="text-[10px] text-slate-500 font-bold">You are viewing the exact workspace and pipeline of: <span className="text-blue-600 font-black">{inspectedEmployee.name}</span></p>
                        </div>
                    </div>
                    <button
                        onClick={() => setInspectedEmployee(null)}
                        className="px-4 py-2.5 bg-blue-650 text-white text-xs font-bold rounded-xl shadow hover:bg-blue-700 transition-all border border-blue-700"
                    >
                        Exit Inspection
                    </button>
                </div>
            )}

            {/* Top Navigation Router */}
            {showTabs && (
                <div className="flex p-1.5 bg-slate-100 rounded-2xl w-fit">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'dashboard'
                            ? 'bg-white text-blue-600 shadow-sm border border-slate-200/60'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                            }`}
                    >
                        Dashboard
                    </button>
                    <button
                        onClick={() => setActiveTab('inbound')}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'inbound'
                            ? 'bg-white text-blue-600 shadow-sm border border-slate-200/60'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                            }`}
                    >
                        Inbound
                    </button>
                    <button
                        onClick={() => setActiveTab('outbound')}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'outbound'
                            ? 'bg-white text-blue-600 shadow-sm border border-slate-200/60'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                            }`}
                    >
                        Outbound
                    </button>
                </div>
            )}

            {/* Admin Payout & Incentive Navigation */}
            {showAdminTabs && (
                <div className="flex p-1.5 bg-slate-100 rounded-2xl w-fit">
                    <button
                        onClick={() => setAdminActiveTab('dashboard')}
                        className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${adminActiveTab === 'dashboard'
                            ? 'bg-slate-800 text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                            }`}
                    >
                        Dashboard
                    </button>
                    <button
                        onClick={() => setAdminActiveTab('incentives')}
                        className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${adminActiveTab === 'incentives'
                            ? 'bg-slate-800 text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                            }`}
                    >
                        Incentives
                    </button>
                </div>
            )}

            {/* Render Active View */}
            <div className="transition-all">
                {showAdminTabs && adminActiveTab === 'incentives' ? (
                    <SalesIncentives
                        employees={employees}
                        activeDeals={activeDeals}
                        inboundActiveDeals={inboundActiveDeals}
                        campaigns={campaigns}
                    />
                ) : (
                    <>
                        {activeTab === 'dashboard' && (
                            <SalesDashboard
                                leads={filteredLeads}
                                setLeads={setLeads}
                                setClients={setClients}
                                services={services}
                                campaigns={campaigns}
                                campaignProspects={filteredProspects}
                                activeDeals={filteredActiveDeals}
                                nurturingLeads={filteredNurturingLeads}
                                noResponseLeads={filteredNoResponseLeads}
                                suppressedLeads={filteredSuppressedLeads}
                                inboundSources={inboundSources}
                                inboundLeads={filteredInboundLeads}
                                inboundActiveDeals={filteredInboundActiveDeals}
                                inboundNurturing={filteredInboundNurturing}
                                inboundNoResponseLeads={filteredInboundNoResponseLeads}
                                inboundSuppressedLeads={filteredInboundSuppressedLeads}
                                currentUser={activeRep || undefined}
                                employees={employees}
                                onInspectEmployee={setInspectedEmployee}
                            />
                        )}
                        {activeTab === 'inbound' && (
                            <SalesInbound
                                leads={filteredLeads} setLeads={setLeads} setClients={setClients}
                                services={services} campaigns={campaigns}
                                inboundSources={inboundSources} inboundLeads={filteredInboundLeads}
                                inboundActiveDeals={filteredInboundActiveDeals} inboundNurturing={filteredInboundNurturing}
                                inboundNoResponseLeads={filteredInboundNoResponseLeads}
                                inboundSuppressedLeads={filteredInboundSuppressedLeads}
                                channels={channels}
                                autoOpenProspectId={autoOpenProspectId}
                                onClearAutoOpen={onClearAutoOpen}
                                departments={departments}
                                quotations={quotations}
                                currentUser={activeRep || undefined}
                                employees={employees}
                            />
                        )}
                        {activeTab === 'outbound' && (
                            <SalesOutbound
                                leads={filteredLeads} setLeads={setLeads} setClients={setClients}
                                services={services} campaigns={campaigns}
                                campaignProspects={filteredProspects} campaignSequences={campaignSequences} activeDeals={filteredActiveDeals}
                                nurturingLeads={filteredNurturingLeads} noResponseLeads={filteredNoResponseLeads}
                                suppressedLeads={filteredSuppressedLeads} channels={channels}
                                autoOpenProspectId={autoOpenProspectId}
                                onClearAutoOpen={onClearAutoOpen}
                                departments={departments}
                                quotations={quotations}
                                currentUser={activeRep || undefined}
                                employees={employees}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default SalesCRM;
