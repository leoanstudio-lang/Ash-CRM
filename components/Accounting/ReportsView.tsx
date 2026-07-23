import React, { useState, useMemo, useEffect } from 'react';
import { JournalEntry, AccountingCategory, AccountingAsset, AccountingLoan, FinancialAccount, Vendor, CompanyProfile } from '../../types';
import {
  buildBalanceSheetStructure,
  buildProfitAndLossStructure,
  buildCashPositionStructure,
  buildTrialBalanceStructure,
  ReportGroup,
} from '../../lib/reportMappingLayer';
import {
  ReportingContext,
  getBalanceSheet,
  getProfitAndLoss,
  getCashPosition,
  getGeneralLedger
} from '../../lib/financialReportingEngine';
import {
  generateSingleFinancialReportPDF,
  generateGenericReportPDF,
  generateMasterFinancialPackagePDF,
  FinancialReportData
} from '../../lib/pdfReportEngine';
import { getCompanyProfile } from '../../lib/db';
import {
  FileText, Calendar, Printer, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight,
  Filter, Search, ArrowUpRight, Wallet, Scale, BookOpen, Users, PieChart, BarChart3, TrendingUp, Download
} from 'lucide-react';

interface ReportsViewProps {
  journalEntries?: JournalEntry[];
  categories?: AccountingCategory[];
  assets?: AccountingAsset[];
  loans?: AccountingLoan[];
  financialAccounts?: FinancialAccount[];
  vendors?: Vendor[];
}

type ActiveReportTab =
  | 'balanceSheet'
  | 'pnl'
  | 'cashFlow'
  | 'cashPosition'
  | 'trialBalance'
  | 'generalLedger'
  | 'vendorReport'
  | 'expenseAnalysis'
  | 'revenueAnalysis';

type PeriodPreset =
  | 'thisMonth'
  | 'thisQuarter'
  | 'h1'
  | 'h2'
  | 'thisYear'
  | 'lastMonth'
  | 'lastQuarter'
  | 'lastYear'
  | 'custom';

