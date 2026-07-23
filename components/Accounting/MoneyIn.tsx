import React, { useState, useEffect, useRef } from 'react';
import { AccountingCategory, JournalEntry, MoneyInType, Client, FinancialAccount, Service } from '../../types';
import { recordMoneyIn, deleteJournalEntry, updateMoneyInEntry } from '../../lib/accounting';
import { ArrowDownLeft, Plus, Trash2, Edit2, Tag, Calendar, Wallet, User, FileText, CheckCircle2, Search, ChevronDown, Sparkles, X } from 'lucide-react';

interface MoneyInProps {
  services?: Service[];
  financialAccounts?: FinancialAccount[];
  categories: AccountingCategory[];
  journalEntries: JournalEntry[];
  clients?: Client[];
}

const MONEY_IN_TYPES: MoneyInType[] = [
  'Sales Revenue',
  'Owner Investment',
  'Loan Received',
  'Client Advance',
  'Other Income'
];

const DEFAULT_COMPANY_SERVICES = [
  'Website Development',
  'Mobile App Development',
  'UI/UX Design',
  'Graphic Designing',
  'Branding & Identity',
  'Social Media Marketing',
  'Meta & Google Ads Management',
  'SEO Optimization',
  'Video Editing & Motion Graphics',
  'Custom Software Development',
  'Consulting & Strategy',
  'Content Creation & Copywriting',
  'E-Commerce Development',
  'Maintenance & AMC Support',
  'Other Income'
];

