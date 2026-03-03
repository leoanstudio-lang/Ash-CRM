import React, { useState } from 'react';
import { ExecutionTask } from '../../types';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Grid, LayoutList } from 'lucide-react';

interface CalendarBoxProps {
    tasks: ExecutionTask[];
    onTaskClick?: (task: ExecutionTask) => void;
}

type ViewMode = 'week' | 'month';

const CalendarBox: React.FC<CalendarBoxProps> = ({ tasks, onTaskClick }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<ViewMode>('week');

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const getTaskColor = (task: ExecutionTask) => {
        if (task.status === 'Completed') return 'bg-slate-100 border border-slate-200 text-slate-400 opacity-70 line-through';
        if (task.status === 'Ignored') return 'bg-slate-50 border border-slate-100 text-slate-300 opacity-50 line-through';

        switch (task.energyType) {
            case 'Deep Work': return 'bg-indigo-600 shadow-indigo-600/20 text-white hover:bg-indigo-700';
            case 'Medium Work': return 'bg-blue-500 shadow-blue-500/20 text-white hover:bg-blue-600';
            default: return 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50';
        }
    };

    // --- Date Math Helpers ---
    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const changeDate = (direction: 1 | -1) => {
        const newDate = new Date(currentDate);
        if (viewMode === 'week') {
            newDate.setDate(newDate.getDate() + (direction * 7));
        } else {
            newDate.setMonth(newDate.getMonth() + direction);
        }
        setCurrentDate(newDate);
    };

    const goToToday = () => setCurrentDate(new Date());

    const formatMonthYear = (date: Date) => {
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    // --- Weekly View Generation ---
    const getWeekDates = (date: Date) => {
        const start = new Date(date);
        start.setDate(start.getDate() - start.getDay()); // Start on Sunday

        const dates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            dates.push(d);
        }
        return dates;
    };

    const weekDates = getWeekDates(currentDate);

    // --- Monthly View Generation ---
    // Generates the grid required for a month view including padding days from prev/next month
    const generateMonthGrid = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDayIdx = getFirstDayOfMonth(year, month);

        const days = [];

        // Prev month padding
        const prevMonthDays = getDaysInMonth(year, month - 1);
        for (let i = firstDayIdx - 1; i >= 0; i--) {
            const d = new Date(year, month - 1, prevMonthDays - i);
            days.push({ date: d, isCurrentMonth: false });
        }

        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            const d = new Date(year, month, i);
            days.push({ date: d, isCurrentMonth: true });
        }

        // Next month padding to fill out 6 rows of 7 days (42 cells total)
        let nextDay = 1;
        while (days.length < 42) {
            const d = new Date(year, month + 1, nextDay++);
            days.push({ date: d, isCurrentMonth: false });
        }

        return days;
    };

    const monthGrid = generateMonthGrid(currentDate);

    // --- Render Helpers ---
    const isToday = (date: Date) => {
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    };

    const isSameDate = (date1: Date, dateString: string) => {
        const d2 = new Date(dateString);
        return date1.getDate() === d2.getDate() &&
            date1.getMonth() === d2.getMonth() &&
            date1.getFullYear() === d2.getFullYear();
    };

    const renderTaskBadge = (task: ExecutionTask, compact: boolean = false) => (
        <div
            key={task.id}
            onClick={() => onTaskClick && onTaskClick(task)}
            className={`p-1.5 md:p-2 rounded-lg mb-1.5 shadow-sm text-left truncate transition-all hover:scale-[1.02] ${onTaskClick ? 'cursor-pointer' : 'cursor-default'} ${getTaskColor(task)}`}
        >
            {compact ? (
                <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
                    <span className="font-bold truncate">{task.name}</span>
                </div>
            ) : (
                <>
                    <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest opacity-80 mb-0.5 truncate">{task.department}</p>
                    <p className="text-[10px] md:text-xs font-bold leading-tight truncate">{task.name}</p>
                </>
            )}
        </div>
    );

    return (
        <div className="bg-white p-4 md:p-6 lg:p-8 rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[700px]">

            {/* Header Controls */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 md:mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                        <CalendarIcon size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">Execution Calendar</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <h3 className="text-sm font-bold text-slate-600">{formatMonthYear(currentDate)}</h3>
                            {viewMode === 'week' && (
                                <span className="text-xs text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                                    Week {Math.ceil(currentDate.getDate() / 7)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                    {/* View Toggle */}
                    <div className="bg-slate-100 p-1 rounded-xl flex items-center shadow-inner">
                        <button
                            onClick={() => setViewMode('month')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${viewMode === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Grid size={14} /> Month
                        </button>
                        <button
                            onClick={() => setViewMode('week')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${viewMode === 'week' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <LayoutList size={14} /> Week
                        </button>
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center gap-2">
                        <button onClick={goToToday} className="px-3 py-2 text-xs font-bold hover:bg-slate-100 rounded-xl transition-colors text-slate-600">Today</button>
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                            <button onClick={() => changeDate(-1)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors">
                                <ChevronLeft size={18} />
                            </button>
                            <div className="w-px h-4 bg-slate-200"></div>
                            <button onClick={() => changeDate(1)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors">
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex gap-4 items-center mb-6 pl-2 hidden md:flex">
                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shadow-sm shadow-indigo-600/30"></span>
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Deep Work</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/30"></span>
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Medium Work</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-200 border border-slate-300"></span>
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Light Work</span>
                </div>
            </div>

            {/* Grid Container */}
            <div className="flex-1 flex flex-col min-h-0 bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-inner font-sans">
                {/* Day Headers */}
                <div className="grid grid-cols-7 border-b border-slate-200 bg-white">
                    {weekDays.map(day => (
                        <div key={day} className="py-3 text-center border-r last:border-r-0 border-slate-100">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{day}</span>
                        </div>
                    ))}
                </div>

                {/* Main Grid Area */}
                <div className="flex-1 overflow-y-auto">
                    {viewMode === 'week' ? (
                        /* --- WEEK VIEW --- */
                        <div className="grid grid-cols-7 min-h-full divide-x divide-slate-200 bg-white">
                            {weekDates.map((date, idx) => {
                                const isCurrentDay = isToday(date);
                                const dayTasks = tasks.filter(t => isSameDate(date, t.deadline));

                                return (
                                    <div key={idx} className={`p-2 min-h-[200px] flex flex-col ${isCurrentDay ? 'bg-indigo-50/30' : ''}`}>
                                        <div className="flex justify-center mb-4 mt-2">
                                            <div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold ${isCurrentDay ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-600 hover:bg-slate-100 cursor-default transition-colors'}`}>
                                                {date.getDate()}
                                            </div>
                                        </div>
                                        <div className="flex-1 space-y-1 overflow-y-auto pr-1 custom-scrollbar">
                                            {dayTasks.map(task => renderTaskBadge(task, false))}
                                            {dayTasks.length === 0 && (
                                                <div className="h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                    <span className="text-xs text-slate-300 font-medium italic">Clear</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* --- MONTH VIEW --- */
                        <div className="grid grid-cols-7 auto-rows-[minmax(120px,auto)] min-h-full divide-x divide-y divide-slate-200 border-t border-slate-200 bg-slate-50/50">
                            {monthGrid.map((cell, idx) => {
                                const isCurrentDay = isToday(cell.date);
                                const dayTasks = tasks.filter(t => isSameDate(cell.date, t.deadline));

                                return (
                                    <div key={idx} className={`min-h-[100px] md:min-h-[120px] p-1.5 flex flex-col ${cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50/80'} ${isCurrentDay ? 'bg-indigo-50/30 ring-1 ring-inset ring-indigo-200' : ''}`}>
                                        <div className="flex justify-end p-1">
                                            <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${isCurrentDay ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30' : cell.isCurrentMonth ? 'text-slate-700' : 'text-slate-400'}`}>
                                                {cell.date.getDate()}
                                            </span>
                                        </div>
                                        <div className="flex-1 space-y-0.5 mt-1 pb-2">
                                            {dayTasks.map(task => renderTaskBadge(task, true))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
            {/* Custom scrollbar styles can go here or in a global css file, inline styles for quick implementation */}
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1;
                    border-radius: 20px;
                }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb {
                    background-color: #94a3b8;
                }
            `}</style>
        </div>
    );
};

export default CalendarBox;
