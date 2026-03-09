import React, { useState, useRef, useEffect } from 'react';
import { Client, Employee, ManualTask, Priority } from '../types';
import { addManualTaskToDB, addEmployeeNotificationToDB } from '../lib/db';
import { X, Search, AlertCircle, ChevronDown } from 'lucide-react';

interface NewManualTaskModalProps {
    employee: Employee;
    clients: Client[];
    onClose: () => void;
    onSuccess: () => void;
}

const PRIORITIES: Priority[] = ['Urgent', 'High', 'Medium', 'Low'];

const PRIORITY_COLORS: Record<Priority, string> = {
    'Urgent': 'text-red-600 bg-red-50 border-red-200',
    'High': 'text-orange-600 bg-orange-50 border-orange-200',
    'Medium': 'text-blue-600 bg-blue-50 border-blue-200',
    'Low': 'text-slate-600 bg-slate-50 border-slate-200',
};

const NewManualTaskModal: React.FC<NewManualTaskModalProps> = ({ employee, clients, onClose, onSuccess }) => {
    const [clientSearch, setClientSearch] = useState('');
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<Priority>('Medium');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const searchRef = useRef<HTMLDivElement>(null);

    const now = new Date();
    const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredClients = clients.filter(c => {
        if (!clientSearch.trim()) return false;
        const q = clientSearch.toLowerCase();
        return (
            (c.companyName || '').toLowerCase().includes(q) ||
            c.name.toLowerCase().includes(q)
        );
    }).slice(0, 6);

    const handleSelectClient = (client: Client) => {
        setSelectedClient(client);
        setClientSearch(client.companyName || client.name);
        setShowSuggestions(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClient) { setError('Please select a client.'); return; }
        if (!description.trim()) { setError('Please enter a task description.'); return; }

        setIsSubmitting(true);
        setError('');

        try {
            const taskPayload: Omit<ManualTask, 'id'> = {
                clientId: selectedClient.id,
                clientName: selectedClient.name,
                companyName: selectedClient.companyName || selectedClient.name,
                description: description.trim(),
                priority,
                status: 'Pending',
                startDate: today,
                createdBy: employee.id,
                createdByName: employee.name,
                department: employee.department,
                adminConfirmed: false,
                createdAt: new Date().toISOString(),
            };

            const taskId = await addManualTaskToDB(taskPayload);

            // Create admin notification
            await addEmployeeNotificationToDB({
                type: 'manual_task_created',
                manualTaskId: taskId,
                employeeId: employee.id,
                employeeName: employee.name,
                department: employee.department,
                clientId: selectedClient.id,
                clientName: selectedClient.name,
                companyName: selectedClient.companyName || selectedClient.name,
                description: description.trim(),
                priority,
                status: 'pending_review',
                createdAt: new Date().toISOString(),
            });

            onSuccess();
        } catch (err) {
            console.error('Error creating manual task:', err);
            setError('Something went wrong. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Create New Task</h2>
                        <p className="text-sm text-slate-500 mt-0.5">This task will be sent to admin for approval</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Client Search */}
                    <div ref={searchRef}>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                            Client / Company
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search by company or client name..."
                                value={clientSearch}
                                onChange={(e) => {
                                    setClientSearch(e.target.value);
                                    setSelectedClient(null);
                                    setShowSuggestions(true);
                                }}
                                onFocus={() => clientSearch && setShowSuggestions(true)}
                                className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                            />
                            {selectedClient && (
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 text-xs font-bold">✓</span>
                            )}
                            {/* Suggestions */}
                            {showSuggestions && filteredClients.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                                    {filteredClients.map(client => (
                                        <button
                                            key={client.id}
                                            type="button"
                                            onClick={() => handleSelectClient(client)}
                                            className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0"
                                        >
                                            <p className="text-sm font-bold text-slate-800">{client.companyName || client.name}</p>
                                            {client.companyName && <p className="text-xs text-slate-500">{client.name}</p>}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {showSuggestions && clientSearch.trim() && filteredClients.length === 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 px-4 py-3">
                                    <p className="text-sm text-slate-500">No clients found for "{clientSearch}"</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                            Task Description
                        </label>
                        <textarea
                            placeholder="Describe the work to be done..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition resize-none"
                        />
                    </div>

                    {/* Priority & Start Date Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                                Priority
                            </label>
                            <div className="relative">
                                <select
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value as Priority)}
                                    className="w-full appearance-none px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-500 cursor-pointer"
                                >
                                    {PRIORITIES.map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                            </div>
                            <span className={`mt-1 inline-block px-2 py-0.5 rounded-md text-xs font-bold border ${PRIORITY_COLORS[priority]}`}>
                                {priority} Priority
                            </span>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                                Start Date
                            </label>
                            <div className="px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <span>📅</span>
                                <span>{today}</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">Auto-set to today</p>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 text-slate-600 font-semibold text-sm hover:bg-slate-100 rounded-xl transition border border-slate-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 py-3 bg-blue-600 text-white font-bold text-sm rounded-xl shadow-sm hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Submitting...' : 'Create Task →'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewManualTaskModal;
