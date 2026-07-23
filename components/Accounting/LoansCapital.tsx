import React, { useState, useEffect } from 'react';
import { AccountingCategory, AccountingLoan, JournalEntry, FinancialAccount } from '../../types';
import { recordLoan, deleteLoan, recordOpeningLiability, DEFAULT_FINANCIAL_ACCOUNTS } from '../../lib/accounting';
import { db } from '../../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { Landmark, Plus, Trash2, Calendar, CreditCard, ShieldCheck } from 'lucide-react';

interface LoansCapitalProps {
  financialAccounts?: FinancialAccount[];
  categories: AccountingCategory[];
  loans: AccountingLoan[];
  journalEntries: JournalEntry[];
}

const LoansCapital: React.FC<LoansCapitalProps> = ({ financialAccounts = [], categories = [], loans = [], journalEntries = [] }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [isOpeningModalOpen, setIsOpeningModalOpen] = useState(false);

  // Firestore Financial Accounts subscription fallback
  const [dbFinancialAccounts, setDbFinancialAccounts] = useState<FinancialAccount[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'accounting_financial_accounts'), (snapshot) => {
      const accs: FinancialAccount[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinancialAccount));
      setDbFinancialAccounts(accs);
    });
    return () => unsub();
  }, []);

  // Filter ONLY Financial Accounts for Deposit Funds To (No Asset categories like Furniture, AC, Laptops!)
  const combinedAccounts = financialAccounts.length > 0 ? financialAccounts : dbFinancialAccounts;
  const activeFinancialAccounts = combinedAccounts.length > 0
    ? combinedAccounts.filter(a => a.status === 'Active')
    : DEFAULT_FINANCIAL_ACCOUNTS.map((a, idx) => ({ ...a, id: `default_fin_${idx}` } as FinancialAccount));

  // New Loan Form State (Go-Live Normal Loans)
  const [loanName, setLoanName] = useState('');
  const [lenderName, setLenderName] = useState('');
  const [source, setSource] = useState<AccountingLoan['source']>('Bank');
  const [amount, setAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [emiAmount, setEmiAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [depositAccountId, setDepositAccountId] = useState('');
  const [remarks, setRemarks] = useState('');

  // Opening Liability Form State (Migration)
  const [opName, setOpName] = useState('');
  const [opLender, setOpLender] = useState('');
  const [opSource, setOpSource] = useState<AccountingLoan['source']>('Bank');
  const [opAmount, setOpAmount] = useState('');
  const [opDate, setOpDate] = useState(new Date().toISOString().split('T')[0]);
  const [opInterestRate, setOpInterestRate] = useState('');
  const [opEmiAmount, setOpEmiAmount] = useState('');
  const [opRemarks, setOpRemarks] = useState('');

  const totalOriginalLoanAmount = loans.reduce((sum, l) => sum + l.amount, 0);
  const totalOutstandingBalance = loans.reduce((sum, l) => sum + l.remainingBalance, 0);
  const totalRepaidAmount = totalOriginalLoanAmount - totalOutstandingBalance;

  // Auto select default deposit financial account
  useEffect(() => {
    if (activeFinancialAccounts.length > 0 && !depositAccountId) {
      const def = activeFinancialAccounts.find(a => a.isDefault) || activeFinancialAccounts[0];
      setDepositAccountId(def.id);
    }
  }, [activeFinancialAccounts, depositAccountId]);

  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanName || !lenderName || !amount) return alert("Please fill required loan fields.");

    const chosenAccount = activeFinancialAccounts.find(a => a.id === depositAccountId) || activeFinancialAccounts[0];

    const destAccount: AccountingCategory = {
      id: chosenAccount.id,
      name: chosenAccount.accountName,
      type: 'Asset',
      status: 'Active',
      isDefault: chosenAccount.isDefault,
      createdAt: chosenAccount.createdAt || new Date().toISOString()
    };

    const newLoan: AccountingLoan = {
      id: Math.random().toString(36).substring(2, 15),
      name: loanName,
      lender: lenderName,
      source,
      amount: parseFloat(amount),
      remainingBalance: parseFloat(amount),
      interestRate: interestRate ? parseFloat(interestRate) : undefined,
      emiAmount: emiAmount ? parseFloat(emiAmount) : undefined,
      date: new Date(date).toISOString(),
      startDate: new Date(date).toISOString(),
      status: 'Active',
      remarks,
      createdAt: new Date().toISOString()
    };

    try {
      await recordLoan(newLoan, destAccount);
      setLoanName('');
      setLenderName('');
      setAmount('');
      setInterestRate('');
      setEmiAmount('');
      setRemarks('');
      setShowAddForm(false);
      alert(`Loan recorded successfully! Funds deposited to "${chosenAccount.accountName}".`);
    } catch (err: any) {
      alert("Error saving loan: " + err.message);
    }
  };

  const handleSaveOpeningLiability = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opName.trim() || !opLender.trim() || !opAmount) return alert("Please fill required liability fields.");

    try {
      await recordOpeningLiability({
        name: opName.trim(),
        lender: opLender.trim(),
        source: opSource,
        amount: parseFloat(opAmount),
        date: new Date(opDate).toISOString(),
        interestRate: opInterestRate ? parseFloat(opInterestRate) : undefined,
        emiAmount: opEmiAmount ? parseFloat(opEmiAmount) : undefined,
        remarks: opRemarks.trim() || 'Opening Liability Migration'
      });

      setOpName('');
      setOpLender('');
      setOpAmount('');
      setOpInterestRate('');
      setOpEmiAmount('');
      setOpRemarks('');
      setIsOpeningModalOpen(false);
      alert(`Opening Liability "${opName.trim()}" registered successfully!`);
    } catch (err: any) {
      console.error(err);
      alert("Error saving opening liability: " + (err?.message || err));
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this liability account?")) {
      try {
        await deleteLoan(id);
      } catch (err: any) {
        alert("Error deleting liability: " + err.message);
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* HEADER METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Outstanding Debt</span>
          <div className="text-2xl font-bold text-rose-600 mt-1">₹{totalOutstandingBalance.toLocaleString('en-IN')}</div>
          <span className="text-xs text-slate-500 font-medium mt-1 block">Current Total Liabilities</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Principal Repaid</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">₹{totalRepaidAmount.toLocaleString('en-IN')}</div>
          <span className="text-xs text-emerald-600/80 font-medium mt-1 block">Paid Off Principal Amount</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Liabilities Borrowed</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">₹{totalOriginalLoanAmount.toLocaleString('en-IN')}</div>
          <span className="text-xs text-slate-500 font-medium mt-1 block">{loans.length} Liability Accounts</span>
        </div>
      </div>

      {/* LOANS & LIABILITIES MANAGEMENT */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Landmark className="text-slate-800" size={20} />
            <div>
              <h2 className="text-base font-bold text-slate-900">Loans & Liabilities</h2>
              <p className="text-xs text-slate-500 font-medium">Manage bank financing, family loans, EMIs, and opening liabilities</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsOpeningModalOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>+ Add Opening Liability</span>
            </button>

            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>{showAddForm ? 'Cancel' : 'Record New Loan'}</span>
            </button>
          </div>
        </div>

        {/* NEW LOAN FORM (POST GO-LIVE) */}
        {showAddForm && (
          <form onSubmit={handleSaveLoan} className="bg-slate-50/80 p-5 rounded-xl border border-slate-200 space-y-4 animate-in fade-in">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Record New Loan (Post Go-Live)</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Loan Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MacBook Finance, Office Loan"
                  value={loanName}
                  onChange={e => setLoanName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-800 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Lender Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Bank, Mother, Friend"
                  value={lenderName}
                  onChange={e => setLenderName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-800 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Loan Source *</label>
                <select
                  value={source}
                  onChange={e => setSource(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-800 shadow-xs font-semibold"
                >
                  <option value="Bank">Bank</option>
                  <option value="Family">Family</option>
                  <option value="Friend">Friend</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Finance Company">Finance Company</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Principal Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="Loan amount"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-800 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Deposit Funds To (Financial Account) *</label>
                <select
                  value={depositAccountId}
                  onChange={e => setDepositAccountId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-slate-800 shadow-xs"
                >
                  {activeFinancialAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.accountName} ({a.accountType})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Received Date *</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-800 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Interest Rate (%)</label>
                <input
                  type="number"
                  placeholder="e.g. 10.5"
                  value={interestRate}
                  onChange={e => setInterestRate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-800 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Monthly EMI (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={emiAmount}
                  onChange={e => setEmiAmount(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-800 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Remarks</label>
                <input
                  type="text"
                  placeholder="Notes..."
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-800 shadow-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="bg-white border border-slate-200 text-slate-600 text-xs px-4 py-2 rounded-xl font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-slate-900 text-white text-xs px-5 py-2 rounded-xl font-semibold hover:bg-slate-800 shadow-xs"
              >
                Save Loan
              </button>
            </div>
          </form>
        )}

        {/* LOANS & LIABILITIES TABLE */}
        <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-4">Liability Account</th>
                <th className="py-3 px-4">Lender / Source</th>
                <th className="py-3 px-4 text-right">Original Principal</th>
                <th className="py-3 px-4 text-right">Outstanding Balance</th>
                <th className="py-3 px-4">Interest / EMI</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-medium text-xs">
                    No liability or loan accounts recorded yet. Click "+ Add Opening Liability" for setup migration.
                  </td>
                </tr>
              ) : (
                loans.map(loan => {
                  const status = loan.status || (loan.remainingBalance <= 0 ? 'Paid Off' : 'Active');
                  const isOpening = loan.isOpeningBalance;

                  return (
                    <tr key={loan.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {loan.name}
                        {loan.remarks && <span className="block text-[11px] text-slate-400 font-normal">{loan.remarks}</span>}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <span>{loan.lender} ({loan.source || 'Lender'})</span>
                          {isOpening && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                              Opening Balance
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 text-right">
                        ₹{loan.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-rose-600 text-right">
                        ₹{loan.remainingBalance.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {loan.interestRate ? `${loan.interestRate}% Int` : '0% Int'}
                        {loan.emiAmount ? ` • ₹${loan.emiAmount}/mo EMI` : ''}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                          status === 'Active' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleDelete(loan.id)}
                          className="p-1 text-slate-400 hover:text-red-600"
                          title="Delete liability record"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE OPENING LIABILITY MODAL */}
      {isOpeningModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Add Opening Liability</h3>
                <p className="text-[11px] text-slate-500 font-medium">Migrate pre-existing debts prior to accounting setup</p>
              </div>
              <button onClick={() => setIsOpeningModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleSaveOpeningLiability} className="space-y-3.5 text-xs">
              
              <div>
                <label className="block font-bold text-slate-700 mb-1">Liability Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Office Loan, Car Finance"
                  value={opName}
                  onChange={(e) => setOpName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Lender Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Bank, Friend, Father"
                  value={opLender}
                  onChange={(e) => setOpLender(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Liability Source *</label>
                <select
                  value={opSource}
                  onChange={(e) => setOpSource(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                >
                  <option value="Bank">Bank</option>
                  <option value="Family">Family</option>
                  <option value="Friend">Friend</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Finance Company">Finance Company</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Outstanding Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 50000"
                    value={opAmount}
                    onChange={(e) => setOpAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Opening Date *</label>
                  <input
                    type="date"
                    required
                    value={opDate}
                    onChange={(e) => setOpDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Interest Rate (%) (Optional)</label>
                  <input
                    type="number"
                    placeholder="e.g. 10.5"
                    value={opInterestRate}
                    onChange={(e) => setOpInterestRate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Monthly EMI (₹) (Optional)</label>
                  <input
                    type="number"
                    placeholder="e.g. 2500"
                    value={opEmiAmount}
                    onChange={(e) => setOpEmiAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Remarks / Migration Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Opening Balance Migration"
                  value={opRemarks}
                  onChange={(e) => setOpRemarks(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="p-3 bg-blue-50/80 rounded-xl text-[11px] text-blue-700 font-medium border border-blue-200/60">
                💡 <span className="font-bold">Opening Liability Rule</span>: Increases Total Liabilities without creating Money In entries or depositing money into Cash/Bank accounts.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpeningModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs"
                >
                  Save Opening Liability
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default LoansCapital;
