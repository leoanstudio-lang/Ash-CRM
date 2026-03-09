import React, { useState } from 'react';
import { AccountingCategory, AccountingAsset } from '../../types';
import { recordAssetPurchase, calculateDepreciation, deleteAsset } from '../../lib/accounting';
import { Building2, Laptop, Tv, Search, Trash2 } from 'lucide-react';

function generateId() {
    return Math.random().toString(36).substring(2, 15);
}

interface AssetManagementProps {
    categories: AccountingCategory[];
    assets: AccountingAsset[];
}

const AssetManagement: React.FC<AssetManagementProps> = ({ categories, assets }) => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Form State
    const [name, setName] = useState('');
    const [assetCatId, setAssetCatId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [cost, setCost] = useState('');
    const [usefulLife, setUsefulLife] = useState('5');
    const [paymentCatId, setPaymentCatId] = useState('');
    const [remarks, setRemarks] = useState('');

    const assetCategories = categories.filter(c => c.type === 'Asset' && c.status === 'Active' && !c.isDefault); // e.g. "Electronics", "Furniture"
    const paymentAccounts = categories.filter(c => c.type === 'Asset' && c.status === 'Active' && c.isDefault && ['Bank Account', 'UPI Wallet', 'Cash'].includes(c.name));

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !cost || !usefulLife || !assetCatId || !paymentCatId) return;

        const astCat = categories.find(c => c.id === assetCatId);
        const payCat = categories.find(c => c.id === paymentCatId);

        if (!astCat || !payCat) return;

        const newAsset: AccountingAsset = {
            id: generateId(),
            name,
            categoryId: astCat.id,
            categoryName: astCat.name,
            purchaseDate: new Date(date).toISOString(),
            cost: parseFloat(cost),
            usefulLifeYears: parseInt(usefulLife),
            paymentMethod: payCat.name,
            remarks,
            createdAt: new Date().toISOString()
        };

        try {
            await recordAssetPurchase(newAsset, payCat, 'System');
            setIsFormOpen(false);
            setName('');
            setCost('');
            setRemarks('');
            setUsefulLife('5');
        } catch (err: any) {
            alert("Error saving asset: " + err.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this asset?')) {
            try {
                await deleteAsset(id);
            } catch (err: any) {
                alert("Error deleting asset: " + err.message);
            }
        }
    };

    const filteredAssets = assets.filter(a =>
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.categoryName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                            <Building2 size={28} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Asset Management</h2>
                            <p className="text-sm font-semibold text-slate-500 mt-1">Track fixed assets and automated depreciation</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsFormOpen(true)}
                        className="bg-amber-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm hover:bg-amber-700 transition shrink-0"
                    >
                        + Add Asset
                    </button>
                </div>

                <div className="bg-amber-50 border border-amber-100 p-6 rounded-xl shadow-sm relative overflow-hidden group">
                    <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider relative z-10">Current Net Book Value</h4>
                    <p className="text-3xl font-black text-amber-600 relative z-10 mt-1">
                        ₹{assets.reduce((sum, asset) => {
                            const { currentValue } = calculateDepreciation(asset, new Date());
                            return sum + currentValue;
                        }, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-amber-100 rounded-full blur-3xl group-hover:bg-amber-200 transition duration-500"></div>
                </div>
            </div>

            {/* Manual Form Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white z-10">
                            <h3 className="text-xl font-bold text-slate-900">Record Fixed Asset</h3>
                            <button onClick={() => setIsFormOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition">✕</button>
                        </div>

                        <form onSubmit={handleSave} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Asset Name</label>
                                    <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-amber-500" placeholder="e.g. MacBook Pro M3" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Asset Category</label>
                                    <select required value={assetCatId} onChange={(e) => setAssetCatId(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-amber-500">
                                        <option value="">Select Category...</option>
                                        {assetCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Purchase Date</label>
                                    <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-amber-500" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Purchase Cost (₹)</label>
                                    <input type="number" required value={cost} onChange={(e) => setCost(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-amber-500" placeholder="0.00" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Useful Life (Years)</label>
                                    <input type="number" required value={usefulLife} onChange={(e) => setUsefulLife(e.target.value)} min="1" max="50" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-amber-500" placeholder="5" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Payment Source</label>
                                <select required value={paymentCatId} onChange={(e) => setPaymentCatId(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-amber-500">
                                    <option value="">Select Account...</option>
                                    {paymentAccounts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Remarks / Vendor details</label>
                                <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-amber-500" rows={2} placeholder="Add any background details here..." />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 py-2.5 text-slate-600 font-semibold text-sm hover:bg-slate-100 rounded-lg transition border border-slate-200">Cancel</button>
                                <button type="submit" className="flex-1 py-2.5 bg-amber-600 text-white font-semibold text-sm rounded-lg shadow-sm hover:bg-amber-700 transition">Save Asset</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Asset Register List */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
                <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
                    <div>
                        <h3 className="font-semibold text-slate-800">Asset Register</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Real-time depreciation</p>
                    </div>
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search assets..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-amber-500 transition-all"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                                <th className="px-6 py-4">Asset Details</th>
                                <th className="px-6 py-4">Purchase Info</th>
                                <th className="px-6 py-4 text-right">Original Cost</th>
                                <th className="px-6 py-4 text-right">Accumulated Dep.</th>
                                <th className="px-6 py-4 text-right">Net Book Value</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredAssets.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-16 text-center text-slate-400">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Laptop size={32} className="opacity-20" />
                                        </div>
                                        <p className="font-black text-xs uppercase tracking-[0.2em]">No assets found</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredAssets.map(asset => {
                                    const { accumulated, currentValue } = calculateDepreciation(asset, new Date());
                                    return (
                                        <tr key={asset.id} className="hover:bg-amber-50/30 transition-all group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                                                        <Tv size={20} />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 text-sm">{asset.name}</p>
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{asset.categoryName}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-xs font-bold text-slate-700">{new Date(asset.purchaseDate).toLocaleDateString()}</p>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{asset.usefulLifeYears} Year Life</p>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <p className="font-bold text-slate-800">₹{asset.cost.toLocaleString()}</p>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <p className="font-semibold text-slate-500">₹{accumulated.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                                <p className="text-[9px] font-bold text-amber-500 mt-0.5">Straight Line</p>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <p className="text-base font-bold text-amber-600">₹{currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => handleDelete(asset.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition border border-transparent hover:border-red-100" title="Delete Asset">
                                                    <Trash2 size={16} />
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
        </div>
    );
};

export default AssetManagement;
