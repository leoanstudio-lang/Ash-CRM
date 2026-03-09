import React, { useState } from 'react';
import { AccountingCategory, AccountingLoan, JournalEntry } from '../../types';
import { recordCapital, recordLoan, deleteJournalEntry, deleteLoan } from '../../lib/accounting';
import { Landmark, Briefcase, Trash2 } from 'lucide-react';

function generateId() {
    return Math.random().toString(36).substring(2, 15);
}

interface LoansCapitalProps {
    categories: AccountingCategory[];
    loans: AccountingLoan[];
    journalEntries: JournalEntry[];
}

const LoansCapital: React.FC<LoansCapitalProps> = ({ categories, loans, journalEntries }) => {
    const [activeTab, setActiveTab] = useState<'capital' | 'loan'>('capital');

    // Capital State
    const [capAmount, setCapAmount] = useState('');
    const [capDate, setCapDate] = useState(new Date().toISOString().split('T')[0]);
    const [capAssetCatId, setCapAssetCatId] = useState('');
    const [capRemarks, setCapRemarks] = useState('');

    // Loan State
    const [loanName, setLoanName] = useState('');
    const [lenderName, setLenderName] = useState('');
    const [loanAmount, setLoanAmount] = useState('');
    const [loanInterest, setLoanInterest] = useState('');
    const [loanDate, setLoanDate] = useState(new Date().toISOString().split('T')[0]);
    const [loanAssetCatId, setLoanAssetCatId] = useState('');
    const [loanRemarks, setLoanRemarks] = useState('');

    const assetAccounts = categories.filter(c => c.type === 'Asset' && c.status === 'Active');
    const capitalEntries = journalEntries.filter(j => j.type === 'Capital');

    const handleSaveCapital = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!capAmount || !capAssetCatId) return;

        const sourceAccount = categories.find(c => c.id === capAssetCatId);
        if (!sourceAccount) return;

        try {
            await recordCapital(
                parseFloat(capAmount),
                sourceAccount,
                new Date(capDate).toISOString(),
                capRemarks || 'Owner Capital Investment'
            );
            setCapAmount('');
            setCapRemarks('');
            alert('Capital recorded successfully!');
        } catch (err: any) {
            alert("Error saving capital: " + err.message);
        }
    };

    const handleSaveLoan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!loanAmount || !loanAssetCatId || !loanName || !lenderName) return;

        const destAccount = categories.find(c => c.id === loanAssetCatId);
        if (!destAccount) return;

        const newLoan: AccountingLoan = {
            id: generateId(),
            name: loanName,
            lender: lenderName,
            amount: parseFloat(loanAmount),
            interestRate: loanInterest ? parseFloat(loanInterest) : undefined,
            remainingBalance: parseFloat(loanAmount),
            date: new Date(loanDate).toISOString(),
            remarks: loanRemarks,
            createdAt: new Date().toISOString()
        };

        try {
            await recordLoan(newLoan, destAccount);
            setLoanName('');
            setLenderName('');
            setLoanAmount('');
            setLoanInterest('');
            setLoanRemarks('');
            alert('Loan recorded successfully!');
            setActiveTab('capital'); // Switch back or just clear
        } catch (err: any) {
            alert("Error saving loan: " + err.message);
        }
    };

    const handleDeleteCapital = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this capital entry?')) {
            try {
                await deleteJournalEntry(id);
            } catch (err: any) {
                alert("Error deleting capital: " + err.message);
            }
        }
    };

    const handleDeleteLoan = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this loan?')) {
            try {
                await deleteLoan(id);
            } catch (err: any) {
                alert("Error deleting loan: " + err.message);
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
                        <Landmark size={28} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Loans & Capital</h2>
                        <p className="text-sm font-semibold text-slate-500 mt-1">Manage owner equity and company liabilities</p>
                    </div>
                </div>

                <div className="flex gap-4 mb-8 border-b border-slate-100 pb-4">
                    <button
                        onClick={() => setActiveTab('capital')}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'capital' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                            }`}
                    >
                        + Add Capital
                    </button>
                    <button
                        onClick={() => setActiveTab('loan')}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'loan' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                            }`}
                    >
                        + Record Loan
                    </button>
                </div>

                {activeTab === 'capital' && (
                    <form onSubmit={handleSaveCapital} className="space-y-6 animate-in fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Capital Amount (₹)</label>
                                <input type="number" required value={capAmount} onChange={(e) => setCapAmount(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-purple-500" placeholder="0.00" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Date</label>
                                <input type="date" required value={capDate} onChange={(e) => setCapDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-purple-500" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Deposit To (Asset Account)</label>
                            <select required value={capAssetCatId} onChange={(e) => setCapAssetCatId(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-purple-500">
                                <option value="">Select Account...</option>
                                {assetAccounts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Remarks / Notes</label>
                            <textarea value={capRemarks} onChange={(e) => setCapRemarks(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-purple-500" rows={2} placeholder="Initial investment, funding round, etc..." />
                        </div>
                        <div className="pt-2">
                            <button type="submit" className="px-6 py-2.5 bg-purple-600 text-white font-semibold text-sm rounded-lg shadow-sm hover:bg-purple-700 transition">Save Capital Entry</button>
                        </div>
                    </form>
                )}

                {activeTab === 'loan' && (
                    <form onSubmit={handleSaveLoan} className="space-y-6 animate-in fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Loan Name</label>
                                <input type="text" required value={loanName} onChange={(e) => setLoanName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-500" placeholder="e.g. Equipment Financing" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Lender Name</label>
                                <input type="text" required value={lenderName} onChange={(e) => setLenderName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-500" placeholder="Bank Name / Person" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Principal Amount (₹)</label>
                                <input type="number" required value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-500" placeholder="0.00" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Interest Rate % (Optional)</label>
                                <input type="number" step="0.1" value={loanInterest} onChange={(e) => setLoanInterest(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-500" placeholder="0.0" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Date Received</label>
                                <input type="date" required value={loanDate} onChange={(e) => setLoanDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-500" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Deposit To (Asset Account)</label>
                            <select required value={loanAssetCatId} onChange={(e) => setLoanAssetCatId(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-500">
                                <option value="">Select Account...</option>
                                {assetAccounts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Remarks / Terms</label>
                            <textarea value={loanRemarks} onChange={(e) => setLoanRemarks(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-500" rows={2} placeholder="Repayment terms, etc..." />
                        </div>
                        <div className="pt-2">
                            <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white font-semibold text-sm rounded-lg shadow-sm hover:bg-indigo-700 transition">Save Loan</button>
                        </div>
                    </form>
                )}
            </div>

            {/* Lists */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Loans List */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                        <h3 className="font-semibold text-slate-800 tracking-tight">Active Loans</h3>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white px-3 py-1.5 rounded-full border border-slate-200">{loans.length}</span>
                    </div>
                    <div className="divide-y divide-slate-50 min-h-[200px]">
                        {loans.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-10 text-slate-400">
                                <Briefcase size={32} className="mb-2 opacity-20" />
                                <p className="text-sm font-bold">No active loans</p>
                            </div>
                        ) : (
                            loans.map(loan => (
                                <div key={loan.id} className="p-5 hover:bg-slate-50 transition flex justify-between items-center group">
                                    <div>
                                        <p className="font-bold text-slate-900 text-sm">{loan.name}</p>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Lender: {loan.lender}</p>
                                    </div>
                                    <div className="flex items-center gap-4 text-right">
                                        <div>
                                            <p className="text-base font-black text-indigo-600">₹{loan.amount.toLocaleString()}</p>
                                            {loan.interestRate && <p className="text-[10px] font-bold text-slate-400 mt-0.5">{loan.interestRate}% Int.</p>}
                                        </div>
                                        <button onClick={() => handleDeleteLoan(loan.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete Loan">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Capital List */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                        <h3 className="font-semibold text-slate-800 tracking-tight">Capital History</h3>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white px-3 py-1.5 rounded-full border border-slate-200">{capitalEntries.length}</span>
                    </div>
                    <div className="divide-y divide-slate-50 min-h-[200px]">
                        {capitalEntries.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-10 text-slate-400">
                                <Landmark size={32} className="mb-2 opacity-20" />
                                <p className="text-sm font-bold">No capital entries</p>
                            </div>
                        ) : (
                            capitalEntries.map(entry => {
                                const amount = entry.entries.find(e => e.type === 'CREDIT')?.amount || 0;
                                return (
                                    <div key={entry.id} className="p-5 hover:bg-slate-50 transition flex justify-between items-center group">
                                        <div>
                                            <p className="font-bold text-slate-900 text-sm">{entry.remarks || 'Capital Injection'}</p>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{new Date(entry.date).toLocaleDateString()}</p>
                                        </div>
                                        <div className="flex items-center gap-4 text-right">
                                            <p className="text-base font-black text-purple-600">₹{amount.toLocaleString()}</p>
                                            <button onClick={() => handleDeleteCapital(entry.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete Capital">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoansCapital;
