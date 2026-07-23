import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ArrowDownLeft,
  ArrowUpRight,
  Laptop,
  Landmark,
  ShieldCheck,
  Building2,
  PieChart,
  List,
  Settings as SettingsIcon
} from 'lucide-react';
import { subscribeToCollection } from '../../lib/db';
import { JournalEntry, AccountingCategory, AccountingAsset, AccountingLoan, Client, FinancialAccount, Vendor, Service } from '../../types';
import { initializeDefaultCategories, initializeDefaultFinancialAccounts } from '../../lib/accounting';
import Dashboard from './Dashboard';
import MoneyIn from './MoneyIn';
import MoneyOut from './MoneyOut';
import AssetManagement from './AssetManagement';
import LoansCapital from './LoansCapital';
import OwnerEquity from './OwnerEquity';
import VendorsView from './VendorsView';
import ReportsView from './ReportsView';
import LedgerView from './LedgerView';
import Settings from './Settings';

type Tab = 'dashboard' | 'money-in' | 'money-out' | 'assets' | 'loans' | 'equity' | 'vendors' | 'reports' | 'ledger' | 'settings';

const AccountingLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([]);
  const [categories, setCategories] = useState<AccountingCategory[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [assets, setAssets] = useState<AccountingAsset[]>([]);
  const [loans, setLoans] = useState<AccountingLoan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    initializeDefaultCategories();
    initializeDefaultFinancialAccounts();

    const unsubFinAccounts = subscribeToCollection<FinancialAccount>('accounting_financial_accounts', setFinancialAccounts);
    const unsubCategories = subscribeToCollection<AccountingCategory>('accounting_categories', setCategories);
    const unsubJournals = subscribeToCollection<JournalEntry>('journal_entries', (entries) => {
      const sorted = [...entries].sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        if (timeB !== timeA) return timeB - timeA;
        const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (createdB !== createdA) return createdB - createdA;
        return (b.id || '').localeCompare(a.id || '');
      });
      setJournalEntries(sorted);
    });
    const unsubAssets = subscribeToCollection<AccountingAsset>('accounting_assets', setAssets);
    const unsubLoans = subscribeToCollection<AccountingLoan>('accounting_loans', setLoans);
    const unsubClients = subscribeToCollection<Client>('clients', setClients);
    const unsubVendors = subscribeToCollection<Vendor>('accounting_vendors', setVendors);
    const unsubServices = subscribeToCollection<Service>('services', setServices);

    return () => {
      unsubFinAccounts();
      unsubCategories();
      unsubJournals();
      unsubAssets();
      unsubLoans();
      unsubClients();
      unsubVendors();
      unsubServices();
    };
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard financialAccounts={financialAccounts} journalEntries={journalEntries} assets={assets} loans={loans} onNavigate={(tab) => setActiveTab(tab as Tab)} />;
      case 'money-in':
        return <MoneyIn services={services} financialAccounts={financialAccounts} categories={categories} journalEntries={journalEntries} clients={clients} />;
      case 'money-out':
        return <MoneyOut vendors={vendors} financialAccounts={financialAccounts} categories={categories} loans={loans} journalEntries={journalEntries} />;
      case 'assets':
        return <AssetManagement categories={categories} assets={assets} />;
      case 'loans':
        return <LoansCapital financialAccounts={financialAccounts} categories={categories} loans={loans} journalEntries={journalEntries} />;
      case 'equity':
        return <OwnerEquity journalEntries={journalEntries} />;
      case 'vendors':
        return <VendorsView vendors={vendors} journalEntries={journalEntries} />;
      case 'reports':
        return <ReportsView vendors={vendors} categories={categories} journalEntries={journalEntries} assets={assets} loans={loans} financialAccounts={financialAccounts} />;
      case 'ledger':
        return <LedgerView journalEntries={journalEntries} categories={categories} />;
      case 'settings':
        return <Settings financialAccounts={financialAccounts} categories={categories} journalEntries={journalEntries} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* STRIPE / LINEAR / VERCEL STYLE TOP TAB NAVIGATION */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-2 flex items-center gap-1.5 overflow-x-auto shadow-sm scrollbar-hide">
        
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'dashboard'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <LayoutDashboard size={15} />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => setActiveTab('money-in')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'money-in'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <ArrowDownLeft size={15} />
          <span>Money In</span>
        </button>

        <button
          onClick={() => setActiveTab('money-out')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'money-out'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <ArrowUpRight size={15} />
          <span>Money Out</span>
        </button>

        <button
          onClick={() => setActiveTab('assets')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'assets'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Laptop size={15} />
          <span>Assets</span>
        </button>

        <button
          onClick={() => setActiveTab('loans')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'loans'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Landmark size={15} />
          <span>Loans & Liabilities</span>
        </button>

        <button
          onClick={() => setActiveTab('equity')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'equity'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <ShieldCheck size={15} />
          <span>Owner Equity</span>
        </button>

        <button
          onClick={() => setActiveTab('vendors')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'vendors'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Building2 size={15} />
          <span>Vendors</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'reports'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <PieChart size={15} />
          <span>Reports</span>
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'ledger'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <List size={15} />
          <span>Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'settings'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <SettingsIcon size={15} />
          <span>Settings</span>
        </button>

      </div>

      {/* DYNAMIC CONTENT VIEW */}
      <div>
        {renderContent()}
      </div>

    </div>
  );
};

export default AccountingLayout;
