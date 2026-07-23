import React, { useState } from 'react';
import { JournalEntry } from '../../types';
import { recordCapitalInfusion, deleteJournalEntry, updateCapitalEntry } from '../../lib/accounting';
import { Landmark, ArrowDownLeft, ArrowUpRight, ShieldCheck, Plus, CheckCircle2, Star, Trash2, Pencil } from 'lucide-react';

interface OwnerEquityProps {
  journalEntries: JournalEntry[];
}

const OwnerEquity: React.FC<OwnerEquityProps> = ({ journalEntries = [] }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [subType, setSubType] = useState<'Opening Balance' | 'Owner Investment'>('Owner Investment');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  // Edit Equity Modal State
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [editSubType, setEditSubType] = useState<'Opening Balance' | 'Owner Investment' | 'Owner Withdrawal'>('Owner Investment');
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editRemarks, setEditRemarks] = useState('');

  const handleOpenEditModal = (entry: JournalEntry) => {
    setEditingEntry(entry);
    const resolvedType = (entry.subType as any) || (entry.type === 'Withdrawal' ? 'Owner Withdrawal' : 'Owner Investment');
    setEditSubType(resolvedType);
    const entryAmt = entry.entries.reduce((sum, e) => sum + e.amount, 0) / 2;
    setEditAmount(entryAmt ? entryAmt.toString() : '0');
    setEditDate(entry.date ? entry.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setEditRemarks(entry.remarks || '');
  };

  const handleSaveEditCapital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    if (!editAmount || Number(editAmount) <= 0) return alert("Please enter a valid amount.");
    if (!editDate) return alert("Please select date.");

    try {
      await updateCapitalEntry({
        id: editingEntry.id,
        subType: editSubType,
        amount: parseFloat(editAmount),
        date: new Date(editDate).toISOString(),
        remarks: editRemarks.trim() || (editSubType === 'Opening Balance' ? 'Opening Balance Migration' : 'Owner Capital Entry')
      });

      setEditingEntry(null);
      alert(`Equity entry updated successfully!`);
    } catch (err: any) {
      console.error(err);
      alert("Error updating equity entry: " + (err?.message || err));
    }
  };

  // Check if Opening Balance is already set
  const hasOpeningBalance = journalEntries.some(j => j.subType === 'Opening Balance');

  // Calculate Capital Contributions (Includes Opening Balance + Owner Investments)
  const capitalEntries = journalEntries
    .filter(j => j.type === 'Capital' || j.subType === 'Owner Investment' || j.subType === 'Opening Balance')
    .sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (timeB !== timeA) return timeB - timeA;
      const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (createdB !== createdA) return createdB - createdA;
      return (b.id || '').localeCompare(a.id || '');
    });

  const totalCapitalInvested = capitalEntries.reduce((sum, j) => {
    const creditLine = j.entries.find(e => e.type === 'CREDIT' && (e.accountType === 'Equity' || e.accountName.includes('Capital')));
    return sum + (creditLine ? creditLine.amount : 0);
  }, 0);

  // Calculate Owner Withdrawals (Drawings)
  const withdrawalEntries = journalEntries
    .filter(j => j.type === 'Withdrawal' || j.subType === 'Owner Withdrawal')
    .sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (timeB !== timeA) return timeB - timeA;
      const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (createdB !== createdA) return createdB - createdA;
      return (b.id || '').localeCompare(a.id || '');
    });

  const totalWithdrawals = withdrawalEntries.reduce((sum, j) => {
    const debitLine = j.entries.find(e => e.type === 'DEBIT');
    return sum + (debitLine ? debitLine.amount : 0);
  }, 0);

  // Calculate Retained Profits (Revenue - Operational Expenses - Loan Interest)
  const totalRevenue = journalEntries
    .filter(j => j.type === 'Revenue' || j.subType === 'Sales Revenue')
    .reduce((sum, j) => sum + (j.entries.find(e => e.type === 'DEBIT')?.amount || 0), 0);

  const totalExpenses = journalEntries
    .filter(j => j.type === 'Expense' || j.subType === 'Operational Expense')
    .reduce((sum, j) => sum + (j.entries.find(e => e.type === 'DEBIT')?.amount || 0), 0);

  const totalInterestPaid = journalEntries
    .filter(j => j.subType === 'Loan Repayment' && j.interestAmount)
    .reduce((sum, j) => sum + (j.interestAmount || 0), 0);

  const retainedProfit = totalRevenue - totalExpenses - totalInterestPaid;

  // Current Net Equity
  const currentNetEquity = totalCapitalInvested - totalWithdrawals + retainedProfit;

  // Open Modal logic
  const handleOpenModal = () => {
    if (hasOpeningBalance) {
      setSubType('Owner Investment');
      setRemarks('Capital Investment');
    } else {
      setSubType('Opening Balance');
      setRemarks('Opening Balance Migration');
    }
    setIsModalOpen(true);
  };

  const handleSaveCapital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return alert("Please enter a valid amount.");
    if (!date) return alert("Please select date.");

    try {
      await recordCapitalInfusion({
        subType,
        amount: parseFloat(amount),
        date: new Date(date).toISOString(),
        remarks: remarks || (subType === 'Opening Balance' ? 'Opening Balance Migration' : 'Owner Capital Infusion'),
        createdBy: 'Admin'
      });
      setAmount('');
      setRemarks('');
      setIsModalOpen(false);
      alert(`${subType} recorded successfully!`);
    } catch (err: any) {
      console.error(err);
      alert("Error recording capital: " + (err?.message || err));
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this capital/withdrawal entry?")) {
      try {
        await deleteJournalEntry(id);
      } catch (err: any) {
        alert("Error deleting entry: " + (err?.message || err));
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* HEADER STATEMENT */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Landmark size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Owner Equity & Capital Structure</h2>
              <p className="text-xs text-slate-500 font-medium">Summary of owner capital investments, opening balance, drawings, and retained earnings</p>
            </div>
          </div>

          <button
            onClick={handleOpenModal}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
          >
            <Plus size={15} />
            <span>+ Add Capital</span>
          </button>
        </div>

        {/* METRICS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Capital Invested</span>
            <div className="text-xl font-bold text-slate-900 mt-1">₹{totalCapitalInvested.toLocaleString('en-IN')}</div>
            <span className="text-[11px] text-emerald-600 font-medium mt-1 block">Opening Balance & Infusions</span>
          </div>

          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Owner Withdrawals</span>
            <div className="text-xl font-bold text-amber-600 mt-1">₹{totalWithdrawals.toLocaleString('en-IN')}</div>
            <span className="text-[11px] text-amber-600/80 font-medium mt-1 block">Drawings / Personal</span>
          </div>

          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cumulative Net Profit</span>
            <div className={`text-xl font-bold mt-1 ${retainedProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              ₹{retainedProfit.toLocaleString('en-IN')}
            </div>
            <span className="text-[11px] text-slate-500 font-medium mt-1 block">Retained Earnings</span>
          </div>

          <div className="bg-indigo-600 text-white p-4 rounded-xl shadow-sm">
            <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider block">Current Net Equity</span>
            <div className="text-xl font-extrabold mt-1">₹{currentNetEquity.toLocaleString('en-IN')}</div>
            <span className="text-[11px] text-indigo-100 font-medium mt-1 block">Total Owner Net Worth</span>
          </div>
        </div>
      </div>

      {/* EQUITY MOVEMENT LEDGER */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">Capital & Withdrawal History</h3>
          <span className="text-xs text-slate-400 font-medium">{[...capitalEntries, ...withdrawalEntries].length} Ledger Entries</span>
        </div>

        <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Entry Type</th>
                <th className="py-3 px-4">Remarks / Description</th>
                <th className="py-3 px-4 text-right">Investment (+ Capital)</th>
                <th className="py-3 px-4 text-right">Withdrawal (- Capital)</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {[...capitalEntries, ...withdrawalEntries].length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-medium text-xs">
                    No equity or withdrawal entries recorded yet. Click "+ Add Capital" to add opening balance or investment.
                  </td>
                </tr>
              ) : (
                [...capitalEntries, ...withdrawalEntries]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map(entry => {
                    const isCapital = entry.type === 'Capital' || entry.subType === 'Owner Investment' || entry.subType === 'Opening Balance';
                    const isOpening = entry.subType === 'Opening Balance';
                    const amount = entry.entries.reduce((sum, e) => sum + e.amount, 0) / 2;

                    return (
                      <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-medium text-slate-500">
                          {new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                            isOpening
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : isCapital
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {isOpening ? 'Opening Balance' : isCapital ? 'Owner Investment' : 'Owner Withdrawal'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-900">
                          {entry.remarks}
                        </td>
                        <td className="py-3.5 px-4 font-extrabold text-emerald-600 text-right">
                          {isCapital ? `+₹${amount.toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td className="py-3.5 px-4 font-extrabold text-amber-600 text-right">
                          {!isCapital ? `-₹${amount.toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(entry)}
                              className="p-1 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded transition"
                              title="Edit equity entry"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(entry.id)}
                              className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition"
                              title="Delete entry"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD CAPITAL MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Add Owner Capital</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleSaveCapital} className="space-y-3.5 text-xs">
              
              <div>
                <label className="block font-bold text-slate-700 mb-1">Entry Type *</label>
                <select
                  value={subType}
                  onChange={(e) => {
                    const selected = e.target.value as 'Opening Balance' | 'Owner Investment';
                    setSubType(selected);
                    if (selected === 'Opening Balance') setRemarks('Opening Balance Migration');
                    else setRemarks('Owner Capital Investment');
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                >
                  <option value="Opening Balance" disabled={hasOpeningBalance}>
                    Opening Balance {hasOpeningBalance ? '(Already Recorded)' : ''}
                  </option>
                  <option value="Owner Investment">Owner Investment</option>
                </select>
                {hasOpeningBalance && subType === 'Owner Investment' && (
                  <span className="text-[10px] text-slate-400 font-medium block mt-1">
                    Opening Balance has already been recorded for initial setup.
                  </span>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 74400"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Remarks / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Opening Balance Migration"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-500 font-medium border border-slate-200/60">
                💡 <span className="font-bold text-slate-700">{subType}</span> increases Total Capital & Net Equity. It will <span className="font-bold text-slate-700">not</span> affect Revenue or Profit & Loss.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-xs"
                >
                  Save Capital Entry
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* EDIT EQUITY MODAL */}
      {editingEntry && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Edit Capital / Withdrawal Entry</h3>
                <p className="text-[11px] text-slate-500 font-medium">Modify transaction amount, date, entry classification, or remarks</p>
              </div>
              <button onClick={() => setEditingEntry(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleSaveEditCapital} className="space-y-3.5 text-xs">
              
              <div>
                <label className="block font-bold text-slate-700 mb-1">Entry Classification *</label>
                <select
                  value={editSubType}
                  onChange={(e) => setEditSubType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                >
                  <option value="Opening Balance">Opening Balance Migration (+ Capital)</option>
                  <option value="Owner Investment">Owner Investment (+ Capital)</option>
                  <option value="Owner Withdrawal">Owner Withdrawal / Drawings (- Capital)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 50000"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Remarks / Migration Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Opening Capital Migration"
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs"
                >
                  Update Entry
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default OwnerEquity;
