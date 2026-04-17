import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Wallet, CreditCard, Building2, Landmark, List, PieChart, Settings as SettingsIcon, ChevronDown } from 'lucide-react';
import { subscribeToCollection } from '../../lib/db';
import { JournalEntry, AccountingCategory, AccountingAsset, AccountingLoan } from '../../types';
import { initializeDefaultCategories } from '../../lib/accounting';
import Settings from './Settings';
import RevenueManagement from './RevenueManagement';
import ExpenseManagement from './ExpenseManagement';
import AssetManagement from './AssetManagement';
import LoansCapital from './LoansCapital';
import LedgerView from './LedgerView';
import ReportsView from './ReportsView';
import Dashboard from './Dashboard';

type Tab = 'dashboard' | 'revenue' | 'expenses' | 'assets' | 'loans_capital' | 'ledger' | 'reports' | 'settings';

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

// Generate period options: last 6 months + current + next 3 months
function generatePeriodOptions(): string[] {
    const options: string[] = [];
    const now = new Date();
    for (let i = -6; i <= 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        options.push(`${MONTHS[d.getMonth()]} ${d.getFullYear()}`);
    }
    return options;
}

// Get the effective period for a journal entry:
// If it has a periodMonth set → use that (it's an advance for a future/past period)
// Otherwise → derive from the receipt date
export function getEntryPeriod(entry: JournalEntry): string {
    if (entry.periodMonth) {
        // periodMonth may be just "April" or "April 2026"
        const hasYear = /\d{4}/.test(entry.periodMonth);
        if (hasYear) return entry.periodMonth;
        // Append the year from the entry date
        const year = new Date(entry.date).getFullYear();
        return `${entry.periodMonth} ${year}`;
    }
    const d = new Date(entry.date);
    return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const AccountingLayout: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('dashboard');

    const [categories, setCategories] = useState<AccountingCategory[]>([]);
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
    const [assets, setAssets] = useState<AccountingAsset[]>([]);
    const [loans, setLoans] = useState<AccountingLoan[]>([]);

    // Global period selector — defaults to current month
    const now = new Date();
    const defaultPeriod = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
    const [selectedPeriod, setSelectedPeriod] = useState<string>(defaultPeriod);

    // Separate month and year for compact selectors
    const [selMonth, setSelMonth] = useState(MONTHS[now.getMonth()]);
    const [selYear, setSelYear] = useState(String(now.getFullYear()));
    const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

    function applyPeriod(m: string, y: string) {
        setSelMonth(m); setSelYear(y);
        setSelectedPeriod(`${m} ${y}`);
    }

    useEffect(() => {
        initializeDefaultCategories();

        const unsubCategories = subscribeToCollection<AccountingCategory>('accounting_categories', setCategories);
        const unsubJournals = subscribeToCollection<JournalEntry>('journal_entries', (entries) => {
            const sorted = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setJournalEntries(sorted);
        });
        const unsubAssets = subscribeToCollection<AccountingAsset>('accounting_assets', setAssets);
        const unsubLoans = subscribeToCollection<AccountingLoan>('accounting_loans', setLoans);

        return () => {
            unsubCategories();
            unsubJournals();
            unsubAssets();
            unsubLoans();
        };
    }, []);

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return <Dashboard journalEntries={journalEntries} assets={assets} loans={loans} categories={categories} selectedPeriod={selectedPeriod} />;
            case 'revenue': return <RevenueManagement categories={categories} journalEntries={journalEntries} selectedPeriod={selectedPeriod} />;
            case 'expenses': return <ExpenseManagement categories={categories} journalEntries={journalEntries} selectedPeriod={selectedPeriod} />;
            case 'assets': return <AssetManagement categories={categories} assets={assets} />;
            case 'loans_capital': return <LoansCapital categories={categories} loans={loans} journalEntries={journalEntries} />;
            case 'ledger': return <LedgerView journalEntries={journalEntries} categories={categories} />;
            case 'reports': return <ReportsView journalEntries={journalEntries} categories={categories} assets={assets} loans={loans} />;
            case 'settings': return <Settings categories={categories} />;
            default: return null;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Top Navigation with inline period selectors */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-2 flex items-center gap-2 overflow-x-auto scrollbar-hide">
                {/* Tab buttons */}
                <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'dashboard'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                        : 'text-slate-400 hover:bg-slate-50 hover:text-blue-600'
                        }`}
                >
                    <LayoutDashboard size={16} /> Dashboard
                </button>
                <button
                    onClick={() => setActiveTab('revenue')}
                    className={`flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'revenue'
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                        : 'text-slate-400 hover:bg-slate-50 hover:text-emerald-600'
                        }`}
                >
                    <Wallet size={16} /> Revenue
                </button>
                <button
                    onClick={() => setActiveTab('expenses')}
                    className={`flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'expenses'
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                        : 'text-slate-400 hover:bg-slate-50 hover:text-red-600'
                        }`}
                >
                    <CreditCard size={16} /> Expenses
                </button>
                <button
                    onClick={() => setActiveTab('assets')}
                    className={`flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'assets'
                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                        : 'text-slate-400 hover:bg-slate-50 hover:text-amber-600'
                        }`}
                >
                    <Building2 size={16} /> Assets
                </button>
                <button
                    onClick={() => setActiveTab('loans_capital')}
                    className={`flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'loans_capital'
                        ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                        : 'text-slate-400 hover:bg-slate-50 hover:text-purple-600'
                        }`}
                >
                    <Landmark size={16} /> Loans & Capital
                </button>
                <button
                    onClick={() => setActiveTab('ledger')}
                    className={`flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'ledger'
                        ? 'bg-slate-800 text-white shadow-lg shadow-slate-800/20'
                        : 'text-slate-400 hover:bg-slate-50 hover:text-slate-800'
                        }`}
                >
                    <List size={16} /> Ledger
                </button>
                <button
                    onClick={() => setActiveTab('reports')}
                    className={`flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'reports'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                        : 'text-slate-400 hover:bg-slate-50 hover:text-indigo-600'
                        }`}
                >
                    <PieChart size={16} /> Reports
                </button>
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'settings'
                        ? 'bg-slate-500 text-white shadow-lg shadow-slate-500/20'
                        : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                        }`}
                >
                    <SettingsIcon size={16} /> Settings
                </button>

                {/* Compact period selector — sits inline at right end of nav */}
                <div className="flex items-center gap-1.5 ml-auto pl-3 border-l border-slate-100 shrink-0">
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest whitespace-nowrap">Period</span>
                    <select
                        value={selMonth}
                        onChange={e => applyPeriod(e.target.value, selYear)}
                        className="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none cursor-pointer hover:border-slate-300 transition"
                    >
                        {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select
                        value={selYear}
                        onChange={e => applyPeriod(selMonth, e.target.value)}
                        className="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none cursor-pointer hover:border-slate-300 transition"
                    >
                        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    {selectedPeriod !== defaultPeriod && (
                        <button
                            onClick={() => applyPeriod(MONTHS[now.getMonth()], String(now.getFullYear()))}
                            className="text-[9px] font-black text-blue-500 hover:text-blue-700 px-1.5 py-1 rounded transition"
                            title="Reset to current month"
                        >
                            ↺
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div>
                {renderContent()}
            </div>
        </div>
    );
};

export default AccountingLayout;
