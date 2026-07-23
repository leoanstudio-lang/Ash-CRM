import {
  ReportingContext,
  getBalanceSheet,
  getProfitAndLoss,
  getCashPosition,
  getTrialBalance,
  getAccountBalances
} from './financialReportingEngine';
import { calculateDepreciation } from './accounting';

// ==========================================
// DYNAMIC REPORT MAPPING TYPES & STRUCTURES
// ==========================================

export interface ReportLineItem {
  id: string;
  name: string;
  code?: string;
  amount: number;
  type: string;
  isNegative?: boolean;
  metadata?: Record<string, any>;
}

export interface ReportGroup {
  id: string;
  title: string;
  order: number;
  total: number;
  hideIfEmpty?: boolean;
  subGroups?: ReportGroup[];
  items?: ReportLineItem[];
}

export interface ReportSection {
  id: string;
  title: string;
  order: number;
  total: number;
  groups: ReportGroup[];
}

export interface ReportStructure {
  reportType: 'balanceSheet' | 'profitAndLoss' | 'cashPosition' | 'trialBalance';
  reportTitle: string;
  reportDate: string;
  periodLabel?: string;
  sections: ReportSection[];
  summaryTotalLabel?: string;
  summaryTotal?: number;
  validation?: any;
}

// Helper to filter out empty groups if hideIfEmpty is enabled
const filterGroups = (groups: ReportGroup[]): ReportGroup[] => {
  return groups
    .map(g => {
      const cleanSub = g.subGroups ? filterGroups(g.subGroups) : undefined;
      return { ...g, subGroups: cleanSub };
    })
    .filter(g => {
      if (!g.hideIfEmpty) return true;
      const hasSub = g.subGroups && g.subGroups.length > 0;
      const hasItems = g.items && g.items.length > 0;
      const hasTotal = Math.abs(g.total) > 0.001;
      return hasSub || hasItems || hasTotal;
    });
};

// ==========================================
// REPORT MAPPING FUNCTIONS
// ==========================================

/**
 * 1. Build Dynamic Balance Sheet Structure
 */
