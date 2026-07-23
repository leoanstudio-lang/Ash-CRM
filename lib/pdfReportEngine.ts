// lib/pdfReportEngine.ts
// Centralized Executive Financial PDF Generator Engine for ASH CRM.
// Formats financial reports following strict corporate PDF standards:
// - Dark Brand Header Band (#0A0028)
// - Metadata Subheader (Period, Generated Date, Currency)
// - Minimal & Clean White Table Grid Styling (with full row total background highlights)
// - Quotation Standard Paginated Footer with Clickable Social Media PNG Icons

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CompanyProfile } from '../types';
import { stampWatermarkAllPages, loadWatermarkBase64 } from './pdfWatermark';

export interface FinancialReportData {
  totalRevenue: number;
  totalOperationalExpenses: number;
  totalInterestExpenses: number;
  netProfit: number;
  bankAndCashBalance: number;
  totalFixedAssetBookValue: number;
  totalSecurityDeposits: number;
  totalAssets: number;
  totalOutstandingLoans: number;
  openingCapital: number;
  additionalCapital: number;
  totalOwnerCapital: number;
  totalOwnerDrawings: number;
  retainedEarnings: number;
  totalCurrentOwnerEquity: number;
  netEquity: number;
  expenseByCategory: { [key: string]: number };
  revenueByCategory?: { [key: string]: number };
  cashFlow?: {
    operatingInflows: number;
    operatingOutflows: number;
    interestOutflows: number;
    netOperatingCash: number;
    assetPurchases: number;
    capitalInflows: number;
    withdrawals: number;
    netFinancingCash: number;
    openingCash: number;
    closingCash: number;
  };
  trialBalanceItems?: { name: string; debit: number; credit: number }[];
  generalLedgerEntries?: { date: string; voucher: string; type: string; remarks: string; debit: number; credit: number }[];
  vendorSummaries?: { name: string; count: number; lastDate: string; totalPurchases: number }[];
}

// Brand Colors
const DEEP_ECLIPSE: [number, number, number] = [10, 0, 40];    // #0A0028
const ROYAL_PURPLE: [number, number, number] = [108, 46, 247];  // #6C2EF7
const SLATE_HEADER: [number, number, number] = [248, 250, 252]; // #F8FAFC
const SLATE_BORDER: [number, number, number] = [226, 232, 240]; // #E2E8F0
const TEXT_DARK: [number, number, number] = [15, 23, 42];     // #0F172A
const TEXT_MUTED: [number, number, number] = [100, 116, 139];  // #64748B
const WHITE: [number, number, number] = [255, 255, 255];

// Helper Cache for Social Media PNG Icons (Base64)
const socialIconCache: Record<string, string | null> = {};

const loadSocialIconBase64 = async (iconFileName: string): Promise<string | null> => {
  if (socialIconCache[iconFileName] !== undefined) return socialIconCache[iconFileName];
  try {
    const resp = await fetch(`/${iconFileName}`);
    if (!resp.ok) {
      socialIconCache[iconFileName] = null;
      return null;
    }
    const blob = await resp.blob();
    const b64: string = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onloadend = () => (typeof reader.result === 'string' ? res(reader.result) : rej());
      reader.onerror = rej;
      reader.readAsDataURL(blob);
    });
    socialIconCache[iconFileName] = b64;
    return b64;
  } catch {
    socialIconCache[iconFileName] = null;
    return null;
  }
};

/**
 * Draws the Company Header Band (#0A0028)
 */
