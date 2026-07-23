import { JournalEntry, AccountingCategory, AccountingAsset, AccountingLoan, FinancialAccount } from '../types';
import { calculateDepreciation } from './accounting';

// ==========================================
// TYPES & INTERFACES FOR REPORTING ENGINE
// ==========================================

export interface ReportingContext {
  journalEntries: JournalEntry[];
  financialAccounts: FinancialAccount[];
  assets: AccountingAsset[];
  loans: AccountingLoan[];
  categories: AccountingCategory[];
}

export interface LedgerFilters {
  startDate?: Date;
  endDate?: Date;
  accountId?: string;
  searchTerm?: string;
  type?: string;
}

export interface BalanceSheetReport {
  reportDate: string;
  assets: {
    cashAndBank: number;
    fixedAssetsBookValue: number;
    securityDeposits: number;
    totalAssets: number;
  };
  liabilities: {
    outstandingLoans: number;
    totalLiabilities: number;
  };
  ownerEquity: {
    openingCapital: number;
    additionalCapital: number;
    retainedEarnings: number;
    ownerDrawings: number;
    totalCurrentOwnerEquity: number;
  };
  totalLiabilitiesAndEquity: number;
  validation: AccountingEquationValidation;
}

export interface ProfitAndLossReport {
  startDate: string;
  endDate: string;
  totalRevenue: number;
  totalOperationalExpenses: number;
  totalInterestExpenses: number;
  netProfit: number;
  revenueByCategory: { [categoryName: string]: number };
  expenseByCategory: { [categoryName: string]: number };
}

export interface CashPositionReport {
  reportDate: string;
  bankAndCashBalance: number;
  totalOutstandingLoans: number;
  netLiquidPosition: number;
  accountBreakdown: { id: string; name: string; type: string; balance: number }[];
}

export interface TrialBalanceItem {
  accountId: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
}