export function buildBalanceSheetStructure(
  context: ReportingContext,
  reportDate: Date = new Date()
): ReportStructure {
  const bs = getBalanceSheet(context, reportDate);
  const accountBalancesData = getAccountBalances(context, reportDate);

  // Group Cash & Bank Accounts by Account Type
  const bankItems: ReportLineItem[] = [];
  const cashItems: ReportLineItem[] = [];
  const upiItems: ReportLineItem[] = [];

  accountBalancesData.accounts.forEach(acc => {
    const item: ReportLineItem = {
      id: acc.id,
      name: acc.name,
      amount: Math.max(0, acc.balance),
      type: acc.type
    };

    if (acc.type === 'Bank') bankItems.push(item);
    else if (acc.type === 'Cash' || acc.type === 'Petty Cash') cashItems.push(item);
    else if (acc.type === 'UPI' || acc.type === 'Credit Card') upiItems.push(item);
    else bankItems.push(item);
  });

  // Current Assets Subgroups
  const currentAssetsSubgroups: ReportGroup[] = [
    {
      id: 'sub_bank',
      title: 'Bank Accounts',
      order: 1,
      total: bankItems.reduce((sum, i) => sum + i.amount, 0),
      hideIfEmpty: true,
      items: bankItems
    },
    {
      id: 'sub_cash',
      title: 'Cash & Cash Equivalents',
      order: 2,
      total: cashItems.reduce((sum, i) => sum + i.amount, 0),
      hideIfEmpty: true,
      items: cashItems
    },
    {
      id: 'sub_upi',
      title: 'UPI & Digital Wallets',
      order: 3,
      total: upiItems.reduce((sum, i) => sum + i.amount, 0),
      hideIfEmpty: true,
      items: upiItems
    }
  ];

  // Fixed Asset Items
  const fixedAssetItems: ReportLineItem[] = (context.assets || []).map(a => {
    const dep = calculateDepreciation(a, reportDate);
    const currentValue = dep && dep.currentValue !== undefined ? dep.currentValue : a.cost;
    return {
      id: a.id,
      name: a.name + (a.categoryName ? ` (${a.categoryName})` : ''),
      amount: currentValue,
      type: 'FixedAsset',
      metadata: { originalCost: a.cost, usefulLife: a.usefulLifeYears }
    };
  });

  // Non-Current Assets Subgroups
  const nonCurrentAssetsSubgroups: ReportGroup[] = [
    {
      id: 'sub_fixed_assets',
      title: 'Property, Plant & Equipment (Net Book Value)',
      order: 1,
      total: bs.assets.fixedAssetsBookValue,
      hideIfEmpty: true,
      items: fixedAssetItems
    },
    {
      id: 'sub_deposits',
      title: 'Security Deposits & Long-term Advances',
      order: 2,
      total: bs.assets.securityDeposits,
      hideIfEmpty: true,
      items: [
        {
          id: 'sec_deposits',
          name: 'Security Deposits Paid',
          amount: bs.assets.securityDeposits,
          type: 'Deposit'
        }
      ]
    }
  ];

  // 1. ASSETS SECTION
  const assetsSection: ReportSection = {
    id: 'sec_assets',
    title: 'ASSETS',
    order: 1,
    total: bs.assets.totalAssets,
    groups: filterGroups([
      {
        id: 'group_current_assets',
        title: 'Current Assets',
        order: 1,
        total: bs.assets.cashAndBank,
        subGroups: currentAssetsSubgroups
      },
      {
        id: 'group_non_current_assets',
        title: 'Non-Current Assets',
        order: 2,
        total: bs.assets.fixedAssetsBookValue + bs.assets.securityDeposits,
        subGroups: nonCurrentAssetsSubgroups
      }
    ])
  };

  // 2. LIABILITIES SECTION
  const loanItems: ReportLineItem[] = (context.loans || []).map(l => ({
    id: l.id,
    name: l.name + (l.lender ? ` (${l.lender})` : ''),
    amount: l.remainingBalance,
    type: l.loanType
  }));

  const liabilitiesSection: ReportSection = {
    id: 'sec_liabilities',
    title: 'LIABILITIES',
    order: 2,
    total: bs.liabilities.totalLiabilities,
    groups: filterGroups([
      {
        id: 'group_liabilities',
        title: 'Outstanding Debt & Liabilities',
        order: 1,
        total: bs.liabilities.totalLiabilities,
        items: loanItems
      }
    ])
  };

  // 3. OWNER EQUITY SECTION
  const equityItems: ReportLineItem[] = [
    {
      id: 'eq_opening_capital',
      name: 'Opening Capital / Contributed Equity',
      amount: bs.ownerEquity.openingCapital,
      type: 'Equity'
    }
  ];

  if (bs.ownerEquity.additionalCapital > 0) {
    equityItems.push({
      id: 'eq_add_capital',
      name: 'Additional Owner Investments',
      amount: bs.ownerEquity.additionalCapital,
      type: 'Equity'
    });
  }

  equityItems.push({
    id: 'eq_retained_earnings',
    name: 'Retained Earnings / Accumulated Net Profit (Loss)',
    amount: bs.ownerEquity.retainedEarnings,
    type: 'Equity'
  });

  if (bs.ownerEquity.ownerDrawings > 0) {
    equityItems.push({
      id: 'eq_drawings',
      name: 'Less: Owner Personal Withdrawals (Drawings)',
      amount: bs.ownerEquity.ownerDrawings,
      type: 'Withdrawal',
      isNegative: true
    });
  }

  const equitySection: ReportSection = {
    id: 'sec_equity',
    title: 'OWNER EQUITY',
    order: 3,
    total: bs.ownerEquity.totalCurrentOwnerEquity,
    groups: filterGroups([
      {
        id: 'group_equity',
        title: 'Capital & Reserves',
        order: 1,
        total: bs.ownerEquity.totalCurrentOwnerEquity,
        items: equityItems
      }
    ])
  };

  return {
    reportType: 'balanceSheet',
    reportTitle: 'Balance Sheet',
    reportDate: reportDate.toISOString(),
    sections: [assetsSection, liabilitiesSection, equitySection],
    summaryTotalLabel: 'TOTAL LIABILITIES & EQUITY',
    summaryTotal: bs.totalLiabilitiesAndEquity,
    validation: bs.validation
  };
}

/**
 * 2. Build Dynamic Profit & Loss Structure
 */
