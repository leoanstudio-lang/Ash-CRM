import React, { useMemo } from 'react';
import { Lead, Client, Service, Campaign } from '../types';
import {
  Users,
  Target,
  TrendingUp,
  MousePointer2,
  PieChart as PieChartIcon,
  BarChart3,
  Activity,
  ArrowUpRight,
  Send,
  MessageSquare,
  CheckCircle2
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';

interface SalesDashboardProps {
  leads: Lead[];
  setLeads?: React.Dispatch<React.SetStateAction<Lead[]>>;
  setClients?: React.Dispatch<React.SetStateAction<Client[]>>;
  services: Service[];
  campaigns?: Campaign[];
  campaignProspects?: any[];
  activeDeals?: any[];
  nurturingLeads?: any[];
  noResponseLeads?: any[];
  suppressedLeads?: any[];
  inboundSources?: any[];
  inboundLeads?: any[];
  inboundActiveDeals?: any[];
  inboundNurturing?: any[];
  inboundNoResponseLeads?: any[];
  inboundSuppressedLeads?: any[];
}

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308'];

const SalesDashboard: React.FC<SalesDashboardProps> = ({
  campaigns = [],
  campaignProspects = [],
  activeDeals = [],
  nurturingLeads = [],
  noResponseLeads = [],
  inboundSources = [],
  inboundLeads = [],
  inboundActiveDeals = [],
  inboundNurturing = [],
  inboundNoResponseLeads = []
}) => {
  // --- Data Aggregation ---
  const stats = useMemo(() => {
    const totalOutboundProspects = (campaignProspects?.length || 0);
    const totalInboundProspects = (inboundLeads?.length || 0);
    const totalReach = totalOutboundProspects + totalInboundProspects;

    const totalActivePipeline = (activeDeals?.length || 0) + (inboundActiveDeals?.length || 0);

    // Calculate contacted count (prospects who have been sent a message or replied)
    const contactedCount =
      campaignProspects.filter(p => p.outboundStatus !== 'Not Contacted').length +
      inboundLeads.filter(p => p.outboundStatus !== 'Not Contacted').length;

    // Calculate won count from active deals (those in 'Closed Won' stage)
    const wonCount =
      activeDeals.filter(d => d.outboundStage === 'Closed Won').length +
      inboundActiveDeals.filter(d => d.outboundStage === 'Closed Won').length;

    // Simple conversion: % of reach that became an active deal
    const conversionRate = totalReach > 0
      ? ((totalActivePipeline / totalReach) * 100).toFixed(1)
      : '0.0';

    const totalNurturing = (nurturingLeads?.length || 0) + (inboundNurturing?.length || 0);

    return { totalReach, totalActivePipeline, conversionRate, totalNurturing, totalInboundProspects, totalOutboundProspects, contactedCount, wonCount };
  }, [campaignProspects, inboundLeads, activeDeals, inboundActiveDeals, nurturingLeads, inboundNurturing]);

  // --- Chart Data: Inbound vs Outbound ---
  const mixData = [
    { name: 'Inbound', value: stats.totalInboundProspects },
    { name: 'Outbound', value: stats.totalOutboundProspects },
  ].filter(d => d.value > 0);

  // --- Chart Data: Sales Growth Trend (Professional Line/Area Graph) ---
  const trendData = useMemo(() => {
    const days = 14;
    const data = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const label = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

      // Count items created on this date
      const newProspects =
        campaignProspects.filter(p => p.createdAt?.startsWith(dateStr)).length +
        inboundLeads.filter(p => p.createdAt?.startsWith(dateStr)).length;

      const newDeals =
        activeDeals.filter(d => d.createdAt?.startsWith(dateStr)).length +
        inboundActiveDeals.filter(d => d.createdAt?.startsWith(dateStr)).length;

      data.push({ name: label, prospects: newProspects, deals: newDeals });
    }
    return data;
  }, [campaignProspects, inboundLeads, activeDeals, inboundActiveDeals]);

  // --- Chart Data: Channel Engagement (Mock/Aggregated) ---
  const channelData = useMemo(() => {
    const counts: Record<string, number> = {};
    [...campaigns, ...inboundSources].forEach(c => {
      const channel = c.channel || 'Other';
      counts[channel] = (counts[channel] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [campaigns, inboundSources]);
  // --- Data Aggregation: Recent Activities ---
  const recentActivities = useMemo(() => {
    const allActivities: any[] = [];

    [...activeDeals, ...inboundActiveDeals].forEach(deal => {
      if (deal.activities) {
        deal.activities.forEach((act: any) => {
          allActivities.push({
            ...act,
            contactName: deal.contactName || deal.name || 'Unknown',
            company: deal.companyName || deal.projectName || 'Individual'
          });
        });
      }
    });

    return allActivities
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [activeDeals, inboundActiveDeals]);

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">

      {/* 1. Header & Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Reach"
          value={stats.totalReach.toLocaleString()}
          icon={<Users className="text-blue-600" />}
          trend="+12% from last week"
          color="blue"
        />
        <StatCard
          title="Active Pipeline"
          value={stats.totalActivePipeline.toLocaleString()}
          icon={<Target className="text-purple-600" />}
          trend="8 High priority"
          color="purple"
        />
        <StatCard
          title="Conversion Rate"
          value={`${stats.conversionRate}%`}
          icon={<TrendingUp className="text-emerald-600" />}
          trend="Top 5% of industry"
          color="emerald"
        />
        <StatCard
          title="Total Nurturing"
          value={stats.totalNurturing.toLocaleString()}
          icon={<Activity className="text-amber-600" />}
          trend="Next follow-up: Today"
          color="amber"
        />
      </div>

      {/* 2. Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Sales Growth Trend */}
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Sales Growth Trend</h3>
              <p className="text-xs text-slate-500 font-medium">New prospects vs. active deals over the last 14 days</p>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Activity size={20} />
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorProspects" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorDeals" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                <Area type="monotone" dataKey="prospects" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorProspects)" name="New Prospects" />
                <Area type="monotone" dataKey="deals" stroke="#ec4899" strokeWidth={3} fillOpacity={1} fill="url(#colorDeals)" name="Active Deals" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lead Source Distribution */}
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Sales Mix</h3>
              <p className="text-xs text-slate-500 font-medium">Inbound vs. Outbound distribution</p>
            </div>
            <div className="p-3 bg-pink-50 text-pink-600 rounded-2xl">
              <PieChartIcon size={20} />
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={mixData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {mixData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={8} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3. Lower Section: Engagement & Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Top Channels */}
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Channel Engagement</h3>
              <p className="text-xs text-slate-500 font-medium">Productivity per channel source</p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <MousePointer2 size={20} />
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity List */}
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Recent Sales Activity</h3>
              <p className="text-xs text-slate-500 font-medium">The latest updates from your sales pipeline</p>
            </div>
            {recentActivities.length > 0 && (
              <button className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-colors">View All</button>
            )}
          </div>
          <div className="space-y-4">
            {recentActivities.length > 0 ? (
              recentActivities.map((act) => (
                <ActivityItem
                  key={act.id}
                  icon={act.type === 'stage_move' ? <Target size={14} /> : act.type === 'note' ? <MessageSquare size={14} /> : <Activity size={14} />}
                  title={act.description}
                  subtitle={`${act.contactName} · ${act.company}`}
                  time={new Date(act.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  color={act.type === 'stage_move' ? 'indigo' : act.type === 'note' ? 'purple' : 'blue'}
                />
              ))
            ) : (
              <div className="py-12 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No activities yet</p>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

// --- Helper Components ---

const StatCard = ({ title, value, icon, trend, color }: any) => (
  <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-lg hover:shadow-xl transition-all group overflow-hidden relative">
    <div className={`absolute top-0 right-0 w-24 h-24 -mt-8 -mr-8 bg-${color}-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500`}></div>
    <div className="relative">
      <div className={`w-12 h-12 rounded-2xl bg-${color}-50 flex items-center justify-center mb-4 border border-${color}-100`}>
        {icon}
      </div>
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{title}</h4>
      <p className="text-3xl font-black text-slate-800 tracking-tighter mb-2">{value}</p>
      <p className={`text-[10px] font-bold ${color === 'emerald' ? 'text-emerald-500' : 'text-slate-500'} flex items-center gap-1`}>
        {trend} <ArrowUpRight size={12} />
      </p>
    </div>
  </div>
);

const ActivityItem = ({ icon, title, subtitle, time, color }: any) => {
  const colorMap: any = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100'
  };
  return (
    <div className="flex items-center gap-4 p-4 rounded-3xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${colorMap[color]}`}>
        {icon}
      </div>
      <div className="flex-1">
        <h5 className="text-xs font-black text-slate-800 leading-tight">{title}</h5>
        <p className="text-[10px] text-slate-500 font-bold mt-0.5">{subtitle}</p>
      </div>
      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{time}</div>
    </div>
  );
};

export default SalesDashboard;
