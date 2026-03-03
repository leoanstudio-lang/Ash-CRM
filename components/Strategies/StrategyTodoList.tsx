import React, { useState, useEffect } from 'react';
import { StrategyTodo } from '../../types';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react';

interface StrategyTodoListProps {
    strategyId: string;
}

const StrategyTodoList: React.FC<StrategyTodoListProps> = ({ strategyId }) => {
    const [todos, setTodos] = useState<StrategyTodo[]>([]);
    const [newText, setNewText] = useState('');

    useEffect(() => {
        const q = query(
            collection(db, 'strategyTodos'),
            where('strategyId', '==', strategyId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedTodos = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as StrategyTodo[];

            // Sort client-side to avoid needing compound indexes initially
            // Pending first, then Completed. Secondary sort by createdAt desc.
            fetchedTodos.sort((a, b) => {
                if (a.isCompleted === b.isCompleted) {
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                }
                return a.isCompleted ? 1 : -1;
            });

            setTodos(fetchedTodos);
        });

        return () => unsubscribe();
    }, [strategyId]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newText.trim()) return;

        try {
            await addDoc(collection(db, 'strategyTodos'), {
                strategyId,
                text: newText.trim(),
                isCompleted: false,
                createdAt: new Date().toISOString()
            });
            setNewText('');
        } catch (err) {
            console.error('Error adding strategy todo:', err);
        }
    };

    const toggleTodo = async (todo: StrategyTodo) => {
        try {
            const ref = doc(db, 'strategyTodos', todo.id);
            await updateDoc(ref, { isCompleted: !todo.isCompleted });
        } catch (err) {
            console.error('Error toggling strategy todo:', err);
        }
    };

    const deleteTodo = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'strategyTodos', id));
        } catch (err) {
            console.error('Error deleting strategy todo:', err);
        }
    };

    const pendingTodos = todos.filter(t => !t.isCompleted);
    const completedTodos = todos.filter(t => t.isCompleted);

    return (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col h-full max-h-[600px]">
            <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center justify-between">
                <span>Mission Directives</span>
                <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">
                    {completedTodos.length}/{todos.length} Fin
                </span>
            </h3>

            {/* Input Form */}
            <form onSubmit={handleAdd} className="mb-4 flex gap-2">
                <input
                    type="text"
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    placeholder="E.g., Close 1 GCC Client..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                />
                <button
                    type="submit"
                    disabled={!newText.trim()}
                    className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                    <Plus size={18} />
                </button>
            </form>

            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                {todos.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                        <p className="text-sm font-bold">No directives set.</p>
                        <p className="text-xs">Add your first target for this month.</p>
                    </div>
                ) : (
                    <>
                        {pendingTodos.map(todo => (
                            <div key={todo.id} className="group flex items-start gap-3 p-3 bg-white border border-slate-100 rounded-xl hover:border-indigo-200 hover:shadow-sm transition-all">
                                <button onClick={() => toggleTodo(todo)} className="mt-0.5 text-slate-300 hover:text-emerald-500 transition-colors shrink-0">
                                    <Circle size={18} />
                                </button>
                                <span className="flex-1 text-sm font-bold text-slate-700 leading-snug break-words">
                                    {todo.text}
                                </span>
                                <button onClick={() => deleteTodo(todo.id)} className="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}

                        {completedTodos.length > 0 && (
                            <div className="pt-4 mt-4 border-t border-slate-100 space-y-2">
                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 px-1">Completed Directives</h4>
                                {completedTodos.map(todo => (
                                    <div key={todo.id} className="group flex items-start gap-3 p-3 bg-slate-50 border border-transparent rounded-xl opacity-75">
                                        <button onClick={() => toggleTodo(todo)} className="mt-0.5 text-emerald-500 transition-colors shrink-0">
                                            <CheckCircle2 size={18} />
                                        </button>
                                        <span className="flex-1 text-sm font-bold text-slate-400 line-through leading-snug break-words">
                                            {todo.text}
                                        </span>
                                        <button onClick={() => deleteTodo(todo.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default StrategyTodoList;
