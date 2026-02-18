
import React, { useState } from 'react';
import { Project, Employee, Package } from '../types';
import { Search, Filter, Calendar, DollarSign, User, ShieldCheck, Clipboard, Trash2 } from 'lucide-react';
import { deleteProjectFromDB } from '../lib/db';

interface HistoryProps {
  projects: Project[];
  packages?: Package[]; // Optional to support legacy usage, but expected
  setProjects?: React.Dispatch<React.SetStateAction<Project[]>>; // Optional/Deprecated
  employees: Employee[];
}

const History: React.FC<HistoryProps> = ({ projects, employees, packages = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Designing' | 'Developing'>('All');
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setProjectToDelete(id);
  };

  const confirmDelete = async () => {
    if (projectToDelete) {
      await deleteProjectFromDB(projectToDelete);
      setProjectToDelete(null);
    }
  };

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.serviceName?.toLowerCase().includes(searchTerm.toLowerCase());

    const isGraphic = project.type === 'Graphic';
    const isDev = ['Web', 'Full Dev', 'Mobile'].includes(project.type);

    if (filterType === 'Designing') return matchesSearch && isGraphic;
    if (filterType === 'Developing') return matchesSearch && isDev;
    return matchesSearch;
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="bg-[#0f172a] px-6 py-5 rounded-[2rem] text-white shadow-xl relative overflow-hidden flex items-center justify-between">
        <div className="relative z-10">
          <h2 className="text-xl font-black tracking-tight">Work Archive</h2>
          <p className="text-slate-400 text-xs font-medium mt-1 opacity-80">Complete history of services and production logs.</p>
        </div>

        <div className="relative z-10 flex gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Total Logged</span>
            <span className="text-2xl font-bold">{projects.length}</span>
          </div>
          <div className="w-px h-10 bg-white/10"></div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Value Delivered</span>
            <span className="text-2xl font-bold text-emerald-400">₹{projects.reduce((sum, p) => sum + (p.totalAmount || 0), 0).toLocaleString()}</span>
          </div>
        </div>
        <div className="absolute -right-10 -bottom-20 w-60 h-60 bg-blue-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex flex-col md:flex-row gap-3 justify-between bg-slate-50/50 items-center">
          <div className="flex gap-2 p-1 bg-white rounded-xl border border-slate-200 w-max shadow-sm">
            <button
              onClick={() => setFilterType('All')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${filterType === 'All' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              All Work
            </button>
            <button
              onClick={() => setFilterType('Designing')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${filterType === 'Designing' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Designing
            </button>
            <button
              onClick={() => setFilterType('Developing')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${filterType === 'Developing' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Developing
            </button>
          </div>

          <div className="relative w-full md:w-64 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={14} />
            <input
              type="text"
              placeholder="Search history..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 shadow-sm transition-all text-xs font-semibold"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-100">
                <th className="px-6 py-4">Project Details</th>
                <th className="px-6 py-4">Client Identity</th>
                <th className="px-6 py-4">Production Log</th>
                <th className="px-6 py-4">Financials</th>
                <th className="px-6 py-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredProjects.map(project => {
                const assignedEmp = employees.find(e => e.id === project.assignedEmployeeId);
                const isGraphic = project.type === 'Graphic';

                return (
                  <tr key={project.id} className="hover:bg-slate-50/80 transition-all duration-300 group">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-105 ${isGraphic ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                          {isGraphic ? <Clipboard size={16} /> : <ShieldCheck size={16} />}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 text-sm tracking-tight">{project.serviceName}</span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{project.type}</span>

                          {/* Package Context */}
                          {project.packageId && (() => {
                            const pkg = packages.find(p => p.id === project.packageId);
                            if (pkg && typeof project.packageLineItemIndex === 'number') {
                              const lineItem = pkg.lineItems[project.packageLineItemIndex];
                              // Calculate index based on creation time for stable "4/30" numbering
                              const allPackageTasks = projects
                                .filter(p => p.packageId === project.packageId && p.packageLineItemIndex === project.packageLineItemIndex)
                                .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
                              const index = allPackageTasks.findIndex(p => p.id === project.id) + 1;

                              return (
                                <div className="mt-1 flex flex-col">
                                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                                    {pkg.packageName}
                                  </span>
                                  <span className="text-[9px] font-bold text-slate-400">
                                    Item {index}/{lineItem.quantity}
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">{project.clientName}</span>
                        <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">ID: {project.id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Calendar size={10} className="text-blue-500" />
                          <span className="text-[9px] font-bold uppercase tracking-wider">{project.deadline}</span>
                        </div>
                        {assignedEmp ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded-md bg-slate-100 text-[6px] flex items-center justify-center font-black text-slate-500 border border-slate-200">
                              {assignedEmp.name.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{assignedEmp.name.split(' ')[0]}</span>
                          </div>
                        ) : (
                          <span className="text-[8px] text-slate-300 font-bold uppercase tracking-widest">No allocation</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900">₹{(project.totalAmount || 0).toLocaleString()}</span>
                        <span className="text-[8px] text-emerald-600 font-bold uppercase tracking-tight">Paid: ₹{(project.receivedAmount || project.advance || 0).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${(project.status === 'Completed' || project.status === 'Finished') ? 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm' :
                          project.status === 'Working' ? 'bg-blue-50 text-blue-600 border-blue-100 animate-pulse' :
                            project.status === 'Waiting' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-slate-50 text-slate-500 border-slate-100'
                          }`}>
                          {project.status === 'Completed' ? 'Finished' : project.status}
                        </span>
                        <button
                          onClick={(e) => handleDeleteClick(e, project.id)}
                          className="p-1.5 bg-white text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-100 shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredProjects.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-slate-400">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                      <Search className="opacity-20" size={24} />
                    </div>
                    <p className="font-bold text-[10px] uppercase tracking-[0.2em]">No results found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full p-6 border border-slate-100 transform transition-all scale-100">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4 mx-auto">
              <Trash2 className="text-red-500" size={24} />
            </div>
            <h3 className="text-lg font-black text-slate-900 text-center mb-2">Delete History Log?</h3>
            <p className="text-center text-slate-500 text-xs font-medium mb-6 leading-relaxed">
              Are you sure you want to permanently delete this project record? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setProjectToDelete(null)}
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

export default History;
