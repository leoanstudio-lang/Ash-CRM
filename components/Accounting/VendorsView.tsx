import React, { useState } from 'react';
import { Vendor, VendorType, JournalEntry } from '../../types';
import { addVendorToDB, updateVendorInDB, deleteVendorFromDB } from '../../lib/accounting';
import { Users, Plus, Search, Filter, Edit, Trash2, Eye, Building2, Phone, Mail, MapPin, CreditCard, FileText, ArrowUpRight, CheckCircle2, X } from 'lucide-react';

interface VendorsViewProps {
  vendors: Vendor[];
  journalEntries: JournalEntry[];
}

export const VENDOR_TYPES: VendorType[] = [
  'Landlord',
  'Employee',
  'Freelancer',
  'Consultant',
  'Office Supplier',
  'Printing',
  'Marketing Agency',
  'Software Subscription',
  'Internet Provider',
  'Electricity Provider',
  'Finance Company',
  'Government',
  'Courier',
  'Maintenance',
  'Miscellaneous',
  'Custom'
];

const VendorsView: React.FC<VendorsViewProps> = ({ vendors = [], journalEntries = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [viewingVendor, setViewingVendor] = useState<Vendor | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [vendorType, setVendorType] = useState<string>('Office Supplier');
  const [customType, setCustomType] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('India');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [website, setWebsite] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive' | 'Archived'>('Active');

  const now = new Date();
  const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Filter Vendors
  const filteredVendors = vendors.filter(v => {
    const matchesSearch =
      v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.contactPerson && v.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (v.mobile && v.mobile.includes(searchTerm)) ||
      (v.email && v.email.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = filterType === 'All' || v.vendorType === filterType;
    const matchesStatus = filterStatus === 'All' || v.status === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  // Calculate Vendor Payment Stats from Money Out Journal Entries
  const getVendorStats = (vendorName: string) => {
    const payments = journalEntries.filter(j => {
      const isVendorMatch = j.vendor?.toLowerCase() === vendorName.toLowerCase() ||
        j.remarks?.toLowerCase().includes(vendorName.toLowerCase());
      const isExpense = j.type === 'Expense' || j.subType === 'Operational Expense' || j.subType === 'Fixed Asset Purchase';
      return isVendorMatch && isExpense;
    });

    const totalPaid = payments.reduce((sum, j) => {
      const debitLine = j.entries.find(e => e.type === 'DEBIT');
      return sum + (debitLine ? debitLine.amount : 0);
    }, 0);

    const sortedPayments = [...payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastPaymentDate = sortedPayments[0]?.date ? new Date(sortedPayments[0].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

    return {
      payments,
      totalPaid,
      count: payments.length,
      lastPaymentDate
    };
  };

  // Metrics
  const totalVendors = vendors.length;
  const activeVendors = vendors.filter(v => v.status === 'Active').length;
  const newVendorsThisMonth = vendors.filter(v => v.createdAt && v.createdAt.startsWith(currentMonthYear)).length;

  const totalPaymentsMade = vendors.reduce((sum, v) => sum + getVendorStats(v.name).totalPaid, 0);

  const resetForm = () => {
    setName('');
    setVendorType('Office Supplier');
    setCustomType('');
    setContactPerson('');
    setMobile('');
    setEmail('');
    setGstNumber('');
    setAddress('');
    setCity('');
    setState('');
    setCountry('India');
    setBankName('');
    setAccountNumber('');
    setIfscCode('');
    setWebsite('');
    setNotes('');
    setStatus('Active');
    setEditingVendor(null);
  };

  const handleOpenEdit = (v: Vendor) => {
    setEditingVendor(v);
    setName(v.name);
    if (VENDOR_TYPES.includes(v.vendorType as VendorType)) {
      setVendorType(v.vendorType);
      setCustomType('');
    } else {
      setVendorType('Custom');
      setCustomType(v.vendorType);
    }
    setContactPerson(v.contactPerson || '');
    setMobile(v.mobile || '');
    setEmail(v.email || '');
    setGstNumber(v.gstNumber || '');
    setAddress(v.address || '');
    setCity(v.city || '');
    setState(v.state || '');
    setCountry(v.country || 'India');
    setBankName(v.bankName || '');
    setAccountNumber(v.accountNumber || '');
    setIfscCode(v.ifscCode || '');
    setWebsite(v.website || '');
    setNotes(v.notes || '');
    setStatus(v.status || 'Active');
    setIsAddModalOpen(true);
  };

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert("Please enter vendor name.");

    const finalType = vendorType === 'Custom' ? (customType.trim() || 'Custom') : vendorType;

    const vendorPayload = {
      name: name.trim(),
      vendorType: finalType,
      contactPerson: contactPerson.trim() || undefined,
      mobile: mobile.trim() || undefined,
      email: email.trim() || undefined,
      gstNumber: gstNumber.trim() || undefined,
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      country: country.trim() || 'India',
      bankName: bankName.trim() || undefined,
      accountNumber: accountNumber.trim() || undefined,
      ifscCode: ifscCode.trim() || undefined,
      website: website.trim() || undefined,
      notes: notes.trim() || undefined,
      status
    };

    try {
      if (editingVendor) {
        await updateVendorInDB(editingVendor.id, vendorPayload);
        alert(`Vendor "${name.trim()}" updated successfully!`);
      } else {
        await addVendorToDB(vendorPayload);
        alert(`Vendor "${name.trim()}" added successfully!`);
      }
      resetForm();
      setIsAddModalOpen(false);
    } catch (err: any) {
      console.error(err);
      alert("Error saving vendor: " + (err?.message || err));
    }
  };

  const handleDelete = async (id: string, vendorName: string) => {
    if (window.confirm(`Are you sure you want to delete vendor "${vendorName}"?`)) {
      try {
        await deleteVendorFromDB(id);
        if (viewingVendor?.id === id) setViewingVendor(null);
      } catch (err: any) {
        alert("Error deleting vendor: " + err.message);
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* HEADER METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Vendors</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{totalVendors}</div>
          <span className="text-xs text-slate-500 font-medium mt-1 block">Registered Payees & Suppliers</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Active Vendors</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{activeVendors}</div>
          <span className="text-xs text-emerald-600/80 font-medium mt-1 block">Operational Recipients</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Payments Made</span>
          <div className="text-2xl font-bold text-indigo-600 mt-1">₹{totalPaymentsMade.toLocaleString('en-IN')}</div>
          <span className="text-xs text-indigo-600/80 font-medium mt-1 block">Cumulative Outflows</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">New Vendors This Month</span>
          <div className="text-2xl font-bold text-blue-600 mt-1">{newVendorsThisMonth}</div>
          <span className="text-xs text-blue-600/80 font-medium mt-1 block">Added in {now.toLocaleString('default', { month: 'short' })}</span>
        </div>
      </div>

      {/* VENDOR MANAGEMENT TABLE & CONTROLS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Building2 size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Vendors & Payees</h2>
              <p className="text-xs text-slate-500 font-medium">Manage suppliers, payees, service providers, landlords, and payment recipients</p>
            </div>
          </div>

          <button
            onClick={() => { resetForm(); setIsAddModalOpen(true); }}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
          >
            <Plus size={15} />
            <span>+ Add Vendor</span>
          </button>
        </div>

        {/* SEARCH & FILTERS */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search vendor name, contact, mobile..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-indigo-500"
            >
              <option value="All">All Vendor Types</option>
              {VENDOR_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-indigo-500"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Archived">Archived</option>
            </select>
          </div>
        </div>

        {/* VENDORS TABLE */}
        <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-4">Vendor Name</th>
                <th className="py-3 px-4">Vendor Type</th>
                <th className="py-3 px-4">Contact Person</th>
                <th className="py-3 px-4">Mobile</th>
                <th className="py-3 px-4 text-right">Total Paid</th>
                <th className="py-3 px-4">Last Payment</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-medium text-xs">
                    No vendors found. Click "+ Add Vendor" to create your first vendor record.
                  </td>
                </tr>
              ) : (
                filteredVendors.map(v => {
                  const stats = getVendorStats(v.name);

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {v.name}
                        {v.gstNumber && <span className="block text-[10px] text-slate-400 font-normal">GST: {v.gstNumber}</span>}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {v.vendorType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-600">
                        {v.contactPerson || '-'}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-600">
                        {v.mobile || '-'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-indigo-600 text-right">
                        ₹{stats.totalPaid.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-medium">
                        {stats.lastPaymentDate}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                          v.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          v.status === 'Inactive' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setViewingVendor(v)}
                            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded transition"
                            title="View Profile & Payments"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(v)}
                            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded transition"
                            title="Edit Vendor"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(v.id, v.name)}
                            className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition"
                            title="Delete Vendor"
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

      {/* VENDOR PROFILE MODAL / DRAWER */}
      {viewingVendor && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">{viewingVendor.name}</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {viewingVendor.vendorType}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">Vendor Profile & Complete Payment History</p>
              </div>
              <button onClick={() => setViewingVendor(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            {/* VENDOR DETAILS & SUMMARY */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Contact Person</span>
                <span className="font-bold text-slate-800 block mt-0.5">{viewingVendor.contactPerson || 'N/A'}</span>
                <span className="text-[11px] text-slate-500 block">{viewingVendor.mobile || 'No Mobile'}</span>
                <span className="text-[11px] text-slate-500 block">{viewingVendor.email || 'No Email'}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tax & Bank Info</span>
                <span className="font-bold text-slate-800 block mt-0.5">GST: {viewingVendor.gstNumber || 'N/A'}</span>
                <span className="text-[11px] text-slate-500 block">{viewingVendor.bankName ? `${viewingVendor.bankName} • ${viewingVendor.accountNumber || ''}` : 'No Bank Details'}</span>
                {viewingVendor.ifscCode && <span className="text-[10px] text-slate-400 block">IFSC: {viewingVendor.ifscCode}</span>}
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payment Summary</span>
                {(() => {
                  const s = getVendorStats(viewingVendor.name);
                  return (
                    <div className="mt-0.5 space-y-0.5">
                      <div className="text-base font-extrabold text-indigo-600">₹{s.totalPaid.toLocaleString('en-IN')}</div>
                      <span className="text-[11px] text-slate-500 block">{s.count} Total Transactions</span>
                      <span className="text-[10px] text-slate-400 block">Last: {s.lastPaymentDate}</span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* PAYMENT HISTORY TABLE */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800">Payment History</h4>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Expense Category</th>
                      <th className="py-2.5 px-3">Remarks</th>
                      <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {(() => {
                      const s = getVendorStats(viewingVendor.name);
                      if (s.payments.length === 0) {
                        return (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-slate-400 font-medium text-xs">
                              No payment transactions recorded for this vendor yet.
                            </td>
                          </tr>
                        );
                      }
                      return s.payments.map(p => {
                        const amount = p.entries.find(e => e.type === 'DEBIT')?.amount || 0;
                        const cat = p.entries.find(e => e.type === 'DEBIT')?.accountName || 'Operational Expense';

                        return (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 text-slate-500 font-medium">
                              {new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800">{cat}</td>
                            <td className="py-2.5 px-3 text-slate-600">{p.remarks}</td>
                            <td className="py-2.5 px-3 font-bold text-rose-600 text-right">₹{amount.toLocaleString('en-IN')}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setViewingVendor(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Close Profile
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ADD / EDIT VENDOR MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">{editingVendor ? 'Edit Vendor' : 'Add New Vendor'}</h3>
              <button onClick={() => { setIsAddModalOpen(false); resetForm(); }} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleSaveVendor} className="space-y-3.5 text-xs">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vendor Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Tech, Landlord Name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vendor Type *</label>
                  <select
                    value={vendorType}
                    onChange={e => setVendorType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                  >
                    {VENDOR_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {vendorType === 'Custom' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Specify Custom Vendor Type *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cloud Hosting, Catering"
                    value={customType}
                    onChange={e => setCustomType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="Name"
                    value={contactPerson}
                    onChange={e => setContactPerson(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Mobile Number</label>
                  <input
                    type="text"
                    placeholder="Phone"
                    value={mobile}
                    onChange={e => setMobile(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="email@domain.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">GST / Tax Number</label>
                  <input
                    type="text"
                    placeholder="GSTIN"
                    value={gstNumber}
                    onChange={e => setGstNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>

              {/* ADDRESS & BANK DETAILS (OPTIONAL) */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Address & Bank Details</span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Address</label>
                    <input
                      type="text"
                      placeholder="Street address"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">City & State</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="City"
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                      <input
                        type="text"
                        placeholder="State"
                        value={state}
                        onChange={e => setState(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Bank Name</label>
                    <input
                      type="text"
                      placeholder="HDFC Bank"
                      value={bankName}
                      onChange={e => setBankName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Account Number</label>
                    <input
                      type="text"
                      placeholder="Account No."
                      value={accountNumber}
                      onChange={e => setAccountNumber(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">IFSC / SWIFT</label>
                    <input
                      type="text"
                      placeholder="IFSC Code"
                      value={ifscCode}
                      onChange={e => setIfscCode(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Notes / Internal Remarks</label>
                  <input
                    type="text"
                    placeholder="Special instructions or contract details..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setIsAddModalOpen(false); resetForm(); }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-xs"
                >
                  {editingVendor ? 'Update Vendor' : 'Save Vendor'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};

export default VendorsView;
