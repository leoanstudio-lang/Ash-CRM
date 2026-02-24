import React, { useState } from 'react';
import { SIDEBAR_ITEMS } from '../constants';
import { Section } from '../types';
import { LogOut, ChevronLeft, ChevronRight } from 'lucide-react';

interface SidebarProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
  onLogout: () => void;
  counts?: Record<string, number>;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSectionChange,
  onLogout,
  counts = {},
  isCollapsed = false,
  onToggleCollapse
}) => {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <aside className={`bg-[#0f172a] text-slate-300 flex flex-col border-r border-slate-800/50 shadow-xl h-full transition-all duration-300 ease-in-out relative ${isCollapsed ? 'w-20' : 'w-64'
      }`}>
      {/* Toggle Button */}
      <button
        onClick={onToggleCollapse}
        className="absolute -right-3 top-20 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg border border-white/10 hover:bg-blue-700 transition-all z-50 lg:flex"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div className={`p-6 transition-all duration-300 ${isCollapsed ? 'px-4' : 'px-6'}`}>
        <div className="flex items-center gap-3 mb-10 pl-2 overflow-hidden">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
            <span className="text-white font-black text-lg">Y</span>
          </div>
          <span className={`text-xl font-bold text-white tracking-tight transition-all duration-300 ${isCollapsed ? 'opacity-0 translate-x-4 pointer-events-none' : 'opacity-100 translate-x-0'
            }`}>
            ash CRM
          </span>
        </div>

        <nav className="space-y-2">
          {SIDEBAR_ITEMS.map((item) => (
            <div key={item.id} className="relative group">
              <button
                onClick={() => onSectionChange(item.id as Section)}
                onMouseEnter={() => isCollapsed && setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group text-left relative ${activeSection === item.id
                    ? 'bg-[#2563eb] text-white shadow-lg shadow-blue-600/30'
                    : 'hover:bg-slate-800/50 hover:text-white'
                  } ${isCollapsed ? 'justify-center px-0' : ''}`}
              >
                <span className={`flex-shrink-0 w-6 flex justify-center transition-all duration-300 ${activeSection === item.id ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'
                  }`}>
                  {item.icon}
                </span>

                {!isCollapsed && (
                  <span className="text-[15px] font-semibold leading-tight whitespace-nowrap overflow-hidden transition-all duration-300">
                    {item.label}
                  </span>
                )}

                {counts && counts[item.id] > 0 && (
                  <span className={`ml-auto bg-red-500 text-white text-[10px] font-black h-5 px-1.5 rounded-full flex items-center justify-center animate-pulse shadow-lg shadow-red-500/30 ${isCollapsed ? 'absolute -top-1 -right-1 min-w-4 h-4 text-[8px] px-1' : 'min-w-[20px]'
                    }`}>
                    {counts[item.id]}
                  </span>
                )}
              </button>

              {/* Tooltip for collapsed state */}
              {isCollapsed && hoveredItem === item.id && (
                <div className="absolute left-full ml-4 px-3 py-2 bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest rounded-lg shadow-xl z-50 whitespace-nowrap border border-slate-700 animate-in fade-in slide-in-from-left-2 duration-200">
                  {item.label}
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-900 rotate-45 border-l border-b border-slate-700" />
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>

      <div className={`mt-auto p-6 space-y-4 transition-all duration-300 ${isCollapsed ? 'px-4' : 'px-6'}`}>
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-all font-bold uppercase text-xs tracking-wider ${isCollapsed ? 'justify-center px-0' : ''
            }`}
          title={isCollapsed ? "Exit Panel" : ""}
        >
          <LogOut size={18} />
          {!isCollapsed && <span>Exit Panel</span>}
        </button>

        <div className={`flex items-center gap-3 p-3 bg-slate-800/30 rounded-2xl border border-slate-700/50 transition-all duration-300 ${isCollapsed ? 'justify-center border-none bg-transparent p-1' : ''
          }`}>
          <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center text-xs font-bold border border-slate-600 text-slate-300 shrink-0">
            AD
          </div>
          {!isCollapsed && (
            <div className="flex flex-col overflow-hidden transition-all duration-300">
              <span className="text-sm font-bold text-white truncate">Admin Panel</span>
              <span className="text-[11px] text-slate-500 font-medium truncate uppercase tracking-wider">Super Admin</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