const drawHeaderBand = (
  doc: jsPDF,
  co: CompanyProfile | null,
  reportTitle: string,
  periodLabel: string
) => {
  const pageWidth = doc.internal.pageSize.width;

  // 1. Dark Header Rect
  doc.setFillColor(...DEEP_ECLIPSE);
  doc.rect(0, 0, pageWidth, 46, 'F');

  // 2. Company Name & Tagline
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...WHITE);
  doc.text(co?.companyName || 'Ash Creative Studio', 14, 18);

  let bandTextY = 23;
  if (co?.tagline && co.tagline.trim() !== '') {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(200, 190, 230);
    doc.text(co.tagline, 14, bandTextY);
    bandTextY += 5;
  }

  // 3. Contacts
  if (co?.contacts && co.contacts.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(180, 170, 210);

    const getPriority = (val: string) => {
      if (val.includes('@')) return 2;
      if (val.replace(/\D/g, '').length >= 10) return 1;
      return 3;
    };
    const sorted = [...co.contacts].sort((a, b) => getPriority(a.value || '') - getPriority(b.value || ''));

    sorted.slice(0, 3).forEach((contact) => {
      if (bandTextY < 42 && contact.value) {
        doc.text(contact.value, 14, bandTextY);
        bandTextY += 4.5;
      }
    });
  }

  // 4. Report Title Right Aligned
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...WHITE);
  doc.text(reportTitle, pageWidth - 14, 28, { align: 'right' });

  // 5. Metadata Row Below Band
  const detailsY = 56;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DEEP_ECLIPSE);
  doc.text('Reporting Period:', 14, detailsY);
  doc.text('Generated Date:', 110, detailsY);
  doc.text('Currency:', 165, detailsY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_MUTED);
  doc.text(periodLabel, 45, detailsY);
  doc.text(new Date().toLocaleDateString('en-GB'), 137, detailsY);
  doc.text('INR (Rs.)', 182, detailsY);

  // Separator line
  doc.setDrawColor(...SLATE_BORDER);
  doc.setLineWidth(0.5);
  doc.line(14, detailsY + 5, pageWidth - 14, detailsY + 5);

  return detailsY + 12;
};

/**
 * Stamps footer using Quotation Module standard:
 * - Purple Accent Separator Line (#6C2EF7)
 * - Company Name & Tagline on Left
 * - Center Page Numbering
 * - Dynamic Clickable Social Media PNG Icons on Right
 */
const drawFooterAndWatermark = async (
  doc: jsPDF,
  co: CompanyProfile | null,
  reportTitle: string
) => {
  const watermarkB64 = await loadWatermarkBase64();
  if (watermarkB64) {
    stampWatermarkAllPages(doc, watermarkB64, 0.25);
  }

  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const footerBandHeight = 28;
  const footerBandY = pageHeight - footerBandHeight;

  const fallbackIconMap: Record<string, string> = {
    instagram: 'instagram.png',
    facebook: 'Facebook.png',
    youtube: 'YouTube.png',
    linkedin: 'linkedin.png',
    behance: 'Behance.png',
    x: 'X.png',
    twitter: 'X.png',
    website: 'Website.png',
    whats: 'whatsapp.png',
    whatsapp: 'whatsapp.png',
  };

  const socials = co?.socials ?? [];

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Continuation Header for Page 2+
    if (i > 1) {
      doc.setFillColor(...DEEP_ECLIPSE);
      doc.rect(0, 0, pageWidth, 14, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...WHITE);
      doc.text(co?.companyName || 'Ash Creative Studio', 14, 9);
      doc.text(`${reportTitle} — continued`, pageWidth - 14, 9, { align: 'right' });
    }

    // === FOOTER: Purple separator line (Quotation module standard) ===
    doc.setDrawColor(...ROYAL_PURPLE);
    doc.setLineWidth(0.6);
    doc.line(14, footerBandY, pageWidth - 14, footerBandY);

    // Left: Company Name in dark
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...DEEP_ECLIPSE);
    doc.text(co?.companyName || 'Ash Creative Studio', 14, footerBandY + 8);

    // Left: Tagline in muted
    if (co?.tagline && co.tagline.trim() !== '') {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(co.tagline, 14, footerBandY + 14);
    }

    // Center: Page number
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...ROYAL_PURPLE);
    doc.text(`${i}/${pageCount}`, pageWidth / 2, footerBandY + 10, { align: 'center' });

    // Right: Dynamic Social Icons from Quotation Module
    const iconSize = 5;
    const spacing = 3;
    let rightX = pageWidth - 14;
    const iconY = footerBandY + 5;

    for (let s = socials.length - 1; s >= 0; s--) {
      const social = socials[s];
      const rawLabel = social.label ? social.label.toLowerCase().trim() : '';
      if (!rawLabel) continue;

      const labelKey = rawLabel.replace(/\s+/g, '_');
      const iconFile = fallbackIconMap[labelKey] || `${labelKey}.png`;

      const b64 = await loadSocialIconBase64(iconFile);
      if (b64) {
        const iconX = rightX - iconSize;
        doc.addImage(b64, 'PNG', iconX, iconY, iconSize, iconSize);

        if (social.value) {
          const url = social.value.startsWith('http') ? social.value : `https://${social.value}`;
          doc.link(iconX, iconY, iconSize, iconSize, { url });
        }

        rightX -= (iconSize + spacing);
      }
    }
  }
};

