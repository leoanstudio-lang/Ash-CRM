import React, { useState } from 'react';
import { ContentMonth, ContentCard, ContentAsset } from '../../types';
import { Video, CalendarDays, Library, Activity, TrendingUp } from 'lucide-react';
import Dashboard from './Dashboard';
import MonthlyPlanner from './MonthlyPlanner';
import ContentLibrary from './ContentLibrary';
import PerformanceTracker from './PerformanceTracker';

interface ContentStudioProps {
    months: ContentMonth[];
    cards: ContentCard[];
    assets: ContentAsset[];
}

export type ContentTab = 'dashboard' | 'planner' | 'library' | 'performance';

const ContentStudio: React.FC<ContentStudioProps> = ({ months, cards, assets }) => {
    const [activeTab, setActiveTab] = useState<ContentTab>('dashboard');

    const renderTab = () => {
        switch (activeTab) {
            case 'dashboard':
                return <Dashboard months={months} cards={cards} />;
            case 'planner':
                return <MonthlyPlanner months={months} cards={cards} />;
            case 'library':
                return <ContentLibrary assets={assets} />;
            case 'performance':
                return <PerformanceTracker cards={cards} />;
            default:
                return <Dashboard months={months} cards={cards} />;
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
            {/* Module Header */}
            <div className="mb-8">
                <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
                    <Video className="text-rose-500" size={32} />
                    Content Studio
                </h2>
                <p className="text-slate-500 font-medium mt-2">
                    Professional content planning, pipeline execution, and performance analytics.
                </p>
            </div>

            {/* Navigation Tabs */}
            <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-8 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'dashboard'
                        ? 'bg-white text-rose-600 shadow-sm border border-slate-200/50'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                >
                    <Activity size={18} />
                    Dashboard
                </button>
                <button
                    onClick={() => setActiveTab('planner')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'planner'
                        ? 'bg-white text-rose-600 shadow-sm border border-slate-200/50'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                >
                    <CalendarDays size={18} />
                    Monthly Planner
                </button>
                <button
                    onClick={() => setActiveTab('library')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'library'
                        ? 'bg-white text-rose-600 shadow-sm border border-slate-200/50'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                >
                    <Library size={18} />
                    Content Library
                </button>
                <button
                    onClick={() => setActiveTab('performance')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'performance'
                        ? 'bg-white text-rose-600 shadow-sm border border-slate-200/50'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                >
                    <TrendingUp size={18} /> {/* Need to import this if used, will adjust */}
                    Performance Tracker
                </button>
            </div>

            {/* Tab Content */}
            <div className="bg-slate-50/50 rounded-3xl min-h-[500px]">
                {renderTab()}
            </div>
        </div>
    );
};

export default ContentStudio;
