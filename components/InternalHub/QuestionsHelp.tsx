import React, { useState } from 'react';
import { HelpCircle, Search, Plus, MessageSquare, Check, Tag, Trash2 } from 'lucide-react';
import { QuestionThread } from '../../types';
import { addDocToDB, updateDocInDB, deleteDocFromDB } from '../../lib/db';

interface QuestionsHelpProps {
  questions: QuestionThread[];
  currentUser: any;
  userRole: string;
  hasPermission: (section: string, action: string) => boolean;
}

const QuestionsHelp: React.FC<QuestionsHelpProps> = ({
  questions,
  currentUser,
  userRole,
  hasPermission
}) => {
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTagsStr, setNewTagsStr] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Active thread detail view
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [newAnswerText, setNewAnswerText] = useState('');

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const tags = newTagsStr
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t !== '');

    const newThread: Omit<QuestionThread, 'id'> = {
      title: newTitle,
      content: newContent,
      submittedBy: currentUser.id,
      submittedByName: currentUser.name,
      tags,
      repliesCount: 0,
      answers: [],
      createdAt: new Date().toISOString()
    };

    try {
      await addDocToDB('questions', newThread);
      setNewTitle('');
      setNewContent('');
      setNewTagsStr('');
      setShowCreate(false);
    } catch (err) {
      console.error(err);
      alert('Error creating thread.');
    }
  };

  const handleDeleteThread = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this thread?')) {
      await deleteDocFromDB('questions', id);
      if (activeQuestionId === id) setActiveQuestionId(null);
    }
  };

  const handlePostAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnswerText.trim() || !activeQuestionId) return;

    const thread = questions.find(q => q.id === activeQuestionId);
    if (!thread) return;

    const newAns = {
      id: `ans-${Date.now()}`,
      content: newAnswerText,
      submittedBy: currentUser.id,
      submittedByName: currentUser.name,
      createdAt: new Date().toISOString()
    };

    const updatedAnswers = [...(thread.answers || []), newAns];

    try {
      await updateDocInDB('questions', activeQuestionId, {
        answers: updatedAnswers,
        repliesCount: updatedAnswers.length
      });
      setNewAnswerText('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleAcceptAnswer = async (ansId: string) => {
    if (!activeQuestionId) return;
    try {
      await updateDocInDB('questions', activeQuestionId, { acceptedAnswerId: ansId });
    } catch (err) {
      console.error(err);
    }
  };

  // Filter threads based on search queries (title, content, tags)
  const filteredQuestions = questions.filter(q => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      q.title.toLowerCase().includes(query) ||
      q.content.toLowerCase().includes(query) ||
      q.tags.some(tag => tag.toLowerCase().includes(query));
    return matchesSearch;
  });

  const activeQuestion = questions.find(q => q.id === activeQuestionId);
  const canManage = hasPermission('questions', 'manage');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <HelpCircle className="text-blue-600" size={22} /> Discussion & Help Forum
          </h3>
          <p className="text-xs text-slate-500 mt-1">Ask questions, share advice, and help solve work-related problems.</p>
        </div>
        <div className="flex gap-2">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-405" size={13} />
            <input
              type="text"
              placeholder="Search topics or tags..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all min-w-[200px]"
            />
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shrink-0"
          >
            <Plus size={15} /> New Thread
          </button>
        </div>
      </div>

      {showCreate && (
        <form onSubmit={handleCreateThread} className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4 animate-in fade-in duration-200">
          <h4 className="font-bold text-slate-800 text-sm">Start a New Conversation</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Topic Title</label>
                <input
                  required
                  type="text"
                  placeholder="e.g., How to configure multiple domains in Vite?"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Category Tags (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g., vite, domain, config, typescript"
                  value={newTagsStr}
                  onChange={e => setNewTagsStr(e.target.value)}
                  className="w-full p-3 border border-slate-205 rounded-lg bg-slate-50 font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Content Details</label>
              <textarea
                required
                rows={5}
                placeholder="Explain what help you need or what you would like to discuss..."
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none text-xs leading-relaxed"
              />
            </div>
          </div>

          <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
            >
              Post Topic
            </button>
          </div>
        </form>
      )}

      {/* Split view or topics list */}
      {!activeQuestionId ? (
        /* Threads list */
        <div className="space-y-4">
          {filteredQuestions.map((q) => {
            const hasAccepted = !!q.acceptedAnswerId;
            return (
              <div
                key={q.id}
                onClick={() => setActiveQuestionId(q.id)}
                className="bg-white p-4.5 rounded-lg border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-350 cursor-pointer transition relative group"
              >
                {canManage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteThread(q.id);
                    }}
                    className="absolute top-4 right-4 p-2 text-slate-350 hover:text-red-500 rounded-lg hover:bg-slate-50 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                )}

                <div className="space-y-2 flex-1 pr-4">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase">{q.submittedByName}</span>
                    <span className="text-[9px] text-slate-300 font-bold">•</span>
                    <span className="text-[9px] text-slate-400 font-bold">{new Date(q.createdAt).toLocaleDateString()}</span>
                  </div>
                  <h4 className="text-base font-black text-slate-800 leading-tight group-hover:text-blue-600 transition-colors">
                    {q.title}
                  </h4>
                  <div className="flex flex-wrap gap-1 pt-1.5">
                    {q.tags?.map(t => (
                      <span key={t} className="px-2 py-0.5 rounded bg-slate-50 border border-slate-100 text-[9px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Tag size={8} /> {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 sm:border-l border-slate-50 sm:pl-6">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                    hasAccepted ? 'bg-emerald-50 text-emerald-650 border border-emerald-150' : 'bg-slate-50 text-slate-500'
                  }`}>
                    <MessageSquare size={12} /> {q.repliesCount || 0}
                  </div>
                  <ChevronRight className="text-slate-350 group-hover:translate-x-1 transition-transform" size={16} />
                </div>
              </div>
            );
          })}
          {filteredQuestions.length === 0 && (
            <div className="py-16 bg-white rounded-lg border border-slate-200 shadow-sm text-center">
              <HelpCircle className="mx-auto text-slate-350 mb-3" size={40} />
              <p className="text-slate-400 italic text-xs">No discussion threads found.</p>
            </div>
          )}
        </div>
      ) : (
        /* Thread detail view */
        activeQuestion && (
          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-5 animate-in fade-in duration-200">
            <div className="pb-3 border-b border-slate-150">
              <button
                onClick={() => setActiveQuestionId(null)}
                className="text-xs text-blue-600 hover:text-blue-700 font-bold mb-3 block"
              >
                ← Back to Q&A List
              </button>
              <div className="flex items-center gap-3 text-slate-400 text-[10px] font-bold">
                <span>By {activeQuestion.submittedByName}</span>
                <span>•</span>
                <span>{new Date(activeQuestion.createdAt).toLocaleString()}</span>
              </div>
              <h3 className="text-xl font-black text-slate-900 mt-2">{activeQuestion.title}</h3>
              <p className="text-xs text-slate-705 leading-relaxed mt-3 bg-slate-50 p-3.5 rounded-lg whitespace-pre-wrap border border-slate-200">
                {activeQuestion.content}
              </p>
            </div>

            {/* Answers List */}
            <div className="space-y-4">
              <h4 className="font-extrabold text-slate-800 text-sm">Replies & Responses ({activeQuestion.answers?.length || 0})</h4>
              <div className="space-y-4">
                {activeQuestion.answers?.map((ans) => {
                  const isAccepted = activeQuestion.acceptedAnswerId === ans.id;
                  const isAuthor = currentUser.id === activeQuestion.submittedBy;

                  return (
                    <div
                      key={ans.id}
                      className={`p-4 rounded-lg border transition flex gap-3.5 ${
                        isAccepted
                          ? 'bg-emerald-50/20 border-emerald-250'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3 text-slate-400 text-[10px] font-bold">
                          <span className="text-slate-650">{ans.submittedByName}</span>
                          <span>•</span>
                          <span>{new Date(ans.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{ans.content}</p>
                      </div>

                      <div className="flex items-start shrink-0">
                        {isAccepted ? (
                          <span className="flex items-center gap-1 bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg shadow-sm">
                            <Check size={12} /> Accepted Answer
                          </span>
                        ) : (
                          isAuthor && (
                            <button
                              onClick={() => handleAcceptAnswer(ans.id)}
                              className="px-2.5 py-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-lg border border-slate-200 text-[9px] font-bold uppercase tracking-wider transition"
                            >
                              Accept Answer
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
                {(!activeQuestion.answers || activeQuestion.answers.length === 0) && (
                  <p className="py-8 text-center text-slate-400 italic text-xs">No replies posted to this topic yet.</p>
                )}
              </div>
            </div>

            {/* Answer editor form */}
            <form onSubmit={handlePostAnswer} className="space-y-2.5 pt-3 border-t border-slate-150">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Write your Reply</label>
              <textarea
                required
                rows={3}
                placeholder="Write your explanation or advice..."
                value={newAnswerText}
                onChange={e => setNewAnswerText(e.target.value)}
                className="w-full p-3 border border-slate-205 rounded-lg bg-slate-50 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                Post Reply
              </button>
            </form>
          </div>
        )
      )}
    </div>
  );
};

export default QuestionsHelp;
