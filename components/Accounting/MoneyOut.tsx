import React, { useState, useEffect } from 'react';
import { AccountingCategory, JournalEntry, MoneyOutType, AccountingLoan, FinancialAccount, Vendor } from '../../types';
import {
  recordOperationalExpense,
  recordFixedAssetPurchase,
  recordLoanRepayment,
  recordOwnerWithdrawal,
  recordSecurityDeposit,
  deleteJournalEntry,
  updateMoneyOutEntry,
  addVendorToDB,
  recordAccountTransfer
} from '../../lib/accounting';
import { VENDOR_TYPES } from './VendorsView';
import { ArrowUpRight, Plus, Trash2, Edit2, Tag, Calendar, Wallet, User, Building2, ShoppingBag, ShieldCheck, Laptop, X, ArrowLeftRight } from 'lucide-react';

interface MoneyOutProps {
  vendors?: Vendor[];
  financialAccounts?: FinancialAccount[];
  categories: AccountingCategory[];
  loans?: AccountingLoan[];
  journalEntries: JournalEntry[];
}

const MONEY_OUT_TYPES: MoneyOutType[] = [
  'Operational Expense',
  'Fixed Asset Purchase',
  'Loan Repayment',
  'Owner Withdrawal',
  'Security Deposit',
  'Advance Payment',
  'Internal Account Transfer',
  'Other Payment'
];

const OPERATIONAL_EXPENSE_CATEGORIES = [
  'Salary',
  'Office Rent',
  'Electricity',
  'Internet',
  'Fuel',
  'Travel',
  'Marketing',
  'Office Supplies',
  'Software Subscription',
  'Printing',
  'Food',
  'Miscellaneous'
];

const FIXED_ASSET_CATEGORIES = [
  'Computer & Laptops',
  'Furniture & Fixtures',
  'AC & Appliances',
  'Camera & Lighting',
  'Office Equipment',
  'Vehicle',
  'Software License (Capitalized)'
];

