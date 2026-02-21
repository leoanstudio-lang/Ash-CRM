
import React, { useState } from 'react';
import { PaymentAlert, Package, Client } from '../types';
import { Bell, History, CheckCircle, Clock, PauseCircle, Undo2, Trash2, Wallet, AlertTriangle, ChevronDown } from 'lucide-react';
import { updatePaymentAlertInDB, deletePaymentAlertFromDB, updatePackageInDB } from '../lib/db';

interface PaymentsProps {
    paymentAlerts: PaymentAlert[];
    packages: Package[];
    clients: Client[];
}

type PaymentTab = 'alerts' | 'history';

const Payments: React.FC<PaymentsProps> = ({ paymentAlerts, packages, clients }) => {
    const [activeTab, setActiveTab] = useState<PaymentTab>('alerts');
    const [alertToDelete, setAlertToDelete] = useState<string | null>(null);

    // Payment Alerts = status is 'due', 'pending', or 'waiting'
    const activeAlerts = paymentAlerts.filter(a => a.status === 'due' || a.status === 'pending' || a.status === 'waiting');

    // Payment History = status is 'received'
    const paymentHistory = paymentAlerts
        .filter(a => a.status === 'received')
        .sort((a, b) => new Date(b.resolvedAt || b.triggeredAt).getTime() - new Date(a.resolvedAt || a.triggeredAt).getTime());

    const handleMarkReceived = async (alertId: string) => {
        const alert = paymentAlerts.find(a => a.id === alertId);
        if (alert && alert.type === 'package' && alert.packageId) {
            const pkg = packages.find(p => p.id === alert.packageId);
            if (pkg) {
                // Update package received amount
                const newReceivedAmount = (pkg.receivedAmount || 0) + alert.amount;
                // Update milestone status
                const updatedMilestones = pkg.paymentMilestones.map(m => {
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

        await updatePaymentAlertInDB(alertId, {
            status: 'received',
            resolvedAt: new Date().toISOString()
        });
    };

    const handleMarkPending = async (alertId: string) => {
        await updatePaymentAlertInDB(alertId, { status: 'pending' });
    };

    const handleMarkWaiting = async (alertId: string) => {
        await updatePaymentAlertInDB(alertId, { status: 'waiting' });
    };

    const handleUndoReceived = async (alertId: string) => {
        const alert = paymentAlerts.find(a => a.id === alertId);
        if (alert && alert.type === 'package' && alert.packageId) {
            const pkg = packages.find(p => p.id === alert.packageId);
            if (pkg) {
                // Deduct from package received amount
                const newReceivedAmount = Math.max(0, (pkg.receivedAmount || 0) - alert.amount);
                // Revert milestone status to due
                const updatedMilestones = pkg.paymentMilestones.map(m => {
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
            resolvedAt: undefined
        });
    };

    const handleDeleteClick = (e: React.MouseEvent, alertId: string) => {
        e.stopPropagation();
        setAlertToDelete(alertId);
    };

    const confirmDelete = async () => {
        if (alertToDelete) {
            // Check if this was a received package payment that needs reversing
            const alert = paymentAlerts.find(a => a.id === alertToDelete);
            if (alert && alert.type === 'package' && alert.packageId && alert.status === 'received') {
                const pkg = packages.find(p => p.id === alert.packageId);
                if (pkg) {
                    // Deduct from package received amount
                    const newReceivedAmount = Math.max(0, (pkg.receivedAmount || 0) - alert.amount);
                    // Revert milestone status to due
                    const updatedMilestones = pkg.paymentMilestones.map(m => {
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

            await deletePaymentAlertFromDB(alertToDelete);
            setAlertToDelete(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'due':
                return <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5"><AlertTriangle size={10} /> Due</span>;
            case 'pending':
                return <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-orange-50 text-orange-700 border border-orange-200 flex items-center gap-1.5"><Clock size={10} /> Pending</span>;
            case 'waiting':
                return <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1.5"><PauseCircle size={10} /> Waiting</span>;
            case 'received':
                return <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5"><CheckCircle size={10} /> Received</span>;
            default:
                return null;
        }
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-amber-500 px-8 py-6 rounded-[2rem] text-white shadow-xl shadow-amber-500/20 relative overflow-hidden group hover:scale-[1.02] transition-transform">
                    <h4 className="text-[10px] font-black opacity-80 uppercase tracking-widest relative z-10">Active Alerts</h4>
                    <p className="text-4xl font-black relative z-10 mt-2">{activeAlerts.length}</p>
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
                </div>

                <div className="bg-emerald-500 px-8 py-6 rounded-[2rem] text-white shadow-xl shadow-emerald-500/20 relative overflow-hidden group hover:scale-[1.02] transition-transform">
                    <h4 className="text-[10px] font-black opacity-80 uppercase tracking-widest relative z-10">Received This Month</h4>
                    <p className="text-4xl font-black relative z-10 mt-2">
                        ₹{paymentHistory
                            .filter(p => {
                                const d = new Date(p.resolvedAt || p.triggeredAt);
                                const now = new Date();
                                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                            })
                            .reduce((sum, p) => sum + p.amount, 0)
                            .toLocaleString()}
                    </p>
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
                </div>

                <div className="bg-white px-8 py-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between hover:border-amber-100 transition-colors group">
                    <div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Due</h4>
                        <p className="text-3xl font-black text-slate-900 tracking-tight group-hover:text-amber-600 transition-colors">
                            ₹{activeAlerts.reduce((sum, a) => sum + a.amount, 0).toLocaleString()}
                        </p>
                    </div>
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center border border-amber-100">
                        <Wallet size={24} strokeWidth={2.5} />
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActiveTab('alerts')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'alerts'
                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                        : 'bg-white text-slate-400 border border-slate-100 hover:border-amber-200 hover:text-amber-600'
                        }`}
                >
                    <Bell size={16} />
                    Payment Alerts
                    {activeAlerts.length > 0 && (
                        <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'alerts' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                            }`}>
                            {activeAlerts.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'history'
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                        : 'bg-white text-slate-400 border border-slate-100 hover:border-emerald-200 hover:text-emerald-600'
                        }`}
                >
                    <History size={16} />
                    Payment History
                </button>
            </div>

            {/* Payment Alerts Tab */}
            {activeTab === 'alerts' && (
                <div className="space-y-4">
                    {activeAlerts.length === 0 ? (
                        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl py-24 text-center">
                            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle size={32} className="text-emerald-400" />
                            </div>
                            <p className="font-black text-xs uppercase tracking-[0.3em] text-slate-400">No pending payment alerts</p>
                            <p className="text-[10px] text-slate-300 mt-2 font-medium">All milestones are up to date</p>
                        </div>
                    ) : (
                        activeAlerts.map(alert => (
                            <div key={alert.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-lg p-6 hover:shadow-xl transition-all">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            {getStatusBadge(alert.status)}
                                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                                                {alert.type === 'package' ? '📦 Package' : '📄 Standalone'}
                                            </span>
                                        </div>
                                        <h4 className="font-black text-slate-900 text-lg tracking-tight">{alert.clientName}</h4>
                                        <p className="text-xs text-slate-500 font-bold mt-1">
                                            {alert.packageName || alert.taskName || 'N/A'} — {alert.milestoneLabel}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-medium mt-1">
                                            Triggered: {formatDate(alert.triggeredAt)}
                                        </p>
                                    </div>

                                    <div className="text-right flex-shrink-0">
                                        <p className="text-2xl font-black text-slate-900">₹{alert.amount.toLocaleString()}</p>
                                        <div className="flex gap-2 mt-3 justify-end">
                                            <button
                                                onClick={() => handleMarkReceived(alert.id)}
                                                className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/20 active:scale-95"
                                            >
                                                ✅ Received
                                            </button>
                                            <button
                                                onClick={() => handleMarkPending(alert.id)}
                                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${alert.status === 'pending'
                                                    ? 'bg-orange-500 text-white shadow-md'
                                                    : 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100'
                                                    }`}
                                            >
                                                ⏳ Pending
                                            </button>
                                            <button
                                                onClick={() => handleMarkWaiting(alert.id)}
                                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${alert.status === 'waiting'
                                                    ? 'bg-purple-500 text-white shadow-md'
                                                    : 'bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100'
                                                    }`}
                                            >
                                                ⏸ Waiting
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Payment History Tab */}
            {activeTab === 'history' && (
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
                    <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/20">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-md">
                                <History size={20} />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-900 tracking-tight">Payment History</h3>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">All received payments</p>
                            </div>
                        </div>
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl font-black uppercase tracking-wider">
                            {paymentHistory.length} Records
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.25em]">
                                    <th className="px-8 py-5">Date</th>
                                    <th className="px-8 py-5">Client</th>
                                    <th className="px-8 py-5">Source</th>
                                    <th className="px-8 py-5">Milestone</th>
                                    <th className="px-8 py-5">Amount</th>
                                    <th className="px-8 py-5">Status</th>
                                    <th className="px-8 py-5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {paymentHistory.map(payment => (
                                    <tr key={payment.id} className="hover:bg-slate-50/80 transition-all duration-300 group">
                                        <td className="px-8 py-5">
                                            <span className="text-xs font-bold text-slate-700">{formatDate(payment.resolvedAt || payment.triggeredAt)}</span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="font-black text-slate-800 text-sm">{payment.clientName}</span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-700">{payment.packageName || payment.taskName || 'N/A'}</span>
                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                                    {payment.type === 'package' ? '📦 Package' : '📄 Standalone'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="text-xs font-medium text-slate-600">{payment.milestoneLabel}</span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="text-sm font-black text-emerald-600">₹{payment.amount.toLocaleString()}</span>
                                        </td>
                                        <td className="px-8 py-5">
                                            {getStatusBadge(payment.status)}
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleUndoReceived(payment.id)}
                                                    className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-all border border-amber-200 active:scale-95"
                                                    title="Undo - Move back to alerts"
                                                >
                                                    <Undo2 size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteClick(e, payment.id)}
                                                    className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all border border-red-200 active:scale-95"
                                                    title="Delete payment record"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {paymentHistory.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="py-24 text-center text-slate-400">
                                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <History size={32} className="opacity-20" />
                                            </div>
                                            <p className="font-black text-xs uppercase tracking-[0.3em]">No payment history yet</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            {/* Delete Confirmation Modal */}
            {alertToDelete && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full p-6 border border-slate-100 transform transition-all scale-100">
                        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4 mx-auto">
                            <Trash2 className="text-red-500" size={24} />
                        </div>
                        <h3 className="text-lg font-black text-slate-900 text-center mb-2">Delete Record?</h3>
                        <p className="text-center text-slate-500 text-xs font-medium mb-6 leading-relaxed">
                            Are you sure you want to permanently delete this payment history? This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setAlertToDelete(null)}
                                className="flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-red-500 text-white shadow-lg shadow-red-500/30 hover:bg-red-600 transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Payments;