/**
 * Builds table options with Clean Web UI styling & proper bottom margins to avoid footer overlap.
 * Full row highlight applied for all cells in Summary/Total rows.
 */
const buildCleanTable = (
  doc: jsPDF,
  startY: number,
  head: string[][],
  body: string[][]
) => {
  autoTable(doc, {
    startY,
    head,
    body,
    theme: 'grid',
    headStyles: {
      fillColor: SLATE_HEADER,
      textColor: TEXT_DARK,
      fontStyle: 'bold',
      fontSize: 8,
      lineWidth: 0.2,
      lineColor: SLATE_BORDER,
      cellPadding: 3
    },
    bodyStyles: {
      textColor: [51, 65, 85],
      fontSize: 8,
      lineWidth: 0.2,
      lineColor: SLATE_BORDER,
      cellPadding: 2.5
    },
    didParseCell: (data) => {
      const rowCells = data.row.cells;
      const firstCellText = rowCells[0] ? rowCells[0].text.join(' ').trim() : '';

      const isTotalOrNetRow =
        firstCellText.startsWith('TOTAL') ||
        firstCellText.startsWith('NET OPERATING') ||
        firstCellText.startsWith('NET LIQUID') ||
        firstCellText.startsWith('NET CASH') ||
        firstCellText.startsWith('CLOSING CASH');

      const isSectionHeaderRow =
        firstCellText === 'ASSETS' ||
        firstCellText === 'LIABILITIES & EQUITY' ||
        firstCellText === 'REVENUE & INCOMES' ||
        firstCellText === 'OPERATIONAL EXPENSES' ||
        firstCellText === 'FINANCIAL COSTS' ||
        firstCellText === 'OPERATING ACTIVITIES' ||
        firstCellText === 'INVESTING ACTIVITIES' ||
        firstCellText === 'FINANCING ACTIVITIES';

      if (isTotalOrNetRow) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = TEXT_DARK;
        data.cell.styles.fillColor = [241, 245, 249]; // #F1F5F9 across ALL cells in the row!
      } else if (isSectionHeaderRow) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = TEXT_DARK;
        data.cell.styles.fillColor = [248, 250, 252]; // #F8FAFC
      }
    },
    margin: { left: 14, right: 14, top: 58, bottom: 32 }
  });

  return (doc as any).lastAutoTable.finalY;
};

/**
 * GENERATE SINGLE STATEMENT PDF (P&L, Balance Sheet, Cash Position, or Expense Summary)
 */