const MoneyIn: React.FC<MoneyInProps> = ({ services = [], financialAccounts = [], categories = [], journalEntries = [], clients = [] }) => {
  const [transactionType, setTransactionType] = useState<MoneyInType>('Sales Revenue');

  // New Entry Form Fields
  const [amount, setAmount] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [loanSource, setLoanSource] = useState('Bank');
  const [customLoanSource, setCustomLoanSource] = useState('');

  // Service / Revenue Category Searchable State (New Entry)
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');
  const [selectedServiceName, setSelectedServiceName] = useState('');
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  const serviceDropdownRef = useRef<HTMLDivElement>(null);

  // Client Searchable State (New Entry)
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [selectedClientName, setSelectedClientName] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  // ==========================================
  // EDIT ENTRY MODAL STATE
  // ==========================================
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editPaymentAccountId, setEditPaymentAccountId] = useState('');
  const [editSubType, setEditSubType] = useState<MoneyInType>('Sales Revenue');
  const [editServiceName, setEditServiceName] = useState('');
  const [editClientName, setEditClientName] = useState('');
  const [editRemarks, setEditRemarks] = useState('');

  // Searchable Service State (Edit Modal)
  const [editServiceSearchTerm, setEditServiceSearchTerm] = useState('');
  const [isEditServiceDropdownOpen, setIsEditServiceDropdownOpen] = useState(false);
  const editServiceDropdownRef = useRef<HTMLDivElement>(null);

  // Searchable Client State (Edit Modal)
  const [editClientSearchTerm, setEditClientSearchTerm] = useState('');
  const [isEditClientDropdownOpen, setIsEditClientDropdownOpen] = useState(false);
  const editClientDropdownRef = useRef<HTMLDivElement>(null);

  const activeFinancialAccounts = financialAccounts.filter(a => a.status === 'Active');
  const defaultAccount = activeFinancialAccounts.find(a => a.isDefault) || activeFinancialAccounts[0];

  // Auto-set default financial account
  useEffect(() => {
    if (defaultAccount && !paymentAccountId) {
      setPaymentAccountId(defaultAccount.id);
    }
  }, [defaultAccount, paymentAccountId]);

  // Combine Settings Services with defaults
  const dbServiceNames = services.map(s => s.name);
  const allServicesList = Array.from(new Set([...dbServiceNames, ...DEFAULT_COMPANY_SERVICES]));

  // Filter services by search term
  const filteredServices = allServicesList.filter(s =>
    s.toLowerCase().includes(serviceSearchTerm.toLowerCase())
  );
  const filteredEditServices = allServicesList.filter(s =>
    s.toLowerCase().includes(editServiceSearchTerm.toLowerCase())
  );

  // Filter clients by search term
  const filteredClients = clients.filter(c => {
    const nameMatch = c.name.toLowerCase().includes(clientSearchTerm.toLowerCase());
    const companyMatch = c.companyName && c.companyName.toLowerCase().includes(clientSearchTerm.toLowerCase());
    return nameMatch || companyMatch;
  });
  const filteredEditClients = clients.filter(c => {
    const nameMatch = c.name.toLowerCase().includes(editClientSearchTerm.toLowerCase());
    const companyMatch = c.companyName && c.companyName.toLowerCase().includes(editClientSearchTerm.toLowerCase());
    return nameMatch || companyMatch;
  });

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (serviceDropdownRef.current && !serviceDropdownRef.current.contains(event.target as Node)) {
        setIsServiceDropdownOpen(false);
      }
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
        setIsClientDropdownOpen(false);
      }
      if (editServiceDropdownRef.current && !editServiceDropdownRef.current.contains(event.target as Node)) {
        setIsEditServiceDropdownOpen(false);
      }
      if (editClientDropdownRef.current && !editClientDropdownRef.current.contains(event.target as Node)) {
        setIsEditClientDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const revenueCategories = categories.filter(c => c.type === 'Revenue' && c.status === 'Active');
  const assetAccounts = categories.filter(c => c.type === 'Asset' && c.status === 'Active');

  // Filter Money In Entries (Excluding Opening Balance migration entries)
  const moneyOutEntries = journalEntries
    .filter(j =>
      (j.type === 'Revenue' || j.type === 'Capital' || (j.type === 'Loan' && j.entries.some(e => e.type === 'CREDIT' && e.accountType === 'Liability'))) &&
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

  const totalMoneyIn = moneyOutEntries.reduce((sum, j) => {
    const debitLine = j.entries.find(e => e.type === 'DEBIT');
    return sum + (debitLine ? debitLine.amount : 0);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return alert("Please enter a valid amount.");

    const targetServiceName = selectedServiceName || serviceSearchTerm.trim() || 'Sales Revenue';

    const selectedFinAcc = activeFinancialAccounts.find(a => a.id === paymentAccountId);
    const destAccount: AccountingCategory = selectedFinAcc
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

    const revCategory: AccountingCategory = {
      id: `cat_${targetServiceName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      name: targetServiceName,
      type: 'Revenue',
      status: 'Active',
      isDefault: true,
      createdAt: new Date().toISOString()
    };

    const finalLoanSource = loanSource === 'Other' ? customLoanSource : loanSource;

    try {
      await recordMoneyIn({
        subType: transactionType,
        amount: parseFloat(amount),
        destinationAccount: destAccount,
        category: revCategory,
        date: new Date(date).toISOString(),
        remarks: remarks || `${transactionType}: ${targetServiceName}`,
        clientName: selectedClientName || clientSearchTerm.trim() || undefined,
        invoiceNumber: invoiceNumber || undefined,
        loanSource: finalLoanSource,
        createdBy: 'Admin'
      });

      setAmount('');
      setRemarks('');
      setInvoiceNumber('');
      setSelectedClientName('');
      setClientSearchTerm('');
      setSelectedServiceName('');
      setServiceSearchTerm('');
      alert(`${transactionType} recorded successfully!`);
    } catch (err: any) {
      console.error("Error recording money in:", err);
      alert("Error: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this entry?")) {
      try {
        await deleteJournalEntry(id);
      } catch (err: any) {
        alert("Error deleting entry: " + err.message);
      }
    }
  };

  // Open Edit Modal with selected entry values
  const startEdit = (j: JournalEntry) => {
    const debitLine = j.entries.find(e => e.type === 'DEBIT');
    const creditLine = j.entries.find(e => e.type === 'CREDIT');

    setEditingEntry(j);
    setEditAmount(debitLine ? debitLine.amount.toString() : '');
    setEditDate(j.date ? new Date(j.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setEditPaymentAccountId(debitLine ? debitLine.accountId : paymentAccountId);
    setEditSubType((j.subType as MoneyInType) || 'Sales Revenue');
    setEditServiceName(creditLine ? creditLine.accountName : '');
    setEditServiceSearchTerm('');
    setEditClientName(j.clientName || '');
    setEditClientSearchTerm('');
    setEditRemarks(j.remarks || '');
  };

  // Save Edit Changes
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    if (!editAmount || Number(editAmount) <= 0) return alert("Please enter a valid amount.");

    const targetServiceName = editServiceName || editServiceSearchTerm.trim() || 'Sales Revenue';

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

    const revCategory: AccountingCategory = {
      id: `cat_${targetServiceName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      name: targetServiceName,
      type: 'Revenue',
      status: 'Active',
      isDefault: true,
      createdAt: new Date().toISOString()
    };

    try {
      await updateMoneyInEntry({
        id: editingEntry.id,
        subType: editSubType,
        amount: parseFloat(editAmount),
        destinationAccount: destAccount,
        category: revCategory,
        date: new Date(editDate).toISOString(),
        remarks: editRemarks,
        clientName: editClientName || editClientSearchTerm.trim() || undefined
      });

      setEditingEntry(null);
      alert("Money In entry updated successfully!");
    } catch (err: any) {
      console.error("Error updating money in entry:", err);
      alert("Error updating entry: " + err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* HEADER METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Money Received</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">₹{totalMoneyIn.toLocaleString('en-IN')}</div>
          <span className="text-xs text-slate-500 font-medium mt-1 block">{moneyOutEntries.length} Inflow Entries</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Sales Revenue</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            ₹{moneyOutEntries.filter(j => j.subType === 'Sales Revenue' || j.type === 'Revenue').reduce((sum, j) => sum + (j.entries.find(e => e.type === 'DEBIT')?.amount || 0), 0).toLocaleString('en-IN')}
          </div>
          <span className="text-xs text-slate-500 font-medium mt-1 block">Core Business Income</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Capital & Loans Received</span>
          <div className="text-2xl font-bold text-indigo-600 mt-1">
            ₹{moneyOutEntries.filter(j => j.subType === 'Owner Investment' || j.subType === 'Loan Received').reduce((sum, j) => sum + (j.entries.find(e => e.type === 'DEBIT')?.amount || 0), 0).toLocaleString('en-IN')}
          </div>
          <span className="text-xs text-slate-500 font-medium mt-1 block">Equity & Inflow Debt</span>
        </div>
      </div>

      {/* ENTRY FORM */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <ArrowDownLeft className="text-emerald-600" size={20} />
          <div>
            <h2 className="text-base font-bold text-slate-900">Record Money In</h2>
            <p className="text-xs text-slate-500 font-medium">Select the transaction type and enter incoming funds details</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Transaction Type *</label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {MONEY_IN_TYPES.map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTransactionType(type)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-left flex items-center justify-between ${
                    transactionType === type
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-2xs'
                      : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>{type}</span>
                  {transactionType === type && <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (₹) *</label>
              <input
                type="number"
                required
                min="1"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="e.g. 25000"
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-emerald-500 shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Received Date *</label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-emerald-500 shadow-xs"
              />
            </div>

            {/* Received To (Financial Account Dropdown) */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Received To (Financial Account) *</label>
              <select
                value={paymentAccountId}
                onChange={e => setPaymentAccountId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-500 shadow-xs"
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

            {/* SEARCHABLE SERVICE CATEGORY FIELD */}
            {(transactionType === 'Sales Revenue' || transactionType === 'Client Advance' || transactionType === 'Other Income') && (
              <div ref={serviceDropdownRef} className="relative">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Service / Revenue Category *</label>

                {selectedServiceName ? (
                  <div className="flex items-center justify-between bg-emerald-50/90 border border-emerald-300 rounded-xl px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={15} className="text-emerald-600" />
                      <span>{selectedServiceName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedServiceName(''); setServiceSearchTerm(''); setIsServiceDropdownOpen(true); }}
                      className="text-slate-500 hover:text-slate-800 text-[11px] font-semibold underline decoration-slate-300"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search service (e.g. Website Dev, Branding, SEO)..."
                        value={serviceSearchTerm}
                        onChange={e => {
                          setServiceSearchTerm(e.target.value);
                          setIsServiceDropdownOpen(true);
                        }}
                        onFocus={() => setIsServiceDropdownOpen(true)}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-7 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-emerald-500 shadow-xs"
                      />
                      <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
                    </div>

                    {/* SEARCH RESULTS POPUP DROPDOWN */}
                    {isServiceDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto p-1.5 text-xs">
                        <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1 flex items-center justify-between">
                          <span>Company Services ({filteredServices.length})</span>
                          <span>Click to select</span>
                        </div>

                        {filteredServices.length === 0 ? (
                          <div className="p-3 text-center text-slate-500 space-y-1">
                            <span>No matching service found.</span>
                            {serviceSearchTerm.trim() && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedServiceName(serviceSearchTerm.trim());
                                  setIsServiceDropdownOpen(false);
                                }}
                                className="block w-full mt-1.5 py-1 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg transition"
                              >
                                + Use "{serviceSearchTerm.trim()}" as Service
                              </button>
                            )}
                          </div>
                        ) : (
                          filteredServices.map(sName => (
                            <button
                              key={sName}
                              type="button"
                              onClick={() => {
                                setSelectedServiceName(sName);
                                setIsServiceDropdownOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-emerald-50 hover:text-emerald-900 rounded-lg font-bold text-slate-800 flex items-center justify-between transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <Sparkles size={13} className="text-slate-400" />
                                <span>{sName}</span>
                              </div>
                              <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Select</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* SEARCHABLE CLIENT SELECTION FIELD */}
            <div ref={clientDropdownRef} className="relative">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Client Name (Optional)</label>

              {selectedClientName ? (
                <div className="flex items-center justify-between bg-emerald-50/90 border border-emerald-300 rounded-xl px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-emerald-600" />
                    <span>{selectedClientName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedClientName(''); setClientSearchTerm(''); setIsClientDropdownOpen(true); }}
                    className="text-slate-500 hover:text-slate-800 text-[11px] font-semibold underline decoration-slate-300"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search client or company name..."
                      value={clientSearchTerm}
                      onChange={e => {
                        setClientSearchTerm(e.target.value);
                        setIsClientDropdownOpen(true);
                      }}
                      onFocus={() => setIsClientDropdownOpen(true)}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-7 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-emerald-500 shadow-xs"
                    />
                    <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
                  </div>

                  {/* CLIENT SEARCH RESULTS POPUP DROPDOWN */}
                  {isClientDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto p-1.5 text-xs">
                      <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1 flex items-center justify-between">
                        <span>Registered Clients ({filteredClients.length})</span>
                        <span>Click to select</span>
                      </div>

                      {filteredClients.length === 0 ? (
                        <div className="p-3 text-center text-slate-500 space-y-1">
                          <span>No matching client found.</span>
                          {clientSearchTerm.trim() && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedClientName(clientSearchTerm.trim());
                                setIsClientDropdownOpen(false);
                              }}
                              className="block w-full mt-1.5 py-1 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg transition"
                            >
                              + Use "{clientSearchTerm.trim()}" as Client Name
                            </button>
                          )}
                        </div>
                      ) : (
                        filteredClients.map(c => {
                          const displayName = c.name + (c.companyName ? ` (${c.companyName})` : '');
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSelectedClientName(displayName);
                                setIsClientDropdownOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-emerald-50 hover:text-emerald-900 rounded-lg font-bold text-slate-800 flex items-center justify-between transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <User size={13} className="text-slate-400" />
                                <div>
                                  <span>{c.name}</span>
                                  {c.companyName && <span className="text-[10px] text-slate-400 font-normal block">{c.companyName}</span>}
                                </div>
                              </div>
                              <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Select</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {transactionType === 'Loan Received' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Loan Source *</label>
                <select
                  value={loanSource}
                  onChange={e => setLoanSource(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-500 shadow-xs"
                >
                  <option value="Bank">Bank</option>
                  <option value="Mother">Mother</option>
                  <option value="Brother">Brother</option>
                  <option value="Family">Family Member</option>
                  <option value="Friend">Friend</option>
                  <option value="Finance Company">Finance Company</option>
                  <option value="Other">Other Source</option>
                </select>
              </div>
            )}

            {transactionType === 'Loan Received' && loanSource === 'Other' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Specify Lender / Source *</label>
                <input
                  type="text"
                  required
                  placeholder="Lender Name"
                  value={customLoanSource}
                  onChange={e => setCustomLoanSource(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-emerald-500 shadow-xs"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Remarks / Note</label>
              <input
                type="text"
                placeholder="Transaction note or details"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 shadow-xs"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-6 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              <Plus size={15} />
              <span>Record Money In</span>
            </button>
          </div>
        </form>
      </div>

      {/* RECENT INFLOWS TABLE - ALIGNED TO PROFESSIONAL MONEY OUT STYLE */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">Incoming Money Ledger</h3>
          <span className="text-xs text-slate-400 font-medium">{moneyOutEntries.length} Total Records</span>
        </div>

        <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Service / Category</th>
                <th className="py-3 px-4">Received To</th>
                <th className="py-3 px-4">Client / Payee</th>
                <th className="py-3 px-4">Remarks / Notes</th>
                <th className="py-3 px-4 text-right">Amount Received</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {moneyOutEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-medium text-xs">
                    No Money In transactions recorded yet.
                  </td>
                </tr>
              ) : (
                moneyOutEntries.map(j => {
                  const debitLine = j.entries.find(e => e.type === 'DEBIT');
                  const creditLine = j.entries.find(e => e.type === 'CREDIT');
                  const amount = debitLine ? debitLine.amount : 0;
                  const accountName = debitLine ? debitLine.accountName : '-';
                  const categoryName = creditLine ? creditLine.accountName : '-';

                  return (
                    <tr key={j.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-slate-500">
                        {new Date(j.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
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
                        {j.clientName || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate" title={j.remarks || ''}>
                        {j.remarks || '-'}
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-emerald-600 text-right">
                        +₹{amount.toLocaleString('en-IN')}
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

      {/* EDIT TRANSACTION MODAL */}
      {editingEntry && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                  <Edit2 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Edit Money In Entry</h3>
                  <p className="text-xs text-slate-500">Update incoming funds details</p>
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
                  onChange={e => setEditSubType(e.target.value as MoneyInType)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 shadow-xs"
                >
                  {MONEY_IN_TYPES.map(t => (
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
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-500 shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-500 shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Received To (Account) *</label>
                <select
                  value={editPaymentAccountId}
                  onChange={e => setEditPaymentAccountId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 shadow-xs"
                >
                  {activeFinancialAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.accountName} ({a.accountType})</option>
                  ))}
                </select>
              </div>

              {/* Service Selection in Edit Modal */}
              <div ref={editServiceDropdownRef} className="relative">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Service / Revenue Category *</label>
                {editServiceName ? (
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-300 rounded-xl px-3 py-2 text-xs font-bold text-emerald-800">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      <span>{editServiceName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setEditServiceName(''); setEditServiceSearchTerm(''); setIsEditServiceDropdownOpen(true); }}
                      className="text-slate-500 hover:text-slate-800 text-[11px] font-semibold underline"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search service..."
                        value={editServiceSearchTerm}
                        onChange={e => { setEditServiceSearchTerm(e.target.value); setIsEditServiceDropdownOpen(true); }}
                        onFocus={() => setIsEditServiceDropdownOpen(true)}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-500 shadow-xs"
                      />
                    </div>
                    {isEditServiceDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto p-1 text-xs">
                        {filteredEditServices.map(sName => (
                          <button
                            key={sName}
                            type="button"
                            onClick={() => { setEditServiceName(sName); setIsEditServiceDropdownOpen(false); }}
                            className="w-full text-left px-3 py-1.5 hover:bg-emerald-50 font-bold text-slate-800 rounded-lg flex items-center justify-between"
                          >
                            <span>{sName}</span>
                            <span className="text-[10px] text-emerald-600 font-semibold">Select</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Client Selection in Edit Modal */}
              <div ref={editClientDropdownRef} className="relative">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Client Name (Optional)</label>
                {editClientName ? (
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-300 rounded-xl px-3 py-2 text-xs font-bold text-emerald-800">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      <span>{editClientName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setEditClientName(''); setEditClientSearchTerm(''); setIsEditClientDropdownOpen(true); }}
                      className="text-slate-500 hover:text-slate-800 text-[11px] font-semibold underline"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search client or company name..."
                        value={editClientSearchTerm}
                        onChange={e => { setEditClientSearchTerm(e.target.value); setIsEditClientDropdownOpen(true); }}
                        onFocus={() => setIsEditClientDropdownOpen(true)}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-500 shadow-xs"
                      />
                    </div>
                    {isEditClientDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto p-1 text-xs">
                        {filteredEditClients.map(c => {
                          const displayName = c.name + (c.companyName ? ` (${c.companyName})` : '');
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => { setEditClientName(displayName); setIsEditClientDropdownOpen(false); }}
                              className="w-full text-left px-3 py-1.5 hover:bg-emerald-50 font-bold text-slate-800 rounded-lg flex items-center justify-between"
                            >
                              <span>{displayName}</span>
                              <span className="text-[10px] text-emerald-600 font-semibold">Select</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Remarks / Note</label>
                <input
                  type="text"
                  placeholder="Transaction note or details"
                  value={editRemarks}
                  onChange={e => setEditRemarks(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 shadow-xs"
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
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default MoneyIn;