export interface TrialBalanceReport {
  reportDate: string;
  items: TrialBalanceItem[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  imbalanceAmount: number;
}

export interface GeneralLedgerReport {
  entries: JournalEntry[];
  totalEntries: number;
  totalDebits: number;
  totalCredits: number;
}

export interface AccountBalancesReport {
  reportDate: string;
  balances: { [accountId: string]: number };
  accounts: { id: string; name: string; type: string; balance: number }[];
}

export interface AccountingEquationValidation {
  reportDate: string;
  totalAssets: number;
  totalLiabilities: number;
  totalOwnerEquity: number;
  totalLiabilitiesAndEquity: number;
  imbalanceAmount: number;
  isValid: boolean;
  mismatchDetails?: {
    assetsBreakdown: { cashAndBank: number; fixedAssetsBookValue: number; securityDeposits: number };
    liabilitiesBreakdown: { outstandingLoans: number };
    equityBreakdown: { openingCapital: number; additionalCapital: number; retainedEarnings: number; ownerDrawings: number };
  };
}

// ==========================================
// HELPER UTILITIES
// ==========================================

const toNum = (val: any): number => {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

// ==========================================
// FINANCIAL REPORTING ENGINE APIS
// ==========================================

/**
 * 1. Calculate Real-time Account Balances as of Report Date
 */
export function getAccountBalances(context: ReportingContext, reportDate: Date = new Date()): AccountBalancesReport {
  const { financialAccounts = [], journalEntries = [] } = context;
  const cutoffTime = reportDate.getTime();

  const entriesUpToDate = journalEntries.filter(j => {
    const d = new Date(j.date).getTime();
    return !isNaN(d) && d <= cutoffTime;
  });

  const balances: { [accountId: string]: number } = {};
  const accountsList: { id: string; name: string; type: string; balance: number }[] = [];

  financialAccounts.filter(acc => acc.status === 'Active').forEach((acc) => {
    let bal = toNum(acc.openingBalance);

    entriesUpToDate.forEach((j) => {
      if (j.isVoided || j.subType === 'Opening Balance') return;
      j.entries.forEach((e) => {
        const matchesId = e.accountId === acc.id || e.financialAccountId === acc.id || j.financialAccountId === acc.id;
        const matchesName = e.accountName.toLowerCase().trim() === acc.accountName.toLowerCase().trim() ||
          acc.accountName.toLowerCase().includes(e.accountName.toLowerCase());

        if (matchesId || (e.accountType === 'Asset' && matchesName)) {
          if (e.type === 'DEBIT') {
            bal += toNum(e.amount);
          } else if (e.type === 'CREDIT') {
            bal -= toNum(e.amount);
          }
        }
      });
    });

    balances[acc.id] = bal;
    accountsList.push({
      id: acc.id,
      name: acc.accountName,
      type: acc.accountType,
      balance: bal
    });
  });

  return {
    reportDate: reportDate.toISOString(),
    balances,
    accounts: accountsList
  };
}

/**
 * 2. Calculate Profit and Loss for a given date range
 */
export function getProfitAndLoss(
  context: ReportingContext,
  startDate?: Date,
  endDate: Date = new Date()
): ProfitAndLossReport {
  const { journalEntries = [] } = context;
  const startTime = startDate ? startDate.getTime() : 0;
  const endTime = endDate.getTime();

  const periodEntries = journalEntries.filter(j => {
    if (j.isVoided) return false;
    const d = new Date(j.date).getTime();
    return !isNaN(d) && d >= startTime && d <= endTime;
  });

  let totalRevenue = 0;
  let totalOperationalExpenses = 0;
  let totalInterestExpenses = 0;

  const revenueByCategory: { [key: string]: number } = {};
  const expenseByCategory: { [key: string]: number } = {};

  periodEntries.forEach(j => {
    // 1. REVENUE
    if (j.type === 'Revenue' || j.subType === 'Sales Revenue' || j.subType === 'Other Income') {
      const debitLine = j.entries.find(e => e.type === 'DEBIT');
      const creditLine = j.entries.find(e => e.type === 'CREDIT');
      const amt = toNum(debitLine ? debitLine.amount : 0);
      totalRevenue += amt;

      const categoryName = creditLine ? creditLine.accountName : 'Sales Revenue';
      revenueByCategory[categoryName] = toNum(revenueByCategory[categoryName]) + amt;
    }

    // 2. OPERATIONAL EXPENSES
    if (j.type === 'Expense' || j.subType === 'Operational Expense') {
      const debitLine = j.entries.find(e => e.type === 'DEBIT');
      const amt = toNum(debitLine ? debitLine.amount : 0);
      totalOperationalExpenses += amt;

      const categoryName = debitLine ? debitLine.accountName : 'Miscellaneous';
      expenseByCategory[categoryName] = toNum(expenseByCategory[categoryName]) + amt;
    }

    // 3. LOAN INTEREST EXPENSES
    if (j.subType === 'Loan Repayment' && j.interestAmount) {
      const interestAmt = toNum(j.interestAmount);
      totalInterestExpenses += interestAmt;
      expenseByCategory['Loan Interest'] = toNum(expenseByCategory['Loan Interest']) + interestAmt;
    }
  });

  const netProfit = toNum(totalRevenue - totalOperationalExpenses - totalInterestExpenses);

  return {
    startDate: startDate ? startDate.toISOString() : 'Beginning of Time',
    endDate: endDate.toISOString(),
    totalRevenue,
    totalOperationalExpenses,
    totalInterestExpenses,
    netProfit,
    revenueByCategory,
    expenseByCategory
  };
}

/**
 * 3. Calculate Balance Sheet as of Report Date
 */
export function getBalanceSheet(context: ReportingContext, reportDate: Date = new Date()): BalanceSheetReport {
  const { journalEntries = [], assets = [], loans = [] } = context;
  const cutoffTime = reportDate.getTime();

  const entriesUpToDate = journalEntries.filter(j => {
    if (j.isVoided) return false;
    const d = new Date(j.date).getTime();
    return !isNaN(d) && d <= cutoffTime;
  });

  // 1. CASH & BANK ASSETS
  const accountBalancesData = getAccountBalances(context, reportDate);
  const cashAndBank = toNum(accountBalancesData.accounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0));

  // 2. FIXED ASSETS BOOK VALUE (Original Cost - Future Depreciation)
  const fixedAssetsBookValue = toNum(assets.reduce((sum, a) => {
    const dep = calculateDepreciation(a, reportDate);
    const val = dep && dep.currentValue !== undefined ? dep.currentValue : a.cost;
    return sum + toNum(val);
  }, 0));

  // 3. SECURITY DEPOSITS
  const securityDeposits = toNum(entriesUpToDate
    .filter(j => j.type === 'Deposit' || j.subType === 'Security Deposit')
    .reduce((sum, j) => sum + toNum(j.entries.find(e => e.type === 'DEBIT')?.amount), 0));

  const totalAssets = toNum(cashAndBank + fixedAssetsBookValue + securityDeposits);

  // 4. OUTSTANDING LOANS (LIABILITIES)
  const outstandingLoans = toNum(loans.reduce((sum, l) => sum + toNum(l.remainingBalance), 0));
  const totalLiabilities = outstandingLoans;

  // 5. OWNER EQUITY
  const openingCapital = toNum(entriesUpToDate
    .filter(j => j.subType === 'Opening Balance' || (j.type === 'Capital' && (j.subType === 'Opening Balance' || j.remarks?.toLowerCase().includes('opening'))))
    .reduce((sum, j) => sum + toNum(j.entries.find(e => e.type === 'CREDIT')?.amount), 0));

  const additionalCapital = toNum(entriesUpToDate
    .filter(j => j.subType === 'Owner Investment')
    .reduce((sum, j) => sum + toNum(j.entries.find(e => e.type === 'CREDIT')?.amount), 0));

  const ownerDrawings = toNum(entriesUpToDate
    .filter(j => j.type === 'Withdrawal' || j.subType === 'Owner Withdrawal')
    .reduce((sum, j) => sum + toNum(j.entries.find(e => e.type === 'DEBIT')?.amount), 0));

  const pnlReport = getProfitAndLoss(context, undefined, reportDate);
  const retainedEarnings = toNum(pnlReport.netProfit);

  const totalCurrentOwnerEquity = toNum(openingCapital + additionalCapital + retainedEarnings - ownerDrawings);
  const totalLiabilitiesAndEquity = toNum(totalLiabilities + totalCurrentOwnerEquity);

  // 6. VALIDATION ENGINE
  const validation = validateAccountingEquation(context, reportDate);

  return {
    reportDate: reportDate.toISOString(),
    assets: {
      cashAndBank,
      fixedAssetsBookValue,
      securityDeposits,
      totalAssets
    },
    liabilities: {
      outstandingLoans,
      totalLiabilities
    },
    ownerEquity: {
      openingCapital,
      additionalCapital,
      retainedEarnings,
      ownerDrawings,
      totalCurrentOwnerEquity
    },
    totalLiabilitiesAndEquity,
    validation
  };
}

/**
 * 4. Validate Fundamental Accounting Equation (Assets = Liabilities + Equity)
 */
export function validateAccountingEquation(context: ReportingContext, reportDate: Date = new Date()): AccountingEquationValidation {
  const { journalEntries = [], assets = [], loans = [] } = context;
  const cutoffTime = reportDate.getTime();

  const entriesUpToDate = journalEntries.filter(j => {
    if (j.isVoided) return false;
    const d = new Date(j.date).getTime();
    return !isNaN(d) && d <= cutoffTime;
  });

  const accountBalancesData = getAccountBalances(context, reportDate);
  const cashAndBank = toNum(accountBalancesData.accounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0));

