import React, { useState } from 'react';
import { PaymentAlert, Package, Client, Project } from '../types';
import {
  Bell, History, CheckCircle2, Clock, PauseCircle, Undo2, Trash2, Wallet,
  AlertTriangle, ChevronDown, LineChart as ChartIcon, FileText, Download, PieChart, Check
} from 'lucide-react';
import { updatePaymentAlertInDB, deletePaymentAlertFromDB, updatePackageInDB, updateProjectInDB, addPaymentAlertToDB } from '../lib/db';
import { processAutomaticRevenue } from '../lib/accounting';
import { deleteField } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadWatermarkBase64, stampWatermarkAllPages } from '../lib/pdfWatermark';

interface PaymentsProps {
  paymentAlerts: PaymentAlert[];
  packages: Package[];
  clients: Client[];
  projects?: Project[];
}
type PaymentTab = 'alerts' | 'history' | 'finance' | 'analytics';

const Payments: React.FC<PaymentsProps> = ({ paymentAlerts = [], packages = [], clients = [], projects = [] }) => {
  const [activeTab, setActiveTab] = useState<PaymentTab>('alerts');
  const [alertToDelete, setAlertToDelete] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  // Actually-received inline panel state
  const [receivingAlertId, setReceivingAlertId] = useState<string | null>(null);
  const [actualAmountInput, setActualAmountInput] = useState<string>('');

  const safeAlerts = Array.isArray(paymentAlerts) ? paymentAlerts : [];
  const safePackages = Array.isArray(packages) ? packages : [];
  const safeClients = Array.isArray(clients) ? clients : [];
  const safeProjects = Array.isArray(projects) ? projects : [];

  // App.tsx auto-syncs completed projects with balance due into the paymentAlerts Firestore
  // collection as real DB records. We simply read from safeAlerts directly — no synthetic logic needed.
  const allAlerts: PaymentAlert[] = safeAlerts.filter(Boolean);

  // Payment Alerts = status is 'due', 'pending', or 'waiting'
  const activeAlerts = allAlerts.filter(a => a && (a.status === 'due' || a.status === 'pending' || a.status === 'waiting'));

  // Payment History = status is 'received'
  const paymentHistory = allAlerts
    .filter(a => a && a.status === 'received')
    .sort((a, b) => new Date(b.resolvedAt || b.triggeredAt).getTime() - new Date(a.resolvedAt || a.triggeredAt).getTime());

  // --- Data Aggregation for Finance & Analytics ---
  const getFinanceData = () => {
    const grouped: Record<string, { monthDate: Date, total: number, design: number, dev: number, payments: PaymentAlert[] }> = {};

    paymentHistory.forEach(p => {
      if (!p) return;
      const d = new Date(p.resolvedAt || p.triggeredAt);
      const monthName = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });

      if (!grouped[monthName]) {
        grouped[monthName] = { monthDate: d, total: 0, design: 0, dev: 0, payments: [] };
      }

      const effectiveAmount = p.actualAmount ?? p.amount;
      grouped[monthName].total += effectiveAmount;
      if (p.department === 'Graphics Designing') grouped[monthName].design += effectiveAmount;
      if (p.department === 'Development') grouped[monthName].dev += effectiveAmount;
      grouped[monthName].payments.push(p);
    });

    return Object.entries(grouped)
      .map(([label, data]) => ({ label, ...data }))
      .sort((a, b) => b.monthDate.getTime() - a.monthDate.getTime());
  };

  const financeData = getFinanceData();

  // Group by months of the year for Recharts (Analytics)
  const availableYears = Array.from(new Set(paymentHistory.map(p => new Date(p.resolvedAt || p.triggeredAt).getFullYear()))).sort((a, b) => Number(b) - Number(a));
  if (!availableYears.includes(new Date().getFullYear())) {
    availableYears.unshift(new Date().getFullYear());
  }

  const getAnalyticsData = (year: number) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    const data = months.map((m, i) => {
      const isFuture = year === currentYear && i > currentMonth;
      return {
        name: m,
        Total: isFuture ? null : 0,
        Design: isFuture ? null : 0,
        Development: isFuture ? null : 0,
        Trend: 0
      };
    });

    paymentHistory.forEach(p => {
      if (!p) return;
      const d = new Date(p.resolvedAt || p.triggeredAt);
      if (d.getFullYear() === year) {
        const monthIdx = d.getMonth();
        const record = data[monthIdx];
        if (record && record.Total !== null) {
          const effectiveAmount = p.actualAmount ?? p.amount;
          record.Total += effectiveAmount;
          if (p.department === 'Graphics Designing' || !p.department) {
            record.Design += effectiveAmount;
          } else if (p.department === 'Development') {
            record.Development += effectiveAmount;
          }
        }
      }
    });

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    let n = 0;
    const validMonths = year < currentYear ? 11 : currentMonth;

    for (let i = 0; i <= validMonths; i++) {
      if (data[i] && data[i].Total !== null) {
        sumX += i;
        sumY += data[i].Total as number;
        sumXY += i * (data[i].Total as number);
        sumX2 += i * i;
        n++;
      }
    }

    let slope = 0;
    let intercept = 0;
    if (n > 1) {
      slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      intercept = (sumY - slope * sumX) / n;
    } else if (n === 1) {
      intercept = sumY;
    }

    data.forEach((d, i) => {
      d.Trend = Math.max(0, Math.round(slope * i + intercept));
    });

    return data;
  };

  const generateMonthlyReportPDF = async (monthLabel: string, payments: PaymentAlert[], total: number, design: number, dev: number) => {
    const doc = new jsPDF();
    const deepEclipse: [number, number, number] = [15, 23, 42];
    const textMuted: [number, number, number] = [100, 116, 139];

    doc.setFontSize(18);
    doc.setTextColor(...deepEclipse);
    doc.setFont("helvetica", "bold");
    doc.text("FINANCIAL REVENUE REPORT", 14, 20);

    doc.setFontSize(11);
    doc.setTextColor(...textMuted);
    doc.setFont("helvetica", "normal");
    doc.text(monthLabel, 14, 28);

    doc.setFontSize(9);
    doc.text(`Total Revenue: Rs. ${total.toLocaleString()}`, 14, 38);
    doc.text(`Graphics Designing: Rs. ${design.toLocaleString()}`, 14, 44);
    doc.text(`Web Development: Rs. ${textMuted}`, 14, 50);

    const tableBody = payments.map(p => [
      formatDate(p.resolvedAt || p.triggeredAt),
      p.clientName || 'Client',
      p.packageName || p.taskName || 'N/A',
      p.department || 'N/A',
      p.actualAmount !== undefined && p.actualAmount !== p.amount
        ? `Rs. ${p.actualAmount.toLocaleString()} (Billed: Rs. ${p.amount.toLocaleString()})`
        : `Rs. ${p.amount.toLocaleString()}`
    ]);

    autoTable(doc, {
      startY: 56,
      head: [['DATE', 'CLIENT', 'SOURCE / MILESTONE', 'DEPARTMENT', 'AMOUNT']],
      body: tableBody,
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: deepEclipse },
      columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } }
    });

    const watermarkB64 = await loadWatermarkBase64();
    if (watermarkB64) {
      stampWatermarkAllPages(doc, watermarkB64);
    }

    doc.save(`Financial_Report_${monthLabel.replace(/\s+/g, '_')}.pdf`);
  };

  const handleMarkReceived = async (alertId: string, overrideAmount?: number) => {
    const alert = allAlerts.find(a => a && a.id === alertId);
    const effectiveAmount = overrideAmount ?? alert?.amount ?? 0;

    if (alert && alert.type === 'package' && alert.packageId) {
      const pkg = safePackages.find(p => p && p.id === alert.packageId);
      if (pkg) {
        const newReceivedAmount = (pkg.receivedAmount || 0) + effectiveAmount;
        const updatedMilestones = (pkg.paymentMilestones || []).map(m => {
          if (m.label === alert.milestoneLabel) {
            return { ...m, status: 'received' as const };
          }
          return m;
        });

        await updatePackageInDB(pkg.id, {
          receivedAmount: newReceivedAmount,
          paymentMilestones: updatedMilestones
        });
      }
    }

    // If it's a project balance alert, update project advance/receivedAmount in DB
    if (alert && alert.projectId) {
      const proj = safeProjects.find(p => p && p.id === alert.projectId);
      if (proj) {
        const currentAdvance = Number(proj.advance) || 0;
        await updateProjectInDB(proj.id, {
          advance: currentAdvance + effectiveAmount,
          receivedAmount: (proj.receivedAmount || 0) + effectiveAmount
        });
      }
    }

    // Build only defined fields to avoid Firestore errors with undefined values
    // (Firestore's updateDoc throws if any field value is undefined)
    const baseUpdate: Record<string, any> = {
      status: 'received',
      actualAmount: effectiveAmount,
      resolvedAt: new Date().toISOString(),
      clientName: alert?.clientName || 'Client',
      amount: alert?.amount || effectiveAmount,
      milestoneLabel: alert?.milestoneLabel || 'Balance Payment',
      department: alert?.department || 'Graphics Designing',
      type: alert?.type || 'standalone',
      triggeredAt: alert?.triggeredAt || new Date().toISOString(),
    };
    if (alert?.projectId !== undefined) baseUpdate.projectId = alert.projectId;
    if (alert?.packageId !== undefined) baseUpdate.packageId = alert.packageId;
    if (alert?.clientId !== undefined) baseUpdate.clientId = alert.clientId;
    if (alert?.packageName !== undefined) baseUpdate.packageName = alert.packageName;
    if (alert?.taskName !== undefined) baseUpdate.taskName = alert.taskName;

    // All alerts from App.tsx auto-sync are real Firestore docs (never synthetic proj_bal_ ids)
    await updatePaymentAlertInDB(alertId, baseUpdate);

    if (alert) {
      await processAutomaticRevenue({ ...alert, ...baseUpdate } as PaymentAlert, effectiveAmount);
    }

    setReceivingAlertId(null);
    setActualAmountInput('');
  };

  const handleOpenReceivePanel = (alertId: string, billedAmount: number) => {
    setReceivingAlertId(alertId);
    setActualAmountInput(String(billedAmount));
  };

  const handleCancelReceivePanel = () => {
    setReceivingAlertId(null);
    setActualAmountInput('');
  };

  const handleMarkPending = async (alertId: string) => {
    if (alertId.startsWith('proj_bal_')) {
      const alert = allAlerts.find(a => a && a.id === alertId);
      if (alert) {
        await addPaymentAlertToDB({
          projectId: alert.projectId,
          clientId: alert.clientId,
          clientName: alert.clientName,
          amount: alert.amount,
          milestoneLabel: alert.milestoneLabel,
          department: alert.department,
          status: 'pending',
          type: 'standalone',
          triggeredAt: alert.triggeredAt
        });
      }
    } else {
      await updatePaymentAlertInDB(alertId, { status: 'pending' });
    }
  };

  const handleMarkWaiting = async (alertId: string) => {
    if (alertId.startsWith('proj_bal_')) {
      const alert = allAlerts.find(a => a && a.id === alertId);
      if (alert) {
        await addPaymentAlertToDB({
          projectId: alert.projectId,
          clientId: alert.clientId,
          clientName: alert.clientName,
          amount: alert.amount,
          milestoneLabel: alert.milestoneLabel,
          department: alert.department,
          status: 'waiting',
          type: 'standalone',
          triggeredAt: alert.triggeredAt
        });
      }
    } else {
      await updatePaymentAlertInDB(alertId, { status: 'waiting' });
    }
  };

  const handleUndoReceived = async (alertId: string) => {
    const alert = allAlerts.find(a => a && a.id === alertId);
    if (alert && alert.type === 'package' && alert.packageId) {
      const pkg = safePackages.find(p => p && p.id === alert.packageId);
      if (pkg) {
        const effectiveAmount = alert.actualAmount !== undefined ? alert.actualAmount : alert.amount;
        const newReceivedAmount = Math.max(0, (pkg.receivedAmount || 0) - effectiveAmount);
        const updatedMilestones = (pkg.paymentMilestones || []).map(m => {
          if (m.label === alert.milestoneLabel) {
            return { ...m, status: 'due' as const };
          }
          return m;
        });

        await updatePackageInDB(pkg.id, {
          receivedAmount: newReceivedAmount,
          paymentMilestones: updatedMilestones
        });
      }
    }

    await updatePaymentAlertInDB(alertId, {
      status: 'due',
      resolvedAt: deleteField() as any,
      actualAmount: deleteField() as any
    });
  };

  const handleDeleteClick = (e: React.MouseEvent, alertId: string) => {
    e.stopPropagation();
    setAlertToDelete(alertId);
  };

  const confirmDelete = async () => {
    if (alertToDelete) {
      const alert = allAlerts.find(a => a && a.id === alertToDelete);
      if (alert && alert.type === 'package' && alert.packageId && alert.status === 'received') {
        const pkg = safePackages.find(p => p && p.id === alert.packageId);
        if (pkg) {
          const effectiveAmount = alert.actualAmount !== undefined ? alert.actualAmount : alert.amount;
          const newReceivedAmount = Math.max(0, (pkg.receivedAmount || 0) - effectiveAmount);
          const updatedMilestones = (pkg.paymentMilestones || []).map(m => {
            if (m.label === alert.milestoneLabel) {
              return { ...m, status: 'due' as const };
            }
            return m;
          });

          await updatePackageInDB(pkg.id, {
            receivedAmount: newReceivedAmount,
            paymentMilestones: updatedMilestones
          });
        }
      }

      if (!alertToDelete.startsWith('proj_bal_')) {
        await deletePaymentAlertFromDB(alertToDelete);
      }
      setAlertToDelete(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'due':
        return <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1"><AlertTriangle size={11} /> Due</span>;
      case 'pending':
        return <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200 inline-flex items-center gap-1"><Clock size={11} /> Pending</span>;
      case 'waiting':
        return <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 inline-flex items-center gap-1"><PauseCircle size={11} /> Waiting</span>;
      case 'received':
        return <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1"><CheckCircle2 size={11} /> Received</span>;
      default:
        return null;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const currentMonthReceived = paymentHistory
    .filter(p => {
      if (!p) return false;
      const d = new Date(p.resolvedAt || p.triggeredAt);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, p) => sum + (p.actualAmount ?? p.amount), 0);

  const totalDueAmount = activeAlerts.reduce((sum, a) => sum + (a.amount || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-6 space-y-6">
      {/* PAGE TITLE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-b border-slate-200/80 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Financial & Payment Desk
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage active payment alerts, received payments, revenue ledgers and analytics
          </p>
        </div>
      </div>

      {/* PROFESSIONAL MINIMAL STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Active Payment Alerts */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Active Payment Alerts</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">{activeAlerts.length}</span>
              <span className="text-xs text-slate-500 font-medium">Pending Action</span>
            </div>
          </div>
          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center border border-amber-100">
            <Bell size={20} />
          </div>
        </div>

        {/* Card 2: Received This Month */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Received This Month</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-emerald-600">₹{currentMonthReceived.toLocaleString()}</span>
            </div>
          </div>
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100">
            <CheckCircle2 size={20} />
          </div>
        </div>

        {/* Card 3: Total Pending Due */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Outstanding Due</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">₹{totalDueAmount.toLocaleString()}</span>
            </div>
          </div>
          <div className="w-10 h-10 bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center border border-slate-200">
            <Wallet size={20} />
          </div>
        </div>
      </div>

      {/* MINIMAL TAB NAVIGATION BAR */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('alerts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'alerts'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Bell size={14} />
          <span>Payment Alerts</span>
          {activeAlerts.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'alerts' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {activeAlerts.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'history'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <History size={14} />
          <span>Payment History</span>
        </button>

        <button
          onClick={() => setActiveTab('finance')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'finance'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <PieChart size={14} />
          <span>Finance Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'analytics'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <ChartIcon size={14} />
          <span>Analytics & Trends</span>
        </button>
      </div>

      {/* TAB 1: PAYMENT ALERTS */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {activeAlerts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-16 text-center space-y-2">
              <CheckCircle2 className="mx-auto text-emerald-500 mb-1" size={40} />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">No Pending Payment Alerts</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                All client milestones and project balances are completely up to date.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden divide-y divide-slate-100">
              <div className="bg-slate-50 text-slate-500 font-bold text-[11px] uppercase tracking-wider px-6 py-3.5 grid grid-cols-12 gap-4 items-center border-b border-slate-200/60">
                <div className="col-span-3">Client Name</div>
                <div className="col-span-3">Milestone / Description</div>
                <div className="col-span-2">Triggered Date</div>
                <div className="col-span-2">Amount Due</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>

              {activeAlerts.map(alert => (
                <div key={alert.id} className="px-6 py-4 grid grid-cols-12 gap-4 items-center transition-colors hover:bg-slate-50/80 text-xs">
                  <div className="col-span-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900">{alert.clientName || 'Client'}</h4>
                      {getStatusBadge(alert.status)}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium block">
                      {alert.type === 'package' ? 'Package' : 'Standalone'} • {alert.department || 'General'}
                    </span>
                  </div>

                  <div className="col-span-3 truncate">
                    <span className="font-bold text-slate-800 block truncate">
                      {alert.packageName || alert.taskName || 'Service Project'}
                    </span>
                    <span className="text-[11px] text-slate-500 block truncate">
                      {alert.milestoneLabel}
                    </span>
                  </div>

                  <div className="col-span-2 text-slate-600 font-medium">
                    {formatDate(alert.triggeredAt)}
                  </div>

                  <div className="col-span-2">
                    <span className="font-extrabold text-slate-900 text-sm">
                      ₹{alert.amount.toLocaleString()}
                    </span>
                  </div>

                  <div className="col-span-2 text-right space-y-2">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => receivingAlertId === alert.id ? handleCancelReceivePanel() : handleOpenReceivePanel(alert.id, alert.amount)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 active:scale-95 ${
                          receivingAlertId === alert.id
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                        }`}
                      >
                        <CheckCircle2 size={13} /> Received
                      </button>

                      <select
                        value={alert.status}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'received') {
                            handleOpenReceivePanel(alert.id, alert.amount);
                          } else if (val === 'pending') {
                            handleMarkPending(alert.id);
                          } else if (val === 'waiting') {
                            handleMarkWaiting(alert.id);
                          } else if (val === 'due') {
                            if (!alert.id.startsWith('proj_bal_')) {
                              updatePaymentAlertInDB(alert.id, { status: 'due' });
                            }
                          }
                        }}
                        className="bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs px-2.5 py-1.5 rounded-xl focus:outline-none focus:border-slate-900 cursor-pointer"
                      >
                        <option value="due">Due</option>
                        <option value="pending">Pending</option>
                        <option value="waiting">Waiting</option>
                        <option value="received">Received</option>
                      </select>
                    </div>

                    {/* Inline Payment Confirmation Panel */}
                    {receivingAlertId === alert.id && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-left space-y-2 mt-2">
                        <label className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                          Confirm Actual Amount Received
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={actualAmountInput}
                            onChange={e => setActualAmountInput(e.target.value)}
                            placeholder={String(alert.amount)}
                            className="w-full bg-white border border-emerald-300 rounded-lg text-xs font-bold text-slate-900 px-2.5 py-1.5 focus:outline-none focus:border-emerald-600"
                          />
                          <button
                            onClick={() => {
                              const parsed = parseFloat(actualAmountInput);
                              if (!isNaN(parsed) && parsed >= 0) {
                                handleMarkReceived(alert.id, parsed);
                              }
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all whitespace-nowrap"
                          >
                            Confirm
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PAYMENT HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden divide-y divide-slate-100">
          <div className="bg-slate-50 text-slate-500 font-bold text-[11px] uppercase tracking-wider px-6 py-3.5 grid grid-cols-12 gap-4 items-center border-b border-slate-200/60">
            <div className="col-span-2">Date Received</div>
            <div className="col-span-3">Client Name</div>
            <div className="col-span-3">Source / Milestone</div>
            <div className="col-span-2">Amount Billed / Received</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {paymentHistory.length === 0 ? (
            <div className="p-16 text-center text-slate-400 space-y-2">
              <History className="mx-auto text-slate-300 mb-1" size={40} />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">No Payment History Yet</h4>
              <p className="text-xs text-slate-500">Confirmed received payments will appear here.</p>
            </div>
          ) : (
            paymentHistory.map(payment => (
              <div key={payment.id} className="px-6 py-4 grid grid-cols-12 gap-4 items-center transition-colors hover:bg-slate-50/80 text-xs">
                <div className="col-span-2 text-slate-600 font-medium">
                  {formatDate(payment.resolvedAt || payment.triggeredAt)}
                </div>

                <div className="col-span-3 font-bold text-slate-900 truncate">
                  {payment.clientName}
                </div>

                <div className="col-span-3 truncate">
                  <span className="font-semibold text-slate-800 block truncate">
                    {payment.packageName || payment.taskName || 'Service Project'}
                  </span>
                  <span className="text-[11px] text-slate-400 block truncate">
                    {payment.milestoneLabel}
                  </span>
                </div>

                <div className="col-span-2">
                  <span className="font-extrabold text-emerald-600 text-sm block">
                    ₹{(payment.actualAmount ?? payment.amount).toLocaleString()}
                  </span>
                  {payment.actualAmount !== undefined && payment.actualAmount !== payment.amount && (
                    <span className="text-[10px] text-slate-400 font-medium">
                      Billed: ₹{payment.amount.toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="col-span-2 text-right flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleUndoReceived(payment.id)}
                    title="Undo - Move back to active alerts"
                    className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                  >
                    <Undo2 size={14} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteClick(e, payment.id)}
                    title="Delete Payment Record"
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: FINANCE LEDGER */}
      {activeTab === 'finance' && (
        <div className="space-y-6">
          {financeData.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-16 text-center space-y-2">
              <PieChart className="mx-auto text-slate-300 mb-1" size={40} />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">No Finance Records Found</h4>
              <p className="text-xs text-slate-500">Monthly breakdown will generate automatically as payments are received.</p>
            </div>
          ) : (
            financeData.map((data) => (
              <div key={data.label} className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                  <h3 className="font-extrabold text-slate-900 text-sm">{data.label} Ledger</h3>
                  <button
                    onClick={() => generateMonthlyReportPDF(data.label, data.payments, data.total, data.design, data.dev)}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-xl transition-all shadow-xs flex items-center gap-1.5"
                  >
                    <Download size={13} /> Download Monthly Report PDF
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 p-6 gap-4">
                  <div className="text-center space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Monthly Revenue</span>
                    <span className="text-2xl font-extrabold text-slate-900">₹{data.total.toLocaleString()}</span>
                  </div>
                  <div className="text-center space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Graphics Designing</span>
                    <span className="text-xl font-bold text-blue-600">₹{data.design.toLocaleString()}</span>
                  </div>
                  <div className="text-center space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Web Development</span>
                    <span className="text-xl font-bold text-emerald-600">₹{data.dev.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 4: ANALYTICS & TRENDS */}
      {activeTab === 'analytics' && (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Revenue Performance Trends</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">12-Month revenue trajectory & growth trends</p>
            </div>
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs px-4 py-2 rounded-xl focus:outline-none focus:border-slate-900"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="h-80 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={getAnalyticsData(selectedYear)} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
                  tickFormatter={(val) => `₹${val.toLocaleString()}`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '12px' }}
                  formatter={(value: number) => [`₹${value.toLocaleString()}`, '']}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                <Line type="monotone" dataKey="Trend" name="Projected Trend" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                <Line type="monotone" connectNulls={false} dataKey="Total" name="Total Revenue" stroke="#0f172a" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" connectNulls={false} dataKey="Design" name="Graphic Designing" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" connectNulls={false} dataKey="Development" name="Web Development" stroke="#059669" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {alertToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-3xl p-6 text-center space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-slate-800">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-1">
              <Trash2 size={24} />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-slate-900">Delete Payment Record?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete this payment record? This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setAlertToDelete(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-xs transition-all"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;
