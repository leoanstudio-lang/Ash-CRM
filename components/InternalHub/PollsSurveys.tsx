import React, { useState } from 'react';
import { Vote, Plus, BarChart2, Calendar, Trash2, CheckSquare } from 'lucide-react';
import { Poll } from '../../types';
import { addDocToDB, updateDocInDB, deleteDocFromDB } from '../../lib/db';

interface PollsSurveysProps {
  polls: Poll[];
  currentUser: any;
  userRole: string;
  hasPermission: (section: string, action: string) => boolean;
}

const PollsSurveys: React.FC<PollsSurveysProps> = ({
  polls,
  currentUser,
  userRole,
  hasPermission
}) => {
  const [showCreate, setShowCreate] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newOptions, setNewOptions] = useState<string[]>(['', '']);
  const [newType, setNewType] = useState<Poll['questionType']>('Single Choice');
  const [newExpires, setNewExpires] = useState('');

  // Local state for temporary answers before submitting
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [textFeedback, setTextFeedback] = useState<Record<string, string>>({});

  const handleAddOption = () => {
    setNewOptions([...newOptions, '']);
  };

  const handleOptionChange = (idx: number, val: string) => {
    const updated = [...newOptions];
    updated[idx] = val;
    setNewOptions(updated);
  };

  const handleRemoveOption = (idx: number) => {
    if (newOptions.length <= 2) return;
    setNewOptions(newOptions.filter((_, i) => i !== idx));
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || newOptions.some(o => !o.trim()) || !newExpires) {
      alert('Please fill out all fields and provide at least two options.');
      return;
    }

    const newPoll: Omit<Poll, 'id'> = {
      question: newQuestion,
      options: newOptions.filter(o => o.trim() !== ''),
      questionType: newType,
      expiresAt: newExpires,
      createdBy: currentUser?.name || 'Admin',
      responses: [],
      createdAt: new Date().toISOString()
    };

    try {
      await addDocToDB('polls', newPoll);
      setNewQuestion('');
      setNewOptions(['', '']);
      setNewExpires('');
      setShowCreate(false);
    } catch (err) {
      console.error(err);
      alert('Failed to save poll to database.');
    }
  };

  const handleDeletePoll = async (id: string) => {
    if (window.confirm('Are you sure you want to permanently delete this poll?')) {
      await deleteDocFromDB('polls', id);
    }
  };

  const handleVote = async (pollId: string) => {
    const poll = polls.find(p => p.id === pollId);
    if (!poll) return;

    let answers: string[] = [];
    if (poll.questionType === 'Text Feedback') {
      const text = textFeedback[pollId];
      if (!text || !text.trim()) {
        alert('Please write your feedback before submitting.');
        return;
      }
      answers = [text];
    } else {
      const opts = selectedOptions[pollId] || [];
      if (opts.length === 0) {
        alert('Please select at least one option to vote.');
        return;
      }
      answers = opts;
    }

    const updatedResponses = [
      ...poll.responses.filter(r => r.employeeId !== currentUser.id),
      { employeeId: currentUser.id, answers }
    ];

    try {
      await updateDocInDB('polls', pollId, { responses: updatedResponses });
      // Reset local answers
      setSelectedOptions(prev => {
        const u = { ...prev };
        delete u[pollId];
        return u;
      });
      setTextFeedback(prev => {
        const u = { ...prev };
        delete u[pollId];
        return u;
      });
    } catch (err) {
      console.error(err);
      alert('Error saving your response.');
    }
  };

  const handleSelectOption = (pollId: string, type: Poll['questionType'], opt: string) => {
    setSelectedOptions(prev => {
      const current = prev[pollId] || [];
      if (type === 'Single Choice' || type === 'Rating') {
        return { ...prev, [pollId]: [opt] };
      } else {
        if (current.includes(opt)) {
          return { ...prev, [pollId]: current.filter(o => o !== opt) };
        } else {
          return { ...prev, [pollId]: [...current, opt] };
        }
      }
    });
  };

  const canManage = hasPermission('polls', 'manage');
  const canWrite = hasPermission('polls', 'write');

  // Helper to calculate percentages of votes
  const getVoteStats = (poll: Poll) => {
    const totalVotes = poll.responses.length;
    const optionCounts: Record<string, number> = {};
    poll.options.forEach(o => { optionCounts[o] = 0; });

    poll.responses.forEach(r => {
      r.answers.forEach(ans => {
        if (optionCounts[ans] !== undefined) {
          optionCounts[ans]++;
        }
      });
    });

    return {
      total: totalVotes,
      counts: optionCounts
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Vote className="text-slate-500" size={20} /> Polls & Feedback Surveys
          </h3>
          <p className="text-xs text-slate-505 mt-1">Participate in corporate voting and share feedback with managers.</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all"
          >
            <Plus size={15} /> Create Survey
          </button>
        )}
      </div>

      {showCreate && (
        <form onSubmit={handleCreatePoll} className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4 animate-in fade-in duration-200">
          <h4 className="font-bold text-slate-805 text-sm">New Poll Settings</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Question / Prompt</label>
                <input
                  required
                  type="text"
                  placeholder="e.g., What should be the timing for the weekend team dinner?"
                  value={newQuestion}
                  onChange={e => setNewQuestion(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Question Type</label>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value as any)}
                    className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-805 focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                  >
                    <option value="Single Choice">Single Choice</option>
                    <option value="Multiple Choice">Multiple Choice (Checkboxes)</option>
                    <option value="Rating">Rating (1 to 5 Stars)</option>
                    <option value="Text Feedback">Text Feedback (Written Notes)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Expiry Date</label>
                  <input
                    required
                    type="date"
                    value={newExpires}
                    onChange={e => setNewExpires(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                  />
                </div>
              </div>
            </div>

            {newType !== 'Text Feedback' && (
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Options List</label>
                {newOptions.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      required
                      type="text"
                      placeholder={newType === 'Rating' ? `${i + 1} Star Description` : `Option #${i + 1}`}
                      value={opt}
                      onChange={e => handleOptionChange(i, e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                    />
                    {newOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(i)}
                        className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {newType !== 'Rating' && (
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 mt-1"
                  >
                    + Add Option
                  </button>
                )}
              </div>
            )}
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
              Save Poll
            </button>
          </div>
        </form>
      )}

      {/* Active Polls List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {polls.map((poll) => {
          const stats = getVoteStats(poll);
          const hasVoted = poll.responses.some(r => r.employeeId === currentUser.id);
          const activeVotes = selectedOptions[poll.id] || [];
          const currentText = textFeedback[poll.id] || '';
          const isExpired = new Date(poll.expiresAt).getTime() < new Date().getTime();

          return (
            <div key={poll.id} className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between relative group hover:border-slate-350 transition duration-200">
              {canManage && (
                <button
                  onClick={() => handleDeletePoll(poll.id)}
                  className="absolute top-4 right-4 p-2 text-slate-350 hover:text-red-500 rounded-lg hover:bg-slate-50 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={16} />
                </button>
              )}

              <div>
                <div className="flex items-center gap-3 text-slate-400 mb-3">
                  <Calendar size={13} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Expires: {new Date(poll.expiresAt).toLocaleDateString()}</span>
                  {isExpired && (
                    <span className="text-[8px] bg-red-50 text-red-500 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Closed</span>
                  )}
                </div>

                <h4 className="text-base font-black text-slate-900 leading-tight mb-4">{poll.question}</h4>

                {!hasVoted && !isExpired ? (
                  /* Voting form */
                  <div className="space-y-3">
                    {poll.questionType === 'Text Feedback' ? (
                      <textarea
                        rows={3}
                        placeholder="Write your suggestions / comments here..."
                        value={currentText}
                        onChange={e => setTextFeedback({ ...textFeedback, [poll.id]: e.target.value })}
                        className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : poll.questionType === 'Rating' ? (
                      <div className="flex gap-2 justify-center py-2">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const starStr = star.toString();
                          const active = activeVotes.includes(starStr);
                          return (
                            <button
                              key={star}
                              type="button"
                              onClick={() => handleSelectOption(poll.id, 'Rating', starStr)}
                              className={`w-9 h-9 rounded-full border flex items-center justify-center font-bold text-sm transition ${
                                active
                                  ? 'bg-amber-500 text-white border-amber-500'
                                  : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              ★
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      /* Radio / Checkboxes options */
                      <div className="space-y-2">
                        {poll.options.map((opt) => {
                          const active = activeVotes.includes(opt);
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handleSelectOption(poll.id, poll.questionType, opt)}
                              className={`w-full p-2.5 rounded-lg border flex items-center gap-3 text-left transition ${
                                active
                                  ? 'bg-blue-50 border-blue-300 text-blue-800 font-bold'
                                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold'
                              }`}
                            >
                              <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                active ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-350'
                              }`}>
                                {active && <span className="w-1.5 h-1.5 bg-white rounded-full"></span>}
                              </span>
                              <span className="text-xs">{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <button
                      onClick={() => handleVote(poll.id)}
                      className="w-full py-2 bg-slate-900 text-white font-bold rounded-lg text-xs hover:bg-black transition flex items-center justify-center gap-1.5 mt-2"
                    >
                      <CheckSquare size={13} /> Submit Vote
                    </button>
                  </div>
                ) : (
                  /* Results visualization */
                  <div className="space-y-3 p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex justify-between text-[9px] uppercase tracking-widest text-slate-400 font-black mb-1">
                      <span>Live Results</span>
                      <span>{stats.total} Votes Logged</span>
                    </div>

                    {poll.questionType === 'Text Feedback' ? (
                      <div className="max-h-36 overflow-y-auto space-y-2">
                        {poll.responses.map((resp, idx) => (
                          <div key={idx} className="p-2 bg-white border border-slate-200 rounded-lg text-[11px] font-medium leading-relaxed text-slate-700 italic">
                            "{resp.answers[0]}"
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {poll.options.map((opt) => {
                          const votes = stats.counts[opt] || 0;
                          const percent = stats.total > 0 ? Math.round((votes / stats.total) * 100) : 0;
                          return (
                            <div key={opt} className="space-y-1">
                              <div className="flex justify-between text-xs font-bold text-slate-700">
                                <span>{opt}</span>
                                <span>{percent}% ({votes})</span>
                              </div>
                              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-blue-600 h-full rounded-full transition-all duration-500"
                                  style={{ width: `${percent}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {polls.length === 0 && (
          <div className="col-span-full py-16 bg-white rounded-lg border border-slate-200 shadow-sm text-center">
            <Vote className="mx-auto text-slate-350 mb-3" size={40} />
            <p className="text-slate-400 italic text-xs">No corporate polls or surveys found.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PollsSurveys;