export const generateSingleFinancialReportPDF = async (
  reportType: 'pnl' | 'balanceSheet' | 'cashPosition' | 'expenses',
  periodLabel: string,
  co: CompanyProfile | null,
  data: FinancialReportData
) => {
  const doc = new jsPDF();

  let reportTitle = 'PROFIT & LOSS STATEMENT';
  let fileName = `P&L_Statement_${periodLabel.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

  if (reportType === 'balanceSheet') {
    reportTitle = 'BALANCE SHEET';
    fileName = `Balance_Sheet_${periodLabel.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  } else if (reportType === 'cashPosition') {
    reportTitle = 'CASH POSITION REPORT';
    fileName = `Cash_Position_${periodLabel.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  } else if (reportType === 'expenses') {
    reportTitle = 'EXPENSE SUMMARY';
    fileName = `Expense_Summary_${periodLabel.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  }

  const startY = drawHeaderBand(doc, co, reportTitle, periodLabel);

  let head: string[][] = [];
  let body: string[][] = [];

  if (reportType === 'pnl') {
    head = [['Particulars / Line Items', 'Amount (Rs.)']];
    body.push(['REVENUE & INCOMES', '']);
    body.push(['   Sales & Service Revenue', `Rs. ${data.totalRevenue.toLocaleString('en-IN')}`]);
    body.push(['TOTAL REVENUE', `Rs. ${data.totalRevenue.toLocaleString('en-IN')}`]);

    body.push(['OPERATIONAL EXPENSES', '']);
    if (Object.keys(data.expenseByCategory).length === 0) {
      body.push(['   No operational expenses recorded', 'Rs. 0']);
    } else {
      Object.entries(data.expenseByCategory).forEach(([cat, amt]) => {
        body.push([`   ${cat}`, `Rs. ${amt.toLocaleString('en-IN')}`]);
      });
    }
    body.push(['TOTAL OPERATIONAL EXPENSES', `Rs. ${data.totalOperationalExpenses.toLocaleString('en-IN')}`]);

    if (data.totalInterestExpenses > 0) {
      body.push(['FINANCIAL COSTS', '']);
      body.push(['   Loan Interest Expense', `Rs. ${data.totalInterestExpenses.toLocaleString('en-IN')}`]);
    }
    body.push(['NET OPERATING PROFIT', `Rs. ${data.netProfit.toLocaleString('en-IN')}`]);

  } else if (reportType === 'balanceSheet') {
    head = [['Particulars / Line Items', 'Amount (Rs.)']];
    body.push(['ASSETS', '']);
    body.push(['   Cash & Bank Balances', `Rs. ${Math.max(0, data.bankAndCashBalance).toLocaleString('en-IN')}`]);
    body.push(['   Fixed Assets (Net Book Value)', `Rs. ${data.totalFixedAssetBookValue.toLocaleString('en-IN')}`]);
    body.push(['   Security Deposits', `Rs. ${data.totalSecurityDeposits.toLocaleString('en-IN')}`]);
    body.push(['TOTAL ASSETS', `Rs. ${data.totalAssets.toLocaleString('en-IN')}`]);

    body.push(['LIABILITIES & EQUITY', '']);
    body.push(['   Outstanding Loans', `Rs. ${data.totalOutstandingLoans.toLocaleString('en-IN')}`]);
    body.push(['   Opening Capital', `Rs. ${data.openingCapital.toLocaleString('en-IN')}`]);
    if (data.additionalCapital > 0) {
      body.push(['   Additional Capital', `Rs. ${data.additionalCapital.toLocaleString('en-IN')}`]);
    }
    body.push(['   Less: Owner Withdrawals', `- Rs. ${data.totalOwnerDrawings.toLocaleString('en-IN')}`]);
    body.push(['   Retained Earnings / Accumulated Profit (Loss)', `Rs. ${data.retainedEarnings.toLocaleString('en-IN')}`]);
    body.push(['   Total Current Owner Equity', `Rs. ${data.totalCurrentOwnerEquity.toLocaleString('en-IN')}`]);
    body.push(['TOTAL LIABILITIES & EQUITY', `Rs. ${(data.totalOutstandingLoans + data.totalCurrentOwnerEquity).toLocaleString('en-IN')}`]);

  } else if (reportType === 'cashPosition') {
    head = [['Liquidity & Debt Indicator', 'Amount (Rs.)']];
    body.push(['Estimated Bank & Cash Liquidity', `Rs. ${Math.max(0, data.bankAndCashBalance).toLocaleString('en-IN')}`]);
    body.push(['Total Outstanding Debt Obligations', `Rs. ${data.totalOutstandingLoans.toLocaleString('en-IN')}`]);
    body.push(['NET LIQUID POSITION', `Rs. ${(Math.max(0, data.bankAndCashBalance) - data.totalOutstandingLoans).toLocaleString('en-IN')}`]);

  } else if (reportType === 'expenses') {
    head = [['Expense Category', 'Share (%)', 'Amount (Rs.)']];
    if (Object.keys(data.expenseByCategory).length === 0) {
      body.push(['No operational expenses recorded', '0%', 'Rs. 0']);
    } else {
      Object.entries(data.expenseByCategory).forEach(([cat, amt]) => {
        const pct = data.totalOperationalExpenses > 0 ? ((amt / data.totalOperationalExpenses) * 100).toFixed(1) : '0';
        body.push([cat, `${pct}%`, `Rs. ${amt.toLocaleString('en-IN')}`]);
      });
    }
    body.push(['TOTAL OPERATIONAL EXPENSES', '100%', `Rs. ${data.totalOperationalExpenses.toLocaleString('en-IN')}`]);
  }

  buildCleanTable(doc, startY, head, body);
  await drawFooterAndWatermark(doc, co, reportTitle);

  doc.save(fileName);
};

/**
 * GENERATE MASTER FINANCIAL PACKAGE PDF (ALL 9 REPORTS IN ONE UNIFIED PDF)
 */
export const generateMasterFinancialPackagePDF = async (
  periodLabel: string,
  co: CompanyProfile | null,
  data: FinancialReportData
) => {
  const doc = new jsPDF();
  const masterTitle = 'EXECUTIVE FINANCIAL REPORT PACKAGE';
  const fileName = `Financial_Master_Package_${periodLabel.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

  // 1. PROFIT & LOSS STATEMENT
  let startY = drawHeaderBand(doc, co, 'PROFIT & LOSS STATEMENT', periodLabel);
  let head = [['Particulars / Line Items', 'Amount (Rs.)']];
  let body: string[][] = [];

  body.push(['REVENUE & INCOMES', '']);
  body.push(['   Sales & Service Revenue', `Rs. ${data.totalRevenue.toLocaleString('en-IN')}`]);
  body.push(['TOTAL REVENUE', `Rs. ${data.totalRevenue.toLocaleString('en-IN')}`]);

  body.push(['OPERATIONAL EXPENSES', '']);
  if (Object.keys(data.expenseByCategory).length === 0) {
    body.push(['   No operational expenses recorded', 'Rs. 0']);
  } else {
    Object.entries(data.expenseByCategory).forEach(([cat, amt]) => {
      body.push([`   ${cat}`, `Rs. ${amt.toLocaleString('en-IN')}`]);
    });
  }
  body.push(['TOTAL OPERATIONAL EXPENSES', `Rs. ${data.totalOperationalExpenses.toLocaleString('en-IN')}`]);

  if (data.totalInterestExpenses > 0) {
    body.push(['FINANCIAL COSTS', '']);
    body.push(['   Loan Interest Expense', `Rs. ${data.totalInterestExpenses.toLocaleString('en-IN')}`]);
  }
  body.push(['NET OPERATING PROFIT', `Rs. ${data.netProfit.toLocaleString('en-IN')}`]);

  buildCleanTable(doc, startY, head, body);

  // 2. BALANCE SHEET
  doc.addPage();
  startY = drawHeaderBand(doc, co, 'BALANCE SHEET', periodLabel);
  head = [['Particulars / Line Items', 'Amount (Rs.)']];
  body = [];

  body.push(['ASSETS', '']);
  body.push(['   Cash & Bank Balances', `Rs. ${Math.max(0, data.bankAndCashBalance).toLocaleString('en-IN')}`]);
  body.push(['   Fixed Assets (Net Book Value)', `Rs. ${data.totalFixedAssetBookValue.toLocaleString('en-IN')}`]);
  body.push(['   Security Deposits', `Rs. ${data.totalSecurityDeposits.toLocaleString('en-IN')}`]);
  body.push(['TOTAL ASSETS', `Rs. ${data.totalAssets.toLocaleString('en-IN')}`]);

  body.push(['LIABILITIES & EQUITY', '']);
  body.push(['   Outstanding Loans', `Rs. ${data.totalOutstandingLoans.toLocaleString('en-IN')}`]);
  body.push(['   Opening Capital', `Rs. ${data.openingCapital.toLocaleString('en-IN')}`]);
  if (data.additionalCapital > 0) {
    body.push(['   Additional Capital', `Rs. ${data.additionalCapital.toLocaleString('en-IN')}`]);
  }
  body.push(['   Less: Owner Withdrawals', `- Rs. ${data.totalOwnerDrawings.toLocaleString('en-IN')}`]);
  body.push(['   Retained Earnings / Accumulated Profit (Loss)', `Rs. ${data.retainedEarnings.toLocaleString('en-IN')}`]);
  body.push(['   Total Current Owner Equity', `Rs. ${data.totalCurrentOwnerEquity.toLocaleString('en-IN')}`]);
  body.push(['TOTAL LIABILITIES & EQUITY', `Rs. ${(data.totalOutstandingLoans + data.totalCurrentOwnerEquity).toLocaleString('en-IN')}`]);

  buildCleanTable(doc, startY, head, body);

  // 3. CASH FLOW STATEMENT
  doc.addPage();
  startY = drawHeaderBand(doc, co, 'CASH FLOW STATEMENT', periodLabel);
  head = [['Cash Flow Particulars', 'Amount (Rs.)']];
  body = [
    ['OPERATING ACTIVITIES', ''],
    ['   Cash Received from Customers', `Rs. ${(data.cashFlow?.operatingInflows || data.totalRevenue).toLocaleString('en-IN')}`],
    ['   Operating Expenses Paid', `- Rs. ${(data.cashFlow?.operatingOutflows || data.totalOperationalExpenses).toLocaleString('en-IN')}`],
    ['   Interest Paid', `- Rs. ${(data.cashFlow?.interestOutflows || data.totalInterestExpenses).toLocaleString('en-IN')}`],
    ['NET CASH FROM OPERATING ACTIVITIES', `Rs. ${(data.cashFlow?.netOperatingCash || data.netProfit).toLocaleString('en-IN')}`],
    ['INVESTING ACTIVITIES', ''],
    ['   Fixed Asset Purchases', `- Rs. ${(data.cashFlow?.assetPurchases || 0).toLocaleString('en-IN')}`],
    ['NET CASH USED IN INVESTING ACTIVITIES', `- Rs. ${(data.cashFlow?.assetPurchases || 0).toLocaleString('en-IN')}`],
    ['FINANCING ACTIVITIES', ''],
    ['   Owner Capital Inflows', `Rs. ${(data.cashFlow?.capitalInflows || 0).toLocaleString('en-IN')}`],
    ['   Owner Withdrawals', `- Rs. ${(data.cashFlow?.withdrawals || data.totalOwnerDrawings).toLocaleString('en-IN')}`],
    ['NET CASH FROM FINANCING ACTIVITIES', `Rs. ${(data.cashFlow?.netFinancingCash || 0).toLocaleString('en-IN')}`],
    ['CLOSING CASH & BANK BALANCE', `Rs. ${(data.cashFlow?.closingCash || data.bankAndCashBalance).toLocaleString('en-IN')}`]
  ];
  buildCleanTable(doc, startY, head, body);

  // 4. CASH POSITION REPORT
  doc.addPage();
  startY = drawHeaderBand(doc, co, 'CASH POSITION REPORT', periodLabel);
  head = [['Liquidity & Debt Indicator', 'Amount (Rs.)']];
  body = [
    ['Estimated Bank & Cash Liquidity', `Rs. ${Math.max(0, data.bankAndCashBalance).toLocaleString('en-IN')}`],
    ['Total Outstanding Debt Obligations', `Rs. ${data.totalOutstandingLoans.toLocaleString('en-IN')}`],
    ['NET LIQUID POSITION', `Rs. ${(Math.max(0, data.bankAndCashBalance) - data.totalOutstandingLoans).toLocaleString('en-IN')}`]
  ];
  buildCleanTable(doc, startY, head, body);

  // 5. TRIAL BALANCE
  if (data.trialBalanceItems && data.trialBalanceItems.length > 0) {
    doc.addPage();
    startY = drawHeaderBand(doc, co, 'TRIAL BALANCE', periodLabel);
    head = [['Account Particulars', 'Debit (Rs.)', 'Credit (Rs.)']];
    body = data.trialBalanceItems.map(item => [
      item.name,
      item.debit > 0 ? `Rs. ${item.debit.toLocaleString('en-IN')}` : '-',
      item.credit > 0 ? `Rs. ${item.credit.toLocaleString('en-IN')}` : '-'
    ]);
    const totDebit = data.trialBalanceItems.reduce((s, i) => s + i.debit, 0);
    const totCredit = data.trialBalanceItems.reduce((s, i) => s + i.credit, 0);
    body.push(['TOTALS', `Rs. ${totDebit.toLocaleString('en-IN')}`, `Rs. ${totCredit.toLocaleString('en-IN')}`]);
    buildCleanTable(doc, startY, head, body);
  }

  // 6. GENERAL LEDGER SUMMARY
  if (data.generalLedgerEntries && data.generalLedgerEntries.length > 0) {
    doc.addPage();
    startY = drawHeaderBand(doc, co, 'GENERAL LEDGER', periodLabel);
    head = [['Date', 'Voucher ID', 'Description', 'Debit (Rs.)', 'Credit (Rs.)']];
    body = data.generalLedgerEntries.slice(0, 40).map(e => [
      e.date,
      e.voucher,
      e.remarks || e.type,
      e.debit > 0 ? `Rs. ${e.debit.toLocaleString('en-IN')}` : '-',
      e.credit > 0 ? `Rs. ${e.credit.toLocaleString('en-IN')}` : '-'
    ]);
    buildCleanTable(doc, startY, head, body);
  }

  // 7. VENDOR SUMMARY REPORT
  if (data.vendorSummaries && data.vendorSummaries.length > 0) {
    doc.addPage();
    startY = drawHeaderBand(doc, co, 'VENDOR SUMMARY REPORT', periodLabel);
    head = [['Vendor Name', 'Transactions', 'Last Tx Date', 'Total Purchases (Rs.)']];
    body = data.vendorSummaries.map(v => [
      v.name,
      v.count.toString(),
      v.lastDate,
      `Rs. ${v.totalPurchases.toLocaleString('en-IN')}`
    ]);
    buildCleanTable(doc, startY, head, body);
  }

  // 8. EXPENSE ANALYSIS
  doc.addPage();
  startY = drawHeaderBand(doc, co, 'EXPENSE ANALYSIS', periodLabel);
  head = [['Expense Category', 'Share (%)', 'Amount (Rs.)']];
  body = [];
  if (Object.keys(data.expenseByCategory).length === 0) {
    body.push(['No operational expenses recorded', '0%', 'Rs. 0']);
  } else {
    Object.entries(data.expenseByCategory).forEach(([cat, amt]) => {
      const pct = data.totalOperationalExpenses > 0 ? ((amt / data.totalOperationalExpenses) * 100).toFixed(1) : '0';
      body.push([cat, `${pct}%`, `Rs. ${amt.toLocaleString('en-IN')}`]);
    });
  }
  body.push(['TOTAL OPERATIONAL EXPENSES', '100%', `Rs. ${data.totalOperationalExpenses.toLocaleString('en-IN')}`]);
  buildCleanTable(doc, startY, head, body);

  // 9. REVENUE ANALYSIS
  doc.addPage();
  startY = drawHeaderBand(doc, co, 'REVENUE ANALYSIS', periodLabel);
  head = [['Service / Category', 'Share (%)', 'Amount (Rs.)']];
  body = [];
  const revCats = data.revenueByCategory || {};
  if (Object.keys(revCats).length === 0) {
    body.push(['Sales Revenue', '100%', `Rs. ${data.totalRevenue.toLocaleString('en-IN')}`]);
  } else {
    Object.entries(revCats).forEach(([cat, amt]) => {
      const pct = data.totalRevenue > 0 ? ((amt / data.totalRevenue) * 100).toFixed(1) : '0';
      body.push([cat, `${pct}%`, `Rs. ${amt.toLocaleString('en-IN')}`]);
    });
  }
  body.push(['TOTAL REVENUE', '100%', `Rs. ${data.totalRevenue.toLocaleString('en-IN')}`]);
  buildCleanTable(doc, startY, head, body);

  await drawFooterAndWatermark(doc, co, masterTitle);

  doc.save(fileName);
};

/**
 * GENERATE GENERIC FINANCIAL REPORT PDF (Trial Balance, General Ledger, Cash Flow, Vendor, Analysis, etc.)
 */
export const generateGenericReportPDF = async (
  reportTitle: string,
  periodLabel: string,
  co: CompanyProfile | null,
  head: string[][],
  body: string[][],
  customFileName?: string
) => {
  const doc = new jsPDF();
  const startY = drawHeaderBand(doc, co, reportTitle.toUpperCase(), periodLabel);
  buildCleanTable(doc, startY, head, body);
  await drawFooterAndWatermark(doc, co, reportTitle);
  const outName = customFileName || `${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${periodLabel.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  doc.save(outName);
};
