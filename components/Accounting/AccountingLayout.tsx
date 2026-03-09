import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Wallet, CreditCard, Building2, Landmark, List, PieChart, Settings as SettingsIcon } from 'lucide-react';
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

const AccountingLayout: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('dashboard');

    const [categories, setCategories] = useState<AccountingCategory[]>([]);
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
    const [assets, setAssets] = useState<AccountingAsset[]>([]);
    const [loans, setLoans] = useState<AccountingLoan[]>([]);

    useEffect(() => {
        initializeDefaultCategories();

        const unsubCategories = subscribeToCollection<AccountingCategory>('accounting_categories', setCategories);
        const unsubJournals = subscribeToCollection<JournalEntry>('journal_entries', (entries) => {
            // Sort entries by date desc
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
            case 'dashboard': return <Dashboard journalEntries={journalEntries} assets={assets} loans={loans} categories={categories} />;
            case 'revenue': return <RevenueManagement categories={categories} journalEntries={journalEntries} />;
            case 'expenses': return <ExpenseManagement categories={categories} journalEntries={journalEntries} />;
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
            {/* Top Navigation */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-2 flex gap-2 overflow-x-auto scrollbar-hide">
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
            </div>

            {/* Main Content Area */}
            <div>
                {renderContent()}
            </div>
        </div>
    );
};

export default AccountingLayout;
