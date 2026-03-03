import React, { useState } from 'react';
import { ExecutionTask } from '../../types';
import { Play, Pause, Check, Edit2, List as ListIcon, Columns, Calendar as CalendarIcon, Filter, Layers } from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface TaskCommandPanelProps {
    tasks: ExecutionTask[];
    onEditTask: (task: ExecutionTask) => void;
}

type ViewMode = 'list' | 'kanban';

const TaskCommandPanel: React.FC<TaskCommandPanelProps> = ({ tasks, onEditTask }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [filterMode, setFilterMode] = useState<'All' | 'Priority' | 'Deep Work'>('All');

    // Matrix Logic Helper
    const getMatrixCategory = (task: ExecutionTask) => {
        const today = new Date().toISOString().split('T')[0];
        const isOverdueOrToday = task.deadline <= today;
        const isHighImpact = task.priority === 'High' || task.impactType === 'Revenue';

        if (isHighImpact && isOverdueOrToday) return 'Do Now';
        if (isHighImpact && !isOverdueOrToday) return 'Schedule';
        if (!isHighImpact && isOverdueOrToday) return 'Delegate';
        return 'Ignore';
    };

    const filteredTasks = tasks.filter(t => {
        if (filterMode === 'Deep Work') return t.energyType === 'Deep Work';
        if (filterMode === 'Priority') return getMatrixCategory(t) === 'Do Now';
        return true;
    });

    const handleStatusChange = async (task: ExecutionTask, newStatus: string) => {
        try {
            const now = new Date().toISOString();
            const updates: any = { status: newStatus };

            const timeLogs = [...(task.timeLogs || [])];

            if (newStatus === 'In Progress') {
                // Start tracking
                timeLogs.push({
                    id: `log_${Date.now()}`,
                    startTime: now
                });
            } else if (task.status === 'In Progress') {
                // Stop tracking previous log
                const lastLog = timeLogs[timeLogs.length - 1];
                if (lastLog && !lastLog.endTime) {
                    lastLog.endTime = now;
                    const start = new Date(lastLog.startTime).getTime();
                    const end = new Date(now).getTime();
                    lastLog.durationSeconds = Math.floor((end - start) / 1000);

                    updates.actualTimeSeconds = (task.actualTimeSeconds || 0) + lastLog.durationSeconds;
                }
            }

            updates.timeLogs = timeLogs;

            await updateDoc(doc(db, 'executionTasks', task.id), updates);
        } catch (e) {
            console.error("Error updating task status:", e);
        }
    };

    const renderTaskCard = (task: ExecutionTask) => {
        const matrix = getMatrixCategory(task);

        return (
            <div key={task.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${matrix === 'Do Now' ? 'bg-rose-500' : matrix === 'Schedule' ? 'bg-blue-500' : matrix === 'Delegate' ? 'bg-amber-500' : 'bg-slate-300'}`}></div>
                <div className="flex justify-between items-start mb-3 pl-2">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${task.impactType === 'Revenue' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                {task.impactType}
                            </span>
                            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${task.energyType === 'Deep Work' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                                {task.energyType}
                            </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 leading-tight">{task.name}</h4>
                    </div>
                    <button onClick={() => onEditTask(task)} className="text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Edit2 size={14} />
                    </button>
                </div>

                <div className="flex items-center justify-between mt-4 pl-2">
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-slate-500">{task.department}</span>
                        <span className="text-[10px] font-bold text-slate-400">•</span>
                        <span className={`text-[10px] font-bold ${task.deadline < new Date().toISOString().split('T')[0] ? 'text-rose-500' : 'text-slate-500'}`}>{task.deadline}</span>
                    </div>

                    <div className="flex gap-2">
                        {task.status !== 'In Progress' && task.status !== 'Completed' && (
                            <button onClick={() => handleStatusChange(task, 'In Progress')} className="w-8 h-8 rounded-full bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 flex items-center justify-center transition-colors">
                                <Play size={12} className="ml-0.5" />
                            </button>
                        )}
                        {task.status === 'In Progress' && (
                            <button onClick={() => handleStatusChange(task, 'Pending')} className="w-8 h-8 rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-700 flex items-center justify-center transition-colors animate-pulse">
                                <Pause size={12} />
                            </button>
                        )}
                        {task.status !== 'Completed' && (
                            <button onClick={() => handleStatusChange(task, 'Completed')} className="w-8 h-8 rounded-full bg-slate-50 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 flex items-center justify-center transition-colors">
                                <Check size={14} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-6 md:p-8 flex flex-col h-[700px]">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                        <Layers className="text-indigo-600" /> Task Command
                    </h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Priority Matrix OS</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="bg-white rounded-xl p-1 shadow-sm border border-slate-100 flex">
                        <button onClick={() => setFilterMode('All')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${filterMode === 'All' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>All</button>
                        <button onClick={() => setFilterMode('Priority')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${filterMode === 'Priority' ? 'bg-rose-500 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>Do Now</button>
                        <button onClick={() => setFilterMode('Deep Work')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${filterMode === 'Deep Work' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>Deep Work</button>
                    </div>

                    <div className="bg-white rounded-xl p-1 shadow-sm border border-slate-100 flex hidden md:flex">
                        <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}><ListIcon size={16} /></button>
                        <button onClick={() => setViewMode('kanban')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'kanban' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}><Columns size={16} /></button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide space-y-4">
                {viewMode === 'list' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredTasks.filter(t => t.status !== 'Completed').map(renderTaskCard)}
                    </div>
                )}

                {viewMode === 'kanban' && (
                    <div className="grid grid-cols-3 gap-6 h-full">
                        {['Pending', 'In Progress', 'Completed'].map(status => (
                            <div key={status} className="bg-slate-100 rounded-2xl p-4 flex flex-col items-center">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">{status}</h3>
                                <div className="w-full space-y-3">
                                    {filteredTasks.filter(t => t.status === status).map(renderTaskCard)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskCommandPanel;
