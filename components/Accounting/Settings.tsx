import React, { useState } from 'react';
import { AccountingCategory, AccountType } from '../../types';
import { db } from '../../lib/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { Edit2, CheckCircle2, XCircle, Settings as SettingsIcon } from 'lucide-react';

interface SettingsProps {
    categories: AccountingCategory[];
}

const Settings: React.FC<SettingsProps> = ({ categories }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCat, setEditingCat] = useState<AccountingCategory | null>(null);

    const [name, setName] = useState('');
    const [type, setType] = useState<AccountType>('Revenue');
    const [status, setStatus] = useState<'Active' | 'Disabled'>('Active');

    const openForm = (cat?: AccountingCategory) => {
        if (cat) {
            setEditingCat(cat);
            setName(cat.name);
            setType(cat.type);
            setStatus(cat.status);
        } else {
            setEditingCat(null);
            setName('');
            setType('Revenue');
            setStatus('Active');
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        try {
            const docRef = editingCat ? doc(db, 'accounting_categories', editingCat.id) : doc(collection(db, 'accounting_categories'));

            const payload: Partial<AccountingCategory> = {
                name,
                type,
                status,
                isDefault: editingCat ? editingCat.isDefault : false, // Can't change default flag via UI
            };

            if (!editingCat) {
                payload.id = docRef.id;
                payload.createdAt = new Date().toISOString();
            }

            await setDoc(docRef, payload, { merge: true });
            setIsModalOpen(false);
        } catch (err) {
            console.error(err);
            alert('Error saving category');
        }
    };

    // Group categories by type
    const grouped = categories.reduce((acc, cat) => {
        if (!acc[cat.type]) acc[cat.type] = [];
        acc[cat.type].push(cat);
        return acc;
    }, {} as Record<string, AccountingCategory[]>);

    const accountTypes: AccountType[] = ['Revenue', 'Expense', 'Asset', 'Liability', 'Equity'];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-600">
                        <SettingsIcon size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Chart of Accounts</h2>
                        <p className="text-sm font-semibold text-slate-500 mt-1">Manage categories for transactions</p>
                    </div>
                </div>
                <button
                    onClick={() => openForm()}
                    className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm hover:bg-blue-700 transition"
                >
                    + Add Category
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
                {accountTypes.map(type => (
                    <div key={type} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                        <h3 className="text-sm font-semibold text-slate-800 mb-4 border-b border-slate-200 pb-3">{type}</h3>
                        <div className="space-y-3">
                            {(grouped[type] || []).map(cat => (
                                <div key={cat.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition group">
                                    <div className="flex items-center gap-2">
                                        {cat.status === 'Active' ? <CheckCircle2 size={14} className="text-emerald-500" /> : <XCircle size={14} className="text-slate-300" />}
                                        <span className={`text-sm font-bold ${cat.status === 'Active' ? 'text-slate-700' : 'text-slate-400 line-through'}`}>{cat.name}</span>
                                        {cat.isDefault && <span className="text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest flex-shrink-0 ml-1">Sys</span>}
                                    </div>
                                    <button onClick={() => openForm(cat)} className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-blue-600 transition">
                                        <Edit2 size={14} />
                                    </button>
                                </div>
                            ))}
                            {(!grouped[type] || grouped[type].length === 0) && (
                                <p className="text-xs text-slate-400 font-medium italic text-center py-4">No categories</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
                        <h3 className="text-xl font-bold text-slate-900 mb-6">{editingCat ? 'Edit Category' : 'New Category'}</h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Category Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                    placeholder="e.g. Office Supplies"
                                    disabled={editingCat?.isDefault}
                                    required
                                />
                                {editingCat?.isDefault && <p className="text-[9px] text-amber-600 mt-1 font-bold">Default system categories cannot be renamed.</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Account Type</label>
                                    <select
                                        value={type}
                                        onChange={(e) => setType(e.target.value as AccountType)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"
                                        disabled={editingCat?.isDefault}
                                    >
                                        {accountTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Status</label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value as 'Active' | 'Disabled')}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Disabled">Disabled</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 text-slate-600 font-semibold text-sm hover:bg-slate-100 rounded-lg transition border border-slate-200">Cancel</button>
                                <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white font-semibold text-sm rounded-lg shadow-sm hover:bg-blue-700 transition">Save Category</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
