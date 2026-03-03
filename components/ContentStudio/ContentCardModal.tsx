import React, { useState } from 'react';
import { ContentMonth, ContentCard } from '../../types';
import { db } from '../../lib/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { X, Video, FileText, CalendarDays, CheckCircle2, Megaphone, Link as LinkIcon, AlertCircle, Trash2 } from 'lucide-react';

interface ContentCardModalProps {
    isOpen: boolean;
    onClose: () => void;
    monthId: string;
    existingCard?: ContentCard | null;
    prefilledDate?: string | null;
}

const ContentCardModal: React.FC<ContentCardModalProps> = ({ isOpen, onClose, monthId, existingCard, prefilledDate }) => {
    const [title, setTitle] = useState(existingCard?.title || '');
    const [hook, setHook] = useState(existingCard?.hook || '');
    const [type, setType] = useState<any>(existingCard?.type || 'Educational');
    const [platform, setPlatform] = useState<any>(existingCard?.platform || 'Instagram');
    const [scriptNotes, setScriptNotes] = useState(existingCard?.scriptNotes || '');
    const [cta, setCta] = useState(existingCard?.cta || '');
    const [recordingDate, setRecordingDate] = useState(existingCard?.recordingDate || '');
    const [postingDate, setPostingDate] = useState(existingCard?.postingDate || prefilledDate || '');
    const [status, setStatus] = useState<any>(existingCard?.status || 'Idea');
    const [leadsGenerated, setLeadsGenerated] = useState(existingCard?.leadsGenerated?.toString() || '0');
    const [convertedClient, setConvertedClient] = useState<any>(existingCard?.convertedClient || 'No');

    React.useEffect(() => {
        if (isOpen) {
            setTitle(existingCard?.title || '');
            setHook(existingCard?.hook || '');
            setType(existingCard?.type || 'Educational');
            setPlatform(existingCard?.platform || 'Instagram');
            setScriptNotes(existingCard?.scriptNotes || '');
            setCta(existingCard?.cta || '');
            setRecordingDate(existingCard?.recordingDate || '');
            setPostingDate(existingCard?.postingDate || prefilledDate || '');
            setStatus(existingCard?.status || 'Idea');
            setLeadsGenerated(existingCard?.leadsGenerated?.toString() || '0');
            setConvertedClient(existingCard?.convertedClient || 'No');
        }
    }, [isOpen, existingCard, prefilledDate]);

    if (!isOpen) return null;

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        const cardData: Partial<ContentCard> = {
            monthId,
            title,
            hook,
            type,
            platform,
            scriptNotes,
            cta,
            recordingDate,
            postingDate,
            status,
            leadsGenerated: parseInt(leadsGenerated) || 0,
            convertedClient,
            createdAt: existingCard?.createdAt || new Date().toISOString()
        };

        try {
            if (existingCard?.id) {
                const docRef = doc(db, 'contentCards', existingCard.id);
                await updateDoc(docRef, cardData);
            } else {
                await addDoc(collection(db, 'contentCards'), cardData);
            }
            onClose();
        } catch (error) {
            console.error("Error saving content card:", error);
        }
    };

    const handleDelete = async () => {
        if (!existingCard?.id) return;
        if (window.confirm("Are you sure you want to delete this content asset?")) {
            try {
                await deleteDoc(doc(db, 'contentCards', existingCard.id));
                onClose();
            } catch (error) {
                console.error("Error deleting content card:", error);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-3xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">

                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-3xl">
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                        <Video className="text-rose-500" />
                        {existingCard ? 'Edit Content Asset' : 'New Content Asset'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors hidden md:block">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <form id="contentCardForm" onSubmit={handleSave} className="space-y-6">

                        {/* Core Idea */}
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-4">
                                <Megaphone size={14} className="text-indigo-500" />
                                Core Asset
                            </h4>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Content Title</label>
                                <input
                                    type="text" required
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                                    value={title} onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. 3 Ways to Double Your Revenue"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">The Hook (First 3 seconds)</label>
                                <textarea
                                    required rows={2}
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                                    value={hook} onChange={(e) => setHook(e.target.value)}
                                    placeholder="Stop scrolling if you want to make $10k this month..."
                                />
                            </div>
                        </div>

                        {/* Implementation Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Content Pillar</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                                        value={type} onChange={(e) => setType(e.target.value)}
                                    >
                                        <option value="Educational">Educational (Value)</option>
                                        <option value="Proof">Proof (Results)</option>
                                        <option value="Journey">Journey (Documentation)</option>
                                        <option value="Sales">Sales (Conversion)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Platform</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                                        value={platform} onChange={(e) => setPlatform(e.target.value)}
                                    >
                                        <option value="Instagram">Instagram (Reel)</option>
                                        <option value="LinkedIn">LinkedIn (Text/Video)</option>
                                        <option value="YouTube">YouTube (Long/Short)</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Pipeline Status</label>
                                    <select
                                        className="w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-800 font-black focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        value={status} onChange={(e) => setStatus(e.target.value)}
                                    >
                                        <option value="Idea">Idea Phase</option>
                                        <option value="Scripted">Script Written</option>
                                        <option value="Recorded">Video Recorded</option>
                                        <option value="Edited">Editing Complete</option>
                                        <option value="Posted">Published / Live</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Pre-Recording Date</label>
                                    <div className="relative">
                                        <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="date"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                                            value={recordingDate} onChange={(e) => setRecordingDate(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Target Go-Live Date</label>
                                    <div className="relative">
                                        <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="date"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                                            value={postingDate} onChange={(e) => setPostingDate(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2 flex justify-between">
                                        Performance (Post-Live)
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-500">Leads generated</span>
                                            <input
                                                type="number" min="0"
                                                className="w-16 bg-transparent text-right font-black text-slate-800 focus:outline-none"
                                                value={leadsGenerated} onChange={(e) => setLeadsGenerated(e.target.value)}
                                            />
                                        </div>
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-500">Converted?</span>
                                            <select
                                                className="bg-transparent font-black tracking-tight text-right text-slate-800 focus:outline-none"
                                                value={convertedClient} onChange={(e) => setConvertedClient(e.target.value as any)}
                                            >
                                                <option value="No">No</option>
                                                <option value="Yes">Yes</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Script & Execution */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                    <FileText size={16} className="text-slate-400" />
                                    Scripting Notes & Talking Points
                                </label>
                                <textarea
                                    rows={4}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
                                    value={scriptNotes} onChange={(e) => setScriptNotes(e.target.value)}
                                    placeholder="- Note 1\n- Note 2\nWrite your loose script here..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                    <LinkIcon size={16} className="text-slate-400" />
                                    Call to Action (CTA)
                                </label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                                    value={cta} onChange={(e) => setCta(e.target.value)}
                                    placeholder="e.g. DM me 'CRM' to get the blueprint."
                                />
                            </div>
                        </div>

                    </form>
                </div>

                <div className="p-6 border-t border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-b-3xl">
                    <div>
                        {existingCard && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="px-4 py-2.5 flex items-center gap-2 text-rose-500 font-bold hover:bg-rose-100 rounded-xl transition-colors"
                            >
                                <Trash2 size={16} /> Delete
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="px-6 py-2.5 font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors">
                            Cancel
                        </button>
                        <button form="contentCardForm" type="submit" className="px-8 py-2.5 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 shadow-md transition-all flex items-center gap-2 group">
                            <CheckCircle2 size={18} className="text-rose-200 group-hover:text-white transition-colors" />
                            {existingCard ? 'Update Workflow' : 'Push to Pipeline'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ContentCardModal;
