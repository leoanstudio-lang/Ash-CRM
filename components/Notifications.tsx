
import React from 'react';
import { Notification } from '../types';
import { Bell, AlertTriangle, CheckCircle, Info, Clock } from 'lucide-react';

interface NotificationsProps {
  notifications: Notification[];
}

const Notifications: React.FC<NotificationsProps> = ({ notifications }) => {
  const getIcon = (type: string) => {
    switch(type) {
      case 'success': return <CheckCircle className="text-emerald-500" size={20} />;
      case 'warning': return <AlertTriangle className="text-amber-500" size={20} />;
      case 'alert': return <Bell className="text-red-500" size={20} />;
      default: return <Info className="text-blue-500" size={20} />;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-slate-800">System Notifications</h3>
        <button className="text-xs font-bold text-blue-600 uppercase tracking-wider">Mark all as read</button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm divide-y divide-slate-50">
        {notifications.map(notif => (
          <div key={notif.id} className="p-5 hover:bg-slate-50 transition-colors flex gap-4">
            <div className="mt-1">
              {getIcon(notif.type)}
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h4 className="font-bold text-slate-800">{notif.title}</h4>
                <span className="text-[10px] text-slate-400 flex items-center gap-1 font-bold">
                  <Clock size={10} /> {notif.timestamp}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">{notif.message}</p>
            </div>
          </div>
        ))}
        {notifications.length === 0 && (
          <div className="p-10 text-center text-slate-400">
            <Bell className="mx-auto mb-3 opacity-20" size={48} />
            <p className="font-medium">No new notifications</p>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mt-8">
        <h4 className="text-sm font-bold text-blue-800 mb-2">Automated Reports Ready</h4>
        <ul className="text-xs text-blue-600 space-y-2">
          <li>• Weekly sales CRM report for May 2024 is available.</li>
          <li>• Mandi report for regional development tasks generated.</li>
          <li>• Vehicle report of the revenue notification processed.</li>
        </ul>
      </div>
    </div>
  );
};

export default Notifications;
