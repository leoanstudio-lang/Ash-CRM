import React from 'react';
import { ExecutionTask } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface AnalyticsPanelProps {
    tasks: ExecutionTask[];
}

const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ tasks }) => {
    const completedTasks = tasks.filter(t => t.status === 'Completed');

    // Time spent by energy type
    const energyData = [
        { name: 'Deep Work', value: 0, color: '#4f46e5' }, // Indigo
        { name: 'Medium Work', value: 0, color: '#3b82f6' }, // Blue
        { name: 'Light Work', value: 0, color: '#0ea5e9' }, // Sky
    ];

    // Time spent by impact type
    const impactData = [
        { name: 'Revenue', value: 0, color: '#10b981' }, // Emerald
        { name: 'Growth', value: 0, color: '#f59e0b' }, // Amber
        { name: 'System', value: 0, color: '#6366f1' }, // Indigo
        { name: 'Admin', value: 0, color: '#94a3b8' }, // Slate
    ];

    completedTasks.forEach(t => {
        const hours = (t.actualTimeSeconds || 0) / 3600;
        const energyItem = energyData.find(e => e.name === t.energyType);
        if (energyItem) energyItem.value += hours;

        const impactItem = impactData.find(e => e.name === t.impactType);
        if (impactItem) impactItem.value += hours;
    });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Deep Work vs Shallow Work */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-6">Energy Allocation (Hours)</h3>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={energyData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }} width={80} />
                            <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                                {energyData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Impact Focus */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-6">Strategic Impact (Hours)</h3>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={impactData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                            <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }} />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={36}>
                                {impactData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsPanel;
