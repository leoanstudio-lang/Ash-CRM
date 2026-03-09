import React, { useState } from 'react';
import { JournalEntry, AccountingCategory } from '../../types';
import { List, Search, Filter } from 'lucide-react';

interface LedgerViewProps {
    journalEntries: JournalEntry[];
    categories: AccountingCategory[];
}

const LedgerView: React.FC<LedgerViewProps> = ({ journalEntries, categories }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [dateRange, setDateRange] = useState<'all' | 'this_month' | 'last_month' | 'this_year'>('this_month');

    // Filter entries
    let filteredEntries = [...journalEntries];

    // 1. Filter by date range
    const now = new Date();
    if (dateRange === 'this_month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        filteredEntries = filteredEntries.filter(e => new Date(e.date) >= startOfMonth);
    } else if (dateRange === 'last_month') {
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        filteredEntries = filteredEntries.filter(e => {
            const d = new Date(e.date);
            return d >= startOfLastMonth && d <= endOfLastMonth;
        });
    } else if (dateRange === 'this_year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        filteredEntries = filteredEntries.filter(e => new Date(e.date) >= startOfYear);
    }

    // 2. Filter by search term
    if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        filteredEntries = filteredEntries.filter(e =>
            e.remarks.toLowerCase().includes(lowerSearch) ||
            e.id.toLowerCase().includes(lowerSearch) ||
            e.entries.some(line => line.accountName.toLowerCase().includes(lowerSearch))
        );
    }

    // 3. Filter by category
    if (selectedCategory !== 'all') {
        filteredEntries = filteredEntries.filter(e =>
            e.entries.some(line => line.accountId === selectedCategory)
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-800">
                            <List size={28} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 tracking-tight">General Ledger</h2>
                            <p className="text-sm font-semibold text-slate-500 mt-1">Master view of all journal entries</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search entries..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-slate-400 w-64"
                            />
                        </div>
                        <button className="w-10 h-10 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-100">
                            <Filter size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 mb-6">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1">
                        <button onClick={() => setDateRange('this_month')} className={`px-4 py-2 rounded-lg text-xs font-semibold ${dateRange === 'this_month' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>This Month</button>
                        <button onClick={() => setDateRange('last_month')} className={`px-4 py-2 rounded-lg text-xs font-semibold ${dateRange === 'last_month' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Last Month</button>
                        <button onClick={() => setDateRange('this_year')} className={`px-4 py-2 rounded-lg text-xs font-semibold ${dateRange === 'this_year' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>This Year</button>
                        <button onClick={() => setDateRange('all')} className={`px-4 py-2 rounded-lg text-xs font-semibold ${dateRange === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>All Time</button>
                    </div>

                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-slate-400 min-w-[200px]"
                    >
                        <option value="all">All Accounts</option>
                        {categories.filter(c => c.status === 'Active').map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                        ))}
                    </select>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 text-xs font-semibold border-b border-slate-200">
                                <th className="px-6 py-4 w-32">Date</th>
                                <th className="px-6 py-4">Transaction / Remarks</th>
                                <th className="px-6 py-4">Account</th>
                                <th className="px-6 py-4 text-right w-32">Debit (₹)</th>
                                <th className="px-6 py-4 text-right w-32">Credit (₹)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredEntries.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-16 text-center text-slate-400">
                                        <List size={32} className="mx-auto mb-3 opacity-20" />
                                        <p className="text-xs font-black uppercase tracking-widest">No entries found</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredEntries.map(entry => (
                                    // Render each line of the journal entry as a table row, grouped visually
                                    <React.Fragment key={entry.id}>
                                        {entry.entries.map((line, idx) => (
                                            <tr key={`${entry.id}-${idx}`} className={`hover:bg-slate-50/50 transition-colors ${idx === 0 ? 'border-t-[3px] border-slate-100' : ''}`}>
                                                {idx === 0 ? (
                                                    <>
                                                        <td className="px-6 py-4 align-top" rowSpan={entry.entries.length}>
                                                            <p className="text-sm font-bold text-slate-700">{new Date(entry.date).toLocaleDateString()}</p>
                                                            <p className="text-xs font-medium text-slate-500 mt-1">ID: {entry.id.substring(0, 6)}</p>
                                                        </td>
                                                        <td className="px-6 py-4 align-top" rowSpan={entry.entries.length}>
                                                            <p className="text-sm font-bold text-slate-900">{entry.remarks}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">{entry.type}</span>
                                                                {entry.referenceId && <span className="text-xs font-semibold text-slate-400">Ref: {entry.referenceId}</span>}
                                                            </div>
                                                        </td>
                                                    </>
                                                ) : null}

                                                <td className="px-6 py-2.5">
                                                    <div className={`flex items-center gap-2 ${line.type === 'CREDIT' ? 'pl-6' : ''}`}>
                                                        <div className={`w-1.5 h-1.5 rounded-full ${line.type === 'DEBIT' ? 'bg-blue-500' : 'bg-amber-500'}`} />
                                                        <span className={`text-xs font-bold ${line.type === 'DEBIT' ? 'text-slate-800' : 'text-slate-600'}`}>{line.accountName}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-2.5 text-right font-black text-slate-700">
                                                    {line.type === 'DEBIT' ? line.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                                                </td>
                                                <td className="px-6 py-2.5 text-right font-black text-slate-700">
                                                    {line.type === 'CREDIT' ? line.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default LedgerView;