export function buildProfitAndLossStructure(
  context: ReportingContext,
  startDate?: Date,
  endDate: Date = new Date()
): ReportStructure {
  const pnl = getProfitAndLoss(context, startDate, endDate);

  const revenueItems: ReportLineItem[] = Object.entries(pnl.revenueByCategory).map(([catName, amt]) => ({
    id: `rev_${catName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    name: catName,
    amount: amt,
    type: 'Revenue'
  }));

  const expenseItems: ReportLineItem[] = Object.entries(pnl.expenseByCategory).map(([catName, amt]) => ({
    id: `exp_${catName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    name: catName,
    amount: amt,
    type: 'Expense'
  }));

  const revenueSection: ReportSection = {
    id: 'sec_pnl_revenue',
    title: 'OPERATING REVENUE (INCOME)',
    order: 1,
    total: pnl.totalRevenue,
    groups: filterGroups([
      {
        id: 'group_pnl_revenue',
        title: 'Business Revenues & Inflows',
        order: 1,
        total: pnl.totalRevenue,
        items: revenueItems
      }
    ])
  };

  const expenseSection: ReportSection = {
    id: 'sec_pnl_expense',
    title: 'OPERATING EXPENSES',
    order: 2,
    total: pnl.totalOperationalExpenses + pnl.totalInterestExpenses,
    groups: filterGroups([
      {
        id: 'group_pnl_expense',
        title: 'Business Expenses & Interest Costs',
        order: 1,
        total: pnl.totalOperationalExpenses + pnl.totalInterestExpenses,
        items: expenseItems
      }
    ])
  };

  return {
    reportType: 'profitAndLoss',
    reportTitle: 'Profit & Loss Statement',
    reportDate: endDate.toISOString(),
    periodLabel: `Period: ${pnl.startDate.split('T')[0]} to ${pnl.endDate.split('T')[0]}`,
    sections: [revenueSection, expenseSection],
    summaryTotalLabel: 'NET OPERATING PROFIT / (LOSS)',
    summaryTotal: pnl.netProfit
  };
}

/**
 * 3. Build Dynamic Cash Position Structure
 */
export function buildCashPositionStructure(
  context: ReportingContext,
  reportDate: Date = new Date()
): ReportStructure {
  const cp = getCashPosition(context, reportDate);

  const accountItems: ReportLineItem[] = cp.accountBreakdown.map(acc => ({
    id: acc.id,
    name: acc.name,
    amount: acc.balance,
    type: acc.type
  }));

  const liquidAssetsSection: ReportSection = {
    id: 'sec_cp_liquid',
    title: 'AVAILABLE LIQUID ASSETS',
    order: 1,
    total: cp.bankAndCashBalance,
    groups: filterGroups([
      {
        id: 'group_cp_accounts',
        title: 'Bank Accounts, Cash & Digital Wallets',
        order: 1,
        total: cp.bankAndCashBalance,
        items: accountItems
      }
    ])
  };

  const debtSection: ReportSection = {
    id: 'sec_cp_debt',
    title: 'OUTSTANDING DEBT OBLIGATIONS',
    order: 2,
    total: cp.totalOutstandingLoans,
    groups: filterGroups([
      {
        id: 'group_cp_debt',
        title: 'Active Loans & Liabilities',
        order: 1,
        total: cp.totalOutstandingLoans,
        items: (context.loans || []).map(l => ({
          id: l.id,
          name: l.name + (l.lender ? ` (${l.lender})` : ''),
          amount: l.remainingBalance,
          type: l.loanType
        }))
      }
    ])
  };

  return {
    reportType: 'cashPosition',
    reportTitle: 'Cash Position & Liquidity Indicator',
    reportDate: reportDate.toISOString(),
    sections: [liquidAssetsSection, debtSection],
    summaryTotalLabel: 'NET LIQUID POSITION',
    summaryTotal: cp.netLiquidPosition
  };
}

/**
 * 4. Build Dynamic Trial Balance Structure
 */
export function buildTrialBalanceStructure(
  context: ReportingContext,
  reportDate: Date = new Date()
): ReportStructure {
  const tb = getTrialBalance(context, reportDate);

  const debitItems: ReportLineItem[] = tb.items.map(item => ({
    id: item.accountId,
    name: item.accountName + ` (${item.accountType})`,
    amount: item.debit,
    type: 'DEBIT'
  }));

  const creditItems: ReportLineItem[] = tb.items.map(item => ({
    id: item.accountId + '_credit',
    name: item.accountName + ` (${item.accountType})`,
    amount: item.credit,
    type: 'CREDIT'
  }));

  const debitsSection: ReportSection = {
    id: 'sec_tb_debit',
    title: 'DEBIT BALANCES',
    order: 1,
    total: tb.totalDebits,
    groups: filterGroups([
      {
        id: 'group_tb_debit',
        title: 'Debit Side Accounts',
        order: 1,
        total: tb.totalDebits,
        items: debitItems
      }
    ])
  };

  const creditsSection: ReportSection = {
    id: 'sec_tb_credit',
    title: 'CREDIT BALANCES',
    order: 2,
    total: tb.totalCredits,
    groups: filterGroups([
      {
        id: 'group_tb_credit',
        title: 'Credit Side Accounts',
        order: 1,
        total: tb.totalCredits,
        items: creditItems
      }
    ])
  };

  return {
    reportType: 'trialBalance',
    reportTitle: 'Trial Balance',
    reportDate: reportDate.toISOString(),
    sections: [debitsSection, creditsSection],
    summaryTotalLabel: 'IMBALANCE AMOUNT',
    summaryTotal: tb.imbalanceAmount,
    validation: { isBalanced: tb.isBalanced, imbalanceAmount: tb.imbalanceAmount }
  };
}
