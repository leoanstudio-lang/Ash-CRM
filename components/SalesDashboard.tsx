import React, { useMemo } from 'react';
import { Lead, Client, Service, Campaign } from '../types';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
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
  CheckCircle2,
  Award,
  DollarSign,
  Landmark
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
  currentUser?: any;
  employees?: any[];
  onInspectEmployee?: (employee: any) => void;
}

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308'];

const SalesDashboard: React.FC<SalesDashboardProps> = ({
  campaigns = [],
  campaignProspects: rawCampaignProspects = [],
  activeDeals: rawActiveDeals = [],
  nurturingLeads: rawNurturingLeads = [],
  noResponseLeads = [],
  inboundSources = [],
  inboundLeads: rawInboundLeads = [],
  inboundActiveDeals: rawInboundActiveDeals = [],
  inboundNurturing: rawInboundNurturing = [],
  inboundNoResponseLeads = [],
  currentUser,
  employees = [],
  onInspectEmployee
}) => {
  const [selectedRepId, setSelectedRepId] = React.useState<string>('all');
  const [dateRange, setDateRange] = React.useState<string>('this_month');
  const [incentiveSettings, setIncentiveSettings] = React.useState<any>({
    minimumTarget: 30000,
    outboundRatio: 0.06,
    inboundRatio: 0.03
  });

  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'config', 'incentive_settings');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setIncentiveSettings(docSnap.data());
        }
      } catch (err) {
        console.error('Error fetching settings in dashboard:', err);
      }
    };
    fetchSettings();
  }, []);

  const isWithinDateRange = React.useCallback((item: any, range: string, forceDate?: string) => {
    // forceDate lets callers override which date field to use
    const itemDateStr = forceDate
      || item.closedAt          // closed won deals: use actual close date
      || item.stageEnteredAt    // stage moves
      || item.createdAt
      || item.dateAdded
      || item.date;
    if (!itemDateStr) return true;
    
    const itemDate = new Date(itemDateStr);
    const now = new Date();
    
    if (range === 'today') {
      return itemDate.toDateString() === now.toDateString();
    }
    if (range === 'last_7_days') {
      const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      return itemDate >= sevenDaysAgo;
    }
    if (range === 'this_month') {
      return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
    }
    if (range === 'last_month') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return itemDate.getMonth() === lastMonth.getMonth() && itemDate.getFullYear() === lastMonth.getFullYear();
    }
    if (range === 'last_30_days') {
      const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
      return itemDate >= thirtyDaysAgo;
    }
    return true;
  }, []);

  const campaignProspects = useMemo(() => {
    let list = rawCampaignProspects;
    if (selectedRepId !== 'all') {
      list = list.filter(p => p.assignedEmployeeId === selectedRepId);
    }
    return list.filter(p => isWithinDateRange(p, dateRange));
  }, [rawCampaignProspects, selectedRepId, dateRange, isWithinDateRange]);

  const activeDeals = useMemo(() => {
    let list = rawActiveDeals;
    if (selectedRepId !== 'all') {
      list = list.filter(d => d.assignedEmployeeId === selectedRepId);
    }
    return list.filter(d => {
      // Closed Won: filter by closedAt (when they actually closed), not createdAt
      if (d.outboundStage === 'Closed Won') {
        const closedDate = d.closedAt || d.stageEnteredAt;
        return isWithinDateRange(d, dateRange, closedDate);
      }
      // Pipeline deals: filter by createdAt
      return isWithinDateRange(d, dateRange);
    });
  }, [rawActiveDeals, selectedRepId, dateRange, isWithinDateRange]);

  const nurturingLeads = useMemo(() => {
    let list = rawNurturingLeads;
    if (selectedRepId !== 'all') {
      list = list.filter(l => l.assignedEmployeeId === selectedRepId);
    }
    return list.filter(l => isWithinDateRange(l, dateRange));
  }, [rawNurturingLeads, selectedRepId, dateRange, isWithinDateRange]);

  const inboundLeads = useMemo(() => {
    let list = rawInboundLeads;
    if (selectedRepId !== 'all') {
      list = list.filter(l => l.assignedEmployeeId === selectedRepId);
    }
    return list.filter(l => isWithinDateRange(l, dateRange));
  }, [rawInboundLeads, selectedRepId, dateRange, isWithinDateRange]);

  const inboundActiveDeals = useMemo(() => {
    let list = rawInboundActiveDeals;
    if (selectedRepId !== 'all') {
      list = list.filter(d => d.assignedEmployeeId === selectedRepId);
    }
    return list.filter(d => {
      if (d.outboundStage === 'Closed Won') {
        const closedDate = d.closedAt || d.stageEnteredAt;
        return isWithinDateRange(d, dateRange, closedDate);
      }
      return isWithinDateRange(d, dateRange);
    });
  }, [rawInboundActiveDeals, selectedRepId, dateRange, isWithinDateRange]);

  const inboundNurturing = useMemo(() => {
    let list = rawInboundNurturing;
    if (selectedRepId !== 'all') {
      list = list.filter(l => l.assignedEmployeeId === selectedRepId);
    }
    return list.filter(l => isWithinDateRange(l, dateRange));
  }, [rawInboundNurturing, selectedRepId, dateRange, isWithinDateRange]);
  // --- Data Aggregation ---
  const stats = useMemo(() => {
    const totalOutboundProspects = (campaignProspects?.length || 0);
    const totalInboundProspects = (inboundLeads?.length || 0);
    const totalReach = totalOutboundProspects + totalInboundProspects;

    // Active pipeline = non-closed deals within date range
    const totalActivePipeline =
      activeDeals.filter(d => d.outboundStage !== 'Closed Won').length +
      inboundActiveDeals.filter(d => d.outboundStage !== 'Closed Won').length;

    // Calculate contacted count (prospects who have been sent a message or replied)
    const contactedCount =
      campaignProspects.filter(p => p.outboundStatus !== 'Not Contacted').length +
      inboundLeads.filter(p => p.outboundStatus !== 'Not Contacted').length;

    // Won deals — always use the full (Closed Won-always-included) activeDeals lists
    const wonDeals = [
      ...activeDeals.filter(d => d.outboundStage === 'Closed Won'),
      ...inboundActiveDeals.filter(d => d.outboundStage === 'Closed Won')
    ];
    const wonCount = wonDeals.length;
    const totalSalesValue = wonDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);

    // Simple conversion: % of reach that became an active deal
    const conversionRate = totalReach > 0
      ? ((totalActivePipeline / totalReach) * 100).toFixed(1)
      : '0.0';

    const closingRatio = (totalActivePipeline + wonCount) > 0
      ? ((wonCount / (totalActivePipeline + wonCount)) * 100).toFixed(1)
      : '0.0';

    const totalNurturing = (nurturingLeads?.length || 0) + (inboundNurturing?.length || 0);

    return { totalReach, totalActivePipeline, conversionRate, closingRatio, totalNurturing, totalInboundProspects, totalOutboundProspects, contactedCount, wonCount, totalSalesValue };
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

  // --- Incentive Payout & History Memos ---
  const repClosedWonDeals = useMemo(() => {
    const outboundClosed = activeDeals
      .filter(d => d.outboundStage === 'Closed Won')
      .map(d => ({
        ...d,
        isOutbound: true,
        valNum: Number(d.value) || 0
      }));

    const inboundClosed = inboundActiveDeals
      .filter(d => d.outboundStage === 'Closed Won')
      .map(d => ({
        ...d,
        isOutbound: false,
        valNum: Number(d.value) || 0
      }));

    const allClosed = [...outboundClosed, ...inboundClosed];

    // Group deals by representative to check cumulative target thresholds
    const dealsByRep: Record<string, typeof allClosed> = {};
    allClosed.forEach(d => {
      const repId = d.assignedEmployeeId || 'unassigned';
      if (!dealsByRep[repId]) dealsByRep[repId] = [];
      dealsByRep[repId].push(d);
    });

    const mappedDeals = Object.entries(dealsByRep).flatMap(([repId, repDeals]) => {
      const totalSalesValue = repDeals.reduce((sum, d) => sum + d.valNum, 0);
      const targetMet = totalSalesValue >= (incentiveSettings?.minimumTarget ?? 30000);

      return repDeals.map(d => {
        let commission = d.incentiveAmount;
        if (commission === undefined) {
          if (targetMet) {
            const ratio = d.isOutbound
              ? (incentiveSettings?.outboundRatio ?? 0.06)
              : (incentiveSettings?.inboundRatio ?? 0.03);
            commission = Math.round(d.valNum * ratio);
          } else {
            commission = 0;
          }
        }
        return {
          ...d,
          commission
        };
      });
    });

    return mappedDeals.sort((a, b) => {
      const dateA = new Date(a.stageEnteredAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.stageEnteredAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [activeDeals, inboundActiveDeals, incentiveSettings]);

  const incentiveTotals = useMemo(() => {
    let pending = 0;
    let paid = 0;
    repClosedWonDeals.forEach(d => {
      if (d.incentiveStatus === 'Paid') {
        paid += d.commission;
      } else {
        pending += d.commission;
      }
    });
    return { pending, paid, total: pending + paid };
  }, [repClosedWonDeals]);

  const incentiveGraphData = useMemo(() => {
    const data = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const label = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

      // Find outbound & inbound won deals closed on this date
      const outboundOnDate = activeDeals.filter(d => d.outboundStage === 'Closed Won' && (d.stageEnteredAt || d.createdAt)?.startsWith(dateStr));
      const inboundOnDate = inboundActiveDeals.filter(d => d.outboundStage === 'Closed Won' && (d.stageEnteredAt || d.createdAt)?.startsWith(dateStr));

      let commTotal = 0;
      outboundOnDate.forEach(od => {
        const matched = repClosedWonDeals.find(rcd => rcd.id === od.id && rcd.isOutbound);
        if (matched) commTotal += matched.commission;
      });
      inboundOnDate.forEach(id => {
        const matched = repClosedWonDeals.find(rcd => rcd.id === id && !rcd.isOutbound);
        if (matched) commTotal += matched.commission;
      });

      data.push({ name: label, amount: commTotal });
    }
    return data;
  }, [activeDeals, inboundActiveDeals, repClosedWonDeals]);

  // --- Chart Data: Channel Engagement (Mock/Aggregated) ---
  const channelData = useMemo(() => {
    const counts: Record<string, number> = {};
    [...campaigns, ...inboundSources].forEach(c => {
      const channel = c.channel || 'Other';
      counts[channel] = (counts[channel] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [campaigns, inboundSources]);
  // --- Sales Reps Aggregation for Admin View ---
  const isAdmin = !currentUser || currentUser.role === 'admin' || currentUser.role === 'super_admin';

  const salesEmployees = useMemo(() => {
    return employees.filter(e => 
      e.role === 'employee' && 
      (e.department?.toLowerCase().includes('sales') || e.department?.toLowerCase() === 'sales')
    );
  }, [employees]);

  const repStats = useMemo(() => {
    return salesEmployees.map(rep => {
      const repProspects = campaignProspects.filter(p => p.assignedEmployeeId === rep.id);
      const repInbound = inboundLeads.filter(l => l.assignedEmployeeId === rep.id);
      const repReach = repProspects.length + repInbound.length;

      const repActiveOutbound = activeDeals.filter(d => d.assignedEmployeeId === rep.id);
      const repActiveInbound = inboundActiveDeals.filter(d => d.assignedEmployeeId === rep.id);
      const repPipeline = repActiveOutbound.length + repActiveInbound.length;

      const repWonOutbound = repActiveOutbound.filter(d => d.outboundStage === 'Closed Won');
      const repWonInbound = repActiveInbound.filter(d => d.outboundStage === 'Closed Won');
      const repWonCount = repWonOutbound.length + repWonInbound.length;

      const repValue = [...repWonOutbound, ...repWonInbound].reduce((sum, d) => sum + (Number(d.value) || 0), 0);

      const repClosingRatio = repPipeline > 0
        ? ((repWonCount / repPipeline) * 100).toFixed(1)
        : '0.0';

      return {
        rep,
        reach: repReach,
        pipeline: repPipeline,
        won: repWonCount,
        value: repValue,
        closingRatio: repClosingRatio
      };
    });
  }, [salesEmployees, campaignProspects, inboundLeads, activeDeals, inboundActiveDeals]);

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

      {/* Date & Filter Header */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 leading-tight">
            {isAdmin ? 'Sales CRM Overview' : 'My Performance Dashboard'}
          </h2>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
            {isAdmin ? 'Aggregate performance metrics and charts' : 'Track your personal sales targets and statistics'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Period:</span>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-800 outline-none focus:border-slate-400 shadow-sm"
            >
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="last_7_days">Last 7 Days</option>
              <option value="today">Today</option>
              <option value="all_time">All Time</option>
            </select>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Representative:</span>
              <select
                value={selectedRepId}
                onChange={(e) => setSelectedRepId(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-800 outline-none focus:border-slate-400 shadow-sm"
              >
                <option value="all">All Representatives</option>
                {salesEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 1. Header & Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard
          title="Total Reach"
          value={stats.totalReach.toLocaleString()}
          icon={<Users className="text-blue-600" />}
          trend={`${stats.totalInboundProspects} Inbound · ${stats.totalOutboundProspects} Outbound`}
          color="blue"
        />
        <StatCard
          title="Active Pipeline"
          value={stats.totalActivePipeline.toLocaleString()}
          icon={<Target className="text-purple-600" />}
          trend={`${stats.totalNurturing} Nurturing leads`}
          color="purple"
        />
        <StatCard
          title="Total Sales Value"
          value={`₹${stats.totalSalesValue.toLocaleString()}`}
          icon={<TrendingUp className="text-emerald-600" />}
          trend="From closed won deals"
          color="emerald"
        />
        <StatCard
          title="Deals Closed"
          value={`${stats.wonCount} Won`}
          icon={<CheckCircle2 className="text-amber-600" />}
          trend={`${stats.closingRatio}% Closing Ratio`}
          color="amber"
        />
        <StatCard
          title="Pending Payout"
          value={`₹${incentiveTotals.pending.toLocaleString()}`}
          icon={<Award className="text-indigo-600" />}
          trend={`₹${incentiveTotals.paid.toLocaleString()} Paid`}
          color="indigo"
        />
      </div>

      {/* 2. Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Sales Growth Trend */}
        <div className="lg:col-span-2 bg-white rounded-lg p-5 border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Sales Growth Trend</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">New prospects vs. active deals over the last 14 days</p>
            </div>
            <div className="w-8 h-8 rounded bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500">
              <Activity size={16} />
            </div>
          </div>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorProspects" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.05} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorDeals" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.05} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '0.5rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)' }}
                />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '15px', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                <Area type="monotone" dataKey="prospects" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorProspects)" name="New Prospects" />
                <Area type="monotone" dataKey="deals" stroke="#ec4899" strokeWidth={2.5} fillOpacity={1} fill="url(#colorDeals)" name="Active Deals" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lead Source Distribution */}
        <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Sales Mix</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Inbound vs. Outbound distribution</p>
            </div>
            <div className="w-8 h-8 rounded bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500">
              <PieChartIcon size={16} />
            </div>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={mixData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={6}
                  dataKey="value"
                >
                  {mixData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={4} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '0.5rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)' }}
                />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3. Lower Section: Engagement & Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top Channels */}
        <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Channel Engagement</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Productivity per channel source</p>
            </div>
            <div className="w-8 h-8 rounded bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500">
              <MousePointer2 size={16} />
            </div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '0.5rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)' }}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={25} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity List */}
        <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Recent Sales Activity</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">The latest updates from your sales pipeline</p>
            </div>
            {recentActivities.length > 0 && (
              <button className="text-[9px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors">View All</button>
            )}
          </div>
          <div className="space-y-1">
            {recentActivities.length > 0 ? (
              recentActivities.map((act) => (
                <ActivityItem
                  key={act.id}
                  icon={act.type === 'stage_move' ? <Target size={13} /> : act.type === 'note' ? <MessageSquare size={13} /> : <Activity size={13} />}
                  title={act.description}
                  subtitle={`${act.contactName} · ${act.company}`}
                  time={new Date(act.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                />
              ))
            ) : (
              <div className="py-12 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No activities yet</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 3.5. Representative Payouts & History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Incentives Graph */}
        <div className="lg:col-span-1 bg-white rounded-lg p-5 border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Incentive Earnings</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Commissions earned over the last 14 days</p>
            </div>
            <div className="w-8 h-8 rounded bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={incentiveGraphData}>
                <defs>
                  <linearGradient id="colorIncentives" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.05} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '0.5rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)' }}
                />
                <Area type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill="url(#colorIncentives)" name="Commission Earned (₹)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Incentives Ledger List */}
        <div className="lg:col-span-2 bg-white rounded-lg p-5 border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Payout Ledger History</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Commissions and status of closed transactions</p>
            </div>
            <div className="w-8 h-8 rounded bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500">
              <Award size={16} />
            </div>
          </div>
          <div className="overflow-y-auto max-h-[250px] border border-slate-150 rounded">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[8px] font-bold uppercase text-slate-400 tracking-wider">
                  <th className="py-2 px-3">Deal Details</th>
                  <th className="py-2 px-3">Closed Date</th>
                  <th className="py-2 px-3">Value</th>
                  <th className="py-2 px-3">Commission</th>
                  <th className="py-2 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[10px]">
                {repClosedWonDeals.map((deal) => (
                  <tr key={deal.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2 px-3">
                      <span className="font-bold text-slate-800 block leading-tight">{deal.name}</span>
                      <span className={`inline-block px-1 py-0.2 rounded text-[7px] font-black uppercase mt-0.5 ${deal.isOutbound ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                        {deal.isOutbound ? 'Outbound' : 'Inbound'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-500">
                      {deal.stageEnteredAt ? new Date(deal.stageEnteredAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Unknown'}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-700">
                      ₹{Number(deal.value || 0).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 font-black text-emerald-600">
                      ₹{deal.commission.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                        deal.incentiveStatus === 'Paid'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {deal.incentiveStatus === 'Paid' ? 'Paid ✓' : 'Unpaid'}
                      </span>
                    </td>
                  </tr>
                ))}
                {repClosedWonDeals.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                      No payouts found for this representative/period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. Sales Reps Cards Grid for Admins */}
      {isAdmin && (
        <div className="space-y-5">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-sm font-bold text-slate-900 leading-tight">Sales Representatives</h3>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Click an agent's card to inspect their sales pipelines, inbound lists, and outbound campaigns.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {repStats.map(({ rep, reach, pipeline, won, value, closingRatio }) => (
              <div 
                key={rep.id} 
                className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm hover:border-slate-350 transition duration-200 flex flex-col justify-between relative"
              >
                <div className="space-y-4">
                  {/* Rep Header */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-50 text-slate-700 rounded border border-slate-200 flex items-center justify-center font-bold text-sm shrink-0">
                      {rep.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-800 leading-tight">{rep.name}</h4>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">{rep.department || 'Sales Representative'}</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-slate-100 w-full"></div>

                  {/* Metrics List */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-450 font-bold">Total Reach</span>
                      <span className="font-bold text-slate-700">{reach.toLocaleString()} prospects</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-450 font-bold">Active Pipeline</span>
                      <span className="font-bold text-slate-700">{pipeline.toLocaleString()} deals</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-450 font-bold">Deals Won</span>
                      <span className="font-bold text-emerald-600">{won} won</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-450 font-bold">Closing Ratio</span>
                      <span className="font-bold text-slate-800">{closingRatio}%</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-slate-100 w-full"></div>

                  {/* Total Value */}
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Closed Won Value</span>
                    <span className="text-sm font-bold text-slate-900">₹{value.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  onClick={() => onInspectEmployee && onInspectEmployee(rep)}
                  className="w-full mt-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider rounded transition duration-200"
                >
                  Open Sales Workflow
                </button>
              </div>
            ))}

            {repStats.length === 0 && (
              <div className="col-span-full bg-white rounded-lg p-12 text-center border border-slate-200 shadow-sm">
                <p className="text-slate-450 font-bold text-xs">No sales representatives registered in this department yet.</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

// --- Helper Components ---

const StatCard = ({ title, value, icon, trend }: any) => (
  <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm transition-all flex flex-col justify-between min-h-[140px]">
    <div className="flex justify-between items-start gap-4">
      <div className="space-y-1">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</h4>
        <p className="text-2xl font-bold text-slate-900 tracking-tight">{value}</p>
      </div>
      <div className="w-8 h-8 rounded bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
        {icon}
      </div>
    </div>
    <div className="text-[10px] text-slate-450 font-bold mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5">
      {trend}
    </div>
  </div>
);

const ActivityItem = ({ icon, title, subtitle, time }: any) => {
  return (
    <div className="flex items-center gap-3.5 py-2.5 border-b border-slate-100 last:border-b-0">
      <div className="w-8 h-8 rounded bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h5 className="text-xs font-bold text-slate-800 truncate">{title}</h5>
        <p className="text-[10.5px] text-slate-450 font-medium truncate mt-0.5">{subtitle}</p>
      </div>
      <div className="text-[9px] font-bold text-slate-400 shrink-0">{time}</div>
    </div>
  );
};

export default SalesDashboard;
