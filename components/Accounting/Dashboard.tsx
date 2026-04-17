import React, { useMemo } from 'react';
import { JournalEntry, AccountingAsset, AccountingLoan, AccountingCategory } from '../../types';
import { calculateDepreciation } from '../../lib/accounting';
import { getEntryPeriod } from './AccountingLayout';
import { TrendingUp, TrendingDown, DollarSign, Wallet, Activity, ArrowUpRight, ArrowDownRight, Layers } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

interface DashboardProps {
    journalEntries: JournalEntry[];
    assets: AccountingAsset[];
    loans: AccountingLoan[];
    categories: AccountingCategory[];
    selectedPeriod: string; // e.g. "March 2026"
}

const Dashboard: React.FC<DashboardProps> = ({ journalEntries, assets, loans, categories, selectedPeriod }) => {
    const stats = useMemo(() => {
        let totalRevenue = 0;
        let totalExpense = 0;
        let cashBalance = 0;

        // Chart: show last 6 months relative to the selected period
        const [selMonth, selYear] = selectedPeriod.split(' ');
        const selMonthIdx = MONTHS.indexOf(selMonth);
        const selYearNum = parseInt(selYear);
        const selDate = new Date(selYearNum, selMonthIdx, 1);

        const chartMap: Record<string, { month: string, revenue: number, expense: number }> = {};
        for (let i = 5; i >= 0; i--) {
            const d = new Date(selYearNum, selMonthIdx - i, 1);
            const name = d.toLocaleString('default', { month: 'short' });
            chartMap[`${name} ${d.getFullYear()}`] = { month: name, revenue: 0, expense: 0 };
        }

        journalEntries.forEach(entry => {
            const entryPeriod = getEntryPeriod(entry); // "March 2026", "April 2026", etc.
            const isSelectedPeriod = entryPeriod === selectedPeriod;

            entry.entries.forEach(line => {
                const cat = categories.find(c => c.id === line.accountId);
                if (!cat) return;

                // Stats for the SELECTED period only
                if (isSelectedPeriod) {
                    if (cat.type === 'Revenue' && line.type === 'CREDIT') {
                        totalRevenue += line.amount;
                    }
                    if (cat.type === 'Expense' && line.type === 'DEBIT') {
                        totalExpense += line.amount;
                    }
                }

                // Cash & Bank Balance: only include the SELECTED period (Refined per user request)
                if (cat.isDefault && ['Bank Account', 'UPI Wallet', 'Cash'].includes(cat.name)) {
                    if (isSelectedPeriod) {
                        if (line.type === 'DEBIT') cashBalance += line.amount;
                        if (line.type === 'CREDIT') cashBalance -= line.amount;
                    }
                }

                // Chart: group by entry's effective period for last 6 months relative to selected
                const [ePeriodMonth, ePeriodYear] = entryPeriod.split(' ');
                const chartKey = `${ePeriodMonth.substring(0, 3)} ${ePeriodYear}`;
                if (chartMap[chartKey]) {
                    if (cat.type === 'Revenue' && line.type === 'CREDIT') {
                        chartMap[chartKey].revenue += line.amount;
                    }
                    if (cat.type === 'Expense' && line.type === 'DEBIT') {
                        chartMap[chartKey].expense += line.amount;
                    }
                }
            });
        });

        const chartData = Object.values(chartMap);

        let totalAssetsNBV = 0;
        const now = new Date();
        assets.forEach(a => {
            totalAssetsNBV += calculateDepreciation(a, now).currentValue;
        });

        return {
            totalRevenue,
            totalExpense,
            cashBalance,
            totalAssetsNBV,
            netProfitThisMonth: totalRevenue - totalExpense,
            chartData
        };
    }, [journalEntries, assets, categories, selectedPeriod]);

    return (
        <div className="space-y-6">
            {/* Top Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><TrendingUp size={64} /></div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Revenue ({selectedPeriod})</p>
                        <div className="flex items-end gap-2">
                            <h3 className="text-3xl font-black text-slate-900 tracking-tight">₹{stats.totalRevenue.toLocaleString()}</h3>
                        </div>
                        <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-emerald-500 bg-emerald-50 w-max px-2.5 py-1 rounded-lg">
                            <ArrowUpRight size={14} /> +Tracking
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><TrendingDown size={64} /></div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Expenses ({selectedPeriod})</p>
                        <div className="flex items-end gap-2">
                            <h3 className="text-3xl font-black text-slate-900 tracking-tight">₹{stats.totalExpense.toLocaleString()}</h3>
                        </div>
                        <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-red-500 bg-red-50 w-max px-2.5 py-1 rounded-lg">
                            <ArrowDownRight size={14} /> -Outgoing
                        </div>
                    </div>
                </div>

                <div className="bg-blue-600 text-white p-6 rounded-xl shadow-md relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-colors"></div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Cash & Bank Balance ({selectedPeriod})</p>
                        <div className="flex items-end gap-2">
                            <h3 className="text-3xl font-black tracking-tight">₹{stats.cashBalance.toLocaleString()}</h3>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                            <span className="text-xs font-bold tracking-tight opacity-90">All liquid assets</span>
                            <Wallet size={16} className="opacity-70" />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 text-white p-6 rounded-xl shadow-md relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><Layers size={64} /></div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Net Book Value (Assets)</p>
                        <div className="flex items-end gap-2">
                            <h3 className="text-3xl font-black tracking-tight">₹{stats.totalAssetsNBV.toLocaleString()}</h3>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                            <span className="text-xs font-bold tracking-tight opacity-90">Fixed Assets Post-Dep.</span>
                            <Activity size={16} className="opacity-70" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Middle Row: Analytics Chart & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-black text-slate-900">Revenue & Expenses Trend</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Last 6 Months by Period</p>
                        </div>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} tickFormatter={(value) => `₹${value >= 1000 ? (value / 1000) + 'k' : value}`} />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ fontSize: '12px', fontWeight: 800 }}
                                />
                                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                                <Area type="monotone" dataKey="expense" name="Expenses" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExp)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div className="mb-6">
                        <h3 className="text-lg font-black text-slate-900">Profit Margin</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{selectedPeriod} Performance</p>
                    </div>

                    <div className="relative flex-1 flex flex-col items-center justify-center">
                        <div className="w-56 h-56 rounded-full border-[16px] border-slate-50 relative flex items-center justify-center">
                            <svg className="absolute inset-0 w-full h-full -rotate-90">
                                <circle cx="96" cy="96" r="80" className="stroke-slate-50 stroke-[16]" fill="none" />
                                {stats.totalRevenue > 0 && (
                                    <circle cx="96" cy="96" r="80" className="stroke-blue-600 stroke-[16] transition-all duration-1000" fill="none" strokeDasharray="502" strokeDashoffset={502 - (502 * Math.max(0, stats.netProfitThisMonth) / stats.totalRevenue)} strokeLinecap="round" />
                                )}
                            </svg>
                            <div className="text-center">
                                <p className="text-3xl font-black text-slate-900 tracking-tight">
                                    {stats.totalRevenue > 0 ? Math.round((stats.netProfitThisMonth / stats.totalRevenue) * 100) : 0}%
                                </p>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Net Margin</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-center px-4">
                        <div className="text-center">
                            <p className="text-[10px] font-black tracking-widest uppercase text-slate-400 mb-1">Inflow</p>
                            <p className="text-sm font-bold text-emerald-600">₹{stats.totalRevenue.toLocaleString()}</p>
                        </div>
                        <div className="w-px h-8 bg-slate-100"></div>
                        <div className="text-center">
                            <p className="text-[10px] font-black tracking-widest uppercase text-slate-400 mb-1">Outflow</p>
                            <p className="text-sm font-bold text-red-600">₹{stats.totalExpense.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
