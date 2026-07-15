
import React, { useState } from 'react';
import { Employee, Service, CatalogService, Role, Channel, Department } from '../types';
import { UserPlus, Settings as SettingsIcon, Shield, Trash2, Key, Plus, LogOut, CheckCircle2, X, Save, Building2, Smartphone, Globe, Instagram, Facebook, Megaphone, Sparkles, FolderKanban, Banknote } from 'lucide-react';
import { addEmployeeToDB, deleteEmployeeFromDB, addServiceToDB, deleteServiceFromDB, addCatalogServiceToDB, deleteCatalogServiceFromDB, getCompanyProfile, saveCompanyProfile, addChannelToDB, deleteChannelFromDB, getAIConfig, saveAIConfig, addDepartmentToDB, deleteDepartmentFromDB } from '../lib/db';
import { CompanyProfile, AIConfig } from '../types';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface SettingsProps {
  employees: Employee[];
  setEmployees?: React.Dispatch<React.SetStateAction<Employee[]>>; // Optional/Deprecated
  services: Service[];
  setServices?: React.Dispatch<React.SetStateAction<Service[]>>; // Optional/Deprecated
  channels?: Channel[];
  departments?: Department[];
  onLogout: () => void;
}

const Settings: React.FC<SettingsProps> = ({ employees, services, channels = [], departments = [], onLogout }) => {
  const [activeTab, setActiveTab] = useState<'employees' | 'services' | 'catalog' | 'channels' | 'admin' | 'company' | 'aiConfig'>('employees');

  // Company Profile State
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [companyForm, setCompanyForm] = useState<CompanyProfile>({
    companyName: '',
    tagline: '',
    contacts: [],
    socials: []
  });

  // AI Config State
  const [isSavingAI, setIsSavingAI] = useState(false);
  const [aiForm, setAiForm] = useState<AIConfig>({
    geminiApiKey: ''
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

  const handleGoogleConnect = () => {
    const clientId = import.meta.env.VITE_GOOGLE_DOCS_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    if (!clientId) {
      alert('VITE_GOOGLE_CLIENT_ID is not configured in .env.local!');
      return;
    }
    const scopes = [
      'email',
      'profile',
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.metadata.readonly'
    ].join(' ');
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
      client_id: clientId,
      redirect_uri: window.location.origin,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent select_account'
    }).toString();
    
    window.location.href = authUrl;
  };

  React.useEffect(() => {
    const fetchCompanyData = async () => {
      const data = await getCompanyProfile();
      if (data) setCompanyForm(data);
    };
    const fetchAIData = async () => {
      const aiData = await getAIConfig();
      if (aiData) setAiForm(aiData);
    };
    fetchCompanyData();
    fetchAIData();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    await saveCompanyProfile(companyForm);
    setIsSavingConfig(false);
    alert('Company Configuration saved successfully!');
  };

  const handleSaveAIConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAI(true);
    await saveAIConfig(aiForm);
    setIsSavingAI(false);
    alert('AI Configuration saved successfully!');
  };

  // States for standard services (reverted to original simple format)
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceCategory, setNewServiceCategory] = useState('Graphic Designing');
  const [isAddingService, setIsAddingService] = useState(false);

  // States for new Catalog Services
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [isAddingCatalog, setIsAddingCatalog] = useState(false);
  const [newCatalogName, setNewCatalogName] = useState('');
  const [newCatalogCategory, setNewCatalogCategory] = useState('Graphic Designing');
  const [newCatalogPrice, setNewCatalogPrice] = useState('');
  const [newCatalogBillingCycle, setNewCatalogBillingCycle] = useState<'one_time' | 'monthly' | 'yearly'>('one_time');
  const [newCatalogDescription, setNewCatalogDescription] = useState('');

  React.useEffect(() => {
    const q = query(collection(db, 'catalog_services'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: CatalogService[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as CatalogService);
      });
      setCatalogServices(list);
    });
    return () => unsubscribe();
  }, []);

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

  // Department Form State
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [isAddingDepartment, setIsAddingDepartment] = useState(false);

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDepartmentName.trim()) return;
    await addDepartmentToDB({ name: newDepartmentName });
    setNewDepartmentName('');
    setIsAddingDepartment(false);
  };

  const removeDepartment = async (id: string) => {
    if (window.confirm('Are you sure you want to completely delete this department?')) {
      await deleteDepartmentFromDB(id);
    }
  };

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

  const handleAddCatalogService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatalogName.trim()) return;

    const newSvc: Omit<CatalogService, 'id'> = {
      name: newCatalogName,
      category: newCatalogCategory,
      price: Number(newCatalogPrice) || 0,
      billingCycle: newCatalogBillingCycle,
      description: newCatalogDescription
    };

    await addCatalogServiceToDB(newSvc);
    setNewCatalogName('');
    setNewCatalogPrice('');
    setNewCatalogBillingCycle('one_time');
    setNewCatalogDescription('');
    setIsAddingCatalog(false);
  };

  const removeCatalogService = async (id: string) => {
    if (window.confirm('Are you sure you want to permanently delete this catalog service definition?')) {
      await deleteCatalogServiceFromDB(id);
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[700px] flex">
      {/* Settings Navigation Sidebar */}
      <div className="w-64 border-r border-slate-100 bg-slate-50/50 p-6 flex flex-col justify-between shrink-0 select-none">
        <div className="space-y-6">
          <div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-2">User Management</h3>
            <div className="space-y-1">
              <button
                onClick={() => setActiveTab('employees')}
                className={`w-full text-left px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2.5 ${
                  activeTab === 'employees'
                    ? 'text-blue-600 bg-blue-50/70 shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <UserPlus size={14} />
                <span>Staff & Access</span>
              </button>
              <button
                onClick={() => setActiveTab('admin')}
                className={`w-full text-left px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2.5 ${
                  activeTab === 'admin'
                    ? 'text-blue-600 bg-blue-50/70 shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <Shield size={14} />
                <span>Admin Security</span>
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-2">Business Setup</h3>
            <div className="space-y-1">
              <button
                onClick={() => setActiveTab('services')}
                className={`w-full text-left px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2.5 ${
                  activeTab === 'services'
                    ? 'text-blue-600 bg-blue-50/70 shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <FolderKanban size={14} />
                <span>Service Master List</span>
              </button>
              <button
                onClick={() => setActiveTab('catalog')}
                className={`w-full text-left px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2.5 ${
                  activeTab === 'catalog'
                    ? 'text-blue-600 bg-blue-50/70 shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <Banknote size={14} />
                <span>Pricing Catalog</span>
              </button>
              <button
                onClick={() => setActiveTab('channels')}
                className={`w-full text-left px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2.5 ${
                  activeTab === 'channels'
                    ? 'text-blue-600 bg-blue-50/70 shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <Megaphone size={14} />
                <span>Outreach Channels</span>
              </button>
              <button
                onClick={() => setActiveTab('company')}
                className={`w-full text-left px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2.5 ${
                  activeTab === 'company'
                    ? 'text-blue-600 bg-blue-50/70 shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <Building2 size={14} />
                <span>Company Config</span>
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-2">AI & Connect</h3>
            <div className="space-y-1">
              <button
                onClick={() => setActiveTab('aiConfig')}
                className={`w-full text-left px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2.5 ${
                  activeTab === 'aiConfig'
                    ? 'text-blue-600 bg-blue-50/70 shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <Sparkles size={14} />
                <span>AI Configuration</span>
              </button>
            </div>
          </div>
        </div>

        {/* Logout at bottom */}
        <div className="pt-4 border-t border-slate-100">
          <button
            onClick={onLogout}
            className="w-full px-3 py-2.5 text-left rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 transition-all flex items-center gap-2.5"
          >
            <LogOut size={14} />
            <span>Logout Account</span>
          </button>
        </div>
      </div>

      <div className="flex-1 p-10 overflow-y-auto max-h-[750px]">
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
                      {isAddingDepartment ? (
                        <div className="flex gap-2 items-center">
                          <input
                            autoFocus
                            className="flex-1 p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="New Department Name"
                            value={newDepartmentName}
                            onChange={e => setNewDepartmentName(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={async (e) => {
                              const deptName = newDepartmentName.trim();
                              if (deptName) {
                                await handleAddDepartment(e);
                                setEmpForm({ ...empForm, department: deptName });
                              } else {
                                setIsAddingDepartment(false);
                              }
                            }}
                            className="px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-sm"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsAddingDepartment(false)}
                            className="px-4 py-3 bg-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-300 transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2 items-center">
                          <select
                            className="flex-1 p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={empForm.department}
                            onChange={e => {
                              if (e.target.value === 'CREATE_NEW') {
                                setIsAddingDepartment(true);
                              } else {
                                setEmpForm({ ...empForm, department: e.target.value });
                              }
                            }}
                          >
                            <option value="">Select a Department...</option>
                            <option value="Graphic">Graphic Designing</option>
                            <option value="Marketing">Digital Marketing</option>
                            {departments.filter(d => d.name !== 'Graphic' && d.name !== 'Marketing').map(d => (
                              <option key={d.id} value={d.name}>{d.name}</option>
                            ))}
                            <option value="CREATE_NEW" className="font-bold text-blue-600">+ Create New Department...</option>
                          </select>
                          {empForm.department && !['Graphic', 'Marketing'].includes(empForm.department) && (
                            <button
                              type="button"
                              onClick={async () => {
                                const deptToDelete = departments.find(d => d.name === empForm.department);
                                if (deptToDelete && window.confirm(`Are you sure you want to delete the department "${deptToDelete.name}"?`)) {
                                  await deleteDepartmentFromDB(deptToDelete.id);
                                  setEmpForm({ ...empForm, department: 'Graphic' });
                                }
                              }}
                              className="p-3 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition-all shrink-0"
                              title="Delete this department"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      )}
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
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-900">Service Master List</h3>
                <p className="text-sm text-slate-500">Configure what services appear in campaigns and employee routing.</p>
              </div>
              {!isAddingService && (
                <button
                  onClick={() => setIsAddingService(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-bold shadow-xl shadow-indigo-600/25 transition-all"
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
                      className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 bg-white text-xs"
                      placeholder="e.g., UI/UX Design Pro"
                      value={newServiceName}
                      onChange={e => setNewServiceName(e.target.value)}
                    />
                  </div>
                  <div className="w-full md:w-64">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Category</label>
                    <select
                      className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 bg-white text-xs"
                      value={newServiceCategory}
                      onChange={e => setNewServiceCategory(e.target.value)}
                    >
                      <option value="Web Development">Web Development</option>
                      <option value="Graphic Designing">Graphic Designing</option>
                      <option value="Mobile Development">Mobile Development</option>
                      <option value="SEO">SEO</option>
                      <option value="Digital Marketing">Digital Marketing</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      type="submit"
                      className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all text-xs"
                    >
                      Save Service
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingService(false)}
                      className="px-6 py-3 bg-white text-slate-500 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition-all text-xs"
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
                    className="text-slate-350 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
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

        {activeTab === 'catalog' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-900">Pricing Catalog</h3>
                <p className="text-sm text-slate-500 mt-1">Configure service definitions, standard rates, and billing cycles for proposals & invoicing.</p>
              </div>
              {!isAddingCatalog && (
                <button
                  onClick={() => setIsAddingCatalog(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-bold shadow-xl shadow-indigo-600/25 transition-all"
                >
                  <Plus size={18} /> New Catalog Item
                </button>
              )}
            </div>

            {isAddingCatalog && (
              <form onSubmit={handleAddCatalogService} className="bg-slate-50 p-8 rounded-3xl border border-slate-200 shadow-sm space-y-5 animate-in fade-in slide-in-from-top-3 duration-350">
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2">Add Master Catalog Definition</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Service Name</label>
                    <input
                      autoFocus
                      required
                      type="text"
                      className="w-full p-3.5 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-bold text-slate-800 text-xs"
                      placeholder="e.g. Premium UI/UX Design System"
                      value={newCatalogName}
                      onChange={e => setNewCatalogName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Department Category</label>
                    <select
                      className="w-full p-3.5 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-bold text-slate-850 text-xs"
                      value={newCatalogCategory}
                      onChange={e => setNewCatalogCategory(e.target.value)}
                    >
                      <option value="Web Development">Web Development</option>
                      <option value="Graphic Designing">Graphic Designing</option>
                      <option value="Mobile Development">Mobile Development</option>
                      <option value="SEO">SEO</option>
                      <option value="Digital Marketing">Digital Marketing</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Standard Rate (₹)</label>
                    <input
                      required
                      type="number"
                      className="w-full p-3.5 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-bold text-slate-800 text-xs"
                      placeholder="e.g. 25000"
                      value={newCatalogPrice}
                      onChange={e => setNewCatalogPrice(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Billing Cycle</label>
                    <select
                      className="w-full p-3.5 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-bold text-slate-850 text-xs"
                      value={newCatalogBillingCycle}
                      onChange={e => setNewCatalogBillingCycle(e.target.value as any)}
                    >
                      <option value="one_time">One-time Payment</option>
                      <option value="monthly">Monthly Recurring</option>
                      <option value="yearly">Annual Recurring</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Scope / Description</label>
                    <input
                      type="text"
                      className="w-full p-3.5 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-bold text-slate-800 text-xs"
                      placeholder="e.g. 5 Screens, Figma source"
                      value={newCatalogDescription}
                      onChange={e => setNewCatalogDescription(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsAddingCatalog(false)}
                    className="px-6 py-2.5 bg-white text-slate-500 font-bold rounded-2xl border border-slate-200 hover:bg-slate-50 transition-all text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg transition-all text-xs"
                  >
                    Add to Catalog
                  </button>
                </div>
              </form>
            )}

            {/* Catalog List Table */}
            <div className="overflow-x-auto border border-slate-150 rounded-2xl shadow-sm">
              <table className="w-full text-left border-collapse bg-white">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-150 text-[9px] font-black uppercase text-slate-450 tracking-wider">
                    <th className="py-3 px-6">Service Details</th>
                    <th className="py-3 px-4">Billing Cycle</th>
                    <th className="py-3 px-4">Standard Price</th>
                    <th className="py-3 px-6">Scope / Description</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {catalogServices.map((svc) => (
                    <tr key={svc.id} className="hover:bg-slate-50/50 transition-all group">
                      <td className="py-4 px-6">
                        <span className="font-bold text-slate-800 block text-sm">{svc.name}</span>
                        <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest mt-1 block">
                          {svc.category}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-semibold text-slate-700">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          svc.billingCycle === 'monthly'
                            ? 'bg-blue-50 text-blue-700 border border-blue-100'
                            : svc.billingCycle === 'yearly'
                            ? 'bg-purple-50 text-purple-700 border border-purple-100'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {svc.billingCycle === 'monthly' ? 'Monthly' : svc.billingCycle === 'yearly' ? 'Yearly' : 'One-time'}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-black text-slate-850">
                        ₹{(svc.price || 0).toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-slate-500 font-medium max-w-xs truncate" title={svc.description}>
                        {svc.description || '—'}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => removeCatalogService(svc.id)}
                          className="text-slate-350 hover:text-red-600 p-2 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {catalogServices.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 italic font-bold">
                        No service definitions in the catalog yet. Click "New Catalog Item" to add.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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

              {/* Google Docs & Drive Permanent Integration */}
              <div className="pt-6 border-t border-slate-200">
                <h4 className="font-black text-slate-800 flex items-center gap-2 mb-2">
                  <Globe size={16} className="text-emerald-500" /> Permanent Google Docs & Drive Connection
                </h4>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed font-medium">
                  Establish a single background Google connection for all users. This token is stored in your Firestore database so employees, admins, and client interfaces never need individual sign-ins to view reports or export PDFs.
                </p>
                
                {companyForm.googleRefreshToken ? (
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0 text-emerald-700">
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-850">Connection Active</p>
                        <p className="text-[10px] text-slate-500 font-bold">Permanent background refresh token is synced with Firestore.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleGoogleConnect}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition shadow-sm uppercase tracking-wider font-sans"
                    >
                      Reconnect Account
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center shrink-0 text-amber-700">
                        <Shield size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-850">Not Connected</p>
                        <p className="text-[10px] text-slate-500 font-bold">No refresh token stored. Fallback credentials from environment will be used.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleGoogleConnect}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold transition shadow-sm uppercase tracking-wider font-sans"
                    >
                      Connect Company Google Account
                    </button>
                  </div>
                )}
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
                  {companyForm.socials?.map((social, index) => {
                    const rawLabel = social.label.toLowerCase().trim().replace(/\s+/g, '_');
                    const labelKey = (rawLabel === 'whats' || rawLabel === 'wa') ? 'whatsapp' : rawLabel;
                    const expectedFilename = `${labelKey}.png`;
                    
                    return (
                    <div key={social.id} className="flex gap-4 items-start animate-in fade-in slide-in-from-left-2 duration-300">
                      <div className="flex-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Platform (e.g. Website, Instagram)</label>
                        <div className="relative">
                          <input
                            required
                            className="w-full p-4 border rounded-2xl bg-white border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            placeholder="Platform"
                            value={social.label}
                            onChange={e => updateSocial(social.id, 'label', e.target.value)}
                          />
                          {social.label.trim() !== '' && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black px-2 py-1 rounded-lg bg-slate-100 text-slate-500">
                              Uses: /{expectedFilename}
                            </span>
                          )}
                        </div>
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
                        {social.label.trim() !== '' && (
                          <p className="text-[10px] text-slate-400 mt-1.5 ml-1">
                            Upload <span className="font-bold text-slate-500">{expectedFilename}</span> to the <span className="font-bold text-slate-500">/public/</span> folder to show this icon in PDFs.
                          </p>
                        )}
                      </div>
                    </div>
                    );
                  })}

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

        {activeTab === 'aiConfig' && (
          <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                <Sparkles size={24} className="text-purple-600" /> AI Features Setup
              </h3>
              <p className="text-sm text-slate-500 mt-1">Configure your Gemini API Key to enable automated AI features across the CRM.</p>
            </div>

            <form onSubmit={handleSaveAIConfig} className="bg-slate-50 p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              
              <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 flex items-start gap-4">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center shrink-0">
                  <Key size={18} className="text-purple-700" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Connection Status</p>
                  {aiForm.geminiApiKey && aiForm.geminiApiKey.length > 20 ? (
                    <p className="text-xs pt-1 flex items-center gap-1 font-bold text-emerald-600"><CheckCircle2 size={12}/> API Key Configured</p>
                  ) : (
                    <p className="text-xs pt-1 flex items-center gap-1 font-bold text-amber-500"><Shield size={12}/> Needs Configuration</p>
                  )}
                  <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">Ensure you input a valid Google Gemini API Key. Invalid keys will result in AI tasks failing silently or with errors. Your key is stored securely in Firebase.</p>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-2">
                  <Key size={12} /> Gemini API Key
                </label>
                <input
                  required
                  type="password"
                  className="w-full p-4 border border-slate-200 rounded-2xl bg-white font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none transition-all font-mono"
                  placeholder="AIzaSy..."
                  value={aiForm.geminiApiKey}
                  onChange={e => setAiForm({ ...aiForm, geminiApiKey: e.target.value })}
                />
              </div>

              <div className="pt-4 border-t border-slate-200">
                <button
                  type="submit"
                  disabled={isSavingAI}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSavingAI ? <span className="animate-pulse">Saving...</span> : <><Save size={18} /> Save AI Configuration</>}
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
