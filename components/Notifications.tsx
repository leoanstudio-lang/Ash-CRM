import React, { useState } from 'react';
import { Notification, EmployeeNotification, Client } from '../types';
import { Bell, AlertTriangle, CheckCircle, Info, Clock, X, ArrowRight, User, Briefcase, Building2, Star } from 'lucide-react';
import { updateEmployeeNotificationInDB, deleteEmployeeNotificationFromDB, addProjectToDB, updateManualTaskInDB } from '../lib/db';

interface NotificationsProps {
  notifications: Notification[];
  employeeNotifications?: EmployeeNotification[];
  clients?: Client[];
  onNotificationClick?: (data: any) => void;
  onDismiss?: (id: string) => void;
  onClearAll?: () => void;
}

interface ConfirmTaskModalProps {
  notif: EmployeeNotification;
  onClose: () => void;
  onConfirmed: () => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  Urgent: 'bg-red-100 text-red-700 border-red-200',
  High: 'bg-orange-100 text-orange-700 border-orange-200',
  Medium: 'bg-blue-100 text-blue-700 border-blue-200',
  Low: 'bg-slate-100 text-slate-600 border-slate-200',
};

const ConfirmTaskModal: React.FC<ConfirmTaskModalProps> = ({ notif, onClose, onConfirmed }) => {
  const [totalAmount, setTotalAmount] = useState('');
  const [advance, setAdvance] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const balance = (parseFloat(totalAmount) || 0) - (parseFloat(advance) || 0);

  const handleConfirm = async () => {
    if (!totalAmount || parseFloat(totalAmount) <= 0) {
      setError('Please enter a valid task value.');
      return;
    }
    setIsSubmitting(true);
    setError('');

    try {
      const total = parseFloat(totalAmount);
      const adv = parseFloat(advance) || 0;
      const now = new Date();
      const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

      // Create a standalone project from the manual task
      const projectPayload: any = {
        clientId: notif.clientId,
        clientName: notif.clientName,
        serviceId: 'manual',
        serviceName: notif.description.substring(0, 60),
        type: 'Graphic', // default to department type
        priority: notif.priority,
        deadline: today,
        startDate: today,
        totalAmount: total,
        advance: adv,
        description: notif.description,
        status: 'Pending',
        progress: 0,
        assignedEmployeeId: notif.employeeId,
        department: notif.department,
        createdAt: new Date().toISOString(),
        isManualTask: true,
        manualTaskNotifId: notif.id,
        manualTaskId: notif.manualTaskId,
      };

      const projectId = await addProjectToDB(projectPayload);

      // Update the ManualTask to confirmed state with value
      await updateManualTaskInDB(notif.manualTaskId, {
        adminConfirmed: true,
        totalAmount: total,
        advance: adv,
        projectId: projectId || null,
      });

      // Mark the notification as confirmed
      await updateEmployeeNotificationInDB(notif.id, { status: 'confirmed' });

      onConfirmed();
    } catch (err) {
      console.error('Error confirming task:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Confirm & Value Task</h2>
              <p className="text-sm text-slate-500 mt-0.5">Set the price for this work before confirming</p>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Task Summary */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${PRIORITY_COLORS[notif.priority] || PRIORITY_COLORS['Medium']}`}>
                {notif.priority}
              </span>
              <span className="text-xs font-bold text-indigo-600">{notif.department}</span>
            </div>
            <p className="text-sm font-bold text-slate-800">{notif.companyName || notif.clientName}</p>
            <p className="text-xs text-slate-600 leading-relaxed">"{notif.description}"</p>
            <p className="text-xs text-slate-400">Employee: {notif.employeeName}</p>
          </div>

          {/* Amount Fields */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
              Total Task Value (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              placeholder="e.g. 15000"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
              Advance Received (₹) <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="number"
              min="0"
              placeholder="e.g. 5000"
              value={advance}
              onChange={(e) => setAdvance(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
            />
          </div>

          {/* Balance Preview */}
          {totalAmount && (
            <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-xs font-bold text-emerald-700">Balance Due on Completion</span>
              <span className="text-sm font-black text-emerald-700">₹{balance.toLocaleString()}</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-3 text-slate-600 font-semibold rounded-xl hover:bg-slate-100 border border-slate-200 text-sm transition"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 text-sm shadow-sm transition disabled:opacity-60"
            >
              {isSubmitting ? 'Confirming...' : '✓ Confirm Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Notifications: React.FC<NotificationsProps> = ({
  notifications,
  employeeNotifications = [],
  clients = [],
  onNotificationClick,
  onDismiss,
  onClearAll
}) => {
  const [confirmingNotif, setConfirmingNotif] = useState<EmployeeNotification | null>(null);
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="text-emerald-500" size={18} />;
      case 'warning': return <AlertTriangle className="text-amber-500" size={18} />;
      case 'alert': return <Bell className="text-rose-500" size={18} />;
      default: return <Info className="text-blue-500" size={18} />;
    }
  };

  // Only show pending ones
  const pendingEmployeeNotifs = employeeNotifications.filter(
    n => n.status === 'pending_review' && !rejectedIds.has(n.id)
  );

  const handleReject = async (notif: EmployeeNotification) => {
    if (!window.confirm(`Reject task request from ${notif.employeeName}?`)) return;
    setRejectedIds(prev => new Set([...Array.from(prev), notif.id]));
    await updateEmployeeNotificationInDB(notif.id, { status: 'rejected' });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-end mb-2">
        <div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">System Notifications</h3>
          <p className="text-slate-500 text-xs font-medium mt-1">Manage your automated alerts and follow-up schedules.</p>
        </div>
        {(notifications.length > 0 || pendingEmployeeNotifs.length > 0) && (
          <button
            onClick={onClearAll}
            className="text-[10px] font-black text-blue-600 uppercase tracking-widest px-4 py-2 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all border border-blue-100"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Employee Task Requests */}
      {pendingEmployeeNotifs.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 flex items-center gap-2">
            <User size={12} />
            Employee Task Requests ({pendingEmployeeNotifs.length})
          </h4>
          {pendingEmployeeNotifs.map(notif => (
            <div
              key={notif.id}
              className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden"
            >
              {/* Top accent */}
              <div className="h-1 bg-gradient-to-r from-indigo-400 to-blue-500" />
              <div className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
                  <div className="flex gap-3 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5">
                      <User size={18} className="text-indigo-500" />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h4 className="font-bold text-slate-800 text-sm">New Task Request</h4>
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${PRIORITY_COLORS[notif.priority] || PRIORITY_COLORS['Medium']}`}>
                          {notif.priority}
                        </span>
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[9px] font-black uppercase border border-indigo-100">
                          {notif.department}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <User size={11} className="text-slate-400 shrink-0" />
                          <span className="font-semibold">{notif.employeeName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <Building2 size={11} className="text-slate-400 shrink-0" />
                          <span className="font-semibold">{notif.companyName || notif.clientName}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 italic leading-relaxed">"{notif.description}"</p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-row sm:flex-col gap-2 sm:min-w-[120px]">
                    <button
                      onClick={() => setConfirmingNotif(notif)}
                      className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle size={13} />
                      Confirm
                    </button>
                    <button
                      onClick={() => handleReject(notif)}
                      className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl hover:bg-red-50 hover:text-red-600 transition flex items-center justify-center gap-1.5"
                    >
                      <X size={13} />
                      Reject
                    </button>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-[10px] text-slate-400">
                  <Clock size={11} />
                  <span>Submitted {new Date(notif.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Separator if both sections visible */}
      {pendingEmployeeNotifs.length > 0 && notifications.length > 0 && (
        <div className="h-px bg-slate-100" />
      )}

      {/* System Follow-up Notifications */}
      {notifications.length > 0 && (
        <div className="space-y-3">
          {pendingEmployeeNotifs.length > 0 && (
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Bell size={12} />
              System Alerts ({notifications.length})
            </h4>
          )}
          <div className="grid gap-3">
            {notifications.map(notif => (
              <div
                key={notif.id}
                className="group relative bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-300 overflow-hidden"
              >
                <div className="flex items-center p-4 gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${notif.type === 'alert' ? 'bg-rose-50' : notif.type === 'success' ? 'bg-emerald-50' : 'bg-blue-50'}`}>
                    {getIcon(notif.type)}
                  </div>

                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => notif.linkData && onNotificationClick?.(notif.linkData)}
                  >
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-800 text-sm">{notif.title}</h4>
                      {notif.linkData && (
                        <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase tracking-widest rounded-md border border-indigo-100 flex items-center gap-1">
                          Action Required <ArrowRight size={8} />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{notif.message}</p>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap hidden sm:flex items-center gap-1">
                      <Clock size={10} /> {notif.timestamp}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDismiss?.(notif.id); }}
                      className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                      title="Dismiss"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {notif.linkData && (
                  <div
                    onClick={() => onNotificationClick?.(notif.linkData)}
                    className="h-1 bg-blue-500/10 group-hover:h-1.5 transition-all cursor-pointer"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {notifications.length === 0 && pendingEmployeeNotifs.length === 0 && (
        <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
            <Bell className="text-slate-300" size={32} />
          </div>
          <h4 className="font-bold text-slate-800">No pending notifications</h4>
          <p className="text-slate-400 text-xs mt-1">We'll alert you when follow-ups are due.</p>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmingNotif && (
        <ConfirmTaskModal
          notif={confirmingNotif}
          onClose={() => setConfirmingNotif(null)}
          onConfirmed={() => {
            setConfirmingNotif(null);
          }}
        />
      )}
    </div>
  );
};

export default Notifications;
