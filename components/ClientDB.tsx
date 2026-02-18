
import React, { useState } from 'react';
import { Client } from '../types';
import {
  Search, UserPlus, Filter, Download, Plus, Mail,
  Phone, Building2, User, Globe, ArrowRight, Trash2,
  MoreVertical, ShieldCheck, ExternalLink
} from 'lucide-react';
import { addClientToDB, deleteClientFromDB } from '../lib/db';

interface ClientDBProps {
  clients: Client[];
  setClients?: React.Dispatch<React.SetStateAction<Client[]>>; // Optional/Deprecated
}

const ClientDB: React.FC<ClientDBProps> = ({ clients }) => {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [clientForm, setClientForm] = useState<Partial<Client>>({
    name: '',
    companyName: '',
    mobile: '',
    email: '',
    serviceEnquired: '',
    status: 'Active'
  });

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.companyName.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientForm.name) return; // Only name is hard required now

    const newClient: any = {
      name: clientForm.name!,
      companyName: clientForm.companyName || 'Private Individual',
      mobile: clientForm.mobile || 'Not Provided',
      email: clientForm.email || 'No Email Registered',
      serviceEnquired: clientForm.serviceEnquired || 'Direct Entry',
      dateAdded: new Date().toISOString().split('T')[0],
      status: (clientForm.status as 'Active' | 'Inactive') || 'Active'
    };

    await addClientToDB(newClient);
    setShowAddModal(false);
    setClientForm({ name: '', companyName: '', mobile: '', email: '', serviceEnquired: '', status: 'Active' });
  };

  const deleteClient = async (id: string) => {
    if (window.confirm('Are you sure you want to permanently remove this client from the master database?')) {
      await deleteClientFromDB(id);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Top Stats & Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-white px-6 py-5 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between overflow-hidden relative group gap-4 sm:gap-0">
          <div className="flex items-center gap-8 relative z-10 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Database Volume</span>
              <p className="text-3xl font-black text-slate-900 tracking-tighter">{clients.length}</p>
            </div>
            <div className="w-px h-10 bg-slate-100 hidden sm:block"></div>
            {/* Mobile divider */}
            <div className="w-px h-10 bg-slate-100 sm:hidden"></div>
            <div className="flex flex-col text-right sm:text-left">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Operational Accounts</span>
              <p className="text-3xl font-black text-blue-600 tracking-tighter">{clients.filter(c => c.status === 'Active').length}</p>
            </div>
          </div>
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-50 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
          <button className="relative z-10 w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 text-slate-500 hover:bg-slate-100 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all border border-slate-200">
            <Download size={14} /> Export Ledger
          </button>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 rounded-[2rem] px-6 py-5 text-white flex flex-col items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 group relative overflow-hidden active:scale-[0.98]"
        >
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/20 group-hover:scale-110 transition-transform">
            <Plus size={20} strokeWidth={3} />
          </div>
          <span className="font-black text-[10px] uppercase tracking-[0.3em]">Register New Client</span>
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
        </button>
      </div>

      {/* Main Client Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center bg-slate-50/20 gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg flex-shrink-0"><ShieldCheck size={20} /></div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight leading-none">Identity Ledger</h3>
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">Verified Client Accounts Database</p>
            </div>
          </div>
          <div className="relative flex-1 max-w-md group w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={16} />
            <input
              type="text"
              placeholder="Search by identity or organization..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 focus:border-blue-500 rounded-2xl outline-none transition-all text-sm font-bold shadow-inner"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
                <th className="px-6 py-4">Identity Brief</th>
                <th className="px-6 py-4">Entity Details</th>
                <th className="px-6 py-4">Onboarding</th>
                <th className="px-6 py-4">Account Status</th>
                <th className="px-6 py-4 text-right">Master Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredClients.map(client => (
                <tr key={client.id} className="hover:bg-slate-50/80 transition-all duration-300 group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-md group-hover:scale-105 transition-transform">
                        {client.name.substring(0, 1)}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900 text-sm tracking-tight">{client.name}</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">{client.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700 tracking-tight">{client.companyName}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[8px] font-black uppercase tracking-widest border border-indigo-100">{client.serviceEnquired}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-500 font-black">{client.dateAdded}</span>
                      <span className="text-[8px] text-slate-300 font-bold uppercase tracking-widest mt-0.5">First Engagement</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${client.status === 'Active' ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`}></div>
                      <span className="text-[9px] font-black text-slate-800 uppercase tracking-widest">{client.status} Account</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button className="p-2 bg-white text-slate-400 hover:text-blue-600 rounded-lg border border-slate-100 shadow-sm hover:scale-110 transition-all">
                        <ExternalLink size={14} />
                      </button>
                      <button
                        onClick={() => deleteClient(client.id)}
                        className="p-2 bg-white text-slate-400 hover:text-rose-600 rounded-lg border border-slate-100 shadow-sm hover:scale-110 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <User size={32} className="text-slate-200" />
                    </div>
                    <p className="font-black uppercase tracking-[0.2em] text-slate-300 text-xs">No identities found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Registration Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-2xl flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] w-full max-w-2xl overflow-hidden animate-in zoom-in duration-300 border border-white/20 max-h-[90vh] overflow-y-auto">
            <div className="px-6 md:px-10 py-6 md:py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-600/20">
                  <UserPlus size={24} />
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-none">Register Identity</h3>
                  <p className="text-slate-400 font-bold text-[9px] mt-1 uppercase tracking-[0.2em] opacity-80">
                    Manual Ledger Protocol Entry
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-10 h-10 rounded-full hover:bg-slate-200 flex items-center justify-center transition-all bg-white border border-slate-100 hover:rotate-90"
              >
                <Plus className="rotate-45 text-slate-400" size={24} />
              </button>
            </div>

            <form onSubmit={handleAddClient} className="p-6 md:p-10 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                    <User size={12} className="text-blue-500" /> Individual Full Name
                  </label>
                  <input
                    required
                    className="w-full p-4 border-2 border-slate-100 rounded-2xl bg-slate-50 font-black text-slate-800 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-600 outline-none transition-all text-sm"
                    type="text"
                    placeholder="Master Identity Name"
                    value={clientForm.name}
                    onChange={e => setClientForm({ ...clientForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                    <Building2 size={12} className="text-blue-500" /> Entity / Organization
                  </label>
                  <input
                    className="w-full p-4 border-2 border-slate-100 rounded-2xl bg-slate-50 font-black text-slate-800 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-600 outline-none transition-all text-sm"
                    type="text"
                    placeholder="Company or Private Group"
                    value={clientForm.companyName}
                    onChange={e => setClientForm({ ...clientForm, companyName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                    <Mail size={12} className="text-blue-500" /> Email (Optional)
                  </label>
                  <input
                    className="w-full p-4 border-2 border-slate-100 rounded-2xl bg-slate-50 font-black text-slate-800 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-600 outline-none transition-all text-sm"
                    type="email"
                    placeholder="client@master-identity.com"
                    value={clientForm.email}
                    onChange={e => setClientForm({ ...clientForm, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                    <Phone size={12} className="text-blue-500" /> Mobile Direct
                  </label>
                  <input
                    className="w-full p-4 border-2 border-slate-100 rounded-2xl bg-slate-50 font-black text-slate-800 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-600 outline-none transition-all text-sm"
                    type="text"
                    placeholder="+91 0000 0000"
                    value={clientForm.mobile}
                    onChange={e => setClientForm({ ...clientForm, mobile: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                    <Globe size={12} className="text-blue-500" /> Primary Service Requirement
                  </label>
                  <input
                    className="w-full p-4 border-2 border-slate-100 rounded-2xl bg-slate-50 font-black text-slate-800 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-600 outline-none transition-all text-sm"
                    type="text"
                    placeholder="Define core requirement or conversion point..."
                    value={clientForm.serviceEnquired}
                    onChange={e => setClientForm({ ...clientForm, serviceEnquired: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl shadow-2xl shadow-blue-600/30 hover:bg-blue-700 hover:-translate-y-1 active:scale-[0.98] transition-all uppercase tracking-[0.3em] text-xs flex items-center justify-center gap-4 group"
                >
                  Finalize Identity Registration
                  <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientDB;
