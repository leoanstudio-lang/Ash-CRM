import React from 'react';
import { ContentMonth, ContentCard } from '../../types';
import { Video, CheckCircle2, Target, CalendarDays, Flame, BarChart3 } from 'lucide-react';

interface DashboardProps {
    months: ContentMonth[];
    cards: ContentCard[];
}

const Dashboard: React.FC<DashboardProps> = ({ months, cards }) => {
    // 1. Identify Current Active Month
    const currentDate = new Date();
    // Use the exact names from constants or construct it. Simple approach:
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentMonthName = monthNames[currentDate.getMonth()];
    const currentYear = currentDate.getFullYear();

    // Find the ContentMonth document for right now
    const activeMonthData = months.find(m => m.month === currentMonthName && m.year === currentYear);

    // Filter cards for the active month
    const activeMonthCards = cards.filter(c => c.monthId === activeMonthData?.id);

    // Metrics calculation
    const totalPlanned = activeMonthData?.targetVideos || 0;
    const totalPublished = activeMonthCards.filter(c => c.status === 'Posted').length;
    const completionPercentage = totalPlanned > 0 ? (totalPublished / totalPlanned) * 100 : 0;

    // Weekly Progress (Assuming 4 weeks a month for simple calculation based on prompt requirements)
    const weeklyTarget = totalPlanned > 0 ? Math.ceil(totalPlanned / 4) : 0;

    // For "Current Week Progress", we'd need to know what week of the month it is. 
    // Simplified: just check how many are published *this week*.
    const getWeekOfMonth = (date: Date) => {
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
        return Math.ceil((date.getDate() + firstDay) / 7);
    };

    const currentWeekNum = getWeekOfMonth(currentDate);

    const publishedThisWeek = activeMonthCards.filter(c => {
        if (c.status !== 'Posted' || !c.postingDate) return false;
        const postDate = new Date(c.postingDate);
        return getWeekOfMonth(postDate) === currentWeekNum && postDate.getMonth() === currentDate.getMonth();
    }).length;

    // Content Streak Calculation (consecutive weeks meeting target)
    // This is a complex historical calculation. We will approximate it by looking back at the last N weeks.
    // For MVP dashboard, we will calculate streak based on the total published vs elapsed weeks in current month.
    let currentStreak = 0;
    if (publishedThisWeek >= weeklyTarget && weeklyTarget > 0) {
        currentStreak = 1; // Simplified streak logic for UI placeholder. Real logic requires deep historical parsing.
        // If we wanted real streak, we'd need to evaluate every previous week successively backward.
    }

    return (
        <div className="p-6 lg:p-10">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">Content Pipeline Overview</h3>
                    <p className="text-slate-500 font-medium">Quick snapshot of your content machinery.</p>
                </div>
                {activeMonthData && (
                    <div className="bg-rose-50 border border-rose-100 px-4 py-2 rounded-xl flex items-center gap-2">
                        <CalendarDays className="text-rose-500" size={18} />
                        <span className="font-bold text-rose-700 text-sm">{activeMonthData.month} {activeMonthData.year} Data</span>
                    </div>
                )}
            </div>

            {!activeMonthData && (
                <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-r-2xl mb-8 flex items-start gap-4">
                    <div className="bg-amber-100 p-2 rounded-full mt-1">
                        <Target className="text-amber-600" size={20} />
                    </div>
                    <div>
                        <h4 className="font-black text-amber-800 text-lg">No Active Plan Found</h4>
                        <p className="text-amber-700/80 font-medium text-sm mt-1">
                            You haven't initialized a Content Plan for <strong>{currentMonthName} {currentYear}</strong>.
                            Head over to the Monthly Planner tab to set your goals.
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Metric 1 */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                    <div className="flex justify-between items-start mb-4">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Total Planned</span>
                        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                            <Video size={16} />
                        </div>
                    </div>
                    <span className="text-4xl font-black text-slate-800">{totalPlanned}</span>
                    <p className="text-sm font-bold text-slate-400 mt-2">Videos this month</p>
                </div>

                {/* Metric 2 */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                    <div className="flex justify-between items-start mb-4">
                        <span className="text-xs font-black uppercase tracking-widest text-emerald-500">Total Published</span>
                        <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                            <CheckCircle2 size={16} />
                        </div>
                    </div>
                    <span className="text-4xl font-black text-slate-800">{totalPublished}</span>
                    <p className="text-sm font-bold text-slate-400 mt-2">Successfully posted</p>
                </div>

                {/* Metric 3 */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 relative overflow-hidden">
                    <div
                        className="absolute bottom-0 left-0 h-1.5 bg-rose-500 transition-all duration-1000 ease-out"
                        style={{ width: `${Math.min(completionPercentage, 100)}%` }}
                    />
                    <div className="flex justify-between items-start mb-4">
                        <span className="text-xs font-black uppercase tracking-widest text-rose-500">Completion %</span>
                        <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
                            <BarChart3 size={16} />
                        </div>
                    </div>
                    <span className="text-4xl font-black text-slate-800">{completionPercentage.toFixed(0)}%</span>
                    <p className="text-sm font-bold text-slate-400 mt-2">Of monthly target</p>
                </div>

                {/* Metric 4 */}
                <div className="bg-gradient-to-br from-orange-500 to-rose-600 rounded-3xl p-6 shadow-md text-white border border-rose-400/50">
                    <div className="flex justify-between items-start mb-4">
                        <span className="text-xs font-black uppercase tracking-widest text-rose-100">Content Streak</span>
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white">
                            <Flame size={16} />
                        </div>
                    </div>
                    <span className="text-4xl font-black">{currentStreak}</span>
                    <p className="text-sm font-bold text-rose-100 mt-2">Weeks meeting target</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Weekly Target Progress Block */}
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
                    <h4 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                        <Target className="text-indigo-500" />
                        Current Week Progress
                    </h4>

                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-slate-500">Published This Week</span>
                        <span className="text-sm font-black text-slate-800">{publishedThisWeek} / {weeklyTarget}</span>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-3 mb-6 relative overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-1000 ${publishedThisWeek >= weeklyTarget ? 'bg-emerald-500' : 'bg-indigo-500'
                                }`}
                            style={{ width: `${Math.min((publishedThisWeek / (Math.max(weeklyTarget, 1))) * 100, 100)}%` }}
                        />
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        {publishedThisWeek >= weeklyTarget && weeklyTarget > 0 ? (
                            <p className="text-sm font-bold text-emerald-600 flex items-center gap-2">
                                <CheckCircle2 size={16} /> Weekly target dominated.
                            </p>
                        ) : activeMonthData ? (
                            <p className="text-sm font-bold text-slate-500">
                                You need to publish <span className="text-indigo-600 font-black">{Math.max(0, weeklyTarget - publishedThisWeek)}</span> more videos this week to stay on track.
                            </p>
                        ) : (
                            <p className="text-sm font-bold text-slate-400">Initialize a plan to set weekly targets.</p>
                        )}
                    </div>
                </div>

                {/* Additional Insights or Empty State */}
                <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-white shadow-sm rounded-full flex items-center justify-center mb-4 text-slate-300">
                        <Video size={32} />
                    </div>
                    <h4 className="text-lg font-black text-slate-700 mb-2">Build The Pipeline</h4>
                    <p className="text-sm font-medium text-slate-500 max-w-sm">
                        Use the Monthly Planner to map out your content logic. Convert ideas into scripted assets, and execute consistently.
                    </p>
                </div>
            </div>

        </div>
    );
};

export default Dashboard;
