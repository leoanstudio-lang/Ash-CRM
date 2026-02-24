
import React, { useState } from 'react';
import { Employee, Service, Role, Channel } from '../types';
import { UserPlus, Settings as SettingsIcon, Shield, Trash2, Key, Plus, LogOut, CheckCircle2, X, Save, Building2, Smartphone, Globe, Instagram, Facebook, Megaphone } from 'lucide-react';
import { addEmployeeToDB, deleteEmployeeFromDB, addServiceToDB, deleteServiceFromDB, getCompanyProfile, saveCompanyProfile, addChannelToDB, deleteChannelFromDB } from '../lib/db';
import { CompanyProfile } from '../types';

interface SettingsProps {
  employees: Employee[];
  setEmployees?: React.Dispatch<React.SetStateAction<Employee[]>>; // Optional/Deprecated
  services: Service[];
  setServices?: React.Dispatch<React.SetStateAction<Service[]>>; // Optional/Deprecated
  channels?: Channel[];
  onLogout: () => void;
}

const Settings: React.FC<SettingsProps> = ({ employees, services, channels = [], onLogout }) => {
  const [activeTab, setActiveTab] = useState<'employees' | 'services' | 'channels' | 'admin' | 'company'>('employees');

  // Company Profile State
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [companyForm, setCompanyForm] = useState<CompanyProfile>({
    companyName: '',
    tagline: '',
    contacts: [],
    socials: []
  });

  const addContact = () => {
    setCompanyForm({
      ...companyForm,
      contacts: [...companyForm.contacts, { id: Date.now().toString(), label: '', value: '' }]
    });
  };

  const removeContact = (id: string) => {
    setCompanyForm({
      ...companyForm,
      contacts: companyForm.contacts.filter(c => c.id !== id)
    });
  };

  const updateContact = (id: string, field: 'label' | 'value', val: string) => {
    setCompanyForm({
      ...companyForm,
      contacts: companyForm.contacts.map(c => c.id === id ? { ...c, [field]: val } : c)
    });
  };

  const addSocial = () => {
    setCompanyForm({
      ...companyForm,
      socials: [...companyForm.socials, { id: Date.now().toString(), label: '', value: '' }]
    });
  };

  const removeSocial = (id: string) => {
    setCompanyForm({
      ...companyForm,
      socials: companyForm.socials.filter(s => s.id !== id)
    });
  };

  const updateSocial = (id: string, field: 'label' | 'value', val: string) => {
    setCompanyForm({
      ...companyForm,
      socials: companyForm.socials.map(s => s.id === id ? { ...s, [field]: val } : s)
    });
  };

  React.useEffect(() => {
    const fetchCompanyData = async () => {
      const data = await getCompanyProfile();
      if (data) setCompanyForm(data);
    };
    fetchCompanyData();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    await saveCompanyProfile(companyForm);
    setIsSavingConfig(false);
    alert('Company Configuration saved successfully!');
  };

  // States for better form handling
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceCategory, setNewServiceCategory] = useState('Graphic Designing');
  const [isAddingService, setIsAddingService] = useState(false);

  // Employee Form State
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [empForm, setEmpForm] = useState<Partial<Employee>>({
    name: '',
    department: 'Graphic',
    username: '',
    password: '',
    mobile: ''
  });

  // Channel Form State
  const [newChannelName, setNewChannelName] = useState('');
  const [isAddingChannel, setIsAddingChannel] = useState(false);

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    await addChannelToDB({ name: newChannelName });
    setNewChannelName('');
    setIsAddingChannel(false);
  };

  const removeChannel = async (id: string) => {
    if (window.confirm('Are you sure you want to completely delete this channel?')) {
      await deleteChannelFromDB(id);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empForm.name || !empForm.username || !empForm.password) return;

    const newEmp: any = {
      name: empForm.name,
      mobile: empForm.mobile || '0000000000',
      username: empForm.username,
      password: empForm.password,
      department: empForm.department || 'Graphic',
      role: 'employee'
    };

    await addEmployeeToDB(newEmp);
    setShowAddEmployee(false);
    setEmpForm({ name: '', department: 'Graphic', username: '', password: '', mobile: '' });
  };

  const deleteEmployee = async (id: string) => {
    if (window.confirm('Are you sure you want to permanently remove this employee access?')) {
      await deleteEmployeeFromDB(id);
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;

    const newSvc: any = {
      name: newServiceName,
      category: newServiceCategory
    };

    await addServiceToDB(newSvc);
    setNewServiceName('');
    setIsAddingService(false);
  };

  const removeService = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this service?')) {
      await deleteServiceFromDB(id);
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[600px] flex flex-col">
      <div className="flex border-b border-slate-100 bg-slate-50/50">
        <button
          onClick={() => setActiveTab('employees')}
          className={`px-8 py-5 font-bold text-sm transition-all ${activeTab === 'employees' ? 'text-blue-600 border-b-4 border-blue-600 bg-white' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Staff & Access
        </button>
        <button
          onClick={() => setActiveTab('services')}
          className={`px-8 py-5 font-bold text-sm transition-all ${activeTab === 'services' ? 'text-blue-600 border-b-4 border-blue-600 bg-white' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Service Master List
        </button>
        <button
          onClick={() => setActiveTab('company')}
          className={`px-8 py-5 font-bold text-sm transition-all ${activeTab === 'company' ? 'text-blue-600 border-b-4 border-blue-600 bg-white' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Company Config
        </button>
        <button
          onClick={() => setActiveTab('channels')}
          className={`px-8 py-5 font-bold text-sm transition-all ${activeTab === 'channels' ? 'text-blue-600 border-b-4 border-blue-600 bg-white' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Outreach Channels
        </button>
        <button
          onClick={() => setActiveTab('admin')}
          className={`px-8 py-5 font-bold text-sm transition-all ${activeTab === 'admin' ? 'text-blue-600 border-b-4 border-blue-600 bg-white' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Security
        </button>
        <div className="ml-auto p-4">
          <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-all">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      <div className="p-10 flex-1 relative">
        {activeTab === 'employees' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-900">Team Management</h3>
                <p className="text-sm text-slate-500">Add employees and set their access credentials.</p>
              </div>
              <button
                onClick={() => setShowAddEmployee(true)}
                className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-sm font-bold shadow-xl hover:bg-black transition-colors"
              >
                <UserPlus size={18} /> Add New Member
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {employees.filter(e => e.role === 'employee').map(emp => (
                <div key={emp.id} className="p-6 rounded-[2rem] border border-slate-100 bg-slate-50/50 flex items-center justify-between group hover:border-blue-200 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center font-black text-blue-600 text-xl">
                      {emp.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-lg">{emp.name}</p>
                      <div className="flex gap-4 mt-1">
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">User: {emp.username}</p>
                        <p className="text-xs text-blue-500 font-bold uppercase tracking-wider">Pass: {emp.password}</p>
                      </div>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-2">{emp.department}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-3 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl shadow-sm"><Key size={18} /></button>
                    <button
                      onClick={() => deleteEmployee(emp.id)}
                      className="p-3 text-slate-400 hover:text-red-600 hover:bg-white rounded-xl shadow-sm"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
              {employees.filter(e => e.role === 'employee').length === 0 && (
                <div className="col-span-full py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <p className="text-slate-500 font-medium">No team members found.</p>
                </div>
              )}
            </div>

            {/* Add Employee Modal */}
            {showAddEmployee && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-white/20">
                  <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="text-xl font-black text-slate-900">New Staff Access</h3>
                    <button onClick={() => setShowAddEmployee(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} className="text-slate-400" /></button>
                  </div>
                  <form onSubmit={handleAddEmployee} className="p-8 space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Full Name</label>
                      <input
                        required
                        className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Employee Name"
                        value={empForm.name}
                        onChange={e => setEmpForm({ ...empForm, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Mobile</label>
                      <input
                        className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Contact Number"
                        value={empForm.mobile}
                        onChange={e => setEmpForm({ ...empForm, mobile: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Department</label>
                      <select
                        className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={empForm.department}
                        onChange={e => setEmpForm({ ...empForm, department: e.target.value })}
                      >
                        <option value="Graphic">Graphic Designing</option>
                        <option value="Unassigned">Unassigned</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Username</label>
                        <input
                          required
                          className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="user.name"
                          value={empForm.username}
                          onChange={e => setEmpForm({ ...empForm, username: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Password</label>
                        <input
                          required
                          className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="******"
                          value={empForm.password}
                          onChange={e => setEmpForm({ ...empForm, password: e.target.value })}
                        />
                      </div>
                    </div>
                    <button type="submit" className="w-full py-4 bg-blue-600 text-white font-black rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all mt-2 flex items-center justify-center gap-2">
                      <Save size={18} /> Create Access Profile
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'services' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-900">Service Catalog</h3>
                <p className="text-sm text-slate-500">Configure what services appear in task allocation menus.</p>
              </div>
              {!isAddingService && (
                <button
                  onClick={() => setIsAddingService(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-xl shadow-indigo-600/20"
                >
                  <Plus size={18} /> New Service
                </button>
              )}
            </div>

            {isAddingService && (
              <form onSubmit={handleAddService} className="bg-slate-50 p-6 rounded-3xl border border-dashed border-slate-300 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Service Name</label>
                    <input
                      autoFocus
                      type="text"
                      className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., UI/UX Design Pro"
                      value={newServiceName}
                      onChange={e => setNewServiceName(e.target.value)}
                    />
                  </div>
                  <div className="w-full md:w-64">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Category</label>
                    <select
                      className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newServiceCategory}
                      onChange={e => setNewServiceCategory(e.target.value)}
                    >
                      <option value="Web Development">Web Development</option>
                      <option value="Graphic Designing">Graphic Designing</option>
                      <option value="Mobile Development">Mobile Development</option>
                      <option value="SEO">SEO</option>
                    </select>
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      type="submit"
                      className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all"
                    >
                      Save Service
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingService(false)}
                      className="px-6 py-3 bg-white text-slate-500 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {services.map(svc => (
                <div key={svc.id} className="p-6 rounded-2xl border border-slate-100 bg-white flex items-center justify-between hover:shadow-md transition-all group">
                  <div>
                    <p className="font-bold text-slate-800">{svc.name}</p>
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black mt-1">{svc.category}</p>
                  </div>
                  <button
                    onClick={() => removeService(svc.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {services.length === 0 && (
                <div className="col-span-full py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <CheckCircle2 className="mx-auto text-slate-300 mb-4 opacity-50" size={48} />
                  <p className="text-slate-500 font-medium">No services defined yet.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'channels' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-900">Outreach Channels</h3>
                <p className="text-sm text-slate-500">Configure dynamically the channels available for Outbound Campaigns.</p>
              </div>
              {!isAddingChannel && (
                <button
                  onClick={() => setIsAddingChannel(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-2xl text-sm font-bold shadow-xl shadow-violet-600/20 hover:bg-violet-700 transition-all"
                >
                  <Plus size={18} /> Add Channel
                </button>
              )}
            </div>

            {isAddingChannel && (
              <form onSubmit={handleAddChannel} className="bg-slate-50 p-6 rounded-3xl border border-dashed border-slate-300 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Channel Name</label>
                    <input
                      autoFocus
                      type="text"
                      className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-500"
                      placeholder="e.g., TikTok, LinkedIn Sales Navigator"
                      value={newChannelName}
                      onChange={e => setNewChannelName(e.target.value)}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      type="submit"
                      className="px-6 py-3 bg-violet-600 text-white font-bold rounded-xl shadow-lg hover:bg-violet-700 transition-all"
                    >
                      Save Channel
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingChannel(false)}
                      className="px-6 py-3 bg-white text-slate-500 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {channels.map(channel => (
                <div key={channel.id} className="p-6 rounded-2xl border border-slate-100 bg-white flex items-center justify-between hover:shadow-md transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center">
                      <Megaphone size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{channel.name}</p>
                      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black mt-1">Outreach</p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeChannel(channel.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-2"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {channels.length === 0 && (
                <div className="col-span-full py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <Megaphone className="mx-auto text-slate-300 mb-4 opacity-50" size={48} />
                  <p className="text-slate-500 font-medium">No custom channels defined yet. Default is Email.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="max-w-md space-y-8">
            <h3 className="text-2xl font-black text-slate-900">Admin Security</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Username</label>
                <input className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" defaultValue="admin" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Current Password</label>
                <input className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" type="password" placeholder="••••••••" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">New Password</label>
                <input className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" type="password" />
              </div>
              <button className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:scale-[1.02] transition-all">Update Security Access</button>
            </div>
          </div>
        )}

        {activeTab === 'company' && (
          <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h3 className="text-2xl font-black text-slate-900">Company Configuration</h3>
              <p className="text-sm text-slate-500 mt-1">Configure your company identity and social details for generated reports.</p>
            </div>

            <form onSubmit={handleSaveConfig} className="bg-slate-50 p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-2">
                    <Building2 size={12} /> Company Name
                  </label>
                  <input
                    required
                    className="w-full p-4 border border-slate-200 rounded-2xl bg-white font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="e.g. Yender Media"
                    value={companyForm.companyName}
                    onChange={e => setCompanyForm({ ...companyForm, companyName: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-2">
                    <UserPlus size={12} /> Tagline
                  </label>
                  <input
                    className="w-full p-4 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="e.g. Creative Solutions"
                    value={companyForm.tagline}
                    onChange={e => setCompanyForm({ ...companyForm, tagline: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-2">
                  <Globe size={12} /> Company Logo (URL)
                </label>
                <div className="flex gap-4">
                  <input
                    className="flex-1 p-4 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
                    placeholder="e.g. https://yourwebsite.com/logo.png"
                    value={companyForm.logoUrl || ''}
                    onChange={e => setCompanyForm({ ...companyForm, logoUrl: e.target.value })}
                  />
                  {companyForm.logoUrl && (
                    <div className="w-14 h-14 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                      <img src={companyForm.logoUrl} alt="Logo Preview" className="max-w-full max-h-full object-contain p-1" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 ml-1 mt-2">Paste a direct link to a transparent .png or .svg of your logo. This will be used in the PDF builder.</p>
              </div>

              {/* Dynamic Contacts Section */}
              <div className="pt-6 border-t border-slate-200">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-black text-slate-800 flex items-center gap-2"><Smartphone size={16} className="text-blue-500" /> Contact Details</h4>
                  <button type="button" onClick={addContact} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-blue-100 transition-colors">
                    <Plus size={14} /> Add Contact
                  </button>
                </div>
                <div className="space-y-4">
                  {companyForm.contacts?.map((contact, index) => (
                    <div key={contact.id} className="flex gap-4 items-start animate-in fade-in slide-in-from-left-2 duration-300">
                      <div className="flex-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Label (e.g. Primary Mobile, Address)</label>
                        <input
                          required
                          className="w-full p-4 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          placeholder="Label"
                          value={contact.label}
                          onChange={e => updateContact(contact.id, 'label', e.target.value)}
                        />
                      </div>
                      <div className="flex-[2]">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Value (e.g. +1 234 567 890)</label>
                        <div className="flex gap-2">
                          <input
                            required
                            className="w-full p-4 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="Value"
                            value={contact.value}
                            onChange={e => updateContact(contact.id, 'value', e.target.value)}
                          />
                          <button type="button" onClick={() => removeContact(contact.id)} className="p-4 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!companyForm.contacts || companyForm.contacts.length === 0) && (
                    <p className="text-sm text-slate-400 italic text-center py-4 bg-white rounded-2xl border border-dashed border-slate-200">No contact details added yet.</p>
                  )}
                </div>
              </div>

              {/* Dynamic Socials Section */}
              <div className="pt-6 border-t border-slate-200">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-black text-slate-800 flex items-center gap-2"><Globe size={16} className="text-indigo-500" /> Web & Social Links</h4>
                  <button type="button" onClick={addSocial} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-indigo-100 transition-colors">
                    <Plus size={14} /> Add Link
                  </button>
                </div>
                <div className="space-y-4">
                  {companyForm.socials?.map((social, index) => (
                    <div key={social.id} className="flex gap-4 items-start animate-in fade-in slide-in-from-left-2 duration-300">
                      <div className="flex-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Platform (e.g. Website, Instagram)</label>
                        <input
                          required
                          className="w-full p-4 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          placeholder="Platform"
                          value={social.label}
                          onChange={e => updateSocial(social.id, 'label', e.target.value)}
                        />
                      </div>
                      <div className="flex-[2]">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">URL / Link</label>
                        <div className="flex gap-2">
                          <input
                            required
                            className="w-full p-4 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            placeholder="https://"
                            value={social.value}
                            onChange={e => updateSocial(social.id, 'value', e.target.value)}
                          />
                          <button type="button" onClick={() => removeSocial(social.id)} className="p-4 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!companyForm.socials || companyForm.socials.length === 0) && (
                    <p className="text-sm text-slate-400 italic text-center py-4 bg-white rounded-2xl border border-dashed border-slate-200">No web or social links added yet.</p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSavingConfig ? <span className="animate-pulse">Saving...</span> : <><Save size={18} /> Save Company Configuration</>}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div >
  );
};

export default Settings;
