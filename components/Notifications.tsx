import React from 'react';
import { Notification } from '../types';
import { Bell, AlertTriangle, CheckCircle, Info, Clock, X, ArrowRight } from 'lucide-react';

interface NotificationsProps {
  notifications: Notification[];
  onNotificationClick?: (data: any) => void;
  onDismiss?: (id: string) => void;
  onClearAll?: () => void;
}

const Notifications: React.FC<NotificationsProps> = ({ notifications, onNotificationClick, onDismiss, onClearAll }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="text-emerald-500" size={18} />;
      case 'warning': return <AlertTriangle className="text-amber-500" size={18} />;
      case 'alert': return <Bell className="text-rose-500" size={18} />;
      default: return <Info className="text-blue-500" size={18} />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-end mb-2">
        <div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">System Notifications</h3>
          <p className="text-slate-500 text-xs font-medium mt-1">Manage your automated alerts and follow-up schedules.</p>
        </div>
        {notifications.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-[10px] font-black text-blue-600 uppercase tracking-widest px-4 py-2 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all border border-blue-100"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="grid gap-3">
        {notifications.map(notif => (
          <div
            key={notif.id}
            className="group relative bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-300 overflow-hidden"
          >
            <div className="flex items-center p-4 gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${notif.type === 'alert' ? 'bg-rose-50' :
                notif.type === 'success' ? 'bg-emerald-50' :
                  'bg-blue-50'
                }`}>
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
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss?.(notif.id);
                  }}
                  className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                  title="Dismiss"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Action Bar on hover if links exist */}
            {notif.linkData && (
              <div
                onClick={() => onNotificationClick?.(notif.linkData)}
                className="h-1 bg-blue-500/10 group-hover:h-1.5 transition-all cursor-pointer"
              />
            )}
          </div>
        ))}

        {notifications.length === 0 && (
          <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <Bell className="text-slate-300" size={32} />
            </div>
            <h4 className="font-bold text-slate-800">No pending notifications</h4>
            <p className="text-slate-400 text-xs mt-1">We'll alert you when follow-ups are due.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
