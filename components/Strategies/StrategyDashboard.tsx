import React, { useState, useEffect } from 'react';
import { Strategy, PaymentAlert } from '../../types';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { FileDown, UploadCloud, Loader2, Trophy, ArrowUpRight, CheckCircle2, TrendingUp, AlertTriangle, ShieldCheck } from 'lucide-react';
import StrategyTodoList from './StrategyTodoList';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
    aggregateMonthlyRevenue,
    getRolling3MonthAverage,
    calculatePercentage,
    generate5YearProjections,
    getTargetForMonth
} from './RevenueEngine';

// --- Simple IndexedDB Wrapper for PDF Storage ---
const DB_NAME = 'StrategyPDFDb';
const STORE_NAME = 'pdfs';

const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e: any) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
};

const savePDFLocally = async (strategyId: string, base64Data: string): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(base64Data, strategyId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

const getPDFLocally = async (strategyId: string): Promise<string | null> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(strategyId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
};

interface StrategyDashboardProps {
    strategy: Strategy;
    paymentAlerts: PaymentAlert[];
    onBack: () => void;
}

const formatCurrency = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)} k`;
    return `₹${val}`;
};

const StrategyDashboard: React.FC<StrategyDashboardProps> = ({ strategy, paymentAlerts, onBack }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [localPdfData, setLocalPdfData] = useState<string | null>(null);

    // Load local PDF on mount
    useEffect(() => {
        if (strategy.blueprintPdfUrl === 'local') {
            getPDFLocally(strategy.id).then(data => {
                if (data) setLocalPdfData(data);
            }).catch(console.error);
        }
    }, [strategy.id, strategy.blueprintPdfUrl]);

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthIndex = monthNames.indexOf(strategy.month);

    // Revenue Intelligence Calcs
    const monthlyRevenue = aggregateMonthlyRevenue(paymentAlerts);
    // Approximate date for the current strategy to use in rolling calc
    const targetDate = new Date(strategy.year, monthIndex, 15);
    const { avg: rollingAvg } = getRolling3MonthAverage(targetDate, monthlyRevenue);

    const currentMonthlyTarget = getTargetForMonth(strategy.year, monthIndex);
    const performancePct = calculatePercentage(rollingAvg, currentMonthlyTarget);

    let riskLevel: 'LOW' | 'MODERATE' | 'HIGH' = 'LOW';
    if (performancePct < 70) riskLevel = 'HIGH';
    else if (performancePct < 90) riskLevel = 'MODERATE';

    const rawProjections = generate5YearProjections(targetDate, rollingAvg, performancePct);

    // Inject Risk Projection Line (Red Line)
    const projections = rawProjections.map(p => ({
        ...p,
        targetProjectionScaled: p.targetProjection,
        actualProjectionScaled: p.actualProjection,
        riskProjectionScaled: riskLevel === 'HIGH' ? p.actualProjection : null
    }));

    // Calculate dynamic actual revenue for the specific month (Existing Logic)
    const strategyPayments = paymentAlerts
        .filter(p => p.status === 'received')
        .filter(p => {
            const dateStr = p.resolvedAt || p.triggeredAt;
            if (!dateStr) return false;
            const d = new Date(dateStr);
            return d.getMonth() === monthIndex && d.getFullYear() === strategy.year;
        });

    const actualRevenue = strategyPayments.reduce((sum, p) => sum + (p.actualAmount || p.amount), 0);
    const ratio = strategy.targetRevenue > 0 ? (actualRevenue / strategy.targetRevenue) * 100 : 0;

    // Calculate top revenue sources
    const sourcesMap = new Map<string, number>();
    strategyPayments.forEach(p => {
        const sourceName = p.clientName || 'Unknown Client';
        sourcesMap.set(sourceName, (sourcesMap.get(sourceName) || 0) + (p.actualAmount || p.amount));
    });

    const topSources = Array.from(sourcesMap.entries())
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5); // Top 5

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            setUploadError('Please upload a valid PDF file.');
            return;
        }

        setIsUploading(true);
        setUploadError('');

        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64String = reader.result as string;
                await savePDFLocally(strategy.id, base64String);
                setLocalPdfData(base64String);

                const strategyRef = doc(db, 'strategies', strategy.id);
                await updateDoc(strategyRef, { blueprintPdfUrl: 'local' });

                setIsUploading(false);
            };
            reader.onerror = () => {
                throw new Error("Failed to read file");
            };
        } catch (error) {
            console.error('Error saving PDF locally:', error);
            setUploadError('Failed to save PDF to local storage.');
            setIsUploading(false);
            e.target.value = '';
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
            <button
                onClick={onBack}
                className="mb-6 flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-800 transition-colors"
            >
                &larr; Return to Library
            </button>

            {/* --- REVENUE INTELLIGENCE SECTION --- */}

            {/* 1. Risk Summary Panel */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-center">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Rolling Monthly Avg</span>
                    <span className="text-2xl font-black text-slate-800">₹{rollingAvg.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-center">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Current Target</span>
                    <span className="text-2xl font-black text-slate-800">₹{currentMonthlyTarget.toLocaleString()}</span>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-center">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Performance %</span>
                    <span className={`text-2xl font-black ${performancePct >= 90 ? 'text-emerald-500' :
                            performancePct >= 70 ? 'text-amber-500' : 'text-red-500'
                        }`}>
                        {performancePct.toFixed(1)}%
                    </span>
                </div>
                <div className={`rounded-2xl p-5 shadow-sm border flex flex-col justify-center relative overflow-hidden ${riskLevel === 'LOW' ? 'bg-emerald-50 border-emerald-100' :
                        riskLevel === 'MODERATE' ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'
                    }`}>
                    <span className={`text-[10px] font-black uppercase tracking-widest block mb-1 ${riskLevel === 'LOW' ? 'text-emerald-500' :
                            riskLevel === 'MODERATE' ? 'text-amber-500' : 'text-red-500'
                        }`}>Risk Level</span>
                    <div className="flex items-center gap-2 relative z-10">
                        {riskLevel === 'LOW' && <ShieldCheck className="text-emerald-600" size={24} />}
                        {riskLevel === 'MODERATE' && <AlertTriangle className="text-amber-600" size={24} />}
                        {riskLevel === 'HIGH' && <AlertTriangle className="text-red-600 animate-pulse" size={24} />}
                        <span className={`text-2xl font-black ${riskLevel === 'LOW' ? 'text-emerald-700' :
                                riskLevel === 'MODERATE' ? 'text-amber-700' : 'text-red-700'
                            }`}>
                            {riskLevel}
                        </span>
                    </div>
                    {riskLevel === 'HIGH' && (
                        <div className="absolute right-0 bottom-0 opacity-10">
                            <TrendingUp size={80} className="text-red-600" />
                        </div>
                    )}
                </div>
            </div>

            {/* 2. 5-Year Revenue Forecast Graph */}
            <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-slate-100 mb-10 relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 relative z-10">
                    <div>
                        <h3 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                            <TrendingUp className="text-blue-600" />
                            5-Year Revenue Projection Model (2026-2030)
                        </h3>
                        <p className="text-slate-500 text-sm font-medium mt-1">
                            Compounded growth projection based on consistency.
                        </p>
                    </div>
                </div>

                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={projections} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                                dataKey="year"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                                dy={10}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                                tickFormatter={formatCurrency}
                                width={80}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                                labelStyle={{ fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}
                                formatter={(value: number, name: string) => {
                                    if (name === 'Target (Fixed)') return [formatCurrency(value), 'Target'];
                                    if (name === 'Actual Trajectory') return [formatCurrency(value), 'Actual'];
                                    if (name === 'Risk Trajectory') return [formatCurrency(value), 'Risk Trajectory'];
                                    return [formatCurrency(value), name];
                                }}
                            />
                            <Legend
                                iconType="circle"
                                wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 600 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="targetProjectionScaled"
                                name="Target (Fixed)"
                                stroke="#10b981"
                                strokeWidth={3}
                                strokeDasharray="5 5"
                                dot={false}
                                activeDot={{ r: 6 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="actualProjectionScaled"
                                name="Actual Trajectory"
                                stroke={riskLevel === 'HIGH' ? '#f8fafc' : '#3b82f6'}
                                strokeWidth={4}
                                dot={{ r: 4, strokeWidth: 2 }}
                                activeDot={{ r: 8 }}
                            />
                            {riskLevel === 'HIGH' && (
                                <Line
                                    type="monotone"
                                    dataKey="riskProjectionScaled"
                                    name="Risk Trajectory"
                                    stroke="#ef4444"
                                    strokeWidth={4}
                                    dot={{ r: 5, strokeWidth: 2, fill: '#ef4444' }}
                                    activeDot={{ r: 8 }}
                                />
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* --- EXISTING STRATEGY MANAGEMENT SECTION --- */}

            <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-3 mb-6">
                <Trophy className="text-amber-500" />
                Strategic Command ({strategy.month})
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Content (Left - 2 Cols) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Header Card */}
                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <Trophy size={120} />
                        </div>
                        <h2 className="text-3xl font-black text-slate-800 mb-2 relative z-10">{strategy.month} {strategy.year} Playbook</h2>
                        <p className="text-slate-500 font-medium mb-8 relative z-10">Strategic blueprint and revenue objectives for the month.</p>

                        <div className="grid grid-cols-2 gap-4 relative z-10">
                            <div className="bg-slate-50 p-6 rounded-2xl">
                                <span className="text-xs font-black uppercase text-slate-400 tracking-widest block mb-1">Target Mission</span>
                                <span className="text-3xl font-black text-slate-700">₹{strategy.targetRevenue.toLocaleString()}</span>
                            </div>
                            <div className="bg-emerald-50 p-6 border border-emerald-100/50 rounded-2xl relative overflow-hidden">
                                <div
                                    className="absolute left-0 bottom-0 top-0 bg-emerald-100/30 transition-all duration-1000 ease-out"
                                    style={{ width: `${Math.min(ratio, 100)}%` }}
                                />
                                <div className="relative z-10">
                                    <span className="text-xs font-black uppercase text-emerald-600/70 tracking-widest block mb-1">Secured Revenue</span>
                                    <span className="text-3xl font-black text-emerald-600">₹{actualRevenue.toLocaleString()}</span>
                                    <div className="mt-2 text-sm font-bold text-emerald-700 bg-white/50 inline-block px-2 py-1 rounded">
                                        {ratio.toFixed(1)}% Achieved
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* PDF Viewer / Uploader Card */}
                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                                <FileDown className="text-indigo-600" />
                                Strategy Blueprint (PDF)
                            </h3>

                            {strategy.blueprintPdfUrl && (
                                <label className="cursor-pointer text-xs font-bold uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-lg active:scale-95">
                                    <UploadCloud size={14} /> Replace
                                    <input type="file" className="hidden" accept="application/pdf" onChange={handleFileUpload} disabled={isUploading} />
                                </label>
                            )}
                        </div>

                        {uploadError && (
                            <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-100">
                                {uploadError}
                            </div>
                        )}

                        {strategy.blueprintPdfUrl === 'local' && localPdfData ? (
                            <div className="aspect-[16/9] w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                                <iframe
                                    src={`${localPdfData}#toolbar=0`}
                                    className="w-full h-full"
                                    title="Strategy Blueprint"
                                />
                            </div>
                        ) : strategy.blueprintPdfUrl && strategy.blueprintPdfUrl !== 'local' ? (
                            <div className="aspect-[16/9] w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                                <iframe
                                    src={`${strategy.blueprintPdfUrl}#toolbar=0`}
                                    className="w-full h-full"
                                    title="Strategy Blueprint"
                                />
                            </div>
                        ) : (
                            <div className="border-2 border-dashed border-slate-200 bg-slate-50 rounded-2xl p-12 flex flex-col items-center justify-center text-center transition-colors hover:bg-slate-100 hover:border-indigo-300">
                                {isUploading ? (
                                    <div className="flex flex-col items-center">
                                        <Loader2 className="animate-spin text-indigo-600 mb-4" size={32} />
                                        <span className="font-bold text-slate-500">Uploading Blueprint...</span>
                                    </div>
                                ) : (
                                    <label className="cursor-pointer flex flex-col items-center group w-full h-full">
                                        <div className="w-16 h-16 bg-white shadow-sm rounded-full flex items-center justify-center text-indigo-600 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 mb-4">
                                            <UploadCloud size={24} />
                                        </div>
                                        <h4 className="text-lg font-black text-slate-700 mb-1">Upload Playbook PDF</h4>
                                        <p className="text-sm font-medium text-slate-400 max-w-xs">Drop your monthly strategy manifesto here to embed it natively for the team.</p>
                                        <input type="file" className="hidden" accept="application/pdf" onChange={handleFileUpload} />
                                    </label>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar (Right - 1 Col) */}
                <div className="space-y-6">
                    {/* Top Revenue Sources Mini-Analytics */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                        <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                            <ArrowUpRight className="text-emerald-500" />
                            Top Contributors
                        </h3>

                        {topSources.length > 0 ? (
                            <div className="space-y-4">
                                {topSources.map((source, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs">
                                                {idx + 1}
                                            </div>
                                            <span className="font-bold text-sm text-slate-700 truncate max-w-[120px]">{source.name}</span>
                                        </div>
                                        <span className="font-black text-emerald-600 text-sm">₹{source.amount.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-8 flex flex-col items-center justify-center text-center">
                                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3 text-slate-300">
                                    <CheckCircle2 size={20} />
                                </div>
                                <span className="font-bold text-sm text-slate-400">No revenue secured yet for this month.</span>
                            </div>
                        )}
                    </div>

                    {/* To-Do List Mission Directives */}
                    <div className="h-[500px]">
                        <StrategyTodoList strategyId={strategy.id} />
                    </div>
                </div>

            </div>
        </div>
    );
};

export default StrategyDashboard;