  const fixedAssetsBookValue = toNum(assets.reduce((sum, a) => {
    const dep = calculateDepreciation(a, reportDate);
    const val = dep && dep.currentValue !== undefined ? dep.currentValue : a.cost;
    return sum + toNum(val);
  }, 0));

  const securityDeposits = toNum(entriesUpToDate
    .filter(j => j.type === 'Deposit' || j.subType === 'Security Deposit')
    .reduce((sum, j) => sum + toNum(j.entries.find(e => e.type === 'DEBIT')?.amount), 0));

  const totalAssets = toNum(cashAndBank + fixedAssetsBookValue + securityDeposits);

  const outstandingLoans = toNum(loans.reduce((sum, l) => sum + toNum(l.remainingBalance), 0));
  const totalLiabilities = outstandingLoans;

  const openingCapital = toNum(entriesUpToDate
    .filter(j => j.subType === 'Opening Balance' || (j.type === 'Capital' && (j.subType === 'Opening Balance' || j.remarks?.toLowerCase().includes('opening'))))
    .reduce((sum, j) => sum + toNum(j.entries.find(e => e.type === 'CREDIT')?.amount), 0));

  const additionalCapital = toNum(entriesUpToDate
    .filter(j => j.subType === 'Owner Investment')
    .reduce((sum, j) => sum + toNum(j.entries.find(e => e.type === 'CREDIT')?.amount), 0));

  const ownerDrawings = toNum(entriesUpToDate
    .filter(j => j.type === 'Withdrawal' || j.subType === 'Owner Withdrawal')
    .reduce((sum, j) => sum + toNum(j.entries.find(e => e.type === 'DEBIT')?.amount), 0));

  const pnlReport = getProfitAndLoss(context, undefined, reportDate);
  const retainedEarnings = toNum(pnlReport.netProfit);

  const totalOwnerEquity = toNum(openingCapital + additionalCapital + retainedEarnings - ownerDrawings);
  const totalLiabilitiesAndEquity = toNum(totalLiabilities + totalOwnerEquity);

  const imbalanceAmount = Math.abs(totalAssets - totalLiabilitiesAndEquity);
  const isValid = imbalanceAmount < 0.01;

