import React, { useState } from 'react';
import { Strategy } from '../../types';
import { X, Save, Target, Box, Calendar } from 'lucide-react';

interface StrategyFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (strategy: Partial<Strategy>) => void;
}

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const StrategyFormModal: React.FC<StrategyFormModalProps> = ({ isOpen, onClose, onSave }) => {
    const currentYear = new Date().getFullYear();
    const currentMonthIndex = new Date().getMonth();

    const [formData, setFormData] = useState<Partial<Strategy>>({
        month: MONTHS[currentMonthIndex],
        year: currentYear,
        targetRevenue: 100000,
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-slate-50 border-b border-slate-100 p-6 flex items-center justify-between">
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                        <Target className="text-indigo-600" />
                        Initialize Strategy
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl text-slate-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 md:p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-2 block flex items-center gap-1"><Calendar size={12} /> Target Month</label>
                            <select
                                value={formData.month}
                                onChange={e => setFormData({ ...formData, month: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all cursor-pointer"
                            >
                                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-2 block">Target Year</label>
                            <input
                                type="number"
                                value={formData.year}
                                onChange={e => setFormData({ ...formData, year: parseInt(e.target.value) })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] uppercase font-black tracking-widest text-emerald-500 mb-2 block flex items-center gap-1"><Box size={12} /> Target Revenue Base</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-bold">₹</span>
                            <input
                                type="number"
                                value={formData.targetRevenue}
                                onChange={e => setFormData({ ...formData, targetRevenue: parseInt(e.target.value) })}
                                className="w-full pl-8 pr-4 py-4 bg-emerald-50 border border-emerald-100 rounded-xl text-lg font-black text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
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
                        Deploy Strategy
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StrategyFormModal;
