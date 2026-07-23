import React, { useState, useEffect } from 'react';
import { JournalEntry, AccountingAsset, AccountingLoan, FinancialAccount } from '../../types';
import { calculateDepreciation, calculateAccountBalances, recordAccountTransfer } from '../../lib/accounting';
import { ArrowDownLeft, ArrowUpRight, Wallet, Landmark, Laptop, ShieldCheck, Plus, TrendingUp, CreditCard, Building, ArrowLeftRight, X } from 'lucide-react';

interface DashboardProps {
  financialAccounts?: FinancialAccount[];
  journalEntries: JournalEntry[];
  assets: AccountingAsset[];
  loans: AccountingLoan[];
  onNavigate: (tab: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ financialAccounts = [], journalEntries = [], assets = [], loans = [], onNavigate }) => {
  const now = new Date();

  // Account Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferFromId, setTransferFromId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [transferRemarks, setTransferRemarks] = useState('');

  // Calculate dynamic balances for all financial accounts
  const accountBalances = calculateAccountBalances(financialAccounts, journalEntries);

  // Active Financial Accounts
  const activeAccounts = financialAccounts.filter(a => a.status === 'Active');

  // Auto-set transfer options when active accounts load
  useEffect(() => {
    if (activeAccounts.length >= 2) {
      if (!transferFromId) setTransferFromId(activeAccounts[0].id);
      if (!transferToId) setTransferToId(activeAccounts[1].id);
    } else if (activeAccounts.length === 1) {
      if (!transferFromId) setTransferFromId(activeAccounts[0].id);
    }
  }, [activeAccounts, transferFromId, transferToId]);

  // Total Available Cash across all active accounts
  const totalAvailableCash = activeAccounts.reduce((sum, acc) => {
    return sum + (accountBalances[acc.id] ?? acc.openingBalance);
  }, 0);

  // Money In Calculation (Excluding Opening Balance migration entries)
  const moneyInEntries = journalEntries.filter(j =>
    (j.type === 'Revenue' || j.type === 'Capital' || (j.type === 'Loan' && j.entries.some(e => e.type === 'CREDIT' && e.accountType === 'Liability'))) &&
    j.subType !== 'Opening Balance'
  );
  const totalMoneyIn = moneyInEntries.reduce((sum, j) => sum + (j.entries.find(e => e.type === 'DEBIT')?.amount || 0), 0);

  // Operational Expenses Calculation
  const operationalExpenses = journalEntries
    .filter(j => j.type === 'Expense' || j.subType === 'Operational Expense')
    .reduce((sum, j) => sum + (j.entries.find(e => e.type === 'DEBIT')?.amount || 0), 0);

  // Fixed Assets Book Value
  const totalFixedAssetBookValue = assets.reduce((sum, a) => {
    const { currentValue } = calculateDepreciation(a, now);
    return sum + currentValue;
  }, 0);

  // Outstanding Debt
  const totalOutstandingLoans = loans.reduce((sum, l) => sum + l.remainingBalance, 0);

  const accountIcon = (type: string) => {
    switch (type) {
      case 'Bank': return <Landmark size={15} className="text-blue-600" />;
      case 'Cash': case 'Petty Cash': return <Wallet size={15} className="text-emerald-600" />;
      case 'UPI': return <Building size={15} className="text-purple-600" />;
      default: return <CreditCard size={15} className="text-amber-600" />;
    }
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferAmount || Number(transferAmount) <= 0) return alert("Please enter a valid amount.");
    if (transferFromId === transferToId) return alert("Source and destination accounts must be different.");

    const fromAcc = activeAccounts.find(a => a.id === transferFromId);
    const toAcc = activeAccounts.find(a => a.id === transferToId);

    if (!fromAcc || !toAcc) return alert("Please select valid accounts.");

    try {
      await recordAccountTransfer({
        fromAccount: fromAcc,
        toAccount: toAcc,
        amount: parseFloat(transferAmount),
        date: new Date(transferDate).toISOString(),
        remarks: transferRemarks || `Internal Transfer: ${fromAcc.accountName} → ${toAcc.accountName}`,
        createdBy: 'Admin'
      });

      setTransferAmount('');
      setTransferRemarks('');
      setIsTransferModalOpen(false);
      alert(`Transferred ₹${Number(transferAmount).toLocaleString('en-IN')} from "${fromAcc.accountName}" to "${toAcc.accountName}" successfully!`);
    } catch (err: any) {
      alert("Error executing transfer: " + err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* QUICK ACTIONS BANNER */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Finance & Accounting Dashboard</h2>
          <p className="text-xs text-slate-500 font-medium">Real-time overview of cash inflows, operational expenses, assets, and liabilities</p>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={() => onNavigate('money-in')}
            className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
          >
            <ArrowDownLeft size={15} />
            <span>+ Record Money In</span>
          </button>

          <button
            onClick={() => onNavigate('money-out')}
            className="flex-1 md:flex-none bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
          >
            <ArrowUpRight size={15} />
            <span>+ Record Money Out</span>
          </button>
        </div>
      </div>

      {/* METRICS CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Money In */}
        <div
          onClick={() => onNavigate('money-in')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Money In</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
              <ArrowDownLeft size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">₹{totalMoneyIn.toLocaleString('en-IN')}</div>
          <span className="text-xs text-slate-500 font-medium mt-1 block">Total Incoming Cash</span>
        </div>

        {/* Operational Expenses */}
        <div
          onClick={() => onNavigate('money-out')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-rose-300 transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Operational Expenses</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl group-hover:scale-110 transition-transform">
              <ArrowUpRight size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-600 mt-2">₹{operationalExpenses.toLocaleString('en-IN')}</div>
          <span className="text-xs text-slate-500 font-medium mt-1 block">Rent, Salaries & Supplies</span>
        </div>

        {/* Fixed Assets */}
        <div
          onClick={() => onNavigate('assets')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-indigo-300 transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fixed Assets</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform">
              <Laptop size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold text-indigo-600 mt-2">₹{totalFixedAssetBookValue.toLocaleString('en-IN')}</div>
          <span className="text-xs text-slate-500 font-medium mt-1 block">Computers & Equipment Book Value</span>
        </div>

        {/* Outstanding Debt */}
        <div
          onClick={() => onNavigate('loans')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-amber-300 transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Outstanding Debt</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform">
              <Landmark size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-2">₹{totalOutstandingLoans.toLocaleString('en-IN')}</div>
          <span className="text-xs text-slate-500 font-medium mt-1 block">Total Active Loans & EMIs</span>
        </div>

      </div>

      {/* FINANCIAL ACCOUNTS WIDGET */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Financial Accounts & Cash Position</h3>
            <p className="text-xs text-slate-500">Real-time balances across Cash in Hand, Bank Accounts, and Digital Wallets</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsTransferModalOpen(true)}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs px-3 py-1.5 rounded-xl border border-indigo-200/80 flex items-center gap-1.5 transition-all shadow-2xs"
            >
              <ArrowLeftRight size={14} />
              <span>Transfer Funds</span>
            </button>
            <button
              onClick={() => onNavigate('settings')}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 hover:underline"
            >
              Manage Accounts →
            </button>
          </div>
        </div>

        {activeAccounts.length === 0 ? (
          <p className="text-xs text-slate-400 font-medium py-2">No active financial accounts found. Add accounts in Settings.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {activeAccounts.map(acc => {
              const bal = accountBalances[acc.id] ?? acc.openingBalance;
              return (
                <div key={acc.id} className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{acc.accountName}</span>
                    {accountIcon(acc.accountType)}
                  </div>
                  <div className="text-lg font-extrabold text-slate-900">₹{bal.toLocaleString('en-IN')}</div>
                  <span className="text-[10px] text-slate-500 font-medium block">{acc.accountType} Account</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
          <span className="font-bold text-slate-600 uppercase tracking-wider text-[11px]">Total Available Cash</span>
          <span className="font-black text-slate-900 text-sm">₹{totalAvailableCash.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* RECENT TRANSACTIONS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">Recent Cash Movements</h3>
          <span className="text-xs text-slate-400 font-medium">Last {Math.min(8, journalEntries.length)} entries</span>
        </div>

        <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold">
              <tr>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Remarks / Description</th>
                <th className="py-2.5 px-4 text-right">Debit / Out (₹)</th>
                <th className="py-2.5 px-4 text-right">Credit / In (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {journalEntries.filter(j => j.subType !== 'Opening Balance').length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400 font-medium">
                    No accounting movements recorded yet.
                  </td>
                </tr>
              ) : (
                journalEntries
                  .filter(j => j.subType !== 'Opening Balance')
                  .sort((a, b) => {
                    const timeA = new Date(a.date).getTime();
                    const timeB = new Date(b.date).getTime();
                    if (timeB !== timeA) return timeB - timeA;
                    const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    if (createdB !== createdA) return createdB - createdA;
                    return (b.id || '').localeCompare(a.id || '');
                  })
                  .slice(0, 8)
                  .map(j => {
                    const debitTotal = j.entries.filter(e => e.type === 'DEBIT').reduce((sum, e) => sum + e.amount, 0);
                    const creditTotal = j.entries.filter(e => e.type === 'CREDIT').reduce((sum, e) => sum + e.amount, 0);
                    const isInflow = (j.type === 'Revenue' || j.type === 'Capital' || j.subType === 'Loan Received') && j.subType !== 'Opening Balance';

                    return (
                      <tr key={j.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-semibold text-slate-600">{j.date}</td>
                        <td className="py-2.5 px-4">
                          <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                            isInflow ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {j.subType || j.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-800">{j.remarks}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-rose-600">
                          {!isInflow ? `₹${debitTotal.toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold text-emerald-600">
                          {isInflow ? `₹${debitTotal.toLocaleString('en-IN')}` : '-'}
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INTERNAL ACCOUNT TRANSFER MODAL */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <ArrowLeftRight size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Transfer Funds Between Accounts</h3>
                  <p className="text-xs text-slate-500">Internal contra entry across financial accounts</p>
                </div>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Transfer From (Source Account) *</label>
                <select
                  value={transferFromId}
                  onChange={e => setTransferFromId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 shadow-xs"
                >
                  {activeAccounts.map(acc => {
                    const bal = accountBalances[acc.id] ?? acc.openingBalance;
                    return (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountName} (Balance: ₹{bal.toLocaleString('en-IN')})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Transfer To (Destination Account) *</label>
                <select
                  value={transferToId}
                  onChange={e => setTransferToId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 shadow-xs"
                >
                  {activeAccounts.map(acc => {
                    const bal = accountBalances[acc.id] ?? acc.openingBalance;
                    return (
                      <option key={acc.id} value={acc.id} disabled={acc.id === transferFromId}>
                        {acc.accountName} (Balance: ₹{bal.toLocaleString('en-IN')}) {acc.id === transferFromId ? '• (Selected as Source)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={transferAmount}
                    onChange={e => setTransferAmount(e.target.value)}
                    placeholder="e.g. 10000"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-500 shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Transfer Date *</label>
                  <input
                    type="date"
                    required
                    value={transferDate}
                    onChange={e => setTransferDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-500 shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Remarks / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Transfer to savings account"
                  value={transferRemarks}
                  onChange={e => setTransferRemarks(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 shadow-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                >
                  Execute Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
