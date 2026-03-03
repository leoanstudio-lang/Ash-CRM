import React, { useState } from 'react';
import { ContentAsset } from '../../types';
import { db } from '../../lib/firebase';
import { collection, addDoc, doc, deleteDoc } from 'firebase/firestore';
import { Library, Plus, Trash2, Tag, BookOpen, Link, Hash, MessageSquare } from 'lucide-react';

interface ContentLibraryProps {
    assets: ContentAsset[];
}

const CATEGORIES = ['Hook', 'CTA', 'Caption', 'Script Format', 'Topic Idea'] as const;

const CategoryIcon = ({ type }: { type: string }) => {
    switch (type) {
        case 'Hook': return <Link size={16} className="text-rose-500" />;
        case 'CTA': return <Tag size={16} className="text-emerald-500" />;
        case 'Caption': return <MessageSquare size={16} className="text-indigo-500" />;
        case 'Script Format': return <BookOpen size={16} className="text-amber-500" />;
        case 'Topic Idea': return <Hash size={16} className="text-blue-500" />;
        default: return <Library size={16} className="text-slate-500" />;
    }
};

const ContentLibrary: React.FC<ContentLibraryProps> = ({ assets }) => {
    const [isCreating, setIsCreating] = useState(false);
    const [activeFilter, setActiveFilter] = useState<string>('All');

    // Form state
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState<any>('Hook');
    const [content, setContent] = useState('');

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const assetData: Omit<ContentAsset, 'id'> = {
                title,
                category,
                content,
                createdAt: new Date().toISOString()
            };

            await addDoc(collection(db, 'contentAssets'), assetData);

            setTitle('');
            setContent('');
            setCategory('Hook');
            setIsCreating(false);
        } catch (error) {
            console.error("Error saving asset:", error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Delete this asset permanently?")) return;
        try {
            await deleteDoc(doc(db, 'contentAssets', id));
        } catch (error) {
            console.error("Error deleting asset:", error);
        }
    };

    const filteredAssets = activeFilter === 'All'
        ? assets
        : assets.filter(a => a.category === activeFilter);

    return (
        <div className="p-6 lg:p-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <Library className="text-indigo-500" />
                        Asset Library
                    </h3>
                    <p className="text-slate-500 font-medium mt-1">Store reusable hooks, CTAs, and frameworks.</p>
                </div>
                {!isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl font-bold hover:bg-indigo-100 transition-colors text-sm"
                    >
                        <Plus size={18} /> New Asset
                    </button>
                )}
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-2 mb-8">
                <button
                    onClick={() => setActiveFilter('All')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeFilter === 'All' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                        }`}
                >
                    All Assets
                </button>
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveFilter(cat)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeFilter === cat ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                            }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {isCreating && (
                <div className="bg-white rounded-3xl p-8 mb-8 shadow-sm border border-slate-200 animate-in slide-in-from-top-4">
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="text-lg font-black text-slate-800">Save New Asset</h4>
                    </div>
                    <form onSubmit={handleSave} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Internal Title</label>
                                <input
                                    type="text" required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={title} onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. The 'Controversial Statement' Hook"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Category</label>
                                <select
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={category} onChange={(e) => setCategory(e.target.value)}
                                >
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Actual Content / Template</label>
                            <textarea
                                required rows={4}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                value={content} onChange={(e) => setContent(e.target.value)}
                                placeholder="Write the reusable asset here..."
                            />
                        </div>

                        <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                            <button
                                type="button" onClick={() => setIsCreating(false)}
                                className="px-6 py-2.5 font-bold text-slate-500 hover:text-slate-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-shadow shadow-md shadow-indigo-200"
                            >
                                Save to Library
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAssets.map(asset => (
                    <div key={asset.id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 group relative">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg">
                                <CategoryIcon type={asset.category} />
                                <span className="text-[10px] uppercase font-black tracking-widest text-slate-600">
                                    {asset.category}
                                </span>
                            </div>
                            <button
                                onClick={() => handleDelete(asset.id)}
                                className="text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <h5 className="font-bold text-slate-800 mb-2">{asset.title}</h5>

                        <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-sm font-medium text-slate-600 whitespace-pre-wrap">
                            {asset.content}
                        </div>
                    </div>
                ))}

                {filteredAssets.length === 0 && !isCreating && (
                    <div className="col-span-full py-16 flex flex-col items-center justify-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400">
                        <Library size={48} className="mb-4 opacity-20" />
                        <h4 className="text-lg font-black text-slate-600">Library Empty</h4>
                        <p className="font-bold mt-1 text-sm text-center">Save reusable hooks and templates to speed up the pipeline.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ContentLibrary;
