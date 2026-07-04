import React, { useState } from 'react';
import { Megaphone, BookOpen, FileText, Award, Search, Plus, Trash2, CheckCircle2, ChevronRight, User } from 'lucide-react';
import { Announcement, KBArticle, SOP, EmployeeRecognition } from '../../types';
import { addDocToDB, updateDocInDB, deleteDocFromDB } from '../../lib/db';

interface ContentLibraryProps {
  announcements: Announcement[];
  kbArticles: KBArticle[];
  sops: SOP[];
  recognitions: EmployeeRecognition[];
  currentUser: any;
  userRole: string;
  hasPermission: (section: string, action: string) => boolean;
  employees: any[];
  activeSubTab: 'announcements' | 'kb' | 'sop' | 'recognition';
}

const ContentLibrary: React.FC<ContentLibraryProps> = ({
  announcements,
  kbArticles,
  sops,
  recognitions,
  currentUser,
  userRole,
  hasPermission,
  employees,
  activeSubTab
}) => {
  // Common creation dialog states
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Announcements Creation State
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annCat, setAnnCat] = useState<Announcement['category']>('Update');

  // 2. KB Article Creation State
  const [kbTitle, setKbTitle] = useState('');
  const [kbContent, setKbContent] = useState('');
  const [kbCat, setKbCat] = useState<KBArticle['category']>('Company Policies');
  const [kbTagsStr, setKbTagsStr] = useState('');

  // 3. SOP Creation State
  const [sopTitle, setSopTitle] = useState('');
  const [sopDept, setSopDept] = useState<SOP['department']>('Development');
  const [sopContent, setSopContent] = useState('');

  // 4. Recognition Creation State
  const [recType, setRecType] = useState<EmployeeRecognition['type']>('Team Player');
  const [recRecipientId, setRecRecipientId] = useState('');
  const [recMessage, setRecMessage] = useState('');

  // Active details view
  const [selectedKBId, setSelectedKBId] = useState<string | null>(null);
  const [selectedSOPId, setSelectedSOPId] = useState<string | null>(null);

  // Trigger Creation submitting
  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) return;

    const record: Omit<Announcement, 'id'> = {
      title: annTitle,
      content: annContent,
      category: annCat,
      publishedBy: currentUser?.name || 'Admin',
      publishedById: currentUser?.id || 'admin',
      date: new Date().toISOString(),
      readBy: []
    };

    try {
      await addDocToDB('companyAnnouncements', record);
      setAnnTitle('');
      setAnnContent('');
      setShowCreate(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAcknowledgeAnnouncement = async (id: string) => {
    const ann = announcements.find(a => a.id === id);
    if (!ann || ann.readBy?.includes(currentUser.id)) return;

    try {
      await updateDocInDB('companyAnnouncements', id, {
        readBy: [...(ann.readBy || []), currentUser.id]
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handlePublishKB = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kbTitle.trim() || !kbContent.trim()) return;

    const record: Omit<KBArticle, 'id'> = {
      title: kbTitle,
      content: kbContent,
      category: kbCat,
      tags: kbTagsStr.split(',').map(t => t.trim().toLowerCase()).filter(t => t !== ''),
      attachments: [],
      lastUpdated: new Date().toISOString().split('T')[0],
      updatedBy: currentUser?.name || 'Admin',
      version: 1,
      views: 0
    };

    try {
      await addDocToDB('knowledgeBase', record);
      setKbTitle('');
      setKbContent('');
      setKbTagsStr('');
      setShowCreate(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenKB = async (id: string) => {
    setSelectedKBId(id);
    const art = kbArticles.find(a => a.id === id);
    if (art) {
      try {
        await updateDocInDB('knowledgeBase', id, { views: (art.views || 0) + 1 });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handlePublishSOP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sopTitle.trim() || !sopContent.trim()) return;

    const record: Omit<SOP, 'id'> = {
      title: sopTitle,
      department: sopDept,
      content: sopContent,
      attachments: [],
      lastUpdated: new Date().toISOString().split('T')[0],
      version: 1
    };

    try {
      await addDocToDB('sopLibrary', record);
      setSopTitle('');
      setSopContent('');
      setShowCreate(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePublishRecognition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recRecipientId || !recMessage.trim()) return;

    const targetEmp = employees.find(emp => emp.id === recRecipientId);
    if (!targetEmp) return;

    const record: Omit<EmployeeRecognition, 'id'> = {
      type: recType,
      recipientId: recRecipientId,
      recipientName: targetEmp.name,
      recognizedBy: currentUser?.name || 'Super Admin',
      recognizedById: currentUser?.id || 'admin',
      message: recMessage,
      date: new Date().toISOString().split('T')[0]
    };

    try {
      await addDocToDB('recognitions', record);
      setRecMessage('');
      setRecRecipientId('');
      setShowCreate(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRecord = async (collection: string, id: string) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      await deleteDocFromDB(collection, id);
      if (selectedKBId === id) setSelectedKBId(null);
      if (selectedSOPId === id) setSelectedSOPId(null);
    }
  };

  // RBAC Permission checks
  const canManage = hasPermission(activeSubTab, 'manage') || hasPermission(activeSubTab, 'write');

  return (
    <div className="space-y-6">
      {/* Tab headers and publishers */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2 capitalize">
            {activeSubTab === 'announcements' && <><Megaphone className="text-blue-600" size={22} /> Company Announcements</>}
            {activeSubTab === 'kb' && <><BookOpen className="text-indigo-600" size={22} /> Knowledge Base Docs</>}
            {activeSubTab === 'sop' && <><FileText className="text-purple-600" size={22} /> Standard Operating Procedures (SOPs)</>}
            {activeSubTab === 'recognition' && <><Award className="text-amber-500" size={22} /> Employee Appreciation Wall</>}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {activeSubTab === 'announcements' && 'Stay updated with company-wide news, holidays, and policies.'}
            {activeSubTab === 'kb' && 'Access corporate guides, guidelines, templates, and marketing files.'}
            {activeSubTab === 'sop' && 'Review step-by-step procedures for graphics, marketing, sales, and accounts.'}
            {activeSubTab === 'recognition' && 'Celebrate employee awards, perforance wins, and team milestones.'}
          </p>
        </div>
        <div className="flex gap-2">
          {activeSubTab !== 'recognition' && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search resources..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all min-w-[200px]"
              />
            </div>
          )}
          {canManage && (
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shrink-0"
            >
              <Plus size={15} /> Publish New
            </button>
          )}
        </div>
      </div>

      {/* Creation Overlays Form */}
      {showCreate && (
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm animate-in fade-in duration-200">
          {activeSubTab === 'announcements' && (
            <form onSubmit={handlePublishAnnouncement} className="space-y-4">
              <h4 className="font-bold text-slate-800 text-sm">New Company Announcement</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Title</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g., Office closed on Independence Day"
                    value={annTitle}
                    onChange={e => setAnnTitle(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Category</label>
                  <select
                    value={annCat}
                    onChange={e => setAnnCat(e.target.value as any)}
                    className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Update">Update</option>
                    <option value="Policy">Policy</option>
                    <option value="Event">Event</option>
                    <option value="Holiday">Holiday</option>
                    <option value="Introduction">Introduction</option>
                    <option value="Meeting">Meeting</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Content Details</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Announce details here..."
                  value={annContent}
                  onChange={e => setAnnContent(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 mt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold">Post Announcement</button>
              </div>
            </form>
          )}

          {activeSubTab === 'kb' && (
            <form onSubmit={handlePublishKB} className="space-y-4">
              <h4 className="font-extrabold text-slate-800 text-base">New Knowledge Base Article</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Article Title</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g., Brand Palette Guideline"
                    value={kbTitle}
                    onChange={e => setKbTitle(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Category</label>
                  <select
                    value={kbCat}
                    onChange={e => setKbCat(e.target.value as any)}
                    className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Company Policies">Company Policies</option>
                    <option value="Client Guidelines">Client Guidelines</option>
                    <option value="Branding Standards">Branding Standards</option>
                    <option value="CRM Guides">CRM Guides</option>
                    <option value="Marketing Guides">Marketing Guides</option>
                    <option value="Sales Guides">Sales Guides</option>
                    <option value="HR Documents">HR Documents</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g., logo, palette, styles, branding"
                  value={kbTagsStr}
                  onChange={e => setKbTagsStr(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-850 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Article Body (markdown supported)</label>
                <textarea
                  required
                  rows={6}
                  placeholder="Provide documentation notes here..."
                  value={kbContent}
                  onChange={e => setKbContent(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 mt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold">Save Article</button>
              </div>
            </form>
          )}

          {activeSubTab === 'sop' && (
            <form onSubmit={handlePublishSOP} className="space-y-4">
              <h4 className="font-extrabold text-slate-800 text-base">Create Standard Operating Procedure (SOP)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">SOP Title</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g., SEO Metadata Auditing SOP"
                    value={sopTitle}
                    onChange={e => setSopTitle(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Department</label>
                  <select
                    value={sopDept}
                    onChange={e => setSopDept(e.target.value as any)}
                    className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Graphic Design">Graphic Designing</option>
                    <option value="Digital Marketing">Digital Marketing</option>
                    <option value="Sales">Sales</option>
                    <option value="Accounts">Accounts</option>
                    <option value="HR">HR</option>
                    <option value="Development">Development</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Instructions Content</label>
                <textarea
                  required
                  rows={6}
                  placeholder="Explain step-by-step how to perform this task..."
                  value={sopContent}
                  onChange={e => setSopContent(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 mt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold">Publish SOP</button>
              </div>
            </form>
          )}

          {activeSubTab === 'recognition' && (
            <form onSubmit={handlePublishRecognition} className="space-y-4">
              <h4 className="font-extrabold text-slate-800 text-base">Recognize a Team Member</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Award Recipient</label>
                  <select
                    required
                    value={recRecipientId}
                    onChange={e => setRecRecipientId(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select Employee...</option>
                    {employees.filter(emp => emp.id !== currentUser.id).map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.department})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Award Badge</label>
                  <select
                    value={recType}
                    onChange={e => setRecType(e.target.value as any)}
                    className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Team Player">🏆 Team Player</option>
                    <option value="Innovation Award">💡 Innovation Award</option>
                    <option value="Best Performer">⚡ Best Performer</option>
                    <option value="Fast Delivery">⏱ Fast Delivery</option>
                    <option value="Customer Appreciation">🤝 Customer Appreciation</option>
                    <option value="Employee of the Month">🌟 Employee of the Month</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Personal Message</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Appreciate their work with a personalized card message..."
                  value={recMessage}
                  onChange={e => setRecMessage(e.target.value)}
                  className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 mt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold">Post Recognition</button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Render Active List Views */}
      <div className="space-y-4">
        {/* 1. Announcements */}
        {activeSubTab === 'announcements' && announcements
          .filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.content.toLowerCase().includes(searchQuery.toLowerCase()))
          .map((ann) => {
            const hasRead = ann.readBy?.includes(currentUser.id);
            return (
              <div key={ann.id} className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between relative group hover:border-slate-350 transition duration-200">
                {canManage && (
                  <button
                    onClick={() => handleDeleteRecord('companyAnnouncements', ann.id)}
                    className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 rounded-lg hover:bg-slate-50 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <div>
                  <div className="flex items-center gap-3 text-slate-400 text-[10px] font-bold mb-2">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded font-black text-[9px] uppercase tracking-wider">{ann.category}</span>
                    <span>By {ann.publishedBy}</span>
                    <span>•</span>
                    <span>{new Date(ann.date).toLocaleDateString()}</span>
                  </div>
                  <h4 className="text-base font-black text-slate-900 leading-tight mb-2">{ann.title}</h4>
                  <p className="text-xs text-slate-650 font-medium leading-relaxed whitespace-pre-wrap">{ann.content}</p>
                </div>
                {!hasRead && currentUser.role !== 'admin' && currentUser.role !== 'super_admin' && (
                  <button
                    onClick={() => handleAcknowledgeAnnouncement(ann.id)}
                    className="w-max mt-3 flex items-center gap-1.5 px-3 py-1.5 border border-blue-500 text-blue-600 bg-white hover:bg-blue-50 rounded-lg text-xs font-bold transition shadow-sm"
                  >
                    <CheckCircle2 size={13} /> Acknowledge as Read
                  </button>
                )}
              </div>
            );
          })}

        {/* 2. Knowledge Base Articles */}
        {activeSubTab === 'kb' && !selectedKBId && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in">
            {kbArticles
              .filter(k => k.title.toLowerCase().includes(searchQuery.toLowerCase()) || k.category.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((art) => (
                <div
                  key={art.id}
                  onClick={() => handleOpenKB(art.id)}
                  className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-350 cursor-pointer transition relative group overflow-hidden"
                >
                  {canManage && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRecord('knowledgeBase', art.id);
                      }}
                      className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 rounded-lg hover:bg-slate-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 block mb-2">{art.category}</span>
                    <h4 className="text-base font-black text-slate-800 leading-tight mb-2 truncate group-hover:text-blue-600 transition-colors">{art.title}</h4>
                    <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed mb-4">{art.content}</p>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-50 pt-4 mt-2">
                    <span className="text-[10px] text-slate-400 font-bold">👁 {art.views || 0} Views</span>
                    <span className="flex items-center gap-1 text-xs font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
                      Read <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* KB Detail View */}
        {activeSubTab === 'kb' && selectedKBId && (() => {
          const art = kbArticles.find(k => k.id === selectedKBId);
          if (!art) return null;
            return (
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4 animate-in fade-in duration-200">
                <button onClick={() => setSelectedKBId(null)} className="text-xs text-blue-600 font-bold hover:text-blue-700">← Back to Article List</button>
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">{art.category}</span>
                <h3 className="text-xl font-black text-slate-900 mt-1">{art.title}</h3>
                <div className="flex gap-4 mt-2 text-[10px] text-slate-400 font-semibold">
                  <span>Last Updated: {art.lastUpdated}</span>
                  <span>Author: {art.updatedBy}</span>
                  <span>Views: {art.views || 0}</span>
                </div>
              </div>
                <p className="text-xs text-slate-700 leading-relaxed font-medium bg-slate-50 p-4 border border-slate-200 rounded-lg whitespace-pre-wrap">
                  {art.content}
                </p>
            </div>
          );
        })()}

        {/* 3. SOP Accordion List */}
        {activeSubTab === 'sop' && !selectedSOPId && (
          <div className="space-y-3">
            {sops
              .filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.department.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((sop) => (
                <div
                  key={sop.id}
                  onClick={() => setSelectedSOPId(sop.id)}
                  className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-350 cursor-pointer transition relative group"
                >
                  {canManage && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRecord('sopLibrary', sop.id);
                      }}
                      className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 rounded-lg hover:bg-slate-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <div className="flex-1">
                    <span className="px-2.5 py-0.5 bg-slate-100 text-slate-500 rounded font-black text-[9px] uppercase tracking-wider">{sop.department}</span>
                    <h4 className="text-base font-black text-slate-800 leading-tight mt-2 group-hover:text-purple-600 transition-colors">{sop.title}</h4>
                  </div>
                  <ChevronRight className="text-slate-300 group-hover:translate-x-1 transition-transform shrink-0" size={16} />
                </div>
              ))}
          </div>
        )}

        {/* SOP Detail View */}
        {activeSubTab === 'sop' && selectedSOPId && (() => {
          const sop = sops.find(s => s.id === selectedSOPId);
          if (!sop) return null;
            return (
              <div className="bg-white p-5 rounded-lg border border-slate-205 shadow-sm space-y-4 animate-in fade-in duration-200">
                <button onClick={() => setSelectedSOPId(null)} className="text-xs text-blue-600 font-bold hover:text-blue-700">← Back to SOP List</button>
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">{sop.department} Department</span>
                <h3 className="text-xl font-black text-slate-900 mt-1">{sop.title}</h3>
                <div className="flex gap-4 mt-2 text-[10px] text-slate-400 font-semibold">
                  <span>Last Updated: {sop.lastUpdated}</span>
                  <span>Version: {sop.version || 1}</span>
                </div>
              </div>
                <p className="text-xs text-slate-700 leading-relaxed font-medium bg-slate-50 p-4 border border-slate-200 rounded-lg whitespace-pre-wrap">
                  {sop.content}
                </p>
            </div>
          );
        })()}

        {/* 4. Appreciation Recognition Wall */}
        {activeSubTab === 'recognition' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in">
            {recognitions.map((rec) => (
              <div key={rec.id} className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-350 transition relative group overflow-hidden">
                {canManage && (
                  <button
                    onClick={() => handleDeleteRecord('recognitions', rec.id)}
                    className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 rounded-lg hover:bg-slate-50 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500 text-lg">
                      {rec.type === 'Team Player' ? '🏆' : rec.type === 'Innovation Award' ? '💡' : rec.type === 'Best Performer' ? '⚡' : '🌟'}
                    </div>
                    <div>
                      <span className="font-extrabold text-slate-800 text-xs block">{rec.recipientName}</span>
                      <span className="text-[9px] uppercase tracking-widest text-slate-400 font-black mt-0.5 block">{rec.type}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed italic bg-slate-50 p-3.5 border border-slate-200 rounded-lg">
                    "{rec.message}"
                  </p>
                </div>
                <div className="flex justify-between items-center border-t border-slate-50 pt-4 mt-4 text-[9px] text-slate-400 font-black uppercase">
                  <span>Appreciated By: {rec.recognizedBy}</span>
                  <span>{new Date(rec.date).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty placeholder logs */}
        {((activeSubTab === 'announcements' && announcements.length === 0) ||
          (activeSubTab === 'kb' && kbArticles.length === 0) ||
          (activeSubTab === 'sop' && sops.length === 0) ||
          (activeSubTab === 'recognition' && recognitions.length === 0)) && (
          <div className="py-16 bg-white rounded-lg border border-slate-200 shadow-sm text-center">
            <BookOpen className="mx-auto text-slate-350 mb-3" size={44} />
            <p className="text-slate-400 italic text-xs">No records logged in this library yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentLibrary;
