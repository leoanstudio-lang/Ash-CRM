import React, { useState } from 'react';
import { AccountingCategory, JournalEntry } from '../../types';
import { recordRevenue, deleteJournalEntry } from '../../lib/accounting';
import { CheckCircle2, TrendingUp, DollarSign, Trash2 } from 'lucide-react';

interface RevenueManagementProps {
    categories: AccountingCategory[];
    journalEntries: JournalEntry[];
}

const RevenueManagement: React.FC<RevenueManagementProps> = ({ categories, journalEntries }) => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [revenueCatId, setRevenueCatId] = useState('');
    const [assetCatId, setAssetCatId] = useState('');
    const [clientName, setClientName] = useState('');
    const [remarks, setRemarks] = useState('');
    const [reference, setReference] = useState('');

    const revenueCategories = categories.filter(c => c.type === 'Revenue' && c.status === 'Active');
    const assetCategories = categories.filter(c => c.type === 'Asset' && c.status === 'Active');
    const revenueEntries = journalEntries.filter(j => j.type === 'Revenue');

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || !revenueCatId || !assetCatId) return;

        const revCat = categories.find(c => c.id === revenueCatId);
        const astCat = categories.find(c => c.id === assetCatId);

        if (!revCat || !astCat) return;

        try {
            const fullRemarks = clientName ? `Client: ${clientName} | ${remarks}` : remarks;
            await recordRevenue(
                parseFloat(amount),
                revCat,
                astCat,
                new Date(date).toISOString(),
                fullRemarks,
                reference || undefined
            );

            setIsFormOpen(false);
            setAmount('');
            setClientName('');
            setRemarks('');
            setReference('');
        } catch (err: any) {
            alert("Error saving revenue: " + err.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this revenue entry?')) {
            try {
                await deleteJournalEntry(id);
            } catch (err: any) {
                alert("Error deleting entry: " + err.message);
            }
        }
    };

    return (
        <div className="space-y-4">
            {/* Header & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                            <TrendingUp size={28} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Revenue Management</h2>
                            <p className="text-sm font-bold text-slate-400 mt-1">Manual entries & auto-synced payments</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsFormOpen(true)}
                        className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm hover:bg-emerald-700 transition shrink-0"
                    >
                        + Add Revenue
                    </button>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-xl shadow-sm relative overflow-hidden group">
                    <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider relative z-10">Total Revenue Recorded</h4>
                    <p className="text-3xl font-black text-emerald-600 relative z-10 mt-1">
                        ₹{revenueEntries.reduce((sum, entry) => {
                            const revLine = entry.entries.find(e => e.type === 'CREDIT');
                            return sum + (revLine?.amount || 0);
                        }, 0).toLocaleString()}
                    </p>
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-emerald-100 rounded-full blur-3xl group-hover:bg-emerald-200 transition duration-500"></div>
                </div>
            </div>

            {/* Manual Form Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white z-10">
                            <h3 className="text-xl font-bold text-slate-900">Record Manual Revenue</h3>
                            <button onClick={() => setIsFormOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition">✕</button>
                        </div>

                        <form onSubmit={handleSave} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Amount (₹)</label>
                                    <input type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500" placeholder="0.00" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Date</label>
                                    <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Revenue Category</label>
                                    <select required value={revenueCatId} onChange={(e) => setRevenueCatId(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500">
                                        <option value="">Select Category...</option>
                                        {revenueCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Payment Method / Asset Account</label>
                                    <select required value={assetCatId} onChange={(e) => setAssetCatId(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500">
                                        <option value="">Select Method...</option>
                                        {assetCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Client Name (Optional)</label>
                                    <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500" placeholder="John Doe" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Reference Number (Optional)</label>
                                    <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500" placeholder="Transaction ID" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Remarks / Notes</label>
                                <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500" rows={3} placeholder="Add any additional details here..." />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 py-2.5 text-slate-600 font-semibold text-sm hover:bg-slate-100 rounded-lg transition border border-slate-200">Cancel</button>
                                <button type="submit" className="flex-1 py-2.5 bg-emerald-600 text-white font-semibold text-sm rounded-lg shadow-sm hover:bg-emerald-700 transition">Save Revenue</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Recent Revenue List */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
                <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-semibold text-slate-800">Recent Revenue Entries</h3>
                    <span className="text-xs font-bold text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">{revenueEntries.length} Records</span>
                </div>
                <div className="p-0">
                    {revenueEntries.length === 0 ? (
                        <div className="text-center py-16">
                            <DollarSign size={48} className="mx-auto text-slate-200 mb-4" />
                            <p className="text-sm font-bold text-slate-500">No revenue recorded yet</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {revenueEntries.slice(0, 50).map(entry => {
                                const revLine = entry.entries.find(e => e.type === 'CREDIT');
                                const assetLine = entry.entries.find(e => e.type === 'DEBIT');
                                return (
                                    <div key={entry.id} className="p-6 hover:bg-slate-50 transition flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                                                <CheckCircle2 size={20} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900 text-sm">{entry.remarks || 'Revenue Entry'}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{revLine?.accountName}</span>
                                                    <span className="text-slate-300 text-xs">•</span>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{assetLine?.accountName}</span>
                                                    {entry.referenceId && (
                                                        <>
                                                            <span className="text-slate-300 text-xs">•</span>
                                                            <span className="text-[10px] font-bold text-slate-400">Ref: {entry.referenceId}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-right flex-col md:flex-row">
                                            <div>
                                                <p className="text-base font-bold text-slate-900">₹{revLine?.amount.toLocaleString()}</p>
                                                <p className="text-[11px] text-slate-500 mt-0.5">{new Date(entry.date).toLocaleDateString()}</p>
                                            </div>
                                            <button onClick={() => handleDelete(entry.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete Entry">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RevenueManagement;
