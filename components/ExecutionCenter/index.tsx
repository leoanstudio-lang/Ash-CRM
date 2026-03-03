import React, { useState } from 'react';
import { ExecutionTask, Client, Project, Employee } from '../../types';
import FocusStrip from './FocusStrip';
import AnalyticsPanel from './AnalyticsPanel';
import CalendarBox from './CalendarBox';
import TaskCommandPanel from './TaskCommandPanel';
import TaskFormModal from './TaskFormModal';
import { addDoc, collection, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Plus, LayoutDashboard, Calendar, BarChart2 } from 'lucide-react';

interface ExecutionCenterProps {
    tasks: ExecutionTask[];
    clients: Client[];
    projects: Project[];
    employees: Employee[];
}

const DEPARTMENTS = ['Management', 'Sales/Marketing', 'Development', 'Design', 'Operations'];

const ExecutionCenter: React.FC<ExecutionCenterProps> = ({ tasks, clients, projects, employees }) => {
    const [activeTab, setActiveTab] = useState<'Tasks' | 'Calendar' | 'Analytics'>('Tasks');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<ExecutionTask | undefined>(undefined);

    const handleSaveTask = async (taskData: Partial<ExecutionTask>) => {
        try {
            if (editingTask) {
                // Update
                await updateDoc(doc(db, 'executionTasks', editingTask.id), taskData);
            } else {
                // Create
                const newTask = {
                    ...taskData,
                    id: `exec_${Date.now()}`,
                    createdAt: new Date().toISOString(),
                    timeLogs: [],
                    actualTimeSeconds: 0
                };
                await addDoc(collection(db, 'executionTasks'), newTask);
            }
        } catch (e) {
            console.error('Error saving task:', e);
        }
    };

    const openNewTaskModal = () => {
        setEditingTask(undefined);
        setIsModalOpen(true);
    };

    const openEditTaskModal = (task: ExecutionTask) => {
        setEditingTask(task);
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-6 md:space-y-8 w-full max-w-7xl mx-auto pb-12">
            {/* Header & Sub-Navigation */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 inline-flex">
                    <button
                        onClick={() => setActiveTab('Tasks')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'Tasks' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <LayoutDashboard size={14} /> Tasks
                    </button>
                    <button
                        onClick={() => setActiveTab('Calendar')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'Calendar' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <Calendar size={14} /> Calendar
                    </button>
                    <button
                        onClick={() => setActiveTab('Analytics')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'Analytics' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <BarChart2 size={14} /> Analytics
                    </button>
                </div>

                <button
                    onClick={openNewTaskModal}
                    className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
                >
                    <Plus size={16} /> Init Task
                </button>
            </div>

            {/* Focus Strip (Always Visible or mostly visible) */}
            <FocusStrip tasks={tasks} />

            {/* Main Content Area based on Tab */}
            <div className="animate-in fade-in duration-300">
                {activeTab === 'Tasks' && (
                    <TaskCommandPanel tasks={tasks} onEditTask={openEditTaskModal} />
                )}

                {activeTab === 'Calendar' && (
                    <CalendarBox tasks={tasks} onTaskClick={openEditTaskModal} />
                )}

                {activeTab === 'Analytics' && (
                    <AnalyticsPanel tasks={tasks} />
                )}
            </div>

            <TaskFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveTask}
                initialData={editingTask}
                departments={DEPARTMENTS}
            />
        </div>
    );
};

export default ExecutionCenter;
