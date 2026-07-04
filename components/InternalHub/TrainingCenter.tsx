import React, { useState } from 'react';
import { BookOpen, Award, FileText, CheckCircle2, ChevronRight, PlayCircle, Plus, BrainCircuit, X } from 'lucide-react';
import { TrainingCourse } from '../../types';
import { addDocToDB, updateDocInDB } from '../../lib/db';

interface TrainingCenterProps {
  courses: TrainingCourse[];
  currentUser: any;
  userRole: string;
  hasPermission: (section: string, action: string) => boolean;
}

const TrainingCenter: React.FC<TrainingCenterProps> = ({
  courses,
  currentUser,
  userRole,
  hasPermission
}) => {
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDept, setNewDept] = useState('Development');
  
  // Materials and Quizzes state for creation
  const [materials, setMaterials] = useState<{ title: string; type: 'video' | 'pdf' | 'presentation' | 'checklist'; url: string }[]>([]);
  const [newMaterialTitle, setNewMaterialTitle] = useState('');
  const [newMaterialType, setNewMaterialType] = useState<'video' | 'pdf' | 'presentation' | 'checklist'>('video');
  const [newMaterialUrl, setNewMaterialUrl] = useState('');

  const [quizzes, setQuizzes] = useState<{ question: string; options: string[]; answerIndex: number }[]>([]);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionOptions, setNewQuestionOptions] = useState<string[]>(['', '', '', '']);
  const [newQuestionAnswer, setNewQuestionAnswer] = useState(0);

  // Active training state
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);

  const handleAddMaterial = () => {
    if (!newMaterialTitle.trim() || !newMaterialUrl.trim()) return;
    setMaterials([...materials, { title: newMaterialTitle, type: newMaterialType, url: newMaterialUrl }]);
    setNewMaterialTitle('');
    setNewMaterialUrl('');
  };

  const handleAddQuestion = () => {
    if (!newQuestionText.trim() || newQuestionOptions.some(o => !o.trim())) {
      alert('Please fill out the question and all 4 options.');
      return;
    }
    setQuizzes([...quizzes, { question: newQuestionText, options: [...newQuestionOptions], answerIndex: newQuestionAnswer }]);
    setNewQuestionText('');
    setNewQuestionOptions(['', '', '', '']);
    setNewQuestionAnswer(0);
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim()) {
      alert('Course Title and Description are required.');
      return;
    }

    const courseData: Omit<TrainingCourse, 'id'> = {
      title: newTitle,
      description: newDesc,
      department: newDept,
      materials,
      quizzes,
      assignedEmployees: [], // default to open for all, or we assign later
      completedBy: [],
      createdAt: new Date().toISOString()
    };

    try {
      await addDocToDB('trainingCourses', courseData);
      setNewTitle('');
      setNewDesc('');
      setMaterials([]);
      setQuizzes([]);
      setShowCreate(false);
    } catch (err) {
      console.error(err);
      alert('Error creating training course.');
    }
  };

  const handleStartQuiz = (courseId: string) => {
    setActiveQuizId(courseId);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
  };

  const handleAnswerSelect = (qIdx: number, optIdx: number) => {
    setQuizAnswers({ ...quizAnswers, [qIdx]: optIdx });
  };

  const handleSubmitQuiz = async (course: TrainingCourse) => {
    const totalQuestions = course.quizzes.length;
    let correctCount = 0;

    course.quizzes.forEach((q, idx) => {
      if (quizAnswers[idx] === q.answerIndex) {
        correctCount++;
      }
    });

    const finalPercent = Math.round((correctCount / totalQuestions) * 100);
    setQuizScore(finalPercent);
    setQuizSubmitted(true);

    // Save completion to database
    const completedLog = [
      ...course.completedBy.filter(c => c.employeeId !== currentUser.id),
      {
        employeeId: currentUser.id,
        completionDate: new Date().toISOString().split('T')[0],
        score: finalPercent
      }
    ];

    try {
      await updateDocInDB('trainingCourses', course.id, { completedBy: completedLog });
    } catch (err) {
      console.error(err);
    }
  };

  const canManage = hasPermission('training', 'manage');
  const activeCourse = courses.find(c => c.id === activeCourseId);
  const quizCourse = courses.find(c => c.id === activeQuizId);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="text-slate-500" size={20} /> Training Center
          </h3>
          <p className="text-xs text-slate-500 mt-1">Enhance your skillset with corporate lessons and test modules.</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all"
          >
            <Plus size={15} /> Create Course
          </button>
        )}
      </div>

      {showCreate && (
        <form onSubmit={handleCreateCourse} className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4 animate-in fade-in duration-200">
          <h4 className="font-bold text-slate-800 text-sm">Create Learning Module</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* General Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Course Title</label>
                <input
                  required
                  type="text"
                  placeholder="e.g., Lead Conversion Masterclass"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-850 focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Description</label>
                <textarea
                  required
                  rows={3}
                  placeholder="What is this course about?"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-850 focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Department Scope</label>
                <select
                  value={newDept}
                  onChange={e => setNewDept(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-850 focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                >
                  <option value="All Departments">All Departments</option>
                  <option value="Graphic Design">Graphic Designing</option>
                  <option value="Digital Marketing">Digital Marketing</option>
                  <option value="Sales">Sales & Business Development</option>
                  <option value="Development">Software Development</option>
                </select>
              </div>

              {/* Add Material tool */}
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Add Study Material</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Lesson Title"
                    value={newMaterialTitle}
                    onChange={e => setNewMaterialTitle(e.target.value)}
                    className="p-2 border border-slate-200 rounded-lg bg-white text-xs font-bold outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Resource URL"
                    value={newMaterialUrl}
                    onChange={e => setNewMaterialUrl(e.target.value)}
                    className="p-2 border border-slate-200 rounded-lg bg-white text-xs font-bold outline-none"
                  />
                </div>
                <div className="flex gap-2 justify-between items-center">
                  <select
                    value={newMaterialType}
                    onChange={e => setNewMaterialType(e.target.value as any)}
                    className="p-2 border border-slate-200 rounded-lg bg-white text-xs font-bold outline-none"
                  >
                    <option value="video">📽 Video Lesson</option>
                    <option value="pdf">📄 PDF Document</option>
                    <option value="presentation">📊 Presentation Slide</option>
                    <option value="checklist">✓ Action Checklist</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddMaterial}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-lg"
                  >
                    Add Lesson
                  </button>
                </div>
                {materials.length > 0 && (
                  <div className="space-y-1 pt-2">
                    {materials.map((m, idx) => (
                      <div key={idx} className="p-2.5 bg-white rounded-lg border border-slate-150 text-[10px] font-bold text-slate-600 flex items-center justify-between">
                        <span>{m.type === 'video' ? '📽' : m.type === 'pdf' ? '📄' : '📊'} {m.title}</span>
                        <button type="button" onClick={() => setMaterials(materials.filter((_, i) => i !== idx))} className="text-red-500">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quiz settings */}
            <div className="space-y-4">
              <span className="text-sm font-bold text-slate-800 block">Configure Quiz Questions</span>
              <div className="p-4 rounded-lg border border-slate-250 bg-slate-50/50 space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 ml-1">Question Text</label>
                  <input
                    type="text"
                    placeholder="e.g., Which conversion strategy has the highest response rate?"
                    value={newQuestionText}
                    onChange={e => setNewQuestionText(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-lg bg-white font-bold text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5 ml-1">Options</label>
                  {newQuestionOptions.map((opt, i) => (
                    <input
                      key={i}
                      required={newQuestionText.trim() !== ''}
                      type="text"
                      placeholder={`Option #${i + 1}`}
                      value={opt}
                      onChange={e => {
                        const updated = [...newQuestionOptions];
                        updated[i] = e.target.value;
                        setNewQuestionOptions(updated);
                      }}
                      className="w-full p-2 border border-slate-200 rounded-lg bg-white text-xs font-semibold"
                    />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Correct Answer Index</label>
                    <select
                      value={newQuestionAnswer}
                      onChange={e => setNewQuestionAnswer(Number(e.target.value))}
                      className="w-full p-2 border border-slate-200 rounded-lg bg-white text-xs font-bold"
                    >
                      <option value={0}>Option 1</option>
                      <option value={1}>Option 2</option>
                      <option value={2}>Option 3</option>
                      <option value={3}>Option 4</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="w-full mt-4 py-2 border border-blue-500 text-blue-600 bg-white hover:bg-blue-50 font-bold rounded-lg text-xs transition"
                  >
                    + Add Question
                  </button>
                </div>
              </div>

              {quizzes.length > 0 && (
                <div className="space-y-2 max-h-44 overflow-y-auto">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Questions List ({quizzes.length})</span>
                  {quizzes.map((q, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex justify-between items-center font-bold">
                      <span className="truncate flex-1">Q{idx + 1}: {q.question}</span>
                      <button type="button" onClick={() => setQuizzes(quizzes.filter((_, i) => i !== idx))} className="text-red-500 ml-4 font-black">✕</button>
                    </div>
                  ))}
                </div>
              )}
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
              Publish Course
            </button>
          </div>
        </form>
      )}

      {/* Main layout: split lists / details */}
      {!activeCourseId ? (
        /* Courses Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => {
            const completionLog = course.completedBy?.find(c => c.employeeId === currentUser.id);
            const isCompleted = !!completionLog;

            return (
              <div
                key={course.id}
                className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-350 transition duration-200 group relative overflow-hidden"
              >
                {isCompleted && (
                  <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider rounded-bl shadow z-10 flex items-center gap-1">
                    <CheckCircle2 size={10} /> Completed ({completionLog.score}%)
                  </div>
                )}

                <div>
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 block mb-2">{course.department}</span>
                  <h4 className="text-base font-black text-slate-800 leading-tight mb-2 truncate">{course.title}</h4>
                  <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed mb-4">{course.description}</p>
                </div>

                <div className="flex items-center justify-between border-t border-slate-50 pt-4 mt-2">
                  <div className="flex gap-3 text-slate-400 text-[10px] font-bold">
                    <span>📚 {course.materials?.length || 0} Lessons</span>
                    <span>🧠 {course.quizzes?.length || 0} Questions</span>
                  </div>
                  <button
                    onClick={() => setActiveCourseId(course.id)}
                    className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 group-hover:translate-x-1 transition-transform"
                  >
                    Launch <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
          {courses.length === 0 && (
            <div className="col-span-full py-16 bg-white rounded-lg border border-slate-200 shadow-sm text-center">
              <BookOpen className="mx-auto text-slate-350 mb-3" size={40} />
              <p className="text-slate-400 italic text-xs">No learning courses or modules published yet.</p>
            </div>
          )}
        </div>
      ) : (
        /* Detailed Course View */
        activeCourse && (
          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-5 animate-in fade-in duration-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-150">
              <div>
                <button
                  onClick={() => setActiveCourseId(null)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-bold mb-1.5 block"
                >
                  ← Back to Course Library
                </button>
                <h3 className="text-xl font-bold text-slate-900">{activeCourse.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{activeCourse.description}</p>
              </div>
              {activeCourse.quizzes?.length > 0 && (
                <button
                  onClick={() => handleStartQuiz(activeCourse.id)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-650 hover:bg-purple-755 text-white rounded-lg text-xs font-bold transition"
                >
                  <BrainCircuit size={15} /> Take Quiz Exam
                </button>
              )}
            </div>

            {/* Course Material Lessons */}
            <div>
              <h4 className="font-extrabold text-slate-800 text-base mb-4">Study Material Lessons</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeCourse.materials?.map((mat, idx) => (
                  <a
                    key={idx}
                    href={mat.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-4 rounded-lg border border-slate-200 hover:border-blue-300 bg-slate-50/50 hover:bg-blue-50/10 transition flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded bg-white border border-slate-200 flex items-center justify-center">
                        {mat.type === 'video' ? (
                          <PlayCircle className="text-blue-500" size={18} />
                        ) : (
                          <FileText className="text-indigo-500" size={18} />
                        )}
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 text-xs block">{mat.title}</span>
                        <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 mt-0.5 block">{mat.type}</span>
                      </div>
                    </div>
                    <span className="text-xs text-blue-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Open Lesson →</span>
                  </a>
                ))}
                {(!activeCourse.materials || activeCourse.materials.length === 0) && (
                  <p className="col-span-full py-8 text-center text-slate-400 italic text-xs">No lessons added to this course.</p>
                )}
              </div>
            </div>
          </div>
        )
      )}

      {/* Quiz Modal Panel */}
      {activeQuizId && quizCourse && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200 flex flex-col max-h-[80vh]">
            <div className="px-6 py-4.5 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-purple-650">Quiz Assessment</span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">{quizCourse.title}</h3>
              </div>
              <button onClick={() => setActiveQuizId(null)} className="p-2 hover:bg-slate-200 rounded-full transition">
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {!quizSubmitted ? (
                /* Interactive quiz questions */
                quizCourse.quizzes.map((q, idx) => (
                  <div key={idx} className="space-y-3 pb-6 border-b border-slate-105 last:border-none">
                    <span className="font-bold text-slate-800 text-sm block">Q{idx + 1}: {q.question}</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {q.options.map((opt, oIdx) => {
                        const active = quizAnswers[idx] === oIdx;
                        return (
                          <button
                            key={oIdx}
                            type="button"
                            onClick={() => handleAnswerSelect(idx, oIdx)}
                            className={`p-3 rounded-lg border text-left text-xs transition ${
                              active
                                ? 'bg-purple-555 border-purple-300 text-purple-850 font-bold'
                                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-650'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                /* Score result page */
                <div className="py-12 text-center space-y-4">
                  <div className="w-20 h-20 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto shadow-md">
                    <Award size={40} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-850">Quiz Completed!</h3>
                    <p className="text-slate-500 text-xs mt-1">Your exam score details are logged below.</p>
                  </div>
                  <span className="text-4xl font-black text-purple-600 block pt-4">{quizScore}%</span>
                  <p className="text-xs text-slate-500 font-bold">
                    {quizScore && quizScore >= 70
                      ? '🎉 Outstanding Performance! You passed the lesson.'
                      : '✍ Retry recommended to improve retention.'}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4.5 border-t border-slate-200 flex justify-end gap-2.5 shrink-0 bg-slate-50">
              <button
                type="button"
                onClick={() => setActiveQuizId(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-500 bg-white"
              >
                Close Window
              </button>
              {!quizSubmitted && (
                <button
                  type="button"
                  onClick={() => handleSubmitQuiz(quizCourse)}
                  disabled={Object.keys(quizAnswers).length < quizCourse.quizzes.length}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition"
                >
                  Submit Exam
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainingCenter;
