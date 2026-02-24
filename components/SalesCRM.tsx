import React, { useState } from 'react';
import { Lead, Client, Service, Campaign, Channel } from '../types';
import SalesDashboard from './SalesDashboard';
import SalesInbound from './SalesInbound';
import SalesOutbound from './SalesOutbound';

interface SalesCRMProps {
    leads: Lead[];
    setLeads?: React.Dispatch<React.SetStateAction<Lead[]>>;
    setClients?: React.Dispatch<React.SetStateAction<Client[]>>;
    services: Service[];
    campaigns?: Campaign[];

    // Outbound Engine Data
    campaignProspects?: any[];
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
}

const SalesCRM: React.FC<SalesCRMProps> = ({
    leads, setLeads, setClients, services, campaigns,
    campaignProspects, activeDeals, nurturingLeads, noResponseLeads, suppressedLeads, channels,
    inboundSources, inboundLeads, inboundActiveDeals, inboundNurturing, inboundNoResponseLeads, inboundSuppressedLeads,
    autoOpenProspectId, autoOpenTab, onClearAutoOpen
}) => {
    const [activeTab, setActiveTab] = React.useState<'dashboard' | 'inbound' | 'outbound'>(autoOpenTab || 'dashboard');

    React.useEffect(() => {
        if (autoOpenTab) {
            setActiveTab(autoOpenTab);
        }
    }, [autoOpenTab]);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Top Navigation Router */}
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

            {/* Render Active View */}
            <div className="transition-all">
                {activeTab === 'dashboard' && (
                    <SalesDashboard
                        leads={leads}
                        setLeads={setLeads}
                        setClients={setClients}
                        services={services}
                        campaigns={campaigns}
                        campaignProspects={campaignProspects}
                        activeDeals={activeDeals}
                        nurturingLeads={nurturingLeads}
                        noResponseLeads={noResponseLeads}
                        suppressedLeads={suppressedLeads}
                        inboundSources={inboundSources}
                        inboundLeads={inboundLeads}
                        inboundActiveDeals={inboundActiveDeals}
                        inboundNurturing={inboundNurturing}
                        inboundNoResponseLeads={inboundNoResponseLeads}
                        inboundSuppressedLeads={inboundSuppressedLeads}
                    />
                )}
                {activeTab === 'inbound' && (
                    <SalesInbound
                        leads={leads} setLeads={setLeads} setClients={setClients}
                        services={services} campaigns={campaigns}
                        inboundSources={inboundSources} inboundLeads={inboundLeads}
                        inboundActiveDeals={inboundActiveDeals} inboundNurturing={inboundNurturing}
                        inboundNoResponseLeads={inboundNoResponseLeads}
                        inboundSuppressedLeads={inboundSuppressedLeads}
                        channels={channels}
                        autoOpenProspectId={autoOpenProspectId}
                        onClearAutoOpen={onClearAutoOpen}
                    />
                )}
                {activeTab === 'outbound' && (
                    <SalesOutbound
                        leads={leads} setLeads={setLeads} setClients={setClients}
                        services={services} campaigns={campaigns}
                        campaignProspects={campaignProspects} activeDeals={activeDeals}
                        nurturingLeads={nurturingLeads} noResponseLeads={noResponseLeads}
                        suppressedLeads={suppressedLeads} channels={channels}
                        autoOpenProspectId={autoOpenProspectId}
                        onClearAutoOpen={onClearAutoOpen}
                    />
                )}
            </div>
        </div>
    );
};

export default SalesCRM;
