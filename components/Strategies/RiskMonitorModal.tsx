import React, { useState, useEffect } from 'react';
import { PaymentAlert } from '../../types';
import { AlertOctagon, TrendingDown, AlertTriangle, ShieldAlert } from 'lucide-react';
import {
    aggregateMonthlyRevenue,
    getMonthYearString,
    getTargetForMonth,
    calculatePercentage
} from './RevenueEngine';

interface RiskMonitorModalProps {
    paymentAlerts: PaymentAlert[];
}

const RiskMonitorModal: React.FC<RiskMonitorModalProps> = ({ paymentAlerts }) => {
    const [riskType, setRiskType] = useState<'MODERATE' | 'SEVERE' | 'STAGNATION' | null>(null);
    const [metrics, setMetrics] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Run Risk Evaluation
        const evaluateSystemRisk = () => {
            const monthlyRevenue = aggregateMonthlyRevenue(paymentAlerts);
            const currentDate = new Date();

            const currentYear = currentDate.getFullYear();
            const currentMonthIndex = currentDate.getMonth();

            // We need data for Current Month, M-1, M-2, M-3
            const getMonthData = (offset: number) => {
                const d = new Date(currentYear, currentMonthIndex - offset, 1);
                const key = getMonthYearString(d);
                const rev = monthlyRevenue[key] || 0;
                const target = getTargetForMonth(d.getFullYear(), d.getMonth());
                // For rolling avg ending AT this month (meaning M, M-1, M-2)
                let rollingTotal = 0;
                let activeMonths = 0;
                for (let i = 0; i < 3; i++) {
                    const rd = new Date(d.getFullYear(), d.getMonth() - i, 1);
                    const rKey = getMonthYearString(rd);
                    // Only sum if it's within the system operational bounds, but for simplification we sum it
                    // if it exists or if 0. We'll divide by 3 rigidly if older than 3 months.
                    rollingTotal += monthlyRevenue[rKey] || 0;
                    activeMonths++; // Simplification: assume always dividing by 3 for risk
                }
                const avg = rollingTotal / 3;
                const pct = calculatePercentage(avg, target);
                return { rev, target, avg, pct };
            };

            const m0 = getMonthData(0); // Current Month Rolling
            const m1 = getMonthData(1); // 1 Month Ago Rolling
            const m2 = getMonthData(2); // 2 Months Ago
            const m3 = getMonthData(3); // 3 Months Ago

            // 1. Severe Risk: rolling_avg < 50% of current_monthly_target
            if (m0.pct < 50 && m0.target > 0) {
                setRiskType('SEVERE');
                setMetrics({ avg: m0.avg, target: m0.target, gap: 100 - m0.pct, reqInc: (m0.target - m0.avg) });
                setIsVisible(true);
                return;
            }

            // 2. Underperformance: rolling_avg < 70% for 2 consecutive months
            if (m0.pct < 70 && m1.pct < 70 && m0.target > 0) {
                setRiskType('MODERATE');
                setMetrics({ avg: m0.avg, target: m0.target, gap: 100 - m0.pct, reqInc: (m0.target - m0.avg) });
                setIsVisible(true);
                return;
            }

            // 3. Growth Stagnation: Revenue growth < 5% over 3 consecutive months
            // Rev growth between raw revenues (not rolling):
            const growth1 = m1.rev > 0 ? ((m0.rev - m1.rev) / m1.rev) * 100 : 100;
            const growth2 = m2.rev > 0 ? ((m1.rev - m2.rev) / m2.rev) * 100 : 100;
            const growth3 = m3.rev > 0 ? ((m2.rev - m3.rev) / m3.rev) * 100 : 100;

            if (growth1 < 5 && growth2 < 5 && growth3 < 5 && m0.target > 0) {
                setRiskType('STAGNATION');
                setIsVisible(true);
                return;
            }

            // 4. Risk Auto-reset: rolling_avg >= 85% for 1 month
            if (m0.pct >= 85) {
                setRiskType(null);
                setIsVisible(false);
            }
        };

        if (paymentAlerts.length > 0) {
            evaluateSystemRisk();
        }
    }, [paymentAlerts]);

    if (!isVisible || !riskType) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border-4 border-red-500 overflow-hidden relative">

                {/* Header */}
                <div className={`p-6 text-white flex items-center gap-4 ${riskType === 'SEVERE' ? 'bg-red-600' :
                        riskType === 'STAGNATION' ? 'bg-amber-600' : 'bg-rose-500'
                    }`}>
                    {riskType === 'SEVERE' && <AlertOctagon size={48} className="animate-pulse" />}
                    {riskType === 'MODERATE' && <AlertTriangle size={48} />}
                    {riskType === 'STAGNATION' && <TrendingDown size={48} />}

                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-widest">
                            {riskType === 'SEVERE' ? 'Severe Revenue Deviation' :
                                riskType === 'STAGNATION' ? 'Growth Stagnation Detected' :
                                    'Revenue Underperformance'}
                        </h2>
                        <p className="font-bold text-white/80 mt-1">
                            {riskType === 'SEVERE' ? 'Immediate sales escalation required.' :
                                riskType === 'STAGNATION' ? '3 consecutive months of sub-5% growth.' :
                                    'Current trajectory will delay future milestones.'}
                        </p>
                    </div>
                </div>

                {/* Metrics */}
                {metrics && riskType !== 'STAGNATION' && (
                    <div className="p-8">
                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-1">Rolling Avg</span>
                                <span className="text-2xl font-black text-red-600">₹{metrics.avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-1">Current Target</span>
                                <span className="text-2xl font-black text-emerald-600">₹{metrics.target.toLocaleString()}</span>
                            </div>
                            <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                <span className="text-xs font-black text-red-400 uppercase tracking-widest block mb-1">Performance Gap</span>
                                <span className="text-2xl font-black text-red-600">{metrics.gap.toFixed(1)}%</span>
                            </div>
                            <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                                <span className="text-xs font-black text-rose-500 uppercase tracking-widest block mb-1">Required Increase</span>
                                <span className="text-2xl font-black text-rose-600">₹{metrics.reqInc.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => setIsVisible(false)}
                                className="w-full bg-slate-900 text-white font-black uppercase tracking-widest py-4 rounded-xl hover:bg-slate-800 transition-colors"
                            >
                                Acknowledge Risk
                            </button>
                        </div>
                    </div>
                )}

                {riskType === 'STAGNATION' && (
                    <div className="p-8 text-center">
                        <ShieldAlert size={64} className="mx-auto text-amber-500 mb-6" />
                        <p className="text-slate-600 font-bold mb-8">
                            Your revenue has flatlined for the past quarter. To reach your 5-year goal, you must establish compounded growth multipliers. Review your sales strategy instantly.
                        </p>
                        <button
                            onClick={() => setIsVisible(false)}
                            className="w-full bg-slate-900 text-white font-black uppercase tracking-widest py-4 rounded-xl hover:bg-slate-800 transition-colors"
                        >
                            Acknowledge Stagnation
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RiskMonitorModal;