const MoneyOut: React.FC<MoneyOutProps> = ({ vendors = [], financialAccounts = [], categories = [], loans = [], journalEntries = [] }) => {
  const [transactionType, setTransactionType] = useState<MoneyOutType>('Operational Expense');

  // Form Fields
  const [amount, setAmount] = useState('');
  const [expenseCategoryId, setExpenseCategoryId] = useState('');
  const [customExpenseCategory, setCustomExpenseCategory] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [transferToAccountId, setTransferToAccountId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [selectedVendorName, setSelectedVendorName] = useState('');

  // Fixed Asset Specific Fields
  const [assetName, setAssetName] = useState('');
  const [assetCategoryName, setAssetCategoryName] = useState('Computer & Laptops');
  const [customAssetCategory, setCustomAssetCategory] = useState('');
  const [assetPurchaseDate, setAssetPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [usefulLifeYears, setUsefulLifeYears] = useState('3');

  // Loan Repayment Specific Fields
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [principalPaid, setPrincipalPaid] = useState('');
  const [interestPaid, setInterestPaid] = useState('0');

  // Inline Add Vendor Modal State
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorType, setNewVendorType] = useState<string>('Vendor / Supplier');
  const [newVendorContact, setNewVendorContact] = useState('');
  const [newVendorMobile, setNewVendorMobile] = useState('');

  // ==========================================
  // EDIT MONEY OUT ENTRY MODAL STATE
  // ==========================================
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editPaymentAccountId, setEditPaymentAccountId] = useState('');
  const [editSubType, setEditSubType] = useState<MoneyOutType>('Operational Expense');
  const [editExpenseCategoryName, setEditExpenseCategoryName] = useState('');
  const [editVendor, setEditVendor] = useState('');
  const [editRemarks, setEditRemarks] = useState('');

  const activeFinancialAccounts = financialAccounts.filter(a => a.status === 'Active');
  const defaultAccount = activeFinancialAccounts.find(a => a.isDefault) || activeFinancialAccounts[0];

  // Auto-set default financial account
  useEffect(() => {
    if (defaultAccount && !paymentAccountId) {
      setPaymentAccountId(defaultAccount.id);
    }
  }, [defaultAccount, paymentAccountId]);

  const expenseCategories = categories.filter(c => c.type === 'Expense' && c.status === 'Active');
  const assetAccounts = categories.filter(c => c.type === 'Asset' && c.status === 'Active');
  const activeLoans = loans.filter(l => l.status === 'Active');

  // Combine Category Defaults with User Categories
  const existingCategoryNames = expenseCategories.map(c => c.name);
  const allExpenseCategoryOptions = Array.from(new Set([...OPERATIONAL_EXPENSE_CATEGORIES, ...existingCategoryNames]));
  const assetCategoryOptions = Array.from(new Set([...FIXED_ASSET_CATEGORIES]));

  // Auto select first loan if available
  useEffect(() => {
    if (activeLoans.length > 0 && !selectedLoanId) {
      setSelectedLoanId(activeLoans[0].id);
    }
  }, [activeLoans, selectedLoanId]);

  // Filter Money Out Entries (Excluding Opening Balance entries)
  const moneyOutEntries = journalEntries
    .filter(j =>
      (j.type === 'Expense' || j.type === 'Withdrawal' || j.type === 'Deposit' || (j.type === 'Asset' && j.subType !== 'Opening Asset') || (j.type === 'Loan' && j.subType === 'Loan Repayment')) &&
      j.subType !== 'Opening Balance'
    )
    .sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (timeB !== timeA) return timeB - timeA;
      const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (createdB !== createdA) return createdB - createdA;
      return (b.id || '').localeCompare(a.id || '');
    });

  const totalMoneyOut = moneyOutEntries.reduce((sum, j) => {
    const debitLine = j.entries.find(e => e.type === 'DEBIT');
    return sum + (debitLine ? debitLine.amount : 0);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) return alert("Please enter a valid amount.");

    const selectedFinAcc = activeFinancialAccounts.find(a => a.id === paymentAccountId);
    const payAccount: AccountingCategory = selectedFinAcc
      ? {
          id: selectedFinAcc.id,
          name: selectedFinAcc.accountName,
          type: 'Asset',
          status: 'Active',
          isDefault: selectedFinAcc.isDefault,
          createdAt: selectedFinAcc.createdAt
        }
      : assetAccounts.find(a => a.id === paymentAccountId) || assetAccounts[0] || {
          id: 'bank_acc', name: 'Bank Account', type: 'Asset', status: 'Active', isDefault: true, createdAt: ''
        };

    try {
      if (transactionType === 'Operational Expense' || transactionType === 'Advance Payment' || transactionType === 'Other Payment') {
        const targetCategoryName = expenseCategoryId === '__NEW__'
          ? customExpenseCategory
          : expenseCategoryId || 'Miscellaneous';

        const expCat: AccountingCategory = {
          id: `cat_${targetCategoryName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          name: targetCategoryName,
          type: 'Expense',
          status: 'Active',
          isDefault: true,
          createdAt: new Date().toISOString()
        };

        await recordOperationalExpense({
          amount: parsedAmount,
          expenseCategory: expCat,
          paymentAccount: payAccount,
          date: new Date(date).toISOString(),
          remarks: remarks || `${transactionType}: ${targetCategoryName}`,
          vendor: selectedVendorName || undefined,
          createdBy: 'Admin'
        });

      } else if (transactionType === 'Fixed Asset Purchase') {
        if (!assetName.trim()) return alert("Please enter Asset Name.");
        const finalCategory = assetCategoryName === '__NEW__' ? customAssetCategory : assetCategoryName;

        await recordFixedAssetPurchase({
          assetName,
          categoryName: finalCategory || 'Office Equipment',
          purchaseCost: parsedAmount,
          purchaseDate: new Date(assetPurchaseDate).toISOString(),
          usefulLifeYears: parseFloat(usefulLifeYears) || 3,
          paymentAccount: payAccount,
          paymentSource: payAccount.name,
          vendor: selectedVendorName || undefined,
          remarks: remarks || `Fixed Asset Purchase: ${assetName}`,
          createdBy: 'Admin'
        });

        setAssetName('');

      } else if (transactionType === 'Loan Repayment') {
        const selectedLoan = activeLoans.find(l => l.id === selectedLoanId);
        if (!selectedLoan) return alert("Please select an active loan to repay.");

        await recordLoanRepayment({
          loan: selectedLoan,
          paymentAmount: parsedAmount,
          interestAmount: parseFloat(interestPaid) || 0,
          paymentAccount: payAccount,
          date: new Date(date).toISOString(),
          remarks: remarks || `Loan Repayment: ${selectedLoan.name}`,
          createdBy: 'Admin'
        });

      } else if (transactionType === 'Owner Withdrawal') {
        await recordOwnerWithdrawal({
          amount: parsedAmount,
          paymentAccount: payAccount,
          date: new Date(date).toISOString(),
          remarks: remarks || 'Owner Personal Withdrawal',
          createdBy: 'Admin'
        });

      } else if (transactionType === 'Security Deposit') {
        await recordSecurityDeposit({
          depositName: remarks || 'Office Deposit',
          amount: parsedAmount,
          paymentAccount: payAccount,
          date: new Date(date).toISOString(),
          remarks: remarks || 'Security Deposit Paid',
          createdBy: 'Admin'
        });
      } else if (transactionType === 'Internal Account Transfer') {
        const destAccountObj = activeFinancialAccounts.find(a => a.id === transferToAccountId);
        if (!destAccountObj) return alert("Please select a valid destination account.");
        if (payAccount.id === destAccountObj.id) return alert("Source and destination accounts must be different.");

        await recordAccountTransfer({
          fromAccount: payAccount,
          toAccount: destAccountObj,
          amount: parsedAmount,
          date: new Date(date).toISOString(),
          remarks: remarks || `Internal Transfer: ${payAccount.name} → ${destAccountObj.accountName}`,
          createdBy: 'Admin'
        });
      }

      setAmount('');
      setRemarks('');
      setSelectedVendorName('');
      alert(`${transactionType} recorded successfully!`);

    } catch (err: any) {
      console.error("Error recording money out:", err);
      alert("Error: " + err.message);
    }
  };

  const handleInlineAddVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendorName.trim()) return alert("Please enter vendor name");

    try {
      await addVendorToDB({
        name: newVendorName.trim(),
        vendorType: newVendorType as any,
        contactPerson: newVendorContact || undefined,
        mobileNumber: newVendorMobile || undefined,
        status: 'Active'
      });

      setSelectedVendorName(newVendorName.trim());
      setNewVendorName('');
      setNewVendorContact('');
      setNewVendorMobile('');
      setIsAddVendorOpen(false);
      alert(`Vendor "${newVendorName}" created and selected!`);
    } catch (err: any) {
      alert("Error adding vendor: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this payment entry?")) {
      try {
        await deleteJournalEntry(id);
      } catch (err: any) {
        alert("Error deleting entry: " + err.message);
      }
    }
  };

  // Open Edit Modal for Money Out Entry
  const startEdit = (j: JournalEntry) => {
    const debitLine = j.entries.find(e => e.type === 'DEBIT');
    const creditLine = j.entries.find(e => e.type === 'CREDIT');

    setEditingEntry(j);
    setEditAmount(debitLine ? debitLine.amount.toString() : '');
    setEditDate(j.date ? new Date(j.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setEditPaymentAccountId(creditLine ? creditLine.accountId : paymentAccountId);
    setEditSubType((j.subType as MoneyOutType) || 'Operational Expense');
    setEditExpenseCategoryName(debitLine ? debitLine.accountName : '');
    setEditVendor(j.vendor || '');
    setEditRemarks(j.remarks || '');
  };

  // Save Money Out Edit Changes
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    if (!editAmount || Number(editAmount) <= 0) return alert("Please enter a valid amount.");

    const selectedFinAcc = activeFinancialAccounts.find(a => a.id === editPaymentAccountId);
    const destAccount: AccountingCategory = selectedFinAcc
      ? {
          id: selectedFinAcc.id,
          name: selectedFinAcc.accountName,
          type: 'Asset',
          status: 'Active',
          isDefault: selectedFinAcc.isDefault,
          createdAt: selectedFinAcc.createdAt
        }
      : assetAccounts.find(a => a.id === editPaymentAccountId) || assetAccounts[0] || {
          id: 'bank_acc', name: 'Bank Account', type: 'Asset', status: 'Active', isDefault: true, createdAt: ''
        };

    const expCat: AccountingCategory = {
      id: `cat_${editExpenseCategoryName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      name: editExpenseCategoryName || 'Miscellaneous',
      type: 'Expense',
      status: 'Active',
      isDefault: true,
      createdAt: new Date().toISOString()
    };

    try {
      await updateMoneyOutEntry({
        id: editingEntry.id,
        subType: editSubType,
        amount: parseFloat(editAmount),
        expenseCategory: expCat,
        paymentAccount: destAccount,
        date: new Date(editDate).toISOString(),
        remarks: editRemarks,
        vendor: editVendor || undefined
      });

      setEditingEntry(null);
      alert("Money Out entry updated successfully!");
    } catch (err: any) {
      console.error("Error updating money out entry:", err);
      alert("Error updating entry: " + err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* HEADER METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Outgoing Cash</span>
          <div className="text-2xl font-bold text-rose-600 mt-1">₹{totalMoneyOut.toLocaleString('en-IN')}</div>
          <span className="text-xs text-slate-500 font-medium mt-1 block">{moneyOutEntries.length} Outflow Entries</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Operational Expenses</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            ₹{moneyOutEntries.filter(j => j.type === 'Expense' || j.subType === 'Operational Expense').reduce((sum, j) => sum + (j.entries.find(e => e.type === 'DEBIT')?.amount || 0), 0).toLocaleString('en-IN')}
          </div>
          <span className="text-xs text-slate-500 font-medium mt-1 block">Recurring Business Expenses</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Fixed Assets & Capital Outflows</span>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            ₹{moneyOutEntries.filter(j => j.subType === 'Fixed Asset Purchase' || j.type === 'Withdrawal' || j.type === 'Deposit').reduce((sum, j) => sum + (j.entries.find(e => e.type === 'DEBIT')?.amount || 0), 0).toLocaleString('en-IN')}
          </div>
          <span className="text-xs text-slate-500 font-medium mt-1 block">Investments & Assets</span>
        </div>
      </div>

      {/* ENTRY FORM */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <ArrowUpRight className="text-rose-600" size={20} />
          <div>
            <h2 className="text-base font-bold text-slate-900">Record Money Out</h2>
            <p className="text-xs text-slate-500 font-medium">Record expenses, asset purchases, loan repayments, and drawings</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Payment Type *</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {MONEY_OUT_TYPES.map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTransactionType(type)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-left flex items-center justify-between ${
                    transactionType === type
                      ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-2xs'
                      : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>{type}</span>
                  {transactionType === type && <div className="w-1.5 h-1.5 rounded-full bg-rose-600" />}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">

            {/* 1. OPERATIONAL EXPENSES FIELDS */}
            {(transactionType === 'Operational Expense' || transactionType === 'Advance Payment' || transactionType === 'Other Payment') && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Expense Category *</label>
                  <select
                    value={expenseCategoryId}
                    onChange={e => setExpenseCategoryId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-rose-500 shadow-xs"
                  >
                    {allExpenseCategoryOptions.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="__NEW__">+ Add Custom Category...</option>
                  </select>
                </div>

                {expenseCategoryId === '__NEW__' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">New Category Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Domain Registration, Hosting"
                      value={customExpenseCategory}
                      onChange={e => setCustomExpenseCategory(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-rose-500 shadow-xs"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="e.g. 1500"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-rose-500 shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-rose-500 shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Paid From (Financial Account) *</label>
                  <select
                    value={paymentAccountId}
                    onChange={e => setPaymentAccountId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-rose-500 shadow-xs"
                  >
                    {activeFinancialAccounts.length > 0 ? (
                      activeFinancialAccounts.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.accountName} ({a.accountType}) {a.isDefault ? '• Default' : ''}
                        </option>
                      ))
                    ) : (
                      assetAccounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-slate-600">Vendor / Payee</label>
                    <button
                      type="button"
                      onClick={() => setIsAddVendorOpen(true)}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                    >
                      <Plus size={12} /> Add Vendor
                    </button>
                  </div>
                  <select
                    value={selectedVendorName}
                    onChange={e => setSelectedVendorName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-rose-500 shadow-xs"
                  >
                    <option value="">-- Select Vendor / Payee --</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.name}>{v.name} ({v.vendorType})</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* 2. FIXED ASSET PURCHASE FIELDS */}
            {transactionType === 'Fixed Asset Purchase' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Asset Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MacBook Pro M3, Office AC, Camera"
                    value={assetName}
                    onChange={e => setAssetName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-rose-500 shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Category / Asset Account *</label>
                  <select
                    value={assetCategoryName}
                    onChange={e => setAssetCategoryName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-rose-500 shadow-xs"
                  >
                    {assetCategoryOptions.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="__NEW__">+ Add New Asset Category...</option>
                  </select>
                </div>

                {assetCategoryName === '__NEW__' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">New Category Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Vehicles, Security Deposit"
                      value={customAssetCategory}
                      onChange={e => setCustomAssetCategory(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-rose-500 shadow-xs"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Purchase Cost (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="e.g. 45000"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-rose-500 shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Purchase Date *</label>
                  <input
                    type="date"
                    required
                    value={assetPurchaseDate}
                    onChange={e => setAssetPurchaseDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-rose-500 shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Useful Life (Years)</label>
                  <input
                    type="number"
                    min="0"
                    value={usefulLifeYears}
                    onChange={e => setUsefulLifeYears(e.target.value)}
                    placeholder="3 (Set 0 for N/A)"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-rose-500 shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Paid From (Financial Account) *</label>
                  <select
                    value={paymentAccountId}
                    onChange={e => setPaymentAccountId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-rose-500 shadow-xs"
                  >
                    {activeFinancialAccounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.accountName} ({a.accountType}) {a.isDefault ? '• Default' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-slate-600">Vendor / Supplier</label>
                    <button
                      type="button"
                      onClick={() => setIsAddVendorOpen(true)}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                    >
                      <Plus size={12} /> Add Vendor
                    </button>
                  </div>
                  <select
                    value={selectedVendorName}
                    onChange={e => setSelectedVendorName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-rose-500 shadow-xs"
                  >
                    <option value="">-- Select Vendor / Supplier --</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.name}>{v.name} ({v.vendorType})</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* 3. LOAN REPAYMENT FIELDS */}
            {transactionType === 'Loan Repayment' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Select Loan Account *</label>
                  <select
                    value={selectedLoanId}
                    onChange={e => setSelectedLoanId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-rose-500 shadow-xs"
                  >
                    {activeLoans.length === 0 ? (
                      <option value="">No Active Loans Found</option>
                    ) : (
                      activeLoans.map(l => (
                        <option key={l.id} value={l.id}>{l.name} - {l.lender} (Balance: ₹{l.remainingBalance.toLocaleString('en-IN')})</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Total Paid Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="Total EMI / Repayment"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-rose-500 shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Interest Component Included (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={interestPaid}
                    onChange={e => setInterestPaid(e.target.value)}
                    placeholder="0 if pure principal"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-rose-500 shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Paid From (Financial Account) *</label>
                  <select
                    value={paymentAccountId}
                    onChange={e => setPaymentAccountId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-rose-500 shadow-xs"
                  >
                    {activeFinancialAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.accountName} ({a.accountType})</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* 4. OWNER WITHDRAWAL & SECURITY DEPOSIT FIELDS */}
            {(transactionType === 'Owner Withdrawal' || transactionType === 'Security Deposit') && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-rose-500 shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-rose-500 shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Paid From (Financial Account) *</label>
                  <select
                    value={paymentAccountId}
                    onChange={e => setPaymentAccountId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-rose-500 shadow-xs"
                  >
                    {activeFinancialAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.accountName} ({a.accountType})</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* 5. INTERNAL ACCOUNT TRANSFER FIELDS */}
            {transactionType === 'Internal Account Transfer' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Transfer From (Source Account) *</label>
                  <select
                    value={paymentAccountId}
                    onChange={e => setPaymentAccountId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-500 shadow-xs"
                  >
                    {activeFinancialAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.accountName} ({a.accountType})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Transfer To (Destination Account) *</label>
                  <select
                    value={transferToAccountId}
                    onChange={e => setTransferToAccountId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-500 shadow-xs"
                  >
                    <option value="">-- Select Destination Account --</option>
                    {activeFinancialAccounts.map(a => (
                      <option key={a.id} value={a.id} disabled={a.id === paymentAccountId}>
                        {a.accountName} ({a.accountType}) {a.id === paymentAccountId ? '• (Source Account)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="e.g. 10000"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-indigo-500 shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Transfer Date *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-indigo-500 shadow-xs"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Remarks / Note</label>
              <input
                type="text"
                placeholder="Payment description or reference"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500 shadow-xs"
              />
            </div>

          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs px-6 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              <Plus size={15} />
              <span>Record Money Out</span>
            </button>
          </div>
        </form>
      </div>

      {/* RECENT OUTFLOWS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">Recent Money Out Transactions</h3>
          <span className="text-xs text-slate-400 font-medium">{moneyOutEntries.length} Total Records</span>
        </div>

        <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Transaction Type</th>
                <th className="py-3 px-4">Expense Category / Account</th>
                <th className="py-3 px-4">Paid From</th>
                <th className="py-3 px-4">Vendor / Payee</th>
                <th className="py-3 px-4">Remarks</th>
                <th className="py-3 px-4 text-right">Amount Spent</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {moneyOutEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-medium text-xs">
                    No Money Out transactions recorded yet.
                  </td>
                </tr>
              ) : (
                moneyOutEntries.map(j => {
                  const debitLine = j.entries.find(e => e.type === 'DEBIT');
                  const creditLine = j.entries.find(e => e.type === 'CREDIT');
                  const amount = debitLine ? debitLine.amount : 0;
                  const categoryName = debitLine ? debitLine.accountName : '-';
                  const accountName = creditLine ? creditLine.accountName : '-';

                  return (
                    <tr key={j.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-slate-500">
                        {new Date(j.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 uppercase">
                          {j.subType || j.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {categoryName}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-600">
                        {accountName}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {j.vendor || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate" title={j.remarks || ''}>
                        {j.remarks || '-'}
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-rose-600 text-right">
                        -₹{amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => startEdit(j)}
                            className="p-1 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded transition"
                            title="Edit entry"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(j.id)}
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

      {/* EDIT MONEY OUT TRANSACTION MODAL */}
      {editingEntry && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-50 rounded-xl text-rose-600">
                  <Edit2 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Edit Money Out Entry</h3>
                  <p className="text-xs text-slate-500">Update outgoing payment details</p>
                </div>
              </div>
              <button
                onClick={() => setEditingEntry(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Transaction Type</label>
                <select
                  value={editSubType}
                  onChange={e => setEditSubType(e.target.value as MoneyOutType)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-rose-500 shadow-xs"
                >
                  {MONEY_OUT_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editAmount}
                    onChange={e => setEditAmount(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-rose-500 shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-rose-500 shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Expense Category / Account *</label>
                <input
                  type="text"
                  required
                  value={editExpenseCategoryName}
                  onChange={e => setEditExpenseCategoryName(e.target.value)}
                  placeholder="Category Name"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-rose-500 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Paid From (Financial Account) *</label>
                <select
                  value={editPaymentAccountId}
                  onChange={e => setEditPaymentAccountId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-rose-500 shadow-xs"
                >
                  {activeFinancialAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.accountName} ({a.accountType})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Vendor / Payee</label>
                <select
                  value={editVendor}
                  onChange={e => setEditVendor(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-rose-500 shadow-xs"
                >
                  <option value="">-- None / General Payee --</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.name}>{v.name} ({v.vendorType})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Remarks / Note</label>
                <input
                  type="text"
                  placeholder="Transaction note or details"
                  value={editRemarks}
                  onChange={e => setEditRemarks(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500 shadow-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INLINE ADD VENDOR MODAL */}
      {isAddVendorOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Add New Vendor</h3>
              <button onClick={() => setIsAddVendorOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleInlineAddVendor} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Vendor / Business Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Vendor Name"
                  value={newVendorName}
                  onChange={e => setNewVendorName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Vendor Type *</label>
                <select
                  value={newVendorType}
                  onChange={e => setNewVendorType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                >
                  {VENDOR_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Contact Person (Optional)</label>
                <input
                  type="text"
                  placeholder="Name"
                  value={newVendorContact}
                  onChange={e => setNewVendorContact(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Mobile Number (Optional)</label>
                <input
                  type="text"
                  placeholder="Phone"
                  value={newVendorMobile}
                  onChange={e => setNewVendorMobile(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddVendorOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-xs"
                >
                  Save & Select
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default MoneyOut;
