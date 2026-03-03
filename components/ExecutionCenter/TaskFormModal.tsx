import React, { useState, useEffect } from 'react';
import { ExecutionTask } from '../../types';
import { X, Save, Clock, Target, Box, Zap, AlertTriangle, Activity } from 'lucide-react';

interface TaskFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (task: Partial<ExecutionTask>) => void;
    initialData?: ExecutionTask;
    departments: string[];
}

const TaskFormModal: React.FC<TaskFormModalProps> = ({ isOpen, onClose, onSave, initialData, departments }) => {
    const [formData, setFormData] = useState<Partial<ExecutionTask>>({
        name: '',
        department: departments[0] || 'Management',
        priority: 'Medium',
        impactType: 'System',
        energyType: 'Medium Work',
        deadline: new Date().toISOString().split('T')[0],
        estimatedTimeSeconds: 3600, // 1 hour default
        status: 'Pending',
        notes: '',
    });

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        } else {
            setFormData({
                name: '',
                department: departments[0] || 'Management',
                priority: 'Medium',
                impactType: 'System',
                energyType: 'Medium Work',
                deadline: new Date().toISOString().split('T')[0],
                estimatedTimeSeconds: 3600,
                status: 'Pending',
                notes: '',
            });
        }
    }, [initialData, isOpen, departments]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-slate-50 border-b border-slate-100 p-6 flex items-center justify-between">
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                        <Target className="text-indigo-600" />
                        {initialData ? 'Edit Execution Node' : 'Initialize Execution Node'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl text-slate-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 md:p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* Main Info */}
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-2 block">Task Designation</label>
                            <input
                                type="text"
                                value={formData.name || ''}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                                placeholder="E.g., Finalize Q3 Marketing Strategy..."
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-2 block">Department</label>
                                <select
                                    value={formData.department}
                                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all cursor-pointer"
                                >
                                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-2 block">Deadline</label>
                                <input
                                    type="date"
                                    value={formData.deadline}
                                    onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    <hr className="border-slate-100" />

                    {/* Classification */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-2 block flex items-center gap-1"><AlertTriangle size={12} /> Priority</label>
                            <select
                                value={formData.priority}
                                onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all cursor-pointer"
                            >
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase font-black tracking-widest text-emerald-500 mb-2 block flex items-center gap-1"><Box size={12} /> Impact Link</label>
                            <select
                                value={formData.impactType}
                                onChange={e => setFormData({ ...formData, impactType: e.target.value as any })}
                                className="w-full px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all cursor-pointer"
                            >
                                <option value="Revenue">Revenue</option>
                                <option value="Growth">Growth</option>
                                <option value="System">System</option>
                                <option value="Admin">Admin</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase font-black tracking-widest text-indigo-500 mb-2 block flex items-center gap-1"><Zap size={12} /> Energy Tax</label>
                            <select
                                value={formData.energyType}
                                onChange={e => setFormData({ ...formData, energyType: e.target.value as any })}
                                className="w-full px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl text-sm font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all cursor-pointer"
                            >
                                <option value="Deep Work">Deep Work</option>
                                <option value="Medium Work">Medium Work</option>
                                <option value="Light Work">Light Work</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase font-black tracking-widest text-amber-500 mb-2 block flex items-center gap-1"><Activity size={12} /> Status</label>
                            <select
                                value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                                className="w-full px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-sm font-bold text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all cursor-pointer"
                            >
                                <option value="Pending">Pending</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Completed">Completed</option>
                                <option value="Ignored">Ignored</option>
                            </select>
                        </div>
                    </div>

                    <hr className="border-slate-100" />

                    {/* Time & Notes */}
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-2 block flex items-center gap-1"><Clock size={12} /> Estimated Time (Hours)</label>
                            <input
                                type="number"
                                min="0.5"
                                step="0.5"
                                value={(formData.estimatedTimeSeconds || 3600) / 3600}
                                onChange={e => setFormData({ ...formData, estimatedTimeSeconds: parseFloat(e.target.value) * 3600 })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-2 block">Execution Notes</label>
                            <textarea
                                value={formData.notes || ''}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all min-h-[100px]"
                                placeholder="Brief outline of execution requirements..."
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 p-6 flex justify-end gap-4 border-t border-slate-100">
                    <button onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-200 transition-colors">
                        Cancel
                    </button>
                    <button onClick={() => {
                        onSave(formData);
                        onClose();
                    }} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-colors">
                        <Save size={18} />
                        Commit Task
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TaskFormModal;
