import React, { useState } from 'react';
import { ContentMonth, ContentCard } from '../../types';
import { Target, Flag, BarChart3, LayoutGrid, CalendarDays, Plus, GripVertical, MessageSquare } from 'lucide-react';
import ContentCardModal from './ContentCardModal';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface MonthDetailProps {
    month: ContentMonth;
    cards: ContentCard[];
    onBack: () => void;
}

const MonthDetail: React.FC<MonthDetailProps> = ({ month, cards, onBack }) => {
    const [viewMode, setViewMode] = useState<'calendar' | 'pipeline'>('pipeline');

    // Metrics for Consistency Tracker
    const totalPlanned = month.targetVideos;
    const totalPosted = cards.filter(c => c.status === 'Posted').length;
    const completionPct = totalPlanned > 0 ? (totalPosted / totalPlanned) * 100 : 0;

    // For weeks completed, logic based on simple 4-week split.
    const weeklyTarget = totalPlanned > 0 ? Math.ceil(totalPlanned / 4) : 0;

    // Evaluate cards posted by week relative to the month. 
    // This requires parsing `postingDate`. We'll simplify this logic.
    const postedDates = cards.filter(c => c.status === 'Posted' && c.postingDate).map(c => new Date(c.postingDate));

    // Simple logic to count active weeks
    const weeksActive = new Set();
    postedDates.forEach(d => {
        const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
        const weekNum = Math.ceil((d.getDate() + firstDay) / 7);
        weeksActive.add(weekNum);
    });

    // If they were supposed to hit `weeklyTarget` each week, checking 'weeks completed' is hard without complex logic.
    // For MVP, we will count how many unique weeks they posted *something*.
    const weeksCompleted = weeksActive.size;
    const currentWeekInMonth = 4; // Placeholder for UI
    const missedWeeks = Math.max(0, currentWeekInMonth - weeksCompleted);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCard, setEditingCard] = useState<ContentCard | null>(null);
    const [prefilledDate, setPrefilledDate] = useState<string | null>(null);

    const handleEditCard = (card: ContentCard) => {
        setPrefilledDate(null);
        setEditingCard(card);
        setIsModalOpen(true);
    };

    const handleNewCard = () => {
        setPrefilledDate(null);
        setEditingCard(null);
        setIsModalOpen(true);
    };

    const handleNewCardWithDate = (dateStr: string) => {
        setEditingCard(null);
        setPrefilledDate(dateStr);
        setIsModalOpen(true);
    };

    // Drag & Drop Kanban Logic
    const handleDragStart = (e: React.DragEvent, cardId: string) => {
        e.dataTransfer.setData('cardId', cardId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent, newStatus: string) => {
        e.preventDefault();
        const cardId = e.dataTransfer.getData('cardId');
        if (!cardId) return;

        const cardRef = doc(db, 'contentCards', cardId);
        try {
            await updateDoc(cardRef, { status: newStatus });
        } catch (error) {
            console.error("Error updating card status:", error);
        }
    };

    const PIPELINE_STAGES = ['Idea', 'Scripted', 'Recorded', 'Edited', 'Posted'] as const;

    // Calendar Generation
    const year = month.year;
    const monthIndex = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].indexOf(month.month);

    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, monthIndex, 1).getDay(); // 0 (Sun) to 6 (Sat)

    const calendarDays = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
        calendarDays.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
        calendarDays.push(i);
    }

    return (
        <div className="p-6 lg:p-10 animate-in fade-in slide-in-from-right-8 duration-300">
            {/* Header / Nav */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                <div>
                    <button
                        onClick={onBack}
                        className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-800 transition-colors"
                    >
                        &larr; Back to Planner
                    </button>
                    <h3 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        {month.month} {month.year}
                        <span className="bg-rose-100 text-rose-700 text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest">Active</span>
                    </h3>
                </div>
                <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                    <button
                        onClick={() => setViewMode('calendar')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${viewMode === 'calendar' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <CalendarDays size={16} /> Calendar
                    </button>
                    <button
                        onClick={() => setViewMode('pipeline')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${viewMode === 'pipeline' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <LayoutGrid size={16} /> Pipeline
                    </button>
                </div>
            </div>

            {/* Top Section: Goals & Consistency Tracker */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
                {/* Monthly Goals */}
                <div className="lg:col-span-2 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <Target size={120} />
                    </div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2 relative z-10">
                        <Flag size={14} className="text-indigo-500" />
                        Core Objectives
                    </h4>

                    <div className="grid grid-cols-3 gap-4 relative z-10">
                        <div>
                            <span className="block text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">Target Videos</span>
                            <span className="text-3xl font-black text-slate-700">{month.targetVideos}</span>
                        </div>
                        <div>
                            <span className="block text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">Target Leads</span>
                            <span className="text-3xl font-black text-emerald-600">{month.targetLeads}</span>
                        </div>
                        <div>
                            <span className="block text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">Main Focus</span>
                            <span className="inline-flex items-center bg-indigo-50 text-indigo-700 text-sm font-bold px-3 py-1 rounded-xl mt-1">
                                {month.objective}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Consistency Tracker */}
                <div className="bg-slate-800 rounded-3xl p-8 shadow-md border border-slate-700 text-white relative overflow-hidden">
                    <h4 className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-6 flex items-center gap-2 relative z-10">
                        <BarChart3 size={14} />
                        Consistency Score
                    </h4>

                    <div className="flex items-end gap-2 mb-4 relative z-10">
                        <span className="text-4xl font-black text-white">{completionPct.toFixed(0)}%</span>
                        <span className="text-slate-400 font-bold mb-1">Completed</span>
                    </div>

                    <div className="w-full bg-slate-700 rounded-full h-2 mb-6 relative z-10">
                        <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                            style={{ width: `${Math.min(completionPct, 100)}%` }}
                        />
                    </div>

                    <div className="flex justify-between items-center text-sm font-bold relative z-10">
                        <span className="text-slate-300">Weeks Active: <span className="text-white">{weeksCompleted}</span></span>
                        {missedWeeks > 0 ? (
                            <span className="text-rose-400">Missed: {missedWeeks}</span>
                        ) : (
                            <span className="text-emerald-400">On Track</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Main View Area */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 min-h-[500px]">
                <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
                    <h4 className="text-lg font-black text-slate-800">
                        {viewMode === 'calendar' ? 'Content Calendar' : 'Content Pipeline'}
                    </h4>
                    <button
                        onClick={handleNewCard}
                        className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl font-bold text-sm hover:bg-rose-100 transition-colors"
                    >
                        <Plus size={16} /> New Content
                    </button>
                </div>

                {viewMode === 'calendar' ? (
                    <div className="border border-slate-100 rounded-2xl bg-white overflow-hidden shadow-sm">
                        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} className="py-3 text-center font-black text-slate-400 text-[10px] uppercase tracking-widest border-r border-slate-100 last:border-r-0">
                                    {day}
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 auto-rows-fr">
                            {calendarDays.map((day, idx) => {
                                if (day === null) {
                                    return <div key={`empty-${idx}`} className="bg-slate-50/50 border-r border-b border-slate-100 min-h-[120px]" />;
                                }

                                const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                const dayCards = cards.filter(c => c.postingDate === dateStr);

                                return (
                                    <div
                                        key={day}
                                        onClick={() => handleNewCardWithDate(dateStr)}
                                        className="min-h-[120px] p-2 border-r border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group relative flex flex-col"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-sm font-bold text-slate-500 w-6 h-6 flex items-center justify-center rounded-full group-hover:bg-rose-100 group-hover:text-rose-600 transition-colors">
                                                {day}
                                            </span>
                                            <button className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition-all p-1">
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                        <div className="flex-1 space-y-1.5 overflow-y-auto custom-scrollbar">
                                            {dayCards.map(c => (
                                                <div
                                                    key={c.id}
                                                    onClick={(e) => { e.stopPropagation(); handleEditCard(c); }}
                                                    className={`text-[10px] font-bold px-2 py-1.5 rounded truncate shadow-sm transition-transform hover:scale-[1.02] border ${c.status === 'Posted' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}
                                                    title={c.title}
                                                >
                                                    {c.title || 'Untitled'}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar min-h-[600px]">
                        {PIPELINE_STAGES.map(stage => {
                            const stageCards = cards.filter(c => c.status === stage);

                            return (
                                <div
                                    key={stage}
                                    className="flex-none w-80 bg-slate-50/80 rounded-2xl p-4 flex flex-col border border-slate-100"
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, stage)}
                                >
                                    <div className="flex justify-between items-center mb-4">
                                        <h5 className="font-black text-slate-700 uppercase tracking-widest text-xs">{stage}</h5>
                                        <div className="bg-slate-200 text-slate-500 font-bold text-xs px-2 py-0.5 rounded-full">
                                            {stageCards.length}
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                                        {stageCards.map(card => (
                                            <div
                                                key={card.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, card.id)}
                                                onClick={() => handleEditCard(card)}
                                                className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-rose-200 transition-all group"
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        <span className="w-2 h-2 rounded-full bg-indigo-500" />
                                                        <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">{card.platform}</span>
                                                    </div>
                                                    <GripVertical size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>

                                                <h6 className="font-bold text-slate-800 text-sm leading-tight mb-2">
                                                    {card.title}
                                                </h6>

                                                <div className="bg-slate-50 border border-slate-100 p-2 rounded-lg text-xs font-medium text-slate-500 italic mb-3 line-clamp-2">
                                                    "{card.hook}"
                                                </div>

                                                <div className="flex justify-between items-center pt-3 border-t border-slate-50 mt-auto">
                                                    <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
                                                        {card.type}
                                                    </span>
                                                    {(card.comments || card.views || card.leadsGenerated > 0) && (
                                                        <div className="flex items-center gap-1 text-xs font-bold text-slate-400">
                                                            <MessageSquare size={12} />
                                                            {card.comments || 0}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}

                                        {stageCards.length === 0 && (
                                            <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center text-xs font-bold text-slate-400 italic bg-white/50">
                                                Drop cards here
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <ContentCardModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                monthId={month.id}
                existingCard={editingCard}
                prefilledDate={prefilledDate}
            />
        </div>
    );
};

export default MonthDetail;