  return {
    reportDate: reportDate.toISOString(),
    totalAssets,
    totalLiabilities,
    totalOwnerEquity,
    totalLiabilitiesAndEquity,
    imbalanceAmount,
    isValid,
    ...(!isValid ? {
      mismatchDetails: {
        assetsBreakdown: { cashAndBank, fixedAssetsBookValue, securityDeposits },
        liabilitiesBreakdown: { outstandingLoans },
        equityBreakdown: { openingCapital, additionalCapital, retainedEarnings, ownerDrawings }
      }
    } : {})
  };
}

/**
 * 5. Calculate Cash Position Report
 */
export function getCashPosition(context: ReportingContext, reportDate: Date = new Date()): CashPositionReport {
  const accountBalancesData = getAccountBalances(context, reportDate);
  const bankAndCashBalance = toNum(accountBalancesData.accounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0));
  const totalOutstandingLoans = toNum(context.loans.reduce((sum, l) => sum + toNum(l.remainingBalance), 0));

  return {
    reportDate: reportDate.toISOString(),
    bankAndCashBalance,
    totalOutstandingLoans,
    netLiquidPosition: toNum(bankAndCashBalance - totalOutstandingLoans),
    accountBreakdown: accountBalancesData.accounts
  };
}

/**
 * 6. Calculate Trial Balance as of Report Date
 */
export function getTrialBalance(context: ReportingContext, reportDate: Date = new Date()): TrialBalanceReport {
  const { journalEntries = [], categories = [] } = context;
  const cutoffTime = reportDate.getTime();

  const entriesUpToDate = journalEntries.filter(j => {
    if (j.isVoided) return false;
    const d = new Date(j.date).getTime();
    return !isNaN(d) && d <= cutoffTime;
  });

  const accountTotals: { [accountId: string]: { debit: number; credit: number; name: string; type: string } } = {};

  categories.forEach(c => {
    accountTotals[c.id] = { debit: 0, credit: 0, name: c.name, type: c.type };
  });

  entriesUpToDate.forEach(j => {
    j.entries.forEach(line => {
      if (!accountTotals[line.accountId]) {
        accountTotals[line.accountId] = {
          debit: 0,
          credit: 0,
          name: line.accountName,
          type: line.accountType
        };
      }

      if (line.type === 'DEBIT') {
        accountTotals[line.accountId].debit += toNum(line.amount);
      } else {
        accountTotals[line.accountId].credit += toNum(line.amount);
      }
    });
  });

  let totalDebits = 0;
  let totalCredits = 0;
  const items: TrialBalanceItem[] = [];

  Object.entries(accountTotals).forEach(([accId, acc]) => {
    if (acc.debit > 0 || acc.credit > 0) {
      totalDebits += acc.debit;
      totalCredits += acc.credit;
      items.push({
        accountId: accId,
        accountName: acc.name,
        accountType: acc.type,
        debit: acc.debit,
        credit: acc.credit
      });
    }
  });

  const imbalanceAmount = Math.abs(totalDebits - totalCredits);

  return {
    reportDate: reportDate.toISOString(),
    items,
    totalDebits,
    totalCredits,
    isBalanced: imbalanceAmount < 0.01,
    imbalanceAmount
  };
}

/**
 * 7. Retrieve General Ledger with Filters
 */
export function getGeneralLedger(context: ReportingContext, filters: LedgerFilters = {}): GeneralLedgerReport {
  let entries = [...(context.journalEntries || [])];

  if (filters.startDate) {
    const startT = filters.startDate.getTime();
    entries = entries.filter(e => new Date(e.date).getTime() >= startT);
  }

  if (filters.endDate) {
    const endT = filters.endDate.getTime();
    entries = entries.filter(e => new Date(e.date).getTime() <= endT);
  }

  if (filters.accountId) {
    entries = entries.filter(e => e.entries.some(line => line.accountId === filters.accountId));
  }

  if (filters.type) {
    entries = entries.filter(e => e.type === filters.type || e.subType === filters.type);
  }

  if (filters.searchTerm) {
    const term = filters.searchTerm.toLowerCase();
    entries = entries.filter(e =>
      e.remarks.toLowerCase().includes(term) ||
      e.id.toLowerCase().includes(term) ||
      e.entries.some(line => line.accountName.toLowerCase().includes(term))
    );
  }

  // Sort LIFO (Latest First)
  entries.sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    if (timeB !== timeA) return timeB - timeA;
    const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (createdB !== createdA) return createdB - createdA;
    return (b.id || '').localeCompare(a.id || '');
  });

  let totalDebits = 0;
  let totalCredits = 0;

  entries.forEach(e => {
    e.entries.forEach(line => {
      if (line.type === 'DEBIT') totalDebits += toNum(line.amount);
      if (line.type === 'CREDIT') totalCredits += toNum(line.amount);
    });
  });

  return {
    entries,
    totalEntries: entries.length,
    totalDebits,
    totalCredits
  };
}
