import React, { useState, useMemo } from 'react';
import { JournalEntry, AccountingCategory, AccountingAsset, AccountingLoan } from '../../types';
import { calculateDepreciation } from '../../lib/accounting';
import { PieChart, FileText, Download, TrendingUp, TrendingDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface ReportsViewProps {
    journalEntries: JournalEntry[];
    categories: AccountingCategory[];
    assets: AccountingAsset[];
    loans: AccountingLoan[];
}

const ReportsView: React.FC<ReportsViewProps> = ({ journalEntries, categories, assets, loans }) => {
    const [reportType, setReportType] = useState<'pnl' | 'balance_sheet' | 'cash_flow'>('pnl');
    const [dateRange, setDateRange] = useState<'this_month' | 'last_month' | 'this_quarter' | 'half_year' | 'this_year' | 'all_time'>('this_year');

    // Helper to filter entries by date range
    const filteredEntries = useMemo(() => {
        let filtered = [...journalEntries];
        const now = new Date();

        if (dateRange === 'this_month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            filtered = filtered.filter(e => new Date(e.date) >= startOfMonth);
        } else if (dateRange === 'last_month') {
            const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            filtered = filtered.filter(e => {
                const d = new Date(e.date);
                return d >= startOfLastMonth && d <= endOfLastMonth;
            });
        } else if (dateRange === 'this_year') {
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            filtered = filtered.filter(e => new Date(e.date) >= startOfYear);
        } else if (dateRange === 'this_quarter') {
            const currentQuarter = Math.floor(now.getMonth() / 3);
            const startOfQuarter = new Date(now.getFullYear(), currentQuarter * 3, 1);
            filtered = filtered.filter(e => new Date(e.date) >= startOfQuarter);
        } else if (dateRange === 'half_year') {
            const currentMonth = now.getMonth();
            const startMonth = currentMonth < 6 ? 0 : 6;
            const startOfHalfYear = new Date(now.getFullYear(), startMonth, 1);
            filtered = filtered.filter(e => new Date(e.date) >= startOfHalfYear);
        }
        return filtered;
    }, [journalEntries, dateRange]);

    // --- Profit & Loss Calculation ---
    const pnlData = useMemo(() => {
        const revenueByCat: Record<string, number> = {};
        const expenseByCat: Record<string, number> = {};
        let totalRevenue = 0;
        let totalExpense = 0;

        filteredEntries.forEach(entry => {
            if (entry.type === 'Revenue') {
                entry.entries.forEach(line => {
                    if (line.type === 'CREDIT') { // Revenue increases with Credit
                        const cat = categories.find(c => c.id === line.accountId);
                        if (cat && cat.type === 'Revenue') {
                            revenueByCat[cat.name] = (revenueByCat[cat.name] || 0) + line.amount;
                            totalRevenue += line.amount;
                        }
                    }
                });
            } else if (entry.type === 'Expense') {
                entry.entries.forEach(line => {
                    if (line.type === 'DEBIT') { // Expense increases with Debit
                        const cat = categories.find(c => c.id === line.accountId);
                        if (cat && cat.type === 'Expense') {
                            expenseByCat[cat.name] = (expenseByCat[cat.name] || 0) + line.amount;
                            totalExpense += line.amount;
                        }
                    }
                });
            }
        });

        // Calculate Depreciation Expense for the period (Simplified: total accumulated allocated to this period if we had specific dates, but for now we'll just show total accumulated up to now as an annualized figure or total to date. For a real P&L, it should be prorated by dateRange. For simplicity here, we'll exclude it from dynamic P&L unless we build a complex engine, but let's add a placeholder or simple calculation)
        let depreciationExpense = 0;
        const now = new Date();
        assets.forEach(asset => {
            const { accumulated } = calculateDepreciation(asset, now);
            // Extremely simplified: we just take a flat monthly/yearly slice based on dateRange
            // In a real app, this would be precise daily calculations based on date ranges.
            if (dateRange === 'this_year') {
                depreciationExpense += asset.cost / asset.usefulLifeYears;
            } else if (dateRange === 'this_month' || dateRange === 'last_month') {
                depreciationExpense += (asset.cost / asset.usefulLifeYears) / 12;
            } else {
                depreciationExpense += accumulated;
            }
        });

        totalExpense += depreciationExpense;
        expenseByCat['Depreciation'] = depreciationExpense;

        return {
            revenueByCat,
            expenseByCat,
            totalRevenue,
            totalExpense,
            netProfit: totalRevenue - totalExpense
        };
    }, [filteredEntries, categories, assets, dateRange]);

    // --- Balance Sheet Calculation ---
    const balanceSheetData = useMemo(() => {
        // Balance sheet is a snapshot in time. Usually 'as of today' or 'end of period'.
        // For simplicity, we calculate balances based on ALL entries up to the end of the selected period.
        // E.g., if 'this_year', it's up to today. If 'last_month', up to end of last month.

        const balances: Record<string, number> = {};

        // Initialize with categories
        categories.forEach(c => balances[c.id] = 0);

        const targetDate = new Date(); // To be strict, this should adjust based on dateRange (e.g. end of last month). We assume 'as of today' for this quick demo.

        const allEntriesUpToTarget = journalEntries; // Simplified

        allEntriesUpToTarget.forEach(entry => {
            entry.entries.forEach(line => {
                const cat = categories.find(c => c.id === line.accountId);
                if (!cat) return;

                // Asset & Expense increase with Debit
                // Liability, Equity, Revenue increase with Credit
                if (cat.type === 'Asset' || cat.type === 'Expense') {
                    if (line.type === 'DEBIT') balances[line.accountId] += line.amount;
                    if (line.type === 'CREDIT') balances[line.accountId] -= line.amount;
                } else {
                    if (line.type === 'CREDIT') balances[line.accountId] += line.amount;
                    if (line.type === 'DEBIT') balances[line.accountId] -= line.amount;
                }
            });
        });

        const assetsItems: { name: string, balance: number }[] = [];
        const liabilitiesItems: { name: string, balance: number }[] = [];
        const equityItems: { name: string, balance: number }[] = [];

        let totalAssets = 0;
        let totalLiabilities = 0;
        let totalEquity = 0;

        // Group Account Balances
        categories.forEach(cat => {
            const bal = balances[cat.id];
            if (bal !== 0) {
                if (cat.type === 'Asset') {
                    assetsItems.push({ name: cat.name, balance: bal });
                    totalAssets += bal;
                }
                if (cat.type === 'Liability') {
                    liabilitiesItems.push({ name: cat.name, balance: bal });
                    totalLiabilities += bal;
                }
                if (cat.type === 'Equity') {
                    equityItems.push({ name: cat.name, balance: bal });
                    totalEquity += bal;
                }
            }
        });

        // Add Fixed Assets Net Book Value
        let fixedAssetsNBV = 0;
        assets.forEach(asset => {
            const { currentValue } = calculateDepreciation(asset, targetDate);
            fixedAssetsNBV += currentValue;
        });
        if (fixedAssetsNBV > 0) {
            assetsItems.push({ name: 'Fixed Assets (Net)', balance: fixedAssetsNBV });
            totalAssets += fixedAssetsNBV;
        }

        // Compute Net Income to drop into Equity
        // Note: A true balance sheet would roll over prior years' retained earnings.
        // This is dynamic. We use the full PNL net profit across ALL TIME.
        let allTimeRevenue = 0;
        let allTimeExpense = 0;
        allEntriesUpToTarget.forEach(entry => {
            entry.entries.forEach(line => {
                const cat = categories.find(c => c.id === line.accountId);
                if (cat?.type === 'Revenue' && line.type === 'CREDIT') allTimeRevenue += line.amount;
                if (cat?.type === 'Expense' && line.type === 'DEBIT') allTimeExpense += line.amount;
            });
        });

        let allTimeDepreciation = 0;
        assets.forEach(a => {
            const { accumulated } = calculateDepreciation(a, targetDate);
            allTimeDepreciation += accumulated;
        });

        const netIncome = allTimeRevenue - (allTimeExpense + allTimeDepreciation);
        if (netIncome !== 0) {
            equityItems.push({ name: 'Retained Earnings (Net Income)', balance: netIncome });
            totalEquity += netIncome;
        }

        return {
            assetsItems,
            liabilitiesItems,
            equityItems,
            totalAssets,
            totalLiabilitiesAndEquity: totalLiabilities + totalEquity
        };

    }, [journalEntries, categories, assets, loans]);


    const renderPNL = () => (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-4xl mx-auto animate-in fade-in">
            <div className="text-center mb-8 border-b border-slate-200 pb-8">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Income Statement</h2>
                <p className="text-slate-500 font-bold text-sm mt-1 uppercase tracking-widest">{dateRange.replace('_', ' ')}</p>
            </div>

            <div className="space-y-8">
                {/* Revenue Section */}
                <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-emerald-600 mb-4 border-b border-slate-50 pb-2">Revenue</h3>
                    <div className="space-y-2">
                        {Object.entries(pnlData.revenueByCat).map(([name, amount]) => (
                            <div key={name} className="flex justify-between text-sm py-1 font-bold text-slate-700">
                                <span>{name}</span>
                                <span>₹{amount.toLocaleString()}</span>
                            </div>
                        ))}
                        {Object.keys(pnlData.revenueByCat).length === 0 && <p className="text-xs text-slate-400 italic">No revenue for this period</p>}
                    </div>
                    <div className="flex justify-between font-black text-slate-900 mt-4 pt-2 border-t border-slate-100">
                        <span>Total Revenue</span>
                        <span>₹{pnlData.totalRevenue.toLocaleString()}</span>
                    </div>
                </div>

                {/* Expense Section */}
                <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-red-600 mb-4 border-b border-slate-50 pb-2">Operating Expenses</h3>
                    <div className="space-y-2">
                        {Object.entries(pnlData.expenseByCat).map(([name, amount]) => (
                            <div key={name} className="flex justify-between text-sm py-1 font-bold text-slate-700">
                                <span>{name}</span>
                                <span>₹{amount.toLocaleString()}</span>
                            </div>
                        ))}
                        {Object.keys(pnlData.expenseByCat).length === 0 && <p className="text-xs text-slate-400 italic">No expenses for this period</p>}
                    </div>
                    <div className="flex justify-between font-black text-slate-900 mt-4 pt-2 border-t border-slate-100">
                        <span>Total Expenses</span>
                        <span>₹{pnlData.totalExpense.toLocaleString()}</span>
                    </div>
                </div>

                {/* Net Profit */}
                <div className={`mt-8 p-6 rounded-2xl flex justify-between items-center ${pnlData.netProfit >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                    <span className="font-black uppercase tracking-widest text-sm">Net Profit (Loss)</span>
                    <span className="font-black text-2xl">₹{pnlData.netProfit.toLocaleString()}</span>
                </div>
            </div>
        </div>
    );

    const renderBalanceSheet = () => (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-4xl mx-auto animate-in fade-in">
            <div className="text-center mb-8 border-b border-slate-200 pb-8">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Balance Sheet</h2>
                <p className="text-slate-500 font-bold text-sm mt-1 uppercase tracking-widest">As of {new Date().toLocaleDateString()}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {/* Assets Section */}
                <div>
                    <h3 className="text-lg font-black text-slate-900 border-b border-slate-200 pb-2 mb-4">Assets</h3>
                    <div className="space-y-2">
                        {balanceSheetData.assetsItems.map(item => (
                            <div key={item.name} className="flex justify-between text-sm py-1 font-bold text-slate-700">
                                <span>{item.name}</span>
                                <span>₹{item.balance.toLocaleString()}</span>
                            </div>
                        ))}
                        {balanceSheetData.assetsItems.length === 0 && <p className="text-xs text-slate-400 italic">No assets recorded</p>}
                    </div>
                    <div className="flex justify-between font-black text-slate-900 mt-6 pt-2 border-t-2 border-slate-900">
                        <span>Total Assets</span>
                        <span>₹{balanceSheetData.totalAssets.toLocaleString()}</span>
                    </div>
                </div>

                {/* Liabilities & Equity Section */}
                <div>
                    <h3 className="text-lg font-black text-slate-900 border-b border-slate-200 pb-2 mb-4">Liabilities & Equity</h3>

                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 mt-4">Liabilities</h4>
                    <div className="space-y-2">
                        {balanceSheetData.liabilitiesItems.map(item => (
                            <div key={item.name} className="flex justify-between text-sm py-1 font-bold text-slate-700">
                                <span>{item.name}</span>
                                <span>₹{item.balance.toLocaleString()}</span>
                            </div>
                        ))}
                        {balanceSheetData.liabilitiesItems.length === 0 && <p className="text-xs text-slate-400 italic mb-4">No liabilities recorded</p>}
                    </div>

                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 mt-6">Equity</h4>
                    <div className="space-y-2">
                        {balanceSheetData.equityItems.map(item => (
                            <div key={item.name} className="flex justify-between text-sm py-1 font-bold text-slate-700">
                                <span>{item.name}</span>
                                <span>₹{item.balance.toLocaleString()}</span>
                            </div>
                        ))}
                        {balanceSheetData.equityItems.length === 0 && <p className="text-xs text-slate-400 italic mb-4">No equity recorded</p>}
                    </div>

                    <div className="flex justify-between font-black text-slate-900 mt-6 pt-2 border-t-2 border-slate-900">
                        <span>Total Liabilities & Equity</span>
                        <span>₹{balanceSheetData.totalLiabilitiesAndEquity.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100 flex justify-center">
                <span className={`text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-full ${Math.abs(balanceSheetData.totalAssets - balanceSheetData.totalLiabilitiesAndEquity) < 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {Math.abs(balanceSheetData.totalAssets - balanceSheetData.totalLiabilitiesAndEquity) < 1 ? 'Balances Match ✓' : 'Out of Balance ✕'}
                </span>
            </div>
        </div>
    );

    const renderCashFlow = () => (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-4xl mx-auto animate-in fade-in flex flex-col items-center justify-center min-h-[400px]">
            <TrendingUp size={48} className="text-blue-100 mb-4" />
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Statement of Cash Flows</h2>
            <p className="text-slate-500 font-bold mt-2 text-center max-w-sm">This specific report is currently being generated by summarizing Bank and UPI ledger activities. Available in next update.</p>
        </div>
    );

    const handleExportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.text(`${reportType === 'pnl' ? 'Income Statement' : 'Balance Sheet'}`, 14, 22);
        doc.setFontSize(10);
        doc.text(`Period: ${dateRange.replace('_', ' ').toUpperCase()}`, 14, 30);

        let startYVal = 40;

        if (reportType === 'pnl') {
            const revData = Object.entries(pnlData.revenueByCat).map(([k, v]) => [k, `Rs. ${v.toLocaleString()}`]);
            const expData = Object.entries(pnlData.expenseByCat).map(([k, v]) => [k, `Rs. ${v.toLocaleString()}`]);

            autoTable(doc, {
                startY: startYVal,
                head: [['Revenue Category', 'Amount']],
                body: [...revData, ['Total Revenue', `Rs. ${pnlData.totalRevenue.toLocaleString()}`]],
                theme: 'grid'
            });

            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 10,
                head: [['Expense Category', 'Amount']],
                body: [...expData, ['Total Expenses', `Rs. ${pnlData.totalExpense.toLocaleString()}`]],
                theme: 'grid'
            });

            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 10,
                head: [['Net Profit', `Rs. ${pnlData.netProfit.toLocaleString()}`]],
                theme: 'grid',
                headStyles: { fillColor: pnlData.netProfit >= 0 ? [16, 185, 129] : [239, 68, 68] }
            });

        } else if (reportType === 'balance_sheet') {
            const astData = balanceSheetData.assetsItems.map(i => [i.name, `Rs. ${i.balance.toLocaleString()}`]);
            const liaData = balanceSheetData.liabilitiesItems.map(i => [i.name, `Rs. ${i.balance.toLocaleString()}`]);
            const eqData = balanceSheetData.equityItems.map(i => [i.name, `Rs. ${i.balance.toLocaleString()}`]);

            autoTable(doc, {
                startY: startYVal,
                head: [['Assets', 'Amount']],
                body: [...astData, ['Total Assets', `Rs. ${balanceSheetData.totalAssets.toLocaleString()}`]],
                theme: 'grid'
            });

            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 10,
                head: [['Liabilities', 'Amount']],
                body: liaData.length > 0 ? [...liaData, ['Total Liabilities', `Rs. ${balanceSheetData.liabilitiesItems.reduce((acc, i) => acc + i.balance, 0).toLocaleString()}`]] : [['No liabilities', '-']],
                theme: 'grid'
            });

            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 10,
                head: [['Equity', 'Amount']],
                body: [...eqData, ['Total L&E', `Rs. ${balanceSheetData.totalLiabilitiesAndEquity.toLocaleString()}`]],
                theme: 'grid'
            });
        }

        doc.save(`${reportType}_${dateRange}.pdf`);
    };

    const handleExportExcel = () => {
        let wb = XLSX.utils.book_new();
        let wsData: any[][] = [];

        if (reportType === 'pnl') {
            wsData.push(['INCOME STATEMENT', `Period: ${dateRange}`]);
            wsData.push([]);
            wsData.push(['REVENUE']);
            Object.entries(pnlData.revenueByCat).forEach(([k, v]) => wsData.push([k, v]));
            wsData.push(['Total Revenue', pnlData.totalRevenue]);
            wsData.push([]);
            wsData.push(['EXPENSES']);
            Object.entries(pnlData.expenseByCat).forEach(([k, v]) => wsData.push([k, v]));
            wsData.push(['Total Expenses', pnlData.totalExpense]);
            wsData.push([]);
            wsData.push(['NET PROFIT (LOSS)', pnlData.netProfit]);
        } else if (reportType === 'balance_sheet') {
            wsData.push(['BALANCE SHEET', `As of: ${new Date().toLocaleDateString()}`]);
            wsData.push([]);
            wsData.push(['ASSETS']);
            balanceSheetData.assetsItems.forEach(i => wsData.push([i.name, i.balance]));
            wsData.push(['Total Assets', balanceSheetData.totalAssets]);
            wsData.push([]);
            wsData.push(['LIABILITIES']);
            balanceSheetData.liabilitiesItems.forEach(i => wsData.push([i.name, i.balance]));
            wsData.push([]);
            wsData.push(['EQUITY']);
            balanceSheetData.equityItems.forEach(i => wsData.push([i.name, i.balance]));
            wsData.push(['Total Liabilities & Equity', balanceSheetData.totalLiabilitiesAndEquity]);
        }

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, 'Report');
        XLSX.writeFile(wb, `${reportType}_${dateRange}.xlsx`);
    };

    return (
        <div className="space-y-6">
            {/* Actions */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex gap-2 p-1 bg-slate-50 rounded-lg w-full md:w-auto">
                    <button
                        onClick={() => setReportType('pnl')}
                        className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${reportType === 'pnl' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Income Statement
                    </button>
                    <button
                        onClick={() => setReportType('balance_sheet')}
                        className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${reportType === 'balance_sheet' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Balance Sheet
                    </button>
                    <button
                        onClick={() => setReportType('cash_flow')}
                        className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${reportType === 'cash_flow' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Cash Flow
                    </button>
                </div>

                <div className="flex gap-3 w-full md:w-auto flex-wrap md:flex-nowrap">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value as any)}
                        className="flex-1 md:flex-none px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none"
                    >
                        <option value="this_month">This Month</option>
                        <option value="last_month">Last Month</option>
                        <option value="this_quarter">This Quarter</option>
                        <option value="half_year">Half Year</option>
                        <option value="this_year">This Year</option>
                        <option value="all_time">All Time</option>
                    </select>

                    {reportType !== 'cash_flow' && (
                        <div className="flex gap-2">
                            <button onClick={handleExportPDF} className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 border border-slate-200 text-slate-700 rounded-lg shadow-sm hover:bg-slate-200 transition font-semibold text-sm h-full">
                                <Download size={16} /> PDF
                            </button>
                            <button onClick={handleExportExcel} className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg shadow-sm hover:bg-emerald-200 transition font-semibold text-sm h-full">
                                <FileText size={16} /> Excel
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Report Container */}
            <div className="bg-slate-50 rounded-2xl p-4 md:p-8 border border-slate-200">
                {reportType === 'pnl' && renderPNL()}
                {reportType === 'balance_sheet' && renderBalanceSheet()}
                {reportType === 'cash_flow' && renderCashFlow()}
            </div>

        </div>
    );
};

export default ReportsView;
