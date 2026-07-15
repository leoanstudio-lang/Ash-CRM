import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { updateActiveDealInDB, updateInboundDealInDB } from '../lib/db';
import { Check, X, Award, DollarSign, Calendar, Landmark, Save } from 'lucide-react';

interface SalesIncentivesProps {
  employees: any[];
  activeDeals: any[];
  inboundActiveDeals: any[];
  campaigns: any[];
}

interface IncentiveSettings {
  minimumTarget: number;
  outboundRatio: number;
  inboundRatio: number;
}

const SalesIncentives: React.FC<SalesIncentivesProps> = ({
  employees = [],
  activeDeals = [],
  inboundActiveDeals = [],
  campaigns = []
}) => {
  const [settings, setSettings] = useState<IncentiveSettings>({
    minimumTarget: 30000,
    outboundRatio: 0.06,
    inboundRatio: 0.03
  });
  const [selectedRepId, setSelectedRepId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 1. Fetch settings from config/incentive_settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'config', 'incentive_settings');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSettings({
            minimumTarget: Number(data.minimumTarget) ?? 30000,
            outboundRatio: Number(data.outboundRatio) ?? 0.06,
            inboundRatio: Number(data.inboundRatio) ?? 0.03
          });
        } else {
          // Check old doc for migration fallback or use default
          const oldRef = doc(db, 'config', 'incentive_rules');
          const oldSnap = await getDoc(oldRef);
          let defaultSettings = { minimumTarget: 30000, outboundRatio: 0.06, inboundRatio: 0.03 };
          if (oldSnap.exists()) {
            const oldData = oldSnap.data();
            const firstOut = oldData.outbound?.[0];
            if (firstOut) defaultSettings.minimumTarget = Number(firstOut.minVal) || 30000;
          }
          await setDoc(docRef, defaultSettings);
          setSettings(defaultSettings);
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      }
    };
    fetchSettings();
  }, []);

  // Save settings to Firestore
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const docRef = doc(db, 'config', 'incentive_settings');
      await setDoc(docRef, settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter Sales employees
  const salesEmployees = useMemo(() => {
    return employees.filter(e =>
      e.role === 'employee' &&
      (e.department?.toLowerCase().includes('sales') || e.department?.toLowerCase() === 'sales')
    );
  }, [employees]);

  // Set default selected rep
  useEffect(() => {
    if (salesEmployees.length > 0 && !selectedRepId) {
      setSelectedRepId(salesEmployees[0].id);
    }
  }, [salesEmployees, selectedRepId]);

  // Find selected employee
  const selectedRep = salesEmployees.find(e => e.id === selectedRepId);

  // Retrieve closed won deals for selected representative and calculate dynamic commissions
  const representativeDeals = useMemo(() => {
    if (!selectedRepId) return [];

    const outboundClosed = activeDeals
      .filter(d => d.assignedEmployeeId === selectedRepId && d.outboundStage === 'Closed Won')
      .map(d => ({
        ...d,
        isOutbound: true,
        valNum: Number(d.value) || 0
      }));

    const inboundClosed = inboundActiveDeals
      .filter(d => d.assignedEmployeeId === selectedRepId && d.outboundStage === 'Closed Won')
      .map(d => ({
        ...d,
        isOutbound: false,
        valNum: Number(d.value) || 0
      }));

    const allDeals = [...outboundClosed, ...inboundClosed];

    // Compute cumulative sales value
    const totalSalesValue = allDeals.reduce((sum, d) => sum + d.valNum, 0);
    const targetMet = totalSalesValue >= settings.minimumTarget;

    return allDeals.map(d => {
      let commission = d.incentiveAmount;
      if (commission === undefined) {
        if (targetMet) {
          commission = d.valNum * (d.isOutbound ? settings.outboundRatio : settings.inboundRatio);
          commission = Math.round(commission); // Round to nearest integer for clean display
        } else {
          commission = 0;
        }
      }
      return {
        ...d,
        calculatedCommission: commission
      };
    }).sort((a, b) => {
      const dateA = new Date(a.stageEnteredAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.stageEnteredAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [selectedRepId, activeDeals, inboundActiveDeals, settings]);

  // Calculate totals
  const totals = useMemo(() => {
    let earned = 0;
    let pending = 0;
    let paid = 0;

    representativeDeals.forEach(deal => {
      const comm = deal.calculatedCommission;
      earned += comm;
      if (deal.incentiveStatus === 'Paid') {
        paid += comm;
      } else {
        pending += comm;
      }
    });

    return { earned, pending, paid };
  }, [representativeDeals]);

  // Toggle paid status
  const handleTogglePaid = async (deal: any) => {
    const nextStatus = deal.incentiveStatus === 'Paid' ? 'Unpaid' : 'Paid';
    try {
      if (deal.isOutbound) {
        await updateActiveDealInDB(deal.id, { incentiveStatus: nextStatus, incentiveAmount: deal.calculatedCommission });
      } else {
        await updateInboundDealInDB(deal.id, { incentiveStatus: nextStatus, incentiveAmount: deal.calculatedCommission });
      }
    } catch (err) {
      console.error('Error toggling incentive status:', err);
      alert('Failed to update payout status.');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Settings Configurator */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Incentive Settings</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Define target requirement and ratio percentages for commission payout</p>
        </div>

        <form onSubmit={handleSaveSettings} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-slate-50 p-4 rounded border border-slate-200">
          <div>
            <label className="text-[9px] font-bold text-slate-450 uppercase tracking-wider block mb-1">Min Cumulative Target (₹)</label>
            <input
              type="number"
              value={settings.minimumTarget}
              onChange={(e) => setSettings({ ...settings, minimumTarget: Number(e.target.value) || 0 })}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs font-bold text-slate-800 outline-none focus:border-slate-400"
              required
            />
          </div>
          <div>
            <label className="text-[9px] font-bold text-slate-450 uppercase tracking-wider block mb-1">Outbound Ratio (%)</label>
            <input
              type="number"
              step="0.01"
              value={settings.outboundRatio * 100}
              onChange={(e) => setSettings({ ...settings, outboundRatio: (Number(e.target.value) || 0) / 100 })}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs font-bold text-slate-800 outline-none focus:border-slate-400"
              required
            />
          </div>
          <div>
            <label className="text-[9px] font-bold text-slate-450 uppercase tracking-wider block mb-1">Inbound Ratio (%)</label>
            <input
              type="number"
              step="0.01"
              value={settings.inboundRatio * 100}
              onChange={(e) => setSettings({ ...settings, inboundRatio: (Number(e.target.value) || 0) / 100 })}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs font-bold text-slate-800 outline-none focus:border-slate-400"
              required
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-1.5 bg-slate-850 hover:bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider rounded transition flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <Save size={12} /> {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
            {saveSuccess && (
              <span className="flex items-center text-xs font-bold text-emerald-600 gap-1 animate-pulse">
                ✓ Saved
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Payout Ledger Section */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Representative Ledger</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Select a representative to inspect payout balances and close transactions</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Representative:</span>
            <select
              value={selectedRepId}
              onChange={(e) => setSelectedRepId(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-800 outline-none focus:border-slate-400 shadow-sm"
            >
              {salesEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedRep ? (
          <div className="space-y-6">
            
            {/* Balance Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded flex items-center justify-between">
                <div>
                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-450">Total Commission Earned</span>
                  <p className="text-xl font-bold text-slate-900 mt-1">₹{totals.earned.toLocaleString()}</p>
                </div>
                <div className="w-8 h-8 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
                  <Award size={16} />
                </div>
              </div>
              <div className="p-4 bg-amber-50/50 border border-amber-200 rounded flex items-center justify-between">
                <div>
                  <span className="text-[8px] font-bold uppercase tracking-wider text-amber-600">Pending Payout (Unpaid)</span>
                  <p className="text-xl font-bold text-amber-700 mt-1">₹{totals.pending.toLocaleString()}</p>
                </div>
                <div className="w-8 h-8 rounded bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <DollarSign size={16} />
                </div>
              </div>
              <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded flex items-center justify-between">
                <div>
                  <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-600">Paid Payouts</span>
                  <p className="text-xl font-bold text-emerald-700 mt-1">₹{totals.paid.toLocaleString()}</p>
                </div>
                <div className="w-8 h-8 rounded bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <Landmark size={16} />
                </div>
              </div>
            </div>

            {/* Payout History Table */}
            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-bold uppercase text-slate-450 tracking-wider">
                    <th className="py-2.5 px-4">Deal Details</th>
                    <th className="py-2.5 px-3">Service / Project</th>
                    <th className="py-2.5 px-3">Channel</th>
                    <th className="py-2.5 px-3">Closed Date</th>
                    <th className="py-2.5 px-3">Deal Value</th>
                    <th className="py-2.5 px-3">Commission</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {representativeDeals.map((deal) => (
                    <tr key={deal.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800">{deal.name}</span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">{deal.mobile || 'No Phone'}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-700">{deal.projectName || 'General Service'}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${deal.isOutbound ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                          {deal.isOutbound ? 'Outbound' : 'Inbound'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-550">
                        {deal.stageEnteredAt ? new Date(deal.stageEnteredAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        ₹{Number(deal.value || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-black text-emerald-600">
                        ₹{deal.calculatedCommission.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleTogglePaid(deal)}
                          className={`px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all shadow-sm ${
                            deal.incentiveStatus === 'Paid'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                          }`}
                        >
                          {deal.incentiveStatus === 'Paid' ? 'Paid ✓' : 'Mark Paid'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {representativeDeals.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 italic font-bold">
                        No closed won deals found for this representative in the active workspace.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 italic">
            No sales employees registered to check ledger details.
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesIncentives;
