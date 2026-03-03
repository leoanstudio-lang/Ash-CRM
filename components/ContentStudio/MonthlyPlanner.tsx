import React, { useState } from 'react';
import { ContentMonth, ContentCard } from '../../types';
import { db } from '../../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { CalendarDays, Plus, Target, ChevronRight } from 'lucide-react';
import MonthDetail from './MonthDetail';

interface MonthlyPlannerProps {
    months: ContentMonth[];
    cards: ContentCard[];
}

const MonthlyPlanner: React.FC<MonthlyPlannerProps> = ({ months, cards }) => {
    const [selectedMonth, setSelectedMonth] = useState<ContentMonth | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    // Form state for new month
    const [newMonthStr, setNewMonthStr] = useState("March");
    const [newYearStr, setNewYearStr] = useState("2026");
    const [targetVideos, setTargetVideos] = useState("8");
    const [objective, setObjective] = useState<'Lead Generation' | 'Authority Building' | 'Journey Documentation' | 'Sales Conversion'>('Lead Generation');
    const [targetLeads, setTargetLeads] = useState("10");

    const availableMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const availableYears = ["2026", "2027", "2028", "2029", "2030"];

    const handleCreateMonth = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const newDoc: Omit<ContentMonth, 'id'> = {
                month: newMonthStr,
                year: parseInt(newYearStr),
                targetVideos: parseInt(targetVideos) || 0,
                objective: objective,
                targetLeads: parseInt(targetLeads) || 0,
                createdAt: new Date().toISOString()
            };

            // Note: the `id` will come back from Firebase in the real listener loop
            // For immediate local feedback, the subscription handles rendering.
            await addDoc(collection(db, 'contentMonths'), newDoc);
            setIsCreating(false);
        } catch (error) {
            console.error("Error creating content month:", error);
        }
    };

    if (selectedMonth) {
        return (
            <MonthDetail
                month={selectedMonth}
                cards={cards.filter(c => c.monthId === selectedMonth.id)}
                onBack={() => setSelectedMonth(null)}
            />
        );
    }

    return (
        <div className="p-6 lg:p-10">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">Monthly Planner</h3>
                    <p className="text-slate-500 font-medium">Select a month to plan strategies and manage the pipeline.</p>
                </div>
                {!isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 px-5 py-3 bg-rose-600 text-white rounded-2xl font-bold hover:bg-rose-700 shadow-md transition-all text-sm"
                    >
                        <Plus size={18} /> Initialize Month
                    </button>
                )}
            </div>

            {isCreating && (
                <div className="bg-white rounded-3xl p-8 mb-8 shadow-sm border border-slate-200 animate-in slide-in-from-top-4">
                    <h4 className="text-xl font-black text-slate-800 mb-6">Create Content Plan</h4>
                    <form onSubmit={handleCreateMonth} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                            <div className="lg:col-span-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Month</label>
                                <select
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                                    value={newMonthStr}
                                    onChange={(e) => setNewMonthStr(e.target.value)}
                                >
                                    {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            <div className="lg:col-span-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Year</label>
                                <select
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                                    value={newYearStr}
                                    onChange={(e) => setNewYearStr(e.target.value)}
                                >
                                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div className="lg:col-span-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target Videos</label>
                                <input
                                    type="number"
                                    min="1"
                                    required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                                    value={targetVideos}
                                    onChange={(e) => setTargetVideos(e.target.value)}
                                />
                            </div>
                            <div className="lg:col-span-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target Leads</label>
                                <input
                                    type="number"
                                    min="0"
                                    required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                                    value={targetLeads}
                                    onChange={(e) => setTargetLeads(e.target.value)}
                                />
                            </div>
                            <div className="lg:col-span-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Objective</label>
                                <select
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                                    value={objective}
                                    onChange={(e) => setObjective(e.target.value as any)}
                                >
                                    <option value="Lead Generation">Lead Generation</option>
                                    <option value="Authority Building">Authority Building</option>
                                    <option value="Journey Documentation">Journey Doc.</option>
                                    <option value="Sales Conversion">Sales Conversion</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setIsCreating(false)}
                                className="px-6 py-3 font-bold text-slate-500 hover:text-slate-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-8 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-md shadow-rose-600/20"
                            >
                                Start Month Plan
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {months
                    .sort((a, b) => new Date(`${b.month} 1, ${b.year}`).getTime() - new Date(`${a.month} 1, ${a.year}`).getTime())
                    .map(month => {
                        const monthCards = cards.filter(c => c.monthId === month.id);
                        const published = monthCards.filter(c => c.status === 'Posted').length;
                        const pct = month.targetVideos > 0 ? Math.min((published / month.targetVideos) * 100, 100) : 0;

                        return (
                            <div
                                key={month.id}
                                onClick={() => setSelectedMonth(month)}
                                className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all group relative overflow-hidden"
                            >
                                <div
                                    className="absolute bottom-0 left-0 h-1.5 bg-rose-500 transition-all duration-1000 ease-out"
                                    style={{ width: `${pct}%` }}
                                />

                                <div className="flex justify-between items-start mb-6">
                                    <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 font-black text-slate-800 text-lg flex items-center gap-2">
                                        <CalendarDays size={18} className="text-rose-500" />
                                        {month.month} {month.year}
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-rose-50 group-hover:text-rose-600 transition-colors">
                                        <ChevronRight size={18} className="translate-x-0 group-hover:translate-x-0.5 transition-transform" />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-end border-b border-slate-50 pb-4">
                                        <div>
                                            <span className="block text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">Target Videos</span>
                                            <span className="font-bold text-slate-800">{month.targetVideos}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-[10px] uppercase font-black tracking-widest text-emerald-500 mb-1">Published</span>
                                            <span className="font-bold text-emerald-600">{published}</span>
                                        </div>
                                    </div>

                                    <div>
                                        <span className="block text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">Core Objective</span>
                                        <div className="flex items-center gap-2 font-bold text-sm text-indigo-700 bg-indigo-50 px-2 py-1 rounded inline-flex">
                                            <Target size={14} />
                                            {month.objective}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                {months.length === 0 && !isCreating && (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400">
                        <CalendarDays size={48} className="mb-4 opacity-20" />
                        <h4 className="text-lg font-black text-slate-600">No Content Plans Active</h4>
                        <p className="font-bold mt-2 text-sm text-center max-w-sm">Create your first monthly execution block to start building out your content engine.</p>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl font-bold hover:bg-rose-100 transition-colors text-sm"
                        >
                            <Plus size={18} /> Initialize Month
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MonthlyPlanner;
