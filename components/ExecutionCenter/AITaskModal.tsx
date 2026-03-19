import React, { useState } from 'react';
import { ExecutionTask } from '../../types';
import { X, Sparkles, Loader2, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { getAIConfig } from '../../lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface AITaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (tasks: Partial<ExecutionTask>[]) => void;
}

const AITaskModal: React.FC<AITaskModalProps> = ({ isOpen, onClose, onSave }) => {
    const [inputText, setInputText] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [extractedTasks, setExtractedTasks] = useState<Partial<ExecutionTask>[]>([]);
    
    // For editing a parsed task inline
    const handleUpdateTask = (index: number, field: string, value: any) => {
        const newTasks = [...extractedTasks];
        newTasks[index] = { ...newTasks[index], [field]: value };
        setExtractedTasks(newTasks);
    };

    const handleRemoveTask = (index: number) => {
        const newTasks = [...extractedTasks];
        newTasks.splice(index, 1);
        setExtractedTasks(newTasks);
    };

    const analyzeText = async () => {
        if (!inputText.trim()) return;
        setIsAnalyzing(true);
        setError(null);
        setExtractedTasks([]);

        try {
            const aiConfig = await getAIConfig();
            if (!aiConfig || !aiConfig.geminiApiKey) {
                throw new Error("Gemini API Key is missing. Please configure it in the Settings panel.");
            }

            const prompt = `You are a helpful assistant for a CRM System. 
Read the following text and extract a list of actionable tasks.
For each task, provide the following fields EXACTLY as specified:
- name (string, short concise title)
- description (string, detailed notes)
- department (string, strictly pick ONE of: 'Management', 'Sales/Marketing', 'Development', 'Design', 'Operations')
- priority (string, strictly pick ONE of: 'High', 'Medium', 'Low')
- impactType (string, strictly pick ONE of: 'Revenue', 'Growth', 'System', 'Admin')
- energyType (string, strictly pick ONE of: 'Deep Work', 'Medium Work', 'Light Work')
- estimatedTimeSeconds (number, guess in seconds, e.g. 1 hour = 3600. Default to 3600 if unsure)
- deadline (string, return an ISO date string for when this should be done. If no date is mentioned, use a date 3 days from now)
- status (string, strictly use "Pending")

Today's Date: ${new Date().toISOString()}

Return ONLY a valid JSON Array of objects matching this exact structure. Do not use markdown blocks like \`\`\`json. Return raw JSON. 
Text to analyze:
"${inputText}"`;

            const genAI = new GoogleGenerativeAI(aiConfig.geminiApiKey.trim());
            const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const textResponse = response.text();
            
            if (!textResponse) {
                throw new Error("Gemini returned an empty response. You may have hit a rate limit.");
            }

            // Clean the JSON string if Gemini wrapped it in markdown
            const cleanJson = textResponse.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
            const parsedTasks = JSON.parse(cleanJson);

            if (Array.isArray(parsedTasks) && parsedTasks.length > 0) {
                setExtractedTasks(parsedTasks);
            } else {
                setError("No tasks found in the provided text. Try adding more details.");
            }

        } catch (err: any) {
            console.error("AI Analysis Error:", err);
            setError(err.message || "An unexpected error occurred during analysis.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleConfirm = () => {
        if (extractedTasks.length === 0) return;
        onSave(extractedTasks);
        handleClose();
    };

    const handleClose = () => {
        setInputText('');
        setExtractedTasks([]);
        setError(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                            <Sparkles size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800">AI Task Extractor</h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Paste notes, get tasks</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-6">
                    {extractedTasks.length === 0 ? (
                        <>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                                    Meeting Notes / Brain Dump
                                </label>
                                <textarea
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    placeholder="e.g. In today's meeting, we decided that Sarah needs to redesign the landing page by next Tuesday. Also, John should follow up with the Acme Corp lead tomorrow morning, and we need to fix the database bug tonight."
                                    className="w-full h-48 p-5 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none text-slate-700"
                                />
                            </div>

                            {error && (
                                <div className="p-4 bg-red-50 text-red-600 rounded-2xl flex gap-3 text-sm font-medium border border-red-100">
                                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                                    <p>{error}</p>
                                </div>
                            )}

                            <button
                                onClick={analyzeText}
                                disabled={isAnalyzing || !inputText.trim()}
                                className="w-full py-4 bg-slate-900 border-2 border-slate-900 text-white font-black rounded-2xl hover:bg-white hover:text-slate-900 disabled:opacity-50 disabled:hover:bg-slate-900 disabled:hover:text-white transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2"
                            >
                                {isAnalyzing ? <><Loader2 size={18} className="animate-spin" /> Analyzing using Gemini...</> : <><Sparkles size={18} /> Extract Tasks</>}
                            </button>
                        </>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                                    Found <span className="text-purple-600">{extractedTasks.length}</span> Tasks
                                </h3>
                                <button
                                    onClick={() => setExtractedTasks([])}
                                    className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors underline"
                                >
                                    Start Over
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {extractedTasks.map((task, idx) => (
                                    <div key={idx} className="p-5 rounded-3xl border border-slate-200 bg-white shadow-sm space-y-4 group">
                                        <div className="flex justify-between items-start gap-4">
                                            <input
                                                value={task.name || ''}
                                                onChange={(e) => handleUpdateTask(idx, 'name', e.target.value)}
                                                className="font-bold text-slate-800 text-lg w-full outline-none border-b border-dashed border-slate-300 focus:border-purple-500"
                                                placeholder="Task Name"
                                            />
                                            <button
                                                onClick={() => handleRemoveTask(idx)}
                                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        <textarea
                                            value={task.description || ''}
                                            onChange={(e) => handleUpdateTask(idx, 'description', e.target.value)}
                                            className="w-full text-sm text-slate-600 outline-none border border-dashed border-slate-300 focus:border-purple-500 rounded-xl p-2 resize-none h-20"
                                            placeholder="Description"
                                        />

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Department</label>
                                                <select
                                                    value={task.department || 'Operations'}
                                                    onChange={(e) => handleUpdateTask(idx, 'department', e.target.value)}
                                                    className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                                                >
                                                    <option value="Management">Management</option>
                                                    <option value="Sales/Marketing">Sales/Marketing</option>
                                                    <option value="Development">Development</option>
                                                    <option value="Design">Design</option>
                                                    <option value="Operations">Operations</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Priority</label>
                                                <select
                                                    value={task.priority || 'Medium'}
                                                    onChange={(e) => handleUpdateTask(idx, 'priority', e.target.value)}
                                                    className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                                                >
                                                    <option value="High">High</option>
                                                    <option value="Medium">Medium</option>
                                                    <option value="Low">Low</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Energy</label>
                                                <select
                                                    value={task.energyType || 'Medium Work'}
                                                    onChange={(e) => handleUpdateTask(idx, 'energyType', e.target.value)}
                                                    className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                                                >
                                                    <option value="Deep Work">Deep Work</option>
                                                    <option value="Medium Work">Medium Work</option>
                                                    <option value="Light Work">Light Work</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Deadline</label>
                                                <input
                                                    type="date"
                                                    value={task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : ''}
                                                    onChange={(e) => handleUpdateTask(idx, 'deadline', new Date(e.target.value).toISOString())}
                                                    className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {extractedTasks.length > 0 && (
                    <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                        <button
                            onClick={handleClose}
                            className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-200 rounded-xl transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black uppercase tracking-widest text-sm rounded-xl shadow-lg shadow-purple-600/30 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2"
                        >
                            <CheckCircle2 size={18} /> Confirm & Insert Tasks
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AITaskModal;