const ReportsView: React.FC<ReportsViewProps> = ({
  journalEntries = [],
  categories = [],
  assets = [],
  loans = [],
  financialAccounts = [],
  vendors = [],
}) => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<ActiveReportTab>('pnl');

  // Company Profile state for PDF export
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);

  useEffect(() => {
    getCompanyProfile().then(setCompanyProfile).catch(console.error);
  }, []);

  // Filter Panel Toggle State
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState<boolean>(false);

  // Advanced Filter States
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('thisMonth');
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Account & Category Database Filters
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('All');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');

  // General Ledger & Vendor Search States
  const [glSearchTerm, setGlSearchTerm] = useState<string>('');
  const [vendorSearch, setVendorSearch] = useState<string>('');

  // Accordion Group Collapsed States
  const [collapsedGroups, setCollapsedGroups] = useState<{ [groupId: string]: boolean }>({});

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Filtered Journal Entries based on selected Account & Category
  const filteredJournalEntries = useMemo(() => {
    return journalEntries.filter(entry => {
      if (entry.isVoided) return false;

      // Filter by Account
      if (selectedAccountFilter !== 'All') {
        const matchesAccount = entry.entries.some(line => line.accountId === selectedAccountFilter);
        if (!matchesAccount) return false;
      }

      // Filter by Category
      if (selectedCategoryFilter !== 'All') {
        const matchesCat = entry.subType === selectedCategoryFilter || entry.type === selectedCategoryFilter;
        if (!matchesCat) return false;
      }

      return true;
    });
  }, [journalEntries, selectedAccountFilter, selectedCategoryFilter]);

  // Read-Only Reporting Context
  const reportingContext: ReportingContext = useMemo(() => ({
    journalEntries: filteredJournalEntries,
    financialAccounts,
    assets,
    loans,
    categories
  }), [filteredJournalEntries, financialAccounts, assets, loans, categories]);

  // Apply Period Presets (Month, Quarter, Half-Year, Year)
  const applyPeriodPreset = (preset: PeriodPreset) => {
    setPeriodPreset(preset);
    const now = new Date();
    let s = new Date();
    let e = new Date();

    if (preset === 'thisMonth') {
      s = new Date(now.getFullYear(), now.getMonth(), 1);
      e = now;
    } else if (preset === 'thisQuarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      s = new Date(now.getFullYear(), qMonth, 1);
      e = now;
    } else if (preset === 'h1') {
      s = new Date(now.getFullYear(), 0, 1);
      e = new Date(now.getFullYear(), 5, 30);
    } else if (preset === 'h2') {
      s = new Date(now.getFullYear(), 6, 1);
      e = new Date(now.getFullYear(), 11, 31);
    } else if (preset === 'thisYear') {
      s = new Date(now.getFullYear(), 0, 1);
      e = now;
    } else if (preset === 'lastMonth') {
      s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      e = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (preset === 'lastQuarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3 - 3;
      s = new Date(now.getFullYear(), qMonth, 1);
      e = new Date(now.getFullYear(), qMonth + 3, 0);
    } else if (preset === 'lastYear') {
      s = new Date(now.getFullYear() - 1, 0, 1);
      e = new Date(now.getFullYear() - 1, 11, 31);
    }

    if (preset !== 'custom') {
      setStartDate(s.toISOString().split('T')[0]);
      setEndDate(e.toISOString().split('T')[0]);
    }
  };

  // Formatter Utility
  const formatCurrency = (amount: number, isNegative?: boolean) => {
    const formatted = Math.abs(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    if (isNegative || amount < 0) return `-₹${formatted}`;
    return `₹${formatted}`;
  };

  const periodLabel = useMemo(() => {
    if (activeTab === 'balanceSheet' || activeTab === 'cashPosition' || activeTab === 'trialBalance') {
      return `As of ${new Date(asOfDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return `${new Date(startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${new Date(endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }, [activeTab, asOfDate, startDate, endDate]);

  const activeTabTitle = useMemo(() => {
    switch (activeTab) {
      case 'pnl': return 'Profit & Loss';
      case 'balanceSheet': return 'Balance Sheet';
      case 'cashFlow': return 'Cash Flow';
      case 'cashPosition': return 'Cash Position';
      case 'trialBalance': return 'Trial Balance';
      case 'generalLedger': return 'General Ledger';
      case 'vendorReport': return 'Vendor Summary';
      case 'expenseAnalysis': return 'Expense Analysis';
      case 'revenueAnalysis': return 'Revenue Analysis';
      default: return 'Report';
    }
  }, [activeTab]);

  // PDF Export Function for Active Report
  const handleExportPDF = async () => {
    try {
      const nowCtx = new Date(asOfDate);
      const startObj = new Date(startDate);
      const endObj = new Date(endDate);

      const bs = getBalanceSheet(reportingContext, nowCtx);
      const pnl = getProfitAndLoss(reportingContext, startObj, endObj);
      const cp = getCashPosition(reportingContext, nowCtx);

      const pdfData: FinancialReportData = {
        totalRevenue: pnl.totalRevenue,
        totalOperationalExpenses: pnl.totalOperationalExpenses,
        totalInterestExpenses: pnl.totalInterestExpenses,
        netProfit: pnl.netProfit,
        bankAndCashBalance: cp.bankAndCashBalance,
        totalFixedAssetBookValue: bs.assets.fixedAssetsBookValue,
        totalSecurityDeposits: bs.assets.securityDeposits,
        totalAssets: bs.assets.totalAssets,
        totalOutstandingLoans: bs.liabilities.totalLiabilities,
        openingCapital: bs.ownerEquity.openingCapital,
        additionalCapital: bs.ownerEquity.additionalCapital,
        totalOwnerCapital: bs.ownerEquity.openingCapital + bs.ownerEquity.additionalCapital,
        totalOwnerDrawings: bs.ownerEquity.ownerDrawings,
        retainedEarnings: bs.ownerEquity.retainedEarnings,
        totalCurrentOwnerEquity: bs.ownerEquity.totalCurrentOwnerEquity,
        netEquity: bs.ownerEquity.totalCurrentOwnerEquity,
        expenseByCategory: pnl.expenseByCategory
      };

      if (activeTab === 'balanceSheet') {
        await generateSingleFinancialReportPDF('balanceSheet', periodLabel, companyProfile, pdfData);
      } else if (activeTab === 'pnl') {
        await generateSingleFinancialReportPDF('pnl', periodLabel, companyProfile, pdfData);
      } else if (activeTab === 'cashPosition') {
        await generateSingleFinancialReportPDF('cashPosition', periodLabel, companyProfile, pdfData);
      } else if (activeTab === 'expenseAnalysis') {
        await generateSingleFinancialReportPDF('expenses', periodLabel, companyProfile, pdfData);
      } else if (activeTab === 'trialBalance') {
        const tb = buildTrialBalanceStructure(reportingContext, nowCtx);
        const head = [['Account Particulars', 'Debit (Rs.)', 'Credit (Rs.)']];
        const body = tb.sections.flatMap(s => s.groups.flatMap(g => (g.items || []).map(i => [
          i.name,
          i.type === 'DEBIT' ? `Rs. ${i.amount.toLocaleString('en-IN')}` : '-',
          i.type === 'CREDIT' ? `Rs. ${i.amount.toLocaleString('en-IN')}` : '-'
        ])));
        body.push(['TOTALS', `Rs. ${tb.sections[0]?.total.toLocaleString('en-IN')}`, `Rs. ${tb.sections[1]?.total.toLocaleString('en-IN')}`]);
        await generateGenericReportPDF('Trial Balance', periodLabel, companyProfile, head, body);
      } else if (activeTab === 'cashFlow') {
        const head = [['Cash Flow Particulars', 'Amount (Rs.)']];
        const body = [
          ['OPERATING ACTIVITIES', ''],
          ['   Cash Received from Customers', `Rs. ${pnl.totalRevenue.toLocaleString('en-IN')}`],
          ['   Operating Expenses Paid', `- Rs. ${pnl.totalOperationalExpenses.toLocaleString('en-IN')}`],
          ['   Interest Paid', `- Rs. ${pnl.totalInterestExpenses.toLocaleString('en-IN')}`],
          ['NET CASH FROM OPERATING ACTIVITIES', `Rs. ${pnl.netProfit.toLocaleString('en-IN')}`],
          ['CLOSING CASH BALANCE', `Rs. ${cp.bankAndCashBalance.toLocaleString('en-IN')}`]
        ];
        await generateGenericReportPDF('Cash Flow Statement', periodLabel, companyProfile, head, body);
      } else if (activeTab === 'generalLedger') {
        const gl = getGeneralLedger(reportingContext, { startDate: startObj, endDate: endObj });
        const head = [['Date', 'Voucher ID', 'Description', 'Type', 'Amount (Rs.)']];
        const body = gl.entries.map(e => [
          new Date(e.date).toLocaleDateString('en-GB'),
          e.id.slice(0, 8),
          e.remarks || '-',
          e.subType || e.type,
          `Rs. ${(e.entries.reduce((sum, line) => sum + line.amount, 0) / 2).toLocaleString('en-IN')}`
        ]);
        await generateGenericReportPDF('General Ledger', periodLabel, companyProfile, head, body);
      } else if (activeTab === 'vendorReport') {
        const head = [['Vendor Name', 'Total Purchases / Payments (Rs.)']];
        const body = Object.entries(pnl.expenseByCategory).map(([cat, amt]) => [cat, `Rs. ${amt.toLocaleString('en-IN')}`]);
        await generateGenericReportPDF('Vendor Summary Report', periodLabel, companyProfile, head, body);
      } else {
        const head = [['Service / Category', 'Amount (Rs.)']];
        const body = Object.entries(pnl.revenueByCategory).map(([cat, amt]) => [cat, `Rs. ${amt.toLocaleString('en-IN')}`]);
        await generateGenericReportPDF('Revenue Analysis', periodLabel, companyProfile, head, body);
      }
    } catch (err: any) {
      console.error('PDF export error:', err);
      alert('Failed to generate PDF: ' + (err?.message || err));
    }
  };

  // PDF Export Function for All Reports Master Package
  const handleExportMasterPDF = async () => {
    try {
      const nowCtx = new Date(asOfDate);
      const startObj = new Date(startDate);
      const endObj = new Date(endDate);

      const bs = getBalanceSheet(reportingContext, nowCtx);
      const pnl = getProfitAndLoss(reportingContext, startObj, endObj);
      const cp = getCashPosition(reportingContext, nowCtx);
      const tb = buildTrialBalanceStructure(reportingContext, nowCtx);
      const gl = getGeneralLedger(reportingContext, { startDate: startObj, endDate: endObj });

      const tbItems = tb.sections[0]?.groups[0]?.items?.map((debitItem, idx) => {
        const creditItem = tb.sections[1]?.groups[0]?.items?.[idx];
        return {
          name: debitItem.name,
          debit: debitItem.amount || 0,
          credit: creditItem?.amount || 0
        };
      }) || [];

      const glEntries = gl.entries.map(e => ({
        date: new Date(e.date).toLocaleDateString('en-GB'),
        voucher: e.id.slice(0, 8),
        type: e.subType || e.type,
        remarks: e.remarks || '-',
        debit: e.entries.reduce((sum, line) => sum + line.amount, 0),
        credit: e.entries.reduce((sum, line) => sum + line.amount, 0)
      }));

      const vSummaries = vendorReportData.map(v => ({
        name: v.name,
        count: v.count,
        lastDate: new Date(v.lastDate).toLocaleDateString('en-GB'),
        totalPurchases: v.totalPurchases
      }));

      const pdfData: FinancialReportData = {
        totalRevenue: pnl.totalRevenue,
        totalOperationalExpenses: pnl.totalOperationalExpenses,
        totalInterestExpenses: pnl.totalInterestExpenses,
        netProfit: pnl.netProfit,
        bankAndCashBalance: cp.bankAndCashBalance,
        totalFixedAssetBookValue: bs.assets.fixedAssetsBookValue,
        totalSecurityDeposits: bs.assets.securityDeposits,
        totalAssets: bs.assets.totalAssets,
        totalOutstandingLoans: bs.liabilities.totalLiabilities,
        openingCapital: bs.ownerEquity.openingCapital,
        additionalCapital: bs.ownerEquity.additionalCapital,
        totalOwnerCapital: bs.ownerEquity.openingCapital + bs.ownerEquity.additionalCapital,
        totalOwnerDrawings: bs.ownerEquity.ownerDrawings,
        retainedEarnings: bs.ownerEquity.retainedEarnings,
        totalCurrentOwnerEquity: bs.ownerEquity.totalCurrentOwnerEquity,
        netEquity: bs.ownerEquity.totalCurrentOwnerEquity,
        expenseByCategory: pnl.expenseByCategory,
        revenueByCategory: pnl.revenueByCategory,
        cashFlow: cashFlowData,
        trialBalanceItems: tbItems,
        generalLedgerEntries: glEntries,
        vendorSummaries: vSummaries
      };

      await generateMasterFinancialPackagePDF(periodLabel, companyProfile, pdfData);
    } catch (err: any) {
      console.error('Master PDF package export error:', err);
      alert('Failed to generate Master PDF package: ' + (err?.message || err));
    }
  };

  // Render Minimal Accordion Group Helper
  const renderGroup = (group: ReportGroup, depth: number = 0) => {
    const isCollapsed = !!collapsedGroups[group.id];
    const hasItems = group.items && group.items.length > 0;
    const hasSubGroups = group.subGroups && group.subGroups.length > 0;

    return (
      <div key={group.id} className="space-y-1">
        <div
          onClick={() => toggleGroup(group.id)}
          className={`flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer transition-colors ${
            depth === 0 ? 'bg-slate-100/90 hover:bg-slate-200/70 font-bold text-slate-900' : 'bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold'
          }`}
        >
          <div className="flex items-center gap-2">
            {(hasItems || hasSubGroups) ? (
              isCollapsed ? <ChevronRight size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />
            ) : (
              <div className="w-3.5" />
            )}
            <span className="text-xs uppercase tracking-tight">{group.title}</span>
          </div>
          <span className="text-xs font-bold text-slate-900">{formatCurrency(group.total)}</span>
        </div>

        {!isCollapsed && (
          <div className="pl-4 space-y-1">
            {hasSubGroups && group.subGroups!.map(sg => renderGroup(sg, depth + 1))}
            {hasItems && (
              <div className="divide-y divide-slate-100 bg-white rounded-lg border border-slate-200 overflow-hidden">
                {group.items!.map(item => (
                  <div key={item.id} className="flex justify-between items-center px-3 py-2 text-xs hover:bg-slate-50/50 transition">
                    <span className="text-slate-700 font-medium">{item.name}</span>
                    <span className={`font-semibold ${item.isNegative || item.amount < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                      {formatCurrency(item.amount, item.isNegative)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // DATA COMPUTATIONS
  const balanceSheetStructure = useMemo(() => buildBalanceSheetStructure(reportingContext, new Date(asOfDate)), [reportingContext, asOfDate]);
  const pnlStructure = useMemo(() => buildProfitAndLossStructure(reportingContext, new Date(startDate), new Date(endDate)), [reportingContext, startDate, endDate]);
  const cashPositionStructure = useMemo(() => buildCashPositionStructure(reportingContext, new Date(asOfDate)), [reportingContext, asOfDate]);
  const trialBalanceStructure = useMemo(() => buildTrialBalanceStructure(reportingContext, new Date(asOfDate)), [reportingContext, asOfDate]);

  const generalLedgerData = useMemo(() => getGeneralLedger(reportingContext, {
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    searchTerm: glSearchTerm.trim() || undefined
  }), [reportingContext, startDate, endDate, glSearchTerm]);

  // Cash Flow Computations
  const cashFlowData = useMemo(() => {
    const pnl = getProfitAndLoss(reportingContext, new Date(startDate), new Date(endDate));
    const cp = getCashPosition(reportingContext, new Date(endDate));

    const netOperatingCash = pnl.totalRevenue - pnl.totalOperationalExpenses - pnl.totalInterestExpenses;
    const assetPurchases = filteredJournalEntries
      .filter(j => j.subType === 'Fixed Asset Purchase' && new Date(j.date) >= new Date(startDate) && new Date(j.date) <= new Date(endDate))
      .reduce((sum, j) => sum + (j.entries.find(e => e.type === 'DEBIT')?.amount || 0), 0);

    const capitalInflows = filteredJournalEntries
      .filter(j => (j.subType === 'Owner Investment' || (j.subType === 'Opening Balance' && j.type === 'Capital')) && new Date(j.date) >= new Date(startDate) && new Date(j.date) <= new Date(endDate))
      .reduce((sum, j) => sum + (j.entries.find(e => e.type === 'CREDIT')?.amount || 0), 0);

    const withdrawals = filteredJournalEntries
      .filter(j => j.subType === 'Owner Withdrawal' && new Date(j.date) >= new Date(startDate) && new Date(j.date) <= new Date(endDate))
      .reduce((sum, j) => sum + (j.entries.find(e => e.type === 'DEBIT')?.amount || 0), 0);

    const netFinancingCash = capitalInflows - withdrawals;
    const closingCash = cp.bankAndCashBalance;
    const openingCash = closingCash - (netOperatingCash - assetPurchases + netFinancingCash);

    return {
      operatingInflows: pnl.totalRevenue,
      operatingOutflows: pnl.totalOperationalExpenses,
      interestOutflows: pnl.totalInterestExpenses,
      netOperatingCash,
      assetPurchases,
      capitalInflows,
      withdrawals,
      netFinancingCash,
      openingCash,
      closingCash
    };
  }, [reportingContext, startDate, endDate, filteredJournalEntries]);

  // Vendor & Analysis Data
  const vendorReportData = useMemo(() => {
    const vendorMap: { [name: string]: { name: string; totalPurchases: number; lastDate: string; count: number } } = {};
    filteredJournalEntries.forEach(j => {
      const vName = j.vendor || (j.type === 'Expense' ? 'General Vendor' : undefined);
      if (!vName) return;
      const amt = j.entries.reduce((sum, line) => line.type === 'DEBIT' ? sum + line.amount : sum, 0);
      if (!vendorMap[vName]) vendorMap[vName] = { name: vName, totalPurchases: 0, lastDate: j.date, count: 0 };
      vendorMap[vName].totalPurchases += amt;
      vendorMap[vName].count += 1;
      if (new Date(j.date).getTime() > new Date(vendorMap[vName].lastDate).getTime()) vendorMap[vName].lastDate = j.date;
    });
    return Object.values(vendorMap).filter(v => !vendorSearch || v.name.toLowerCase().includes(vendorSearch.toLowerCase()));
  }, [filteredJournalEntries, vendorSearch]);

  const expenseAnalysisData = useMemo(() => {
    const pnl = getProfitAndLoss(reportingContext, new Date(startDate), new Date(endDate));
    const totalExp = pnl.totalOperationalExpenses + pnl.totalInterestExpenses;
    const categoryList = Object.entries(pnl.expenseByCategory).map(([name, amount]) => ({
      name,
      amount,
      percentage: totalExp > 0 ? (amount / totalExp) * 100 : 0
    })).sort((a, b) => b.amount - a.amount);
    return { totalExp, categoryList };
  }, [reportingContext, startDate, endDate]);

  const revenueAnalysisData = useMemo(() => {
    const pnl = getProfitAndLoss(reportingContext, new Date(startDate), new Date(endDate));
    const totalRev = pnl.totalRevenue;
    const categoryList = Object.entries(pnl.revenueByCategory).map(([name, amount]) => ({
      name,
      amount,
      percentage: totalRev > 0 ? (amount / totalRev) * 100 : 0
    })).sort((a, b) => b.amount - a.amount);
    return { totalRev, categoryList };
  }, [reportingContext, startDate, endDate]);

  return (
    <div className="space-y-5 animate-in fade-in duration-200 font-sans text-slate-800">

      {/* TOP PROFESSIONAL BAR */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Financial Reports Suite</h2>
            <p className="text-xs text-slate-500 font-normal">
              Corporate accounting reports & executive financial audit ledger
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* ADVANCED FILTER TOGGLE BUTTON */}
            <button
              onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border ${
                isFilterPanelOpen || selectedAccountFilter !== 'All' || selectedCategoryFilter !== 'All'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
              }`}
            >
              <Filter size={13} />
              <span>Filter</span>
              {(selectedAccountFilter !== 'All' || selectedCategoryFilter !== 'All') && (
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              )}
            </button>

            {/* DOWNLOAD SINGLE REPORT BUTTON */}
            <button
              onClick={handleExportPDF}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg shadow-2xs transition flex items-center gap-1.5"
              title={`Download ${activeTabTitle} PDF`}
            >
              <Download size={13} />
              <span>Download {activeTabTitle} PDF</span>
            </button>

            {/* DOWNLOAD ALL REPORTS MASTER PDF BUTTON */}
            <button
              onClick={handleExportMasterPDF}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-2xs transition flex items-center gap-1.5"
              title="Download All Reports in a single PDF package"
            >
              <Download size={13} />
              <span>Download All Reports (Master PDF)</span>
            </button>
          </div>
        </div>

        {/* MINIMAL ERP SUBTLE UNDERLINE TAB NAVIGATION */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 text-xs font-semibold">
          {[
            { id: 'pnl', label: 'Profit & Loss' },
            { id: 'balanceSheet', label: 'Balance Sheet' },
            { id: 'cashFlow', label: 'Cash Flow' },
            { id: 'cashPosition', label: 'Cash Position' },
            { id: 'trialBalance', label: 'Trial Balance' },
            { id: 'generalLedger', label: 'General Ledger' },
            { id: 'vendorReport', label: 'Vendor Summary' },
            { id: 'expenseAnalysis', label: 'Expense Analysis' },
            { id: 'revenueAnalysis', label: 'Revenue Analysis' }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ActiveReportTab)}
                className={`px-3.5 py-2 transition-all border-b-2 font-bold whitespace-nowrap ${
                  isActive
                    ? 'border-slate-900 text-slate-900 bg-slate-50'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ADVANCED FILTERING PANEL (EXPANDABLE) */}
        {isFilterPanelOpen && (
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3 text-xs animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Filter size={13} className="text-slate-500" />
                Advanced Financial Filters
              </span>
              <button
                onClick={() => {
                  setSelectedAccountFilter('All');
                  setSelectedCategoryFilter('All');
                  applyPeriodPreset('thisMonth');
                }}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800"
              >
                Reset Filters
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* PERIOD PRESET SELECTOR */}
              <div>
                <label className="block font-bold text-slate-600 mb-1">Period Quick Filter</label>
                <select
                  value={periodPreset}
                  onChange={e => applyPeriodPreset(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 outline-none"
                >
                  <option value="thisMonth">This Month</option>
                  <option value="thisQuarter">This Quarter</option>
                  <option value="h1">Half-Yearly H1 (Jan-Jun)</option>
                  <option value="h2">Half-Yearly H2 (Jul-Dec)</option>
                  <option value="thisYear">This Financial Year (FY)</option>
                  <option value="lastMonth">Last Month</option>
                  <option value="lastQuarter">Last Quarter</option>
                  <option value="lastYear">Last Year</option>
                  <option value="custom">Custom Date Range</option>
                </select>
              </div>

              {/* DATE INPUTS */}
              {(activeTab === 'balanceSheet' || activeTab === 'cashPosition' || activeTab === 'trialBalance') ? (
                <div>
                  <label className="block font-bold text-slate-600 mb-1">As of Date</label>
                  <input
                    type="date"
                    value={asOfDate}
                    onChange={e => setAsOfDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 outline-none"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => { setStartDate(e.target.value); setPeriodPreset('custom'); }}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => { setEndDate(e.target.value); setPeriodPreset('custom'); }}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 outline-none"
                    />
                  </div>
                </>
              )}

              {/* DATABASE FINANCIAL ACCOUNT FILTER */}
              <div>
                <label className="block font-bold text-slate-600 mb-1">Financial Account</label>
                <select
                  value={selectedAccountFilter}
                  onChange={e => setSelectedAccountFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 outline-none"
                >
                  <option value="All">All Accounts (Consolidated)</option>
                  {financialAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                  ))}
                </select>
              </div>

              {/* CATEGORY FILTER */}
              <div>
                <label className="block font-bold text-slate-600 mb-1">Category / Transaction Type</label>
                <select
                  value={selectedCategoryFilter}
                  onChange={e => setSelectedCategoryFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 outline-none"
                >
                  <option value="All">All Categories</option>
                  <option value="Sales Revenue">Sales Revenue</option>
                  <option value="Operational Expense">Operational Expense</option>
                  <option value="Fixed Asset Purchase">Fixed Asset Purchase</option>
                  <option value="Loan Repayment">Loan Repayment</option>
                  <option value="Owner Investment">Owner Investment</option>
                  <option value="Owner Withdrawal">Owner Withdrawal</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ACTIVE PERIOD BADGE BAR */}
        <div className="flex items-center justify-between text-xs text-slate-500 font-semibold pt-1 px-1">
          <div className="flex items-center gap-2">
            <Calendar size={13} className="text-slate-400" />
            <span>Active Period: <strong className="text-slate-900">{periodLabel}</strong></span>
          </div>
          {(selectedAccountFilter !== 'All' || selectedCategoryFilter !== 'All') && (
            <span className="text-[11px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded border border-slate-200">
              Filtered: {selectedAccountFilter !== 'All' ? '1 Account' : ''} {selectedCategoryFilter !== 'All' ? '1 Category' : ''}
            </span>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. PROFIT & LOSS STATEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'pnl' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Operating Revenue</span>
              <div className="text-xl font-bold text-emerald-600 mt-1">
                {formatCurrency(pnlStructure.sections[0]?.total || 0)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Operating Expenses</span>
              <div className="text-xl font-bold text-rose-600 mt-1">
                {formatCurrency(pnlStructure.sections[1]?.total || 0)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Net Operating Profit / (Loss)</span>
              <div className={`text-xl font-bold mt-1 ${ (pnlStructure.summaryTotal || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600' }`}>
                {formatCurrency(pnlStructure.summaryTotal || 0)}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
            {pnlStructure.sections.map(sec => (
              <div key={sec.id} className="space-y-2">
                <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 font-bold text-xs uppercase tracking-wide text-slate-900">
                  <span>{sec.title}</span>
                  <span>{formatCurrency(sec.total)}</span>
                </div>
                <div className="space-y-1">
                  {sec.groups.map(g => renderGroup(g))}
                </div>
              </div>
            ))}

            <div className="pt-3 border-t-2 border-slate-900 flex justify-between items-center bg-slate-50 p-3 rounded-lg text-xs font-bold text-slate-900">
              <span>NET OPERATING PROFIT / (LOSS)</span>
              <span className={`text-sm font-bold ${ (pnlStructure.summaryTotal || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600' }`}>
                {formatCurrency(pnlStructure.summaryTotal || 0)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. BALANCE SHEET */}
      {/* ========================================================================= */}
      {activeTab === 'balanceSheet' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ASSETS */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Assets</h3>
                <span className="text-xs font-bold text-slate-900">
                  {formatCurrency(balanceSheetStructure.sections.find(s => s.id === 'sec_assets')?.total || 0)}
                </span>
              </div>
              <div className="space-y-2">
                {balanceSheetStructure.sections.find(s => s.id === 'sec_assets')?.groups.map(g => renderGroup(g))}
              </div>
              <div className="pt-2 border-t-2 border-slate-900 flex justify-between items-center text-xs font-bold">
                <span>TOTAL ASSETS</span>
                <span className="text-emerald-700">
                  {formatCurrency(balanceSheetStructure.sections.find(s => s.id === 'sec_assets')?.total || 0)}
                </span>
              </div>
            </div>

            {/* LIABILITIES & EQUITY */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Liabilities & Owner Equity</h3>
                <span className="text-xs font-bold text-slate-900">
                  {formatCurrency(balanceSheetStructure.summaryTotal || 0)}
                </span>
              </div>
              <div className="space-y-2">
                {balanceSheetStructure.sections.find(s => s.id === 'sec_liabilities')?.groups.map(g => renderGroup(g))}
                {balanceSheetStructure.sections.find(s => s.id === 'sec_equity')?.groups.map(g => renderGroup(g))}
              </div>
              <div className="pt-2 border-t-2 border-slate-900 flex justify-between items-center text-xs font-bold">
                <span>TOTAL LIABILITIES & OWNER EQUITY</span>
                <span className="text-slate-900">
                  {formatCurrency(balanceSheetStructure.summaryTotal || 0)}
                </span>
              </div>
            </div>
          </div>

          <div className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-between ${
            balanceSheetStructure.validation?.isValid ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={15} />
              {balanceSheetStructure.validation?.isValid ? 'Balance Sheet Reconciled' : 'Balance Imbalance'}
            </span>
            <span>Diff: {formatCurrency(balanceSheetStructure.validation?.imbalanceAmount || 0)}</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CASH FLOW STATEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'cashFlow' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4 text-xs">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-2">Statement of Cash Flows</h3>
          
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="font-bold text-slate-900 uppercase text-[11px]">1. Operating Activities</div>
              <div className="flex justify-between py-1 px-2.5 bg-slate-50 rounded">
                <span>Cash from Customers</span>
                <span className="font-semibold text-emerald-600">+{formatCurrency(cashFlowData.operatingInflows)}</span>
              </div>
              <div className="flex justify-between py-1 px-2.5 bg-slate-50 rounded">
                <span>Operating Expenses Paid</span>
                <span className="font-semibold text-rose-600">-{formatCurrency(cashFlowData.operatingOutflows)}</span>
              </div>
              <div className="flex justify-between py-1.5 px-2.5 bg-slate-100 font-bold">
                <span>Net Cash from Operating Activities</span>
                <span>{formatCurrency(cashFlowData.netOperatingCash)}</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="font-bold text-slate-900 uppercase text-[11px]">2. Investing Activities</div>
              <div className="flex justify-between py-1 px-2.5 bg-slate-50 rounded">
                <span>Fixed Asset Purchases</span>
                <span className="font-semibold text-rose-600">-{formatCurrency(cashFlowData.assetPurchases)}</span>
              </div>
              <div className="flex justify-between py-1.5 px-2.5 bg-slate-100 font-bold">
                <span>Net Cash Used in Investing Activities</span>
                <span>{formatCurrency(-cashFlowData.assetPurchases)}</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="font-bold text-slate-900 uppercase text-[11px]">3. Financing Activities</div>
              <div className="flex justify-between py-1 px-2.5 bg-slate-50 rounded">
                <span>Capital Inflows</span>
                <span className="font-semibold text-emerald-600">+{formatCurrency(cashFlowData.capitalInflows)}</span>
              </div>
              <div className="flex justify-between py-1 px-2.5 bg-slate-50 rounded">
                <span>Owner Withdrawals</span>
                <span className="font-semibold text-rose-600">-{formatCurrency(cashFlowData.withdrawals)}</span>
              </div>
              <div className="flex justify-between py-1.5 px-2.5 bg-slate-100 font-bold">
                <span>Net Cash from Financing Activities</span>
                <span>{formatCurrency(cashFlowData.netFinancingCash)}</span>
              </div>
            </div>

            <div className="pt-2 border-t-2 border-slate-900 flex justify-between items-center font-bold text-slate-900 text-xs bg-slate-50 p-2.5 rounded-lg">
              <span>Closing Cash & Bank Balance</span>
              <span>{formatCurrency(cashFlowData.closingCash)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. CASH POSITION */}
      {/* ========================================================================= */}
      {activeTab === 'cashPosition' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-2">Financial Account Cash Balances</h3>
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Account</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Balance (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cashPositionStructure.sections[0]?.groups[0]?.items?.map(acc => (
                  <tr key={acc.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{acc.name}</td>
                    <td className="py-2.5 px-3 text-slate-500">{acc.type}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">{formatCurrency(acc.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TRIAL BALANCE */}
      {/* ========================================================================= */}
      {activeTab === 'trialBalance' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-2">Trial Balance Sheet</h3>
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Account Particulars</th>
                  <th className="py-2.5 px-3 text-right">Debit (₹)</th>
                  <th className="py-2.5 px-3 text-right">Credit (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trialBalanceStructure.sections[0]?.groups[0]?.items?.map((debitItem, idx) => {
                  const creditItem = trialBalanceStructure.sections[1]?.groups[0]?.items?.[idx];
                  return (
                    <tr key={debitItem.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{debitItem.name}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600">{debitItem.amount > 0 ? formatCurrency(debitItem.amount) : '-'}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-indigo-600">{creditItem && creditItem.amount > 0 ? formatCurrency(creditItem.amount) : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 font-black border-t-2 border-slate-900 text-slate-900">
                <tr>
                  <td className="py-2.5 px-3">TOTALS</td>
                  <td className="py-2.5 px-3 text-right">{formatCurrency(trialBalanceStructure.sections[0]?.total || 0)}</td>
                  <td className="py-2.5 px-3 text-right">{formatCurrency(trialBalanceStructure.sections[1]?.total || 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. GENERAL LEDGER */}
      {/* ========================================================================= */}
      {activeTab === 'generalLedger' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">General Ledger Register</h3>
            <div className="relative w-64">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={glSearchTerm}
                onChange={e => setGlSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1 text-xs outline-none font-medium"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Voucher</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right">Debit (₹)</th>
                  <th className="py-2.5 px-3 text-right">Credit (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {generalLedgerData.entries.map(entry => {
                  const debitAmt = entry.entries.reduce((sum, line) => line.type === 'DEBIT' ? sum + line.amount : sum, 0);
                  const creditAmt = entry.entries.reduce((sum, line) => line.type === 'CREDIT' ? sum + line.amount : sum, 0);
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 text-slate-500 font-medium">{new Date(entry.date).toLocaleDateString('en-GB')}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{entry.id.slice(0, 8)}</td>
                      <td className="py-2.5 px-3 font-semibold text-indigo-700">{entry.subType || entry.type}</td>
                      <td className="py-2.5 px-3 text-slate-900 font-medium">{entry.remarks}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600">{formatCurrency(debitAmt)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-indigo-600">{formatCurrency(creditAmt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. VENDOR SUMMARY */}
      {/* ========================================================================= */}
      {activeTab === 'vendorReport' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Vendor Summary</h3>
            <input
              type="text"
              placeholder="Search vendor..."
              value={vendorSearch}
              onChange={e => setVendorSearch(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs outline-none font-medium"
            />
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Vendor Name</th>
                  <th className="py-2.5 px-3 text-center">Tx Count</th>
                  <th className="py-2.5 px-3">Last Transaction</th>
                  <th className="py-2.5 px-3 text-right">Total Purchases (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vendorReportData.map(v => (
                  <tr key={v.name} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{v.name}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-600">{v.count}</td>
                    <td className="py-2.5 px-3 text-slate-500">{new Date(v.lastDate).toLocaleDateString('en-GB')}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-rose-600">{formatCurrency(v.totalPurchases)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. EXPENSE ANALYSIS */}
      {/* ========================================================================= */}
      {activeTab === 'expenseAnalysis' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-2">Expense Distribution Analysis</h3>
          <div className="space-y-3">
            {expenseAnalysisData.categoryList.map(item => (
              <div key={item.name} className="space-y-1">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-slate-800">{item.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">{item.percentage.toFixed(1)}%</span>
                    <span className="text-rose-600 font-bold">{formatCurrency(item.amount)}</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-slate-700 h-full rounded-full" style={{ width: `${item.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. REVENUE ANALYSIS */}
      {/* ========================================================================= */}
      {activeTab === 'revenueAnalysis' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-2">Revenue Service Breakdown</h3>
          <div className="space-y-3">
            {revenueAnalysisData.categoryList.map(item => (
              <div key={item.name} className="space-y-1">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-slate-800">{item.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">{item.percentage.toFixed(1)}%</span>
                    <span className="text-emerald-600 font-bold">{formatCurrency(item.amount)}</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-slate-900 h-full rounded-full" style={{ width: `${item.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default ReportsView;
