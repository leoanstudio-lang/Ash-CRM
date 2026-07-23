import React, { useState } from 'react';
import { AccountingCategory, AccountType, FinancialAccount, FinancialAccountType, JournalEntry } from '../../types';
import { db } from '../../lib/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import {
  addFinancialAccountToDB,
  updateFinancialAccountInDB,
  deleteFinancialAccountFromDB,
  calculateAccountBalances
} from '../../lib/accounting';
import {
  Edit2,
  CheckCircle2,
  XCircle,
  Settings as SettingsIcon,
  Landmark,
  Wallet,
  CreditCard,
  Building,
  Plus,
  Star,
  Eye,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Tag
} from 'lucide-react';

interface SettingsProps {
  financialAccounts?: FinancialAccount[];
  categories: AccountingCategory[];
  journalEntries?: JournalEntry[];
}

const Settings: React.FC<SettingsProps> = ({ financialAccounts = [], categories = [], journalEntries = [] }) => {
  const [activeTab, setActiveTab] = useState<'financial-accounts' | 'categories'>('financial-accounts');

  // --- FINANCIAL ACCOUNTS FORM STATE ---
  const [isAccModalOpen, setIsAccModalOpen] = useState(false);
  const [editingAcc, setEditingAcc] = useState<FinancialAccount | null>(null);

  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<FinancialAccountType>('Bank');
  const [bankName, setBankName] = useState('');
  const [accNumber, setAccNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [openingBal, setOpeningBal] = useState<number>(0);
  const [openingDate, setOpeningDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [accStatus, setAccStatus] = useState<'Active' | 'Inactive'>('Active');
  const [isDefault, setIsDefault] = useState<boolean>(false);
  const [accRemarks, setAccRemarks] = useState('');

  // --- TRANSACTIONS VIEW MODAL STATE ---
  const [viewingAcc, setViewingAcc] = useState<FinancialAccount | null>(null);

  // --- CATEGORY FORM STATE ---
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<AccountingCategory | null>(null);
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<AccountType>('Revenue');
  const [catStatus, setCatStatus] = useState<'Active' | 'Disabled'>('Active');

  // Calculate dynamic real-time balances for all accounts
  const accountBalances = calculateAccountBalances(financialAccounts, journalEntries);

  // OPEN ACCOUNT FORM
  const openAccForm = (acc?: FinancialAccount) => {
    if (acc) {
      setEditingAcc(acc);
      setAccName(acc.accountName);
      setAccType(acc.accountType);
      setBankName(acc.bankName || '');
      setAccNumber(acc.accountNumber || '');
      setIfscCode(acc.ifscCode || '');
      setOpeningBal(acc.openingBalance);
      setOpeningDate(acc.openingBalanceDate || new Date().toISOString().split('T')[0]);
      setAccStatus(acc.status);
      setIsDefault(acc.isDefault);
      setAccRemarks(acc.remarks || '');
    } else {
      setEditingAcc(null);
      setAccName('');
      setAccType('Bank');
      setBankName('');
      setAccNumber('');
      setIfscCode('');
      setOpeningBal(0);
      setOpeningDate(new Date().toISOString().split('T')[0]);
      setAccStatus('Active');
      setIsDefault(financialAccounts.length === 0);
      setAccRemarks('');
    }
    setIsAccModalOpen(true);
  };

  // SAVE ACCOUNT
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return;

    try {
      const payload: Omit<FinancialAccount, 'id' | 'createdAt'> = {
        accountName: accName.trim(),
        accountType: accType,
        bankName: accType === 'Bank' ? bankName.trim() : undefined,
        accountNumber: accNumber.trim() || undefined,
        ifscCode: ifscCode.trim() || undefined,
        openingBalance: Number(openingBal) || 0,
        openingBalanceDate: openingDate,
        status: accStatus,
        isDefault,
        remarks: accRemarks.trim() || undefined
      };

      if (editingAcc) {
        await updateFinancialAccountInDB(editingAcc.id, payload);
      } else {
        await addFinancialAccountToDB(payload);
      }
      setIsAccModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Error saving financial account');
    }
  };

  // TOGGLE STATUS
  const handleToggleAccStatus = async (acc: FinancialAccount) => {
    try {
      const newStatus = acc.status === 'Active' ? 'Inactive' : 'Active';
      await updateFinancialAccountInDB(acc.id, { status: newStatus });
    } catch (err) {
      console.error(err);
    }
  };

  // DELETE ACCOUNT
  const handleDeleteAccount = async (acc: FinancialAccount) => {
    if (window.confirm(`Are you sure you want to delete the financial account "${acc.accountName}"?`)) {
      try {
        await deleteFinancialAccountFromDB(acc.id);
      } catch (err: any) {
        console.error("Error deleting financial account:", err);
        alert("Failed to delete account: " + (err?.message || err));
      }
    }
  };

  // CATEGORY HANDLERS
  const openCatForm = (cat?: AccountingCategory, defaultType: AccountType = 'Revenue') => {
    if (cat) {
      setEditingCat(cat);
      setCatName(cat.name);
      setCatType(cat.type);
      setCatStatus(cat.status);
    } else {
      setEditingCat(null);
      setCatName('');
      setCatType(defaultType);
      setCatStatus('Active');
    }
    setIsCatModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    try {
      const docRef = editingCat ? doc(db, 'accounting_categories', editingCat.id) : doc(collection(db, 'accounting_categories'));
      const payload: Partial<AccountingCategory> = {
        name: catName.trim(),
        type: catType,
        status: catStatus,
        isDefault: editingCat ? editingCat.isDefault : false
      };
      if (!editingCat) {
        payload.id = docRef.id;
        payload.createdAt = new Date().toISOString();
      }
      await setDoc(docRef, payload, { merge: true });
      setIsCatModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Error saving category');
    }
  };

  const handleDeleteCategory = async (cat: AccountingCategory) => {
    if (window.confirm(`Are you sure you want to delete category "${cat.name}"?`)) {
      try {
        const { deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(db, 'accounting_categories', cat.id));
      } catch (err: any) {
        console.error(err);
        alert("Failed to delete category: " + (err?.message || err));
      }
    }
  };

  const accountTypeIcon = (type: FinancialAccountType) => {
    switch (type) {
      case 'Bank': return <Landmark size={16} className="text-blue-600" />;
      case 'Cash': case 'Petty Cash': return <Wallet size={16} className="text-emerald-600" />;
      case 'UPI': return <Building size={16} className="text-purple-600" />;
      case 'Credit Card': case 'Payment Gateway': return <CreditCard size={16} className="text-amber-600" />;
      default: return <Wallet size={16} className="text-slate-600" />;
    }
  };

  // Group categories by type
  const groupedCategories = categories.reduce((acc, cat) => {
    if (!acc[cat.type]) acc[cat.type] = [];
    acc[cat.type].push(cat);
    return acc;
  }, {} as Record<string, AccountingCategory[]>);

  const categoryTypes: AccountType[] = ['Revenue', 'Expense', 'Asset', 'Liability', 'Equity'];

  // Filter transactions for viewing account ledger
  const accountTransactions = viewingAcc
    ? journalEntries.filter(j =>
        !j.isVoided &&
        j.entries.some(e =>
          e.financialAccountId === viewingAcc.id ||
          j.financialAccountId === viewingAcc.id ||
          (e.accountType === 'Asset' && e.accountName.toLowerCase().includes(viewingAcc.accountName.toLowerCase()))
        )
      )
    : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* SETTINGS SUB NAVIGATION */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-700">
            <SettingsIcon size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Finance Settings & Accounts</h2>
            <p className="text-xs text-slate-500 font-medium">Manage bank accounts, cash wallets & chart of accounts</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200/80">
          <button
            onClick={() => setActiveTab('financial-accounts')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'financial-accounts' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Financial Accounts
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'categories' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Chart of Accounts
          </button>
        </div>
      </div>

      {/* 1. FINANCIAL ACCOUNTS MANAGEMENT TAB */}
      {activeTab === 'financial-accounts' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Cash, Bank & Payment Accounts</h3>
              <p className="text-xs text-slate-500">Configure liquid accounts used for Money In, Money Out & Expense transactions</p>
            </div>

            <button
              onClick={() => openAccForm()}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
            >
              <Plus size={15} />
              <span>Add Financial Account</span>
            </button>
          </div>

          {/* ACCOUNTS TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Account Name & Details</th>
                  <th className="py-3 px-4">Account Type</th>
                  <th className="py-3 px-4 text-right">Opening Balance</th>
                  <th className="py-3 px-4 text-right">Current Balance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {financialAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                      No financial accounts configured. Click "+ Add Financial Account" to get started.
                    </td>
                  </tr>
                ) : (
                  financialAccounts.map((acc) => {
                    const balance = accountBalances[acc.id] ?? acc.openingBalance;
                    return (
                      <tr key={acc.id} className="hover:bg-slate-50/50 transition-colors">
                        
                        {/* Account Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-slate-100 rounded-xl">
                              {accountTypeIcon(acc.accountType)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900">{acc.accountName}</span>
                                {acc.isDefault && (
                                  <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                    <Star size={10} className="fill-amber-600 text-amber-600" /> Default
                                  </span>
                                )}
                              </div>
                              {acc.accountType === 'Bank' && (
                                <p className="text-[11px] text-slate-500">
                                  {acc.bankName} {acc.accountNumber ? `• A/C: ${acc.accountNumber}` : ''} {acc.ifscCode ? `• IFSC: ${acc.ifscCode}` : ''}
                                </p>
                              )}
                              {acc.remarks && <p className="text-[10px] text-slate-400 italic">{acc.remarks}</p>}
                            </div>
                          </div>
                        </td>

                        {/* Account Type */}
                        <td className="py-3.5 px-4">
                          <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-bold text-[11px]">
                            {acc.accountType}
                          </span>
                        </td>

                        {/* Opening Balance */}
                        <td className="py-3.5 px-4 text-right font-medium text-slate-600">
                          ₹{acc.openingBalance.toLocaleString('en-IN')}
                        </td>

                        {/* Current Balance */}
                        <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 text-sm">
                          ₹{balance.toLocaleString('en-IN')}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                            acc.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {acc.status === 'Active' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                            {acc.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            
                            <button
                              onClick={() => setViewingAcc(acc)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition"
                              title="View Account Transactions"
                            >
                              <Eye size={15} />
                            </button>

                            <button
                              onClick={() => openAccForm(acc)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition"
                              title="Edit Account"
                            >
                              <Edit2 size={15} />
                            </button>

                            <button
                              onClick={() => handleToggleAccStatus(acc)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                                acc.status === 'Active'
                                  ? 'text-amber-600 hover:bg-amber-50'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              {acc.status === 'Active' ? 'Deactivate' : 'Activate'}
                            </button>

                            <button
                              onClick={() => handleDeleteAccount(acc)}
                              className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition"
                              title="Delete Financial Account"
                            >
                              <Trash2 size={15} />
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
      )}

      {/* 2. CHART OF ACCOUNTS CATEGORIES TAB */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Chart of Accounts Categories</h3>
              <p className="text-xs text-slate-500">Configure accounting heads for Expenses, Revenues, Assets, Liabilities & Equity</p>
            </div>

            <button
              onClick={() => openCatForm()}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
            >
              <Plus size={15} />
              <span>Add Category</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
            {categoryTypes.map((type) => (
              <div key={type} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {type}
                  </h3>
                  <button
                    onClick={() => openCatForm(undefined, type)}
                    className="text-[10px] font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-lg transition"
                    title={`Add new ${type} account head`}
                  >
                    <Plus size={12} /> Add
                  </button>
                </div>

                <div className="space-y-1.5">
                  {(groupedCategories[type] || []).length === 0 ? (
                    <p className="text-[10px] text-slate-400 font-medium py-2">No {type} accounts configured.</p>
                  ) : (
                    (groupedCategories[type] || []).map((cat) => (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition group text-xs"
                      >
                        <div className="flex items-center gap-2">
                          {cat.status === 'Active' ? <CheckCircle2 size={13} className="text-emerald-500" /> : <XCircle size={13} className="text-slate-300" />}
                          <span className={`font-semibold ${cat.status === 'Active' ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                            {cat.name}
                          </span>
                          {cat.isDefault && <span className="text-[8px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">Sys</span>}
                        </div>

                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => openCatForm(cat)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-800 transition"
                            title="Edit Category"
                          >
                            <Edit2 size={13} />
                          </button>

                          {!cat.isDefault && (
                            <button
                              onClick={() => handleDeleteCategory(cat)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition"
                              title="Delete Category"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE / EDIT FINANCIAL ACCOUNT MODAL */}
      {isAccModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingAcc ? 'Edit Financial Account' : 'Create Financial Account'}
              </h3>
              <button onClick={() => setIsAccModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-3.5 text-xs">
              
              <div>
                <label className="block font-bold text-slate-700 mb-1">Account Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Office Cash, Federal Bank Current Account, Company UPI"
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Account Type *</label>
                <select
                  value={accType}
                  onChange={(e) => setAccType(e.target.value as FinancialAccountType)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-slate-800"
                >
                  <option value="Cash">Cash in Hand</option>
                  <option value="Petty Cash">Petty Cash</option>
                  <option value="Bank">Bank Account</option>
                  <option value="UPI">UPI Wallet</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Payment Gateway">Payment Gateway</option>
                  <option value="Other">Other Financial Account</option>
                </select>
              </div>

              {accType === 'Bank' && (
                <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80 animate-in fade-in">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Bank Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Federal Bank, HDFC Bank, SBI"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 font-semibold focus:outline-none focus:border-slate-800"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-600 mb-1">Account Number</label>
                      <input
                        type="text"
                        placeholder="e.g. 1234567890"
                        value={accNumber}
                        onChange={(e) => setAccNumber(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 font-semibold focus:outline-none focus:border-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 mb-1">IFSC Code</label>
                      <input
                        type="text"
                        placeholder="e.g. FDRL0001234"
                        value={ifscCode}
                        onChange={(e) => setIfscCode(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 font-semibold focus:outline-none focus:border-slate-800"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Opening Balance (₹)</label>
                  <input
                    type="number"
                    value={openingBal}
                    onChange={(e) => setOpeningBal(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Opening Balance Date</label>
                  <input
                    type="date"
                    value={openingDate}
                    onChange={(e) => setOpeningDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Account Status</label>
                  <select
                    value={accStatus}
                    onChange={(e) => setAccStatus(e.target.value as 'Active' | 'Inactive')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-slate-800"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDefault}
                      onChange={(e) => setIsDefault(e.target.checked)}
                      className="w-4 h-4 rounded text-slate-900 focus:ring-slate-800"
                    />
                    <span className="font-bold text-slate-800">Set as Default</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Remarks / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional account description or purpose"
                  value={accRemarks}
                  onChange={(e) => setAccRemarks(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAccModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-xs"
                >
                  {editingAcc ? 'Update Account' : 'Save Account'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT CATEGORY MODAL */}
      {isCatModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingCat ? 'Edit Category' : 'Create Category'}
              </h3>
              <button onClick={() => setIsCatModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Type *</label>
                <select
                  value={catType}
                  onChange={(e) => setCatType(e.target.value as AccountType)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-slate-800"
                >
                  {categoryTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Status</label>
                <select
                  value={catStatus}
                  onChange={(e) => setCatStatus(e.target.value as 'Active' | 'Disabled')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-slate-800"
                >
                  <option value="Active">Active</option>
                  <option value="Disabled">Disabled</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-xs"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW ACCOUNT TRANSACTIONS MODAL */}
      {viewingAcc && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 shadow-xl space-y-4">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-slate-100 rounded-xl">
                  {accountTypeIcon(viewingAcc.accountType)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{viewingAcc.accountName} — Account Ledger</h3>
                  <p className="text-xs text-slate-500 font-medium">Opening Balance: ₹{viewingAcc.openingBalance.toLocaleString('en-IN')}</p>
                </div>
              </div>

              <button onClick={() => setViewingAcc(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="max-h-96 overflow-y-auto border border-slate-200/80 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Transaction Details</th>
                    <th className="py-2.5 px-3 text-right">Inflow (₹)</th>
                    <th className="py-2.5 px-3 text-right">Outflow (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {accountTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400 font-medium">
                        No transactions recorded for this financial account.
                      </td>
                    </tr>
                  ) : (
                    accountTransactions.map((j) => {
                      const line = j.entries.find(e =>
                        e.financialAccountId === viewingAcc.id ||
                        j.financialAccountId === viewingAcc.id ||
                        e.accountName.toLowerCase().includes(viewingAcc.accountName.toLowerCase())
                      );
                      const isInflow = line?.type === 'DEBIT';
                      const amt = line?.amount || 0;

                      return (
                        <tr key={j.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-semibold text-slate-600">{j.date}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">
                            <div>{j.remarks || j.type}</div>
                            {j.clientName && <span className="text-[10px] text-slate-400">Client: {j.clientName}</span>}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                            {isInflow ? `+₹${amt.toLocaleString('en-IN')}` : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                            {!isInflow ? `-₹${amt.toLocaleString('en-IN')}` : '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-700">
                Calculated Current Balance: <span className="text-slate-900 font-extrabold text-sm">₹{(accountBalances[viewingAcc.id] ?? viewingAcc.openingBalance).toLocaleString('en-IN')}</span>
              </span>
              <button
                onClick={() => setViewingAcc(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Settings;
