import React, { useState } from 'react';
import { Strategy, PaymentAlert } from '../../types';
import { Target, Plus } from 'lucide-react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import StrategyFormModal from './StrategyFormModal';
import StrategyDashboard from './StrategyDashboard';

interface StrategiesProps {
    strategies: Strategy[];
    paymentAlerts: PaymentAlert[];
}

const Strategies: React.FC<StrategiesProps> = ({ strategies, paymentAlerts }) => {
    const [isCreating, setIsCreating] = useState(false);
    const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);

    const handleSaveStrategy = async (strategyData: Partial<Strategy>) => {
        try {
            const newStrategy = {
                ...strategyData,
                createdAt: new Date().toISOString()
            };
            await addDoc(collection(db, 'strategies'), newStrategy);
        } catch (e) {
            console.error('Error saving strategy:', e);
        }
    };

    const getActualRevenue = (strategy: Strategy): number => {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const monthIndex = monthNames.indexOf(strategy.month);

        return paymentAlerts
            .filter(p => p.status === 'received')
            .filter(p => {
                const dateStr = p.resolvedAt || p.triggeredAt;
                if (!dateStr) return false;
                const d = new Date(dateStr);
                return d.getMonth() === monthIndex && d.getFullYear() === strategy.year;
            })
            .reduce((sum, p) => sum + (p.actualAmount || p.amount), 0);
    };

    if (selectedStrategy) {
        return (
            <StrategyDashboard
                strategy={selectedStrategy}
                paymentAlerts={paymentAlerts}
                onBack={() => setSelectedStrategy(null)}
            />
        );
    }

    return (
        <div className="space-y-6 md:space-y-8 w-full max-w-7xl mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                    <Target className="text-indigo-600" size={28} />
                    Strategic Command
                </h2>
                <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
                >
                    <Plus size={16} /> Init Strategy
                </button>
            </div>

            {/* Grid of Strategy Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {strategies.map((strategy) => {
                    const actualRevenue = getActualRevenue(strategy);
                    const ratio = strategy.targetRevenue > 0 ? (actualRevenue / strategy.targetRevenue) * 100 : 0;

                    return (
                        <div
                            key={strategy.id}
                            onClick={() => setSelectedStrategy(strategy)}
                            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md hover:border-indigo-100 transition-all hover:-translate-y-1 relative overflow-hidden"
                        >
                            <div
                                className="absolute left-0 bottom-0 h-1.5 bg-emerald-500 transition-all duration-1000 ease-out"
                                style={{ width: `${Math.min(ratio, 100)}%` }}
                            />

                            <div className="flex justify-between items-start mb-6">
                                <h3 className="text-xl font-black text-slate-800">{strategy.month} {strategy.year}</h3>
                                <div className="bg-slate-50 px-3 py-1 rounded-lg text-xs font-bold text-slate-500 border border-slate-100">
                                    {ratio.toFixed(1)}% Achieved
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-4 rounded-2xl">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Target Revenue</span>
                                    <span className="text-lg font-bold text-slate-700">₹{strategy.targetRevenue.toLocaleString()}</span>
                                </div>
                                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100/50">
                                    <span className="text-[10px] font-black uppercase text-emerald-600/70 tracking-widest block mb-1">Actual Revenue</span>
                                    <span className="text-lg font-black text-emerald-600">₹{actualRevenue.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {strategies.length === 0 && (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400">
                        <Target size={48} className="mb-4 opacity-20" />
                        <p className="font-bold">No strategies initialized yet.</p>
                    </div>
                )}
            </div>

            <StrategyFormModal
                isOpen={isCreating}
                onClose={() => setIsCreating(false)}
                onSave={handleSaveStrategy}
            />
        </div>
    );
};

export default Strategies;
