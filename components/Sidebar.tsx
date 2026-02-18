
import React from 'react';
import { SIDEBAR_ITEMS } from '../constants';
import { Section } from '../types';
import { LogOut } from 'lucide-react';

interface SidebarProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
  onLogout: () => void;
  activeAlertCount?: number;
}

const Sidebar: React.FC<SidebarProps> = ({ activeSection, onSectionChange, onLogout, activeAlertCount = 0 }) => {
  return (
    <aside className="w-64 bg-[#0f172a] text-slate-300 flex flex-col border-r border-slate-800/50 shadow-xl h-full">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-10 pl-2">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="text-white font-black text-lg">Y</span>
          </div>
          <span className="text-xl font-bold text-white tracking-tight">ash CRM</span>
        </div>

        <nav className="space-y-2">
          {SIDEBAR_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id as Section)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group text-left ${activeSection === item.id
                ? 'bg-[#2563eb] text-white shadow-lg shadow-blue-600/30'
                : 'hover:bg-slate-800/50 hover:text-white'
                }`}
            >
              <span className={`flex-shrink-0 w-6 flex justify-center ${activeSection === item.id ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'
                }`}>
                {item.icon}
              </span>
              <span className={`text-[15px] font-semibold leading-tight ${activeSection === item.id ? 'text-white' : 'text-slate-300 group-hover:text-white'
                }`}>
                {item.label}
              </span>
              {item.id === 'Payments' && activeAlertCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-black min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center animate-pulse shadow-lg shadow-red-500/30">
                  {activeAlertCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-6 space-y-4">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-all font-bold uppercase text-xs tracking-wider"
        >
          <LogOut size={18} />
          <span>Exit Panel</span>
        </button>

        <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-2xl border border-slate-700/50">
          <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center text-xs font-bold border border-slate-600 text-slate-300">
            AD
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-bold text-white truncate">Admin Panel</span>
            <span className="text-[11px] text-slate-500 font-medium truncate uppercase tracking-wider">Super Admin</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
