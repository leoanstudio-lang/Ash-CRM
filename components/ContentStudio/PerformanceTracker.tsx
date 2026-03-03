import React, { useState } from 'react';
import { ContentCard } from '../../types';
import { TrendingUp, BarChart, ArrowUpRight, MessageSquare, Bookmark, Share2, Users, LayoutGrid } from 'lucide-react';

interface PerformanceTrackerProps {
    cards: ContentCard[];
}

const PerformanceTracker: React.FC<PerformanceTrackerProps> = ({ cards }) => {
    // Only show performance for Published/Posted cards
    const publishedCards = cards.filter(c => c.status === 'Posted')
        .sort((a, b) => new Date(b.postingDate).getTime() - new Date(a.postingDate).getTime());

    // Aggregate Stats
    const totalViews = publishedCards.reduce((acc, curr) => acc + (curr.views || 0), 0);
    const totalLeads = publishedCards.reduce((acc, curr) => acc + (curr.leadsGenerated || 0), 0);
    const totalConversions = publishedCards.filter(c => c.convertedClient === 'Yes').length;

    return (
        <div className="p-6 lg:p-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <TrendingUp className="text-emerald-500" />
                        Performance Analytics
                    </h3>
                    <p className="text-slate-500 font-medium mt-1">Measure the business impact of your content engine.</p>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 flex items-center gap-4 px-6 py-3 rounded-2xl">
                    <div className="text-right">
                        <span className="block text-[10px] uppercase font-black tracking-widest text-emerald-600 mb-0.5">Total Content Leads</span>
                        <span className="text-2xl font-black text-emerald-700">{totalLeads}</span>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-emerald-600 shadow-sm">
                        <Users size={20} />
                    </div>
                </div>
            </div>

            {/* High-Level Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-500">
                        <LayoutGrid size={24} />
                    </div>
                    <div>
                        <span className="block text-xs uppercase font-black tracking-widest text-slate-400 mb-1">Total Assets</span>
                        <span className="text-2xl font-black text-slate-800">{publishedCards.length}</span>
                    </div>
                </div>
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center border border-blue-100 text-blue-500">
                        <BarChart size={24} />
                    </div>
                    <div>
                        <span className="block text-xs uppercase font-black tracking-widest text-slate-400 mb-1">Total Views</span>
                        <span className="text-2xl font-black text-slate-800">{totalViews.toLocaleString()}</span>
                    </div>
                </div>
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center border border-indigo-100 text-indigo-500">
                        <ArrowUpRight size={24} />
                    </div>
                    <div>
                        <span className="block text-xs uppercase font-black tracking-widest text-slate-400 mb-1">Converted Clients</span>
                        <span className="text-2xl font-black text-slate-800">{totalConversions}</span>
                    </div>
                </div>
            </div>

            {/* Performance DataTable */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h4 className="font-black text-slate-800 text-lg">Asset Ledger</h4>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-xs font-black text-slate-500 uppercase tracking-widest">
                                <th className="py-4 px-6 font-black w-1/3">Asset Title</th>
                                <th className="py-4 px-6 font-black text-center">Date</th>
                                <th className="py-4 px-6 font-black text-center">Type</th>
                                <th className="py-4 px-6 font-black text-center"><BarChart size={14} className="mx-auto" /></th>
                                <th className="py-4 px-6 font-black text-center"><MessageSquare size={14} className="mx-auto" /></th>
                                <th className="py-4 px-6 font-black text-center"><Bookmark size={14} className="mx-auto" /></th>
                                <th className="py-4 px-6 font-black text-center"><Share2 size={14} className="mx-auto" /></th>
                                <th className="py-4 px-6 font-black text-center text-emerald-600">Leads</th>
                                <th className="py-4 px-6 font-black text-center text-indigo-600">Client?</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {publishedCards.map(card => {
                                // Calculate total interaction
                                const interactions = (card.comments || 0) + (card.saves || 0) + (card.shares || 0);
                                const v = card.views || 0;
                                const engagementRate = v > 0 ? ((interactions / v) * 100).toFixed(1) : '0.0';

                                return (
                                    <tr key={card.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-4 px-6">
                                            <p className="font-bold text-slate-800 text-sm leading-tight mb-1">{card.title}</p>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                                                {card.platform}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-center text-sm font-bold text-slate-500">
                                            {card.postingDate ? new Date(card.postingDate).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded inline-block whitespace-nowrap">
                                                {card.type}
                                            </span>
                                        </td>

                                        {/* Core Metrics Placeholder - currently input manually in edit mode */}
                                        <td className="py-4 px-6 text-center text-sm font-black text-blue-600">
                                            {card.views?.toLocaleString() || '-'}
                                        </td>
                                        <td className="py-4 px-6 text-center text-sm font-bold text-slate-600">
                                            {card.comments || '-'}
                                        </td>
                                        <td className="py-4 px-6 text-center text-sm font-bold text-slate-600">
                                            {card.saves || '-'}
                                        </td>
                                        <td className="py-4 px-6 text-center text-sm font-bold text-slate-600">
                                            {card.shares || '-'}
                                        </td>

                                        {/* Business Impact Metrics */}
                                        <td className="py-4 px-6 text-center text-sm font-black text-emerald-600">
                                            {card.leadsGenerated > 0 ? card.leadsGenerated : '-'}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            {card.convertedClient === 'Yes' ? (
                                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-600">
                                                    <ArrowUpRight size={14} />
                                                </span>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {publishedCards.length === 0 && (
                        <div className="py-16 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                            <BarChart size={48} className="mb-4 opacity-20" />
                            <h4 className="text-lg font-black text-slate-600">No Performance Data</h4>
                            <p className="font-bold mt-1 text-sm text-center">Metrics will appear here once you move content to "Posted" status.</p>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};

export default PerformanceTracker;
