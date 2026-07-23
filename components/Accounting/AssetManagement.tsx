import React, { useState } from 'react';
import { AccountingAsset, AccountingCategory } from '../../types';
import { calculateDepreciation, deleteAsset, recordOpeningAsset, updateAsset } from '../../lib/accounting';
import { db } from '../../lib/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { cleanData } from '../../lib/accounting';
import { Laptop, Trash2, Pencil, Calendar, ShieldCheck, Tag, Plus, Landmark } from 'lucide-react';

interface AssetManagementProps {
  categories: AccountingCategory[];
  assets: AccountingAsset[];
}

const AssetManagement: React.FC<AssetManagementProps> = ({ categories = [], assets = [] }) => {
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  // Add Category Modal State
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Add Opening Asset Modal State
  const [isOpeningAssetModalOpen, setIsOpeningAssetModalOpen] = useState(false);
  const [opName, setOpName] = useState('');
  const [opCategoryName, setOpCategoryName] = useState('Computer & Laptops');
  const [opPurchaseDate, setOpPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [opCost, setOpCost] = useState('');
  const [opUsefulLife, setOpUsefulLife] = useState('3');
  const [opVendor, setOpVendor] = useState('');
  const [opRemarks, setOpRemarks] = useState('');

  // Edit Asset Modal State
  const [editingAsset, setEditingAsset] = useState<AccountingAsset | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategoryName, setEditCategoryName] = useState('Computer & Laptops');
  const [editPurchaseDate, setEditPurchaseDate] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editUsefulLife, setEditUsefulLife] = useState('3');
  const [editStatus, setEditStatus] = useState<'Active' | 'Disposed' | 'Maintenance'>('Active');
  const [editVendor, setEditVendor] = useState('');
  const [editRemarks, setEditRemarks] = useState('');

  const handleOpenEditModal = (asset: AccountingAsset) => {
    setEditingAsset(asset);
    setEditName(asset.name);
    setEditCategoryName(asset.categoryName || 'Computer & Laptops');
    setEditPurchaseDate(asset.purchaseDate ? asset.purchaseDate.split('T')[0] : new Date().toISOString().split('T')[0]);
    setEditCost(asset.cost ? asset.cost.toString() : '0');
    setEditUsefulLife(asset.usefulLifeYears !== undefined && asset.usefulLifeYears !== null ? asset.usefulLifeYears.toString() : '3');
    setEditStatus(asset.status || 'Active');
    setEditVendor(asset.vendor || '');
    setEditRemarks(asset.remarks || '');
  };

  const handleSaveEditAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;
    if (!editName.trim()) return alert("Please enter asset name.");
    if (!editCost || Number(editCost) < 0) return alert("Please enter a valid cost.");
    if (!editPurchaseDate) return alert("Please select purchase date.");

    try {
      await updateAsset(editingAsset.id, {
        name: editName.trim(),
        categoryName: editCategoryName,
        cost: parseFloat(editCost),
        purchaseDate: new Date(editPurchaseDate).toISOString(),
        usefulLifeYears: parseFloat(editUsefulLife) >= 0 ? parseFloat(editUsefulLife) : 0,
        status: editStatus,
        vendor: editVendor.trim() || undefined,
        remarks: editRemarks.trim() || undefined
      });

      setEditingAsset(null);
      alert(`Asset "${editName.trim()}" updated successfully!`);
    } catch (err: any) {
      console.error(err);
      alert("Error updating asset: " + (err?.message || err));
    }
  };

  const now = new Date();

  // Combine asset categories from DB and existing assets
  const assetCategoriesFromDB = categories.filter(c => c.type === 'Asset' && c.status === 'Active').map(c => c.name);
  const FIXED_ASSET_DEFAULT_CATEGORIES = ['Computer & Laptops', 'Furniture & Fixtures', 'AC & Appliances', 'Camera & Lighting', 'Other'];
  const allCategoryNames = Array.from(new Set([...assetCategoriesFromDB, ...FIXED_ASSET_DEFAULT_CATEGORIES, ...assets.map(a => a.categoryName)]));

  // Filter Assets
  const filteredAssets = assets.filter(asset => {
    const matchesCategory = filterCategory === 'All' || asset.categoryName === filterCategory;
    const matchesStatus = filterStatus === 'All' || (asset.status || 'Active') === filterStatus;
    return matchesCategory && matchesStatus;
  });

  // Financial Metrics
  const totalCost = assets.reduce((sum, a) => sum + a.cost, 0);

  const totalBookValue = assets.reduce((sum, a) => {
    const { currentValue } = calculateDepreciation(a, now);
    return sum + currentValue;
  }, 0);

  const totalDepreciation = totalCost - totalBookValue;

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this asset from the Asset Register?")) {
      try {
        await deleteAsset(id);
      } catch (err: any) {
        alert("Error deleting asset: " + err.message);
      }
    }
  };

  const handleCreateAssetCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      const docRef = doc(collection(db, 'accounting_categories'));
      await setDoc(docRef, cleanData({
        id: docRef.id,
        name: newCatName.trim(),
        type: 'Asset',
        status: 'Active',
        isDefault: false,
        createdAt: new Date().toISOString()
      }));
      setNewCatName('');
      setIsAddCategoryOpen(false);
      alert(`Asset category "${newCatName.trim()}" created successfully!`);
    } catch (err: any) {
      console.error(err);
      alert('Error creating asset category: ' + (err?.message || err));
    }
  };

  const handleSaveOpeningAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opName.trim()) return alert("Please enter asset name.");
    if (!opCost || Number(opCost) <= 0) return alert("Please enter a valid original cost.");
    if (!opPurchaseDate) return alert("Please select purchase date.");

    try {
      await recordOpeningAsset({
        name: opName.trim(),
        categoryName: opCategoryName,
        cost: parseFloat(opCost),
        purchaseDate: new Date(opPurchaseDate).toISOString(),
        usefulLifeYears: parseFloat(opUsefulLife) >= 0 ? parseFloat(opUsefulLife) : 3,
        vendor: opVendor.trim() || undefined,
        remarks: opRemarks.trim() || 'Opening Asset Migration'
      });

      setOpName('');
      setOpCost('');
      setOpVendor('');
      setOpRemarks('');
      setIsOpeningAssetModalOpen(false);
      alert(`Opening Asset "${opName.trim()}" registered successfully! Added to Fixed Asset Register.`);
    } catch (err: any) {
      console.error(err);
      alert("Error saving opening asset: " + (err?.message || err));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* HEADER METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Fixed Assets Cost</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">₹{totalCost.toLocaleString('en-IN')}</div>
          <span className="text-xs text-slate-500 font-medium mt-1 block">{assets.length} Registered Equipment & Items</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Current Book Value</span>
          <div className="text-2xl font-bold text-indigo-600 mt-1">₹{totalBookValue.toLocaleString('en-IN')}</div>
          <span className="text-xs text-indigo-600/80 font-medium mt-1 block">Net Asset Worth (Post Depreciation)</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Accumulated Depreciation</span>
          <div className="text-2xl font-bold text-slate-500 mt-1">₹{totalDepreciation.toLocaleString('en-IN')}</div>
          <span className="text-xs text-slate-500 font-medium mt-1 block">Straight-Line Depreciation To Date</span>
        </div>
      </div>

      {/* ASSET REGISTER TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Laptop className="text-indigo-600" size={20} />
            <div>
              <h2 className="text-base font-bold text-slate-900">Fixed Asset Register</h2>
              <p className="text-xs text-slate-500 font-medium">Track computers, electronics, machinery, furniture, and book values</p>
            </div>
          </div>

          {/* FILTERS & ACTION BUTTONS */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsOpeningAssetModalOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus size={14} />
              <span>+ Add Opening Asset</span>
            </button>

            <button
              onClick={() => setIsAddCategoryOpen(true)}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus size={14} />
              <span>Add Category</span>
            </button>

            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-indigo-500"
            >
              <option value="All">All Categories</option>
              {allCategoryNames.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-indigo-500"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Disposed">Disposed</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-4">Asset Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Purchase Date</th>
                <th className="py-3 px-4 text-center">Useful Life</th>
                <th className="py-3 px-4">Payment Source</th>
                <th className="py-3 px-4 text-right">Original Cost</th>
                <th className="py-3 px-4 text-right">Book Value</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 font-medium text-xs">
                    No fixed assets recorded yet. Click "+ Add Opening Asset" for migration or record a "Fixed Asset Purchase" in Money Out.
                  </td>
                </tr>
              ) : (
                filteredAssets.map(asset => {
                  const { currentValue } = calculateDepreciation(asset, now);
                  const status = asset.status || 'Active';
                  const source = asset.paymentSource || asset.paymentMethod || 'Bank';

                  return (
                    <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {asset.name}
                        {asset.vendor && <span className="block text-[11px] text-slate-400 font-normal">Vendor: {asset.vendor}</span>}
                        {asset.remarks && <span className="block text-[11px] text-slate-500 font-normal italic">Note: {asset.remarks}</span>}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-600">
                        {asset.categoryName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(asset.purchaseDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          !asset.usefulLifeYears || asset.usefulLifeYears === 0
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-indigo-50 text-indigo-700'
                        }`}>
                          {!asset.usefulLifeYears || asset.usefulLifeYears === 0 ? 'N/A' : `${asset.usefulLifeYears} Yrs`}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-600">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          source === 'Opening Balance'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {source}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 text-right">
                        ₹{asset.cost.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-indigo-600 text-right">
                        ₹{Math.round(currentValue).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                          status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          status === 'Maintenance' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(asset)}
                            className="p-1 text-slate-400 hover:text-indigo-600 transition"
                            title="Edit asset details"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(asset.id)}
                            className="p-1 text-slate-400 hover:text-red-600 transition"
                            title="Delete asset"
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

      {/* CREATE OPENING ASSET MODAL */}
      {isOpeningAssetModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Add Opening Asset</h3>
                <p className="text-[11px] text-slate-500 font-medium">Register historical business equipment prior to accounting setup</p>
              </div>
              <button onClick={() => setIsOpeningAssetModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleSaveOpeningAsset} className="space-y-3.5 text-xs">
              
              <div>
                <label className="block font-bold text-slate-700 mb-1">Asset Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MacBook M1, Office AC, Camera"
                  value={opName}
                  onChange={(e) => setOpName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Category *</label>
                <select
                  value={opCategoryName}
                  onChange={(e) => setOpCategoryName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                >
                  {allCategoryNames.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Original Cost (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 45000"
                    value={opCost}
                    onChange={(e) => setOpCost(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Purchase Date *</label>
                  <input
                    type="date"
                    required
                    value={opPurchaseDate}
                    onChange={(e) => setOpPurchaseDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Useful Life (Years)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="3 (Set 0 for N/A)"
                  value={opUsefulLife}
                  onChange={(e) => setOpUsefulLife(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                />
                <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Enter 0 for Non-Depreciable assets (N/A)</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Vendor / Payee (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Apple Store, Landlord"
                  value={opVendor}
                  onChange={(e) => setOpVendor(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-indigo-600"
                />
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
                💡 <span className="font-bold">Opening Asset Rule</span>: Adds to Fixed Assets & Book Value without generating Money Out entries or deducting Cash/Bank balance.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpeningAssetModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs"
                >
                  Save Opening Asset
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* CREATE ASSET CATEGORY MODAL */}
      {isAddCategoryOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Add New Asset Category</h3>
              <button onClick={() => setIsAddCategoryOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleCreateAssetCategory} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Asset Category / Account Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Office Security Deposit, Vehicles, Plant & Machinery"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-500 font-medium">
                Type: <span className="font-bold text-slate-800">Asset</span> (Chart of Accounts)
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddCategoryOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-xs"
                >
                  Save Asset Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ASSET MODAL */}
      {editingAsset && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Edit Asset Details</h3>
                <p className="text-[11px] text-slate-500 font-medium">Update equipment specifications, original cost, useful life, or status</p>
              </div>
              <button onClick={() => setEditingAsset(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleSaveEditAsset} className="space-y-3.5 text-xs">
              
              <div>
                <label className="block font-bold text-slate-700 mb-1">Asset Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MacBook M1, Office AC, Camera"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Category *</label>
                <select
                  value={editCategoryName}
                  onChange={(e) => setEditCategoryName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                >
                  {allCategoryNames.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Original Cost (₹) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="e.g. 45000"
                    value={editCost}
                    onChange={(e) => setEditCost(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Purchase Date *</label>
                  <input
                    type="date"
                    required
                    value={editPurchaseDate}
                    onChange={(e) => setEditPurchaseDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Useful Life (Years)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="3 (Set 0 for N/A)"
                    value={editUsefulLife}
                    onChange={(e) => setEditUsefulLife(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
                  >
                    <option value="Active">Active</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Disposed">Disposed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Vendor / Payee (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Apple Store, Landlord"
                  value={editVendor}
                  onChange={(e) => setEditVendor(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Remarks / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Opening Balance Migration"
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingAsset(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs"
                >
                  Update Asset
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AssetManagement;
