
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Client, Project, Lead } from '../types';
import { TrendingUp, Users, ClipboardList, Clock } from 'lucide-react';

interface DashboardProps {
  clients: Client[];
  projects: Project[];
  leads: Lead[];
}

const mockFinancialData = [
  { name: 'Jan', revenue: 4000, expenses: 2400 },
  { name: 'Feb', revenue: 3000, expenses: 1398 },
  { name: 'Mar', revenue: 2000, expenses: 9800 },
  { name: 'Apr', revenue: 2780, expenses: 3908 },
  { name: 'May', revenue: 1890, expenses: 4800 },
  { name: 'Jun', revenue: 2390, expenses: 3800 },
];

const StatCard = ({ title, value, icon: Icon, color }: any) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
    <div>
      <p className="text-sm text-slate-500 font-medium">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800 mt-1">{value}</h3>
    </div>
    <div className={`p-3 rounded-xl bg-${color}-50 text-${color}-600`}>
      <Icon size={24} />
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ clients, projects, leads }) => {
  const activeProjects = projects.filter(p => p.status !== 'Closed' && p.status !== 'Completed');
  const totalRevenue = projects.reduce((acc, p) => acc + p.totalAmount, 0);

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Thanda Analysis Section */}
      <section className="bg-blue-600 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-blue-500/10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-bold">Thanda Analysis</h2>
            <p className="text-blue-100 text-sm md:text-base">Strength, Weakness & Financial Analysis Report</p>
          </div>
          <button className="bg-white/20 hover:bg-white/30 transition-colors px-4 py-2 rounded-lg text-xs md:text-sm font-semibold backdrop-blur-sm self-stretch md:self-auto text-center">
            Export Report
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <div className="bg-white/10 p-5 rounded-2xl backdrop-blur-sm border border-white/10">
            <h4 className="text-sm font-bold mb-2 uppercase tracking-wider text-blue-200">Strengths</h4>
            <ul className="text-sm space-y-1 list-disc list-inside opacity-90">
              <li>High average revenue per project</li>
              <li>Strong graphic design portfolio</li>
              <li>Lead conversion rate up 12%</li>
            </ul>
          </div>
          <div className="bg-white/10 p-5 rounded-2xl backdrop-blur-sm border border-white/10">
            <h4 className="text-sm font-bold mb-2 uppercase tracking-wider text-blue-200">Opportunities</h4>
            <ul className="text-sm space-y-1 list-disc list-inside opacity-90">
              <li>High demand for Mobile Dev</li>
              <li>Unused environment data study</li>
              <li>Referral program potential</li>
            </ul>
          </div>
          <div className="bg-white/10 p-5 rounded-2xl backdrop-blur-sm border border-white/10">
            <h4 className="text-sm font-bold mb-2 uppercase tracking-wider text-blue-200">Next Month Plan</h4>
            <p className="text-sm opacity-90">Improve response time for environment data task and scale digital marketing team.</p>
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Clients" value={clients.length} icon={Users} color="blue" />
        <StatCard title="Active Projects" value={activeProjects.length} icon={ClipboardList} color="emerald" />
        <StatCard title="Sales Leads" value={leads.length} icon={TrendingUp} color="indigo" />
        <StatCard title="Total Revenue" value={`₹${totalRevenue}`} icon={Clock} color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {/* Financial Status Chart */}
        <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Revenue Overview</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockFinancialData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lead Conversion Logic */}
        <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Lead Distribution</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Cold', count: leads.filter(l => l.status === 'Cold').length },
                { name: 'Warm', count: leads.filter(l => l.status === 'Warm').length },
                { name: 'Hot', count: leads.filter(l => l.status === 'Hot').length },
                { name: 'Today', count: leads.filter(l => l.status === 'Lead Today').length },
              ]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#818cf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
