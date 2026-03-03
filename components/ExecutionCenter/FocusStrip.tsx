import React from 'react';
import { ExecutionTask } from '../../types';
import { Target, Zap, Briefcase, AlertTriangle } from 'lucide-react';

interface FocusStripProps {
    tasks: ExecutionTask[];
}

const FocusStrip: React.FC<FocusStripProps> = ({ tasks }) => {
    const activeTasks = tasks.filter(t => t.status !== 'Completed' && t.status !== 'Ignored');
    const todayStr = new Date().toISOString().split('T')[0];

    const criticalCount = activeTasks.filter(t => t.priority === 'High').length;
    const revenueCount = activeTasks.filter(t => t.impactType === 'Revenue').length;
    const deepWorkCount = activeTasks.filter(t => t.energyType === 'Deep Work').length;
    const overdueCount = activeTasks.filter(t => t.deadline < todayStr).length;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 md:mb-8">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between transition-transform hover:-translate-y-1">
                <div>
                    <p className="text-[10px] uppercase font-black tracking-widest text-rose-500 mb-1">Critical Focus</p>
                    <h3 className="text-2xl font-black text-slate-800">{criticalCount} <span className="text-sm font-medium text-slate-400">Tasks</span></h3>
                </div>
                <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500">
                    <AlertTriangle size={24} />
                </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between transition-transform hover:-translate-y-1">
                <div>
                    <p className="text-[10px] uppercase font-black tracking-widest text-emerald-500 mb-1">Revenue Engine</p>
                    <h3 className="text-2xl font-black text-slate-800">{revenueCount} <span className="text-sm font-medium text-slate-400">Tasks</span></h3>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                    <Briefcase size={24} />
                </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between transition-transform hover:-translate-y-1">
                <div>
                    <p className="text-[10px] uppercase font-black tracking-widest text-indigo-500 mb-1">Deep Work</p>
                    <h3 className="text-2xl font-black text-slate-800">{deepWorkCount} <span className="text-sm font-medium text-slate-400">Tasks</span></h3>
                </div>
                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Zap size={24} />
                </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between transition-transform hover:-translate-y-1">
                <div>
                    <p className="text-[10px] uppercase font-black tracking-widest text-red-500 mb-1">Overdue Action</p>
                    <h3 className="text-2xl font-black text-slate-800">{overdueCount} <span className="text-sm font-medium text-slate-400">Tasks</span></h3>
                </div>
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
                    <Target size={24} />
                </div>
            </div>
        </div>
    );
};

export default FocusStrip;
