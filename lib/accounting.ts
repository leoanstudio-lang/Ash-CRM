import { db } from './firebase';
import { collection, doc, setDoc, query, where, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { JournalEntry, JournalEntryLine, AccountingCategory, AccountingAsset, AccountingLoan, PaymentAlert, MoneyInType, MoneyOutType } from '../types';

function generateId() {
    return Math.random().toString(36).substring(2, 15);
}

// Utility to recursively clean undefined properties for Firestore safety
export function cleanData<T>(obj: T): T {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) {
        return obj.map(cleanData) as unknown as T;
    }
    if (typeof obj === 'object') {
        const cleaned: any = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
                cleaned[key] = cleanData(value);
            }
        }
        return cleaned as T;
    }
    return obj;
}

// Utility to create a balanced journal entry
export async function createJournalEntry(
    date: string,
    type: 'Revenue' | 'Expense' | 'Asset' | 'Loan' | 'Capital' | 'Withdrawal' | 'Deposit',
    remarks: string,
    entries: JournalEntryLine[],
    referenceId?: string,
    createdBy?: string,
    periodMonth?: string,
    extraFields?: Partial<JournalEntry>
): Promise<string> {
    // Validate double entry (Debits = Credits)
    const totalDebits = entries.filter(e => e.type === 'DEBIT').reduce((sum, e) => sum + e.amount, 0);
    const totalCredits = entries.filter(e => e.type === 'CREDIT').reduce((sum, e) => sum + e.amount, 0);

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
        throw new Error(`Double entry validation failed. Debits (${totalDebits}) do not equal Credits (${totalCredits}).`);
    }

    // Check idempotent reference
    if (referenceId) {
        const q = query(collection(db, 'journal_entries'), where('referenceId', '==', referenceId));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            console.warn(`Journal entry with reference ${referenceId} already exists. Skipping.`);
            return snapshot.docs[0].id;
        }
    }

    const entryDoc = doc(collection(db, 'journal_entries'));

    const journalEntry: JournalEntry = {
        id: entryDoc.id,
        date,
        type,
        ...(referenceId ? { referenceId } : {}),
        remarks,
        entries,
        createdBy: createdBy || 'System',
        createdAt: new Date().toISOString(),
        ...(periodMonth ? { periodMonth } : {}),
        ...extraFields
    };

    await setDoc(entryDoc, cleanData(journalEntry));
    return entryDoc.id;
}

// ==========================================
// MONEY IN POSTING HELPERS
// ==========================================

export async function recordMoneyIn(params: {
    subType: MoneyInType;
    amount: number;
    destinationAccount: AccountingCategory; // Bank / Cash / Account
    category?: AccountingCategory;
    date: string;
    remarks: string;
    clientName?: string;
    invoiceNumber?: string;
    loanSource?: string;
    referenceId?: string;
    createdBy?: string;
}) {
    const { subType, amount, destinationAccount, category, date, remarks, clientName, invoiceNumber, loanSource, referenceId, createdBy } = params;

    let entries: JournalEntryLine[] = [];
    let mainType: JournalEntry['type'] = 'Revenue';

    if (subType === 'Sales Revenue' || subType === 'Other Income') {
        mainType = 'Revenue';
        entries = [
            {
                accountId: destinationAccount.id,
                accountName: destinationAccount.name,
                accountType: 'Asset',
                amount,
                type: 'DEBIT'
            },
            {
                accountId: category?.id || 'sales_revenue_main',
                accountName: category?.name || subType,
                accountType: 'Revenue',
                amount,
                type: 'CREDIT'
            }
        ];
    } else if (subType === 'Owner Investment') {
        mainType = 'Capital';
        entries = [
            {
                accountId: destinationAccount.id,
                accountName: destinationAccount.name,
                accountType: 'Asset',
                amount,
                type: 'DEBIT'
            },
            {
                accountId: 'owner_equity_main',
                accountName: 'Owner Capital',
                accountType: 'Equity',
                amount,
                type: 'CREDIT'
            }
        ];
    } else if (subType === 'Loan Received') {
        mainType = 'Loan';
        entries = [
            {
                accountId: destinationAccount.id,
                accountName: destinationAccount.name,
                accountType: 'Asset',
                amount,
                type: 'DEBIT'
            },
            {
                accountId: 'loan_payable_main',
                accountName: loanSource ? `Loan (${loanSource})` : 'Loan Payable',
                accountType: 'Liability',
                amount,
                type: 'CREDIT'
            }
        ];
    } else if (subType === 'Client Advance') {
        mainType = 'Revenue';
        entries = [
            {
                accountId: destinationAccount.id,
                accountName: destinationAccount.name,
                accountType: 'Asset',
                amount,
                type: 'DEBIT'
            },
            {
                accountId: 'unearned_revenue_main',
                accountName: 'Client Advance (Liability)',
                accountType: 'Liability',
                amount,
                type: 'CREDIT'
            }
        ];
    }

    return createJournalEntry(date, mainType, remarks, entries, referenceId, createdBy, undefined, {
        subType,
        clientName
    });
}

export async function recordCapitalInfusion(params: {
    subType: 'Opening Balance' | 'Owner Investment';
    amount: number;
    date: string;
    remarks?: string;
    createdBy?: string;
}) {
    const { subType, amount, date, remarks, createdBy } = params;

    const entries: JournalEntryLine[] = [
        {
            accountId: 'cash_acc',
            accountName: 'Owner Equity Account',
            accountType: 'Asset',
            amount,
            type: 'DEBIT'
        },
        {
            accountId: 'owner_equity_main',
            accountName: 'Owner Capital',
            accountType: 'Equity',
            amount,
            type: 'CREDIT'
        }
    ];

    return createJournalEntry(
        date,
        'Capital',
        remarks || subType,
        entries,
        undefined,
        createdBy,
        undefined,
        { subType }
    );
}

export async function updateCapitalEntry(params: {
    id: string;
    subType: 'Opening Balance' | 'Owner Investment' | 'Owner Withdrawal';
    amount: number;
    date: string;
    remarks: string;
}) {
    const { id, subType, amount, date, remarks } = params;

    const isWithdrawal = subType === 'Owner Withdrawal';
    const type = isWithdrawal ? 'Withdrawal' : 'Capital';

    const entries: JournalEntryLine[] = isWithdrawal ? [
        {
            accountId: 'owner_drawings_main',
            accountName: 'Owner Drawings / Withdrawals',
            accountType: 'Equity',
            amount,
            type: 'DEBIT'
        },
        {
            accountId: 'cash_acc',
            accountName: 'Cash / Bank Account',
            accountType: 'Asset',
            amount,
            type: 'CREDIT'
        }
    ] : [
        {
            accountId: 'cash_acc',
            accountName: 'Owner Equity Account',
            accountType: 'Asset',
            amount,
            type: 'DEBIT'
        },
        {
            accountId: 'owner_equity_main',
            accountName: 'Owner Capital',
            accountType: 'Equity',
            amount,
            type: 'CREDIT'
        }
    ];

    await updateDoc(doc(db, 'journal_entries', id), cleanData({
        type,
        subType,
        date,
        remarks,
        entries,
        updatedAt: new Date().toISOString()
    }));
}

// ==========================================
// MONEY OUT POSTING HELPERS
// ==========================================

export async function recordOperationalExpense(params: {
    amount: number;
    expenseCategory: AccountingCategory;
    paymentAccount: AccountingCategory;
    date: string;
    remarks: string;
    vendor?: string;
    referenceId?: string;
    createdBy?: string;
}) {
    const { amount, expenseCategory, paymentAccount, date, remarks, vendor, referenceId, createdBy } = params;

    const entries: JournalEntryLine[] = [
        {
            accountId: expenseCategory.id,
            accountName: expenseCategory.name,
            accountType: 'Expense',
            amount,
            type: 'DEBIT'
        },
        {
            accountId: paymentAccount.id,
            accountName: paymentAccount.name,
            accountType: 'Asset',
            amount,
            type: 'CREDIT'
        }
    ];

    return createJournalEntry(date, 'Expense', remarks, entries, referenceId, createdBy, undefined, {
        subType: 'Operational Expense',
        vendor
    });
}

export async function recordFixedAssetPurchase(params: {
    assetName: string;
    categoryName: string;
    purchaseCost: number;
    purchaseDate: string;
    usefulLifeYears: number;
    paymentSource: 'Cash' | 'Bank' | 'Loan' | 'Credit' | 'Owner Contribution';
    paymentAccount?: AccountingCategory;
    vendor?: string;
    remarks?: string;
    createdBy?: string;
}) {
    const { assetName, categoryName, purchaseCost, purchaseDate, usefulLifeYears, paymentSource, paymentAccount, vendor, remarks, createdBy } = params;

    const assetId = generateId();

    let creditAccountName = paymentAccount?.name || paymentSource;
    let creditAccountType: JournalEntryLine['accountType'] = 'Asset';

    if (paymentSource === 'Loan') creditAccountType = 'Liability';
    if (paymentSource === 'Credit') creditAccountType = 'Liability';
    if (paymentSource === 'Owner Contribution') creditAccountType = 'Equity';

    const entries: JournalEntryLine[] = [
        {
            accountId: assetId,
            accountName: assetName,
            accountType: 'Asset',
            amount: purchaseCost,
            type: 'DEBIT'
        },
        {
            accountId: paymentAccount?.id || `source_${paymentSource.toLowerCase()}`,
            accountName: creditAccountName,
            accountType: creditAccountType,
            amount: purchaseCost,
            type: 'CREDIT'
        }
    ];

    const journalId = await createJournalEntry(
        purchaseDate,
        'Asset',
        remarks || `Fixed Asset Purchase: ${assetName}`,
        entries,
        undefined,
        createdBy,
        undefined,
        {
            subType: 'Fixed Asset Purchase',
            vendor,
            assetId
        }
    );

    // Save Asset Record to Asset Register
    const assetRecord: AccountingAsset = {
        id: assetId,
        name: assetName,
        categoryId: generateId(),
        categoryName,
        purchaseDate,
        cost: purchaseCost,
        usefulLifeYears: usefulLifeYears !== undefined && usefulLifeYears !== null ? usefulLifeYears : 3,
        paymentMethod: paymentSource,
        paymentSource,
        vendor,
        status: 'Active',
        journalEntryId: journalId,
        remarks,
        createdAt: new Date().toISOString()
    };

    const assetDoc = doc(collection(db, 'accounting_assets'), assetId);
    await setDoc(assetDoc, cleanData(assetRecord));

    return journalId;
}

export async function recordOpeningAsset(params: {
    name: string;
    categoryName: string;
    cost: number;
    purchaseDate: string;
    usefulLifeYears: number;
    vendor?: string;
    remarks?: string;
}) {
    const { name, categoryName, cost, purchaseDate, usefulLifeYears, vendor, remarks } = params;

    const assetId = generateId();

    const assetRecord: AccountingAsset = {
        id: assetId,
        name,
        categoryId: generateId(),
        categoryName,
        purchaseDate,
        cost,
        usefulLifeYears: usefulLifeYears !== undefined && usefulLifeYears !== null ? usefulLifeYears : 3,
        paymentMethod: 'Opening Balance',
        paymentSource: 'Opening Balance',
        isOpeningAsset: true,
        vendor,
        status: 'Active',
        remarks: remarks || 'Opening Asset Migration',
        createdAt: new Date().toISOString()
    };

    const assetDoc = doc(collection(db, 'accounting_assets'), assetId);
    await setDoc(assetDoc, cleanData(assetRecord));

    return assetId;
}

export async function recordLoanRepayment(params: {
    loan: AccountingLoan;
    paymentAmount: number;
    interestAmount?: number;
    paymentAccount: AccountingCategory;
    date: string;
    remarks?: string;
    createdBy?: string;
}) {
    const { loan, paymentAmount, interestAmount = 0, paymentAccount, date, remarks, createdBy } = params;

    const principalAmount = Math.max(0, paymentAmount - interestAmount);

    const entries: JournalEntryLine[] = [];

    // Debit Loan Liability (reduces liability)
    if (principalAmount > 0) {
        entries.push({
            accountId: loan.id,
            accountName: `Loan: ${loan.name}`,
            accountType: 'Liability',
            amount: principalAmount,
            type: 'DEBIT'
        });
    }

    // Debit Interest Expense (if interest > 0)
    if (interestAmount > 0) {
        entries.push({
            accountId: 'interest_expense_main',
            accountName: 'Loan Interest Expense',
            accountType: 'Expense',
            amount: interestAmount,
            type: 'DEBIT'
        });
    }

    // Credit Cash / Bank (total payment)
    entries.push({
        accountId: paymentAccount.id,
        accountName: paymentAccount.name,
        accountType: 'Asset',
        amount: paymentAmount,
        type: 'CREDIT'
    });

    const journalId = await createJournalEntry(
        date,
        'Loan',
        remarks || `Loan Repayment: ${loan.name}`,
        entries,
        undefined,
        createdBy,
        undefined,
        {
            subType: 'Loan Repayment',
            loanId: loan.id,
            interestAmount
        }
    );

    // Update Loan Remaining Balance
    const newBalance = Math.max(0, loan.remainingBalance - principalAmount);
    const loanDoc = doc(db, 'accounting_loans', loan.id);
    await updateDoc(loanDoc, cleanData({
        remainingBalance: newBalance,
        status: newBalance <= 0 ? 'Paid Off' : 'Active'
    }));

    return journalId;
}

export async function recordOpeningLiability(params: {
    name: string;
    lender: string;
    source: AccountingLoan['source'];
    amount: number;
    date: string;
    interestRate?: number;
    emiAmount?: number;
    remarks?: string;
}) {
    const { name, lender, source, amount, date, interestRate, emiAmount, remarks } = params;

    const loanId = generateId();

    const loanRecord: AccountingLoan = {
        id: loanId,
        name,
        lender,
        source: source || 'Bank',
        amount,
        remainingBalance: amount,
        date,
        startDate: date,
        interestRate: interestRate !== undefined && interestRate !== null ? interestRate : 0,
        emiAmount: emiAmount !== undefined && emiAmount !== null ? emiAmount : 0,
        status: 'Active',
        isOpeningBalance: true,
        remarks: remarks || 'Opening Liability Migration',
        createdAt: new Date().toISOString()
    };

    const loanDoc = doc(collection(db, 'accounting_loans'), loanId);
    await setDoc(loanDoc, cleanData(loanRecord));

    return loanId;
}

export async function recordOwnerWithdrawal(params: {
    amount: number;
    paymentAccount: AccountingCategory;
    date: string;
    remarks?: string;
    createdBy?: string;
}) {
    const { amount, paymentAccount, date, remarks, createdBy } = params;

    const entries: JournalEntryLine[] = [
        {
            accountId: 'owner_drawings_main',
            accountName: 'Owner Drawings / Withdrawals',
            accountType: 'Equity',
            amount,
            type: 'DEBIT' // Reduces Equity
        },
        {
            accountId: paymentAccount.id,
            accountName: paymentAccount.name,
            accountType: 'Asset',
            amount,
            type: 'CREDIT'
        }
    ];

    return createJournalEntry(date, 'Withdrawal', remarks || 'Owner Drawings Withdrawal', entries, undefined, createdBy, undefined, {
        subType: 'Owner Withdrawal'
    });
}

export async function recordSecurityDeposit(params: {
    depositName: string;
    amount: number;
    paymentAccount: AccountingCategory;
    date: string;
    remarks?: string;
    createdBy?: string;
}) {
    const { depositName, amount, paymentAccount, date, remarks, createdBy } = params;

    const entries: JournalEntryLine[] = [
        {
            accountId: generateId(),
            accountName: `Deposit: ${depositName}`,
            accountType: 'Asset',
            amount,
            type: 'DEBIT'
        },
        {
            accountId: paymentAccount.id,
            accountName: paymentAccount.name,
            accountType: 'Asset',
            amount,
            type: 'CREDIT'
        }
    ];

    return createJournalEntry(date, 'Deposit', remarks || `Security Deposit: ${depositName}`, entries, undefined, createdBy, undefined, {
        subType: 'Security Deposit'
    });
}

// Backward Compatibility Helpers
export async function recordRevenue(
    amount: number,
    revenueCategory: AccountingCategory,
    paymentAccount: AccountingCategory,
    date: string,
    remarks: string,
    referenceId?: string,
    createdBy?: string,
    periodMonth?: string
) {
    return recordMoneyIn({
        subType: 'Sales Revenue',
        amount,
        destinationAccount: paymentAccount,
        category: revenueCategory,
        date,
        remarks,
        referenceId,
        createdBy
    });
}

export async function recordExpense(
    amount: number,
    expenseCategory: AccountingCategory,
    paymentAccount: AccountingCategory,
    date: string,
    remarks: string,
    referenceId?: string,
    createdBy?: string
) {
    return recordOperationalExpense({
        amount,
        expenseCategory,
        paymentAccount,
        date,
        remarks,
        referenceId,
        createdBy
    });
}

export async function recordCapital(
    amount: number,
    sourceAccount: AccountingCategory,
    date: string,
    remarks: string,
    createdBy?: string
) {
    return recordMoneyIn({
        subType: 'Owner Investment',
        amount,
        destinationAccount: sourceAccount,
        date,
        remarks,
        createdBy
    });
}

export async function recordLoan(
    loan: AccountingLoan,
    destinationAccount: AccountingCategory,
    createdBy?: string
) {
    const journalId = await recordMoneyIn({
        subType: 'Loan Received',
        amount: loan.amount,
        destinationAccount,
        date: loan.date,
        remarks: `Received Loan from ${loan.lender}`,
        loanSource: loan.lender,
        createdBy
    });

    const loanDoc = doc(collection(db, 'accounting_loans'), loan.id);
    await setDoc(loanDoc, cleanData({ ...loan, journalEntryId: journalId, status: 'Active' }));

    return journalId;
}

export function calculateDepreciation(asset: AccountingAsset, reportDate: Date) {
    if (!asset.usefulLifeYears || asset.usefulLifeYears <= 0) {
        return { accumulated: 0, currentValue: asset.cost };
    }

    const purchaseDate = new Date(asset.purchaseDate);
    if (reportDate < purchaseDate) {
        return { accumulated: 0, currentValue: asset.cost };
    }

    const yearsElapsed = (reportDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    const usefulLife = asset.usefulLifeYears;
    const cappedYears = Math.min(yearsElapsed, usefulLife);

    const annualDepreciation = asset.cost / usefulLife;
    const accumulated = cappedYears * annualDepreciation;

    return {
        accumulated,
        currentValue: Math.max(0, asset.cost - accumulated)
    };
}

export const DEFAULT_CATEGORIES: Omit<AccountingCategory, 'id' | 'createdAt'>[] = [
    { name: 'Service Revenue', type: 'Revenue', status: 'Active', isDefault: true },
    { name: 'Consulting Income', type: 'Revenue', status: 'Active', isDefault: true },
    { name: 'Project Payment', type: 'Revenue', status: 'Active', isDefault: true },
    { name: 'Other Income', type: 'Revenue', status: 'Active', isDefault: true },
    { name: 'Salary', type: 'Expense', status: 'Active', isDefault: true },
    { name: 'Office Rent', type: 'Expense', status: 'Active', isDefault: true },
    { name: 'Electricity', type: 'Expense', status: 'Active', isDefault: true },
    { name: 'Internet', type: 'Expense', status: 'Active', isDefault: true },
    { name: 'Fuel', type: 'Expense', status: 'Active', isDefault: true },
    { name: 'Travel', type: 'Expense', status: 'Active', isDefault: true },
    { name: 'Marketing', type: 'Expense', status: 'Active', isDefault: true },
    { name: 'Office Supplies', type: 'Expense', status: 'Active', isDefault: true },
    { name: 'Software Subscription', type: 'Expense', status: 'Active', isDefault: true },
    { name: 'Printing', type: 'Expense', status: 'Active', isDefault: true },
    { name: 'Food', type: 'Expense', status: 'Active', isDefault: true },
    { name: 'Miscellaneous', type: 'Expense', status: 'Active', isDefault: true },
    { name: 'Bank Account', type: 'Asset', status: 'Active', isDefault: true },
    { name: 'UPI Wallet', type: 'Asset', status: 'Active', isDefault: true },
    { name: 'Cash', type: 'Asset', status: 'Active', isDefault: true },
    { name: 'Computer & Laptops', type: 'Asset', status: 'Active', isDefault: true },
    { name: 'Furniture & Fixtures', type: 'Asset', status: 'Active', isDefault: true },
    { name: 'AC & Appliances', type: 'Asset', status: 'Active', isDefault: true },
    { name: 'Camera & Lighting', type: 'Asset', status: 'Active', isDefault: true },
    { name: 'Owner Capital', type: 'Equity', status: 'Active', isDefault: true },
    { name: 'Owner Drawings', type: 'Equity', status: 'Active', isDefault: true },
    { name: 'Retained Earnings', type: 'Equity', status: 'Active', isDefault: true },
];

export async function initializeDefaultCategories() {
    const q = query(collection(db, 'accounting_categories'));
    const snap = await getDocs(q);
    if (snap.empty) {
        for (const cat of DEFAULT_CATEGORIES) {
            const docRef = doc(collection(db, 'accounting_categories'));
            await setDoc(docRef, cleanData({ ...cat, id: docRef.id, createdAt: new Date().toISOString() }));
        }
    }
}

export async function processAutomaticRevenue(alert: PaymentAlert, actualAmount: number) {
    try {
        const catQuery = query(collection(db, 'accounting_categories'), where('isDefault', '==', true));
        const snap = await getDocs(catQuery);
        const categories: AccountingCategory[] = snap.docs.map(d => d.data() as AccountingCategory);

        const revenueCat = categories.find(c => c.name === 'Service Revenue') || { id: 'srv_rev', name: 'Service Revenue', type: 'Revenue', status: 'Active', isDefault: true, createdAt: '' };
        const upiCat = categories.find(c => c.name === 'Bank Account' || c.name === 'UPI Wallet') || { id: 'bank_acc', name: 'Bank Account', type: 'Asset', status: 'Active', isDefault: true, createdAt: '' };

        let periodMonth: string | undefined;
        if (alert.packagePeriod) {
            const hasYear = /\d{4}/.test(alert.packagePeriod);
            periodMonth = hasYear ? alert.packagePeriod : `${alert.packagePeriod} ${new Date().getFullYear()}`;
        }

        await recordMoneyIn({
            subType: 'Sales Revenue',
            amount: actualAmount,
            destinationAccount: upiCat,
            category: revenueCat,
            date: new Date().toISOString(),
            remarks: `Auto-Revenue: ${alert.clientName} - ${alert.packageName || alert.taskName || 'N/A'}`,
            clientName: alert.clientName,
            referenceId: alert.id,
            createdBy: 'System Auto'
        });
    } catch (e) {
        console.error("Error processing auto revenue", e);
    }
}

export async function deleteJournalEntry(id: string) {
    await deleteDoc(doc(db, 'journal_entries', id));
}

export async function updateJournalEntry(id: string, updates: Partial<JournalEntry>) {
    await updateDoc(doc(db, 'journal_entries', id), cleanData(updates));
}

export async function updateMoneyInEntry(params: {
    id: string;
    subType: MoneyInType;
    amount: number;
    destinationAccount: AccountingCategory;
    category?: AccountingCategory;
    date: string;
    remarks: string;
    clientName?: string;
}) {
    const { id, subType, amount, destinationAccount, category, date, remarks, clientName } = params;

    const targetCategoryName = category?.name || subType;
    const categoryId = category?.id || `cat_${targetCategoryName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    const entries: JournalEntryLine[] = [
        {
            accountId: destinationAccount.id,
            accountName: destinationAccount.name,
            accountType: 'Asset',
            amount,
            type: 'DEBIT'
        },
        {
            accountId: categoryId,
            accountName: targetCategoryName,
            accountType: 'Revenue',
            amount,
            type: 'CREDIT'
        }
    ];

    await updateDoc(doc(db, 'journal_entries', id), cleanData({
        date,
        subType,
        remarks,
        clientName: clientName || null,
        entries
    }));
}

export async function updateMoneyOutEntry(params: {
    id: string;
    subType: MoneyOutType;
    amount: number;
    expenseCategory: AccountingCategory;
    paymentAccount: AccountingCategory;
    date: string;
    remarks: string;
    vendor?: string;
}) {
    const { id, subType, amount, expenseCategory, paymentAccount, date, remarks, vendor } = params;

    const entries: JournalEntryLine[] = [
        {
            accountId: expenseCategory.id,
            accountName: expenseCategory.name,
            accountType: 'Expense',
            amount,
            type: 'DEBIT'
        },
        {
            accountId: paymentAccount.id,
            accountName: paymentAccount.name,
            accountType: 'Asset',
            amount,
            type: 'CREDIT'
        }
    ];

    await updateDoc(doc(db, 'journal_entries', id), cleanData({
        date,
        subType,
        remarks,
        vendor: vendor || null,
        entries
    }));
}

export async function deleteAsset(id: string) {
    await deleteDoc(doc(db, 'accounting_assets', id));
}

export async function updateAsset(id: string, updates: Partial<AccountingAsset>) {
    await setDoc(doc(db, 'accounting_assets', id), cleanData({
        ...updates,
        updatedAt: new Date().toISOString()
    }), { merge: true });
}

export async function deleteLoan(id: string) {
    await deleteDoc(doc(db, 'accounting_loans', id));
}

// ==========================================
// FINANCIAL ACCOUNT MANAGEMENT HELPERS
// ==========================================

export const DEFAULT_FINANCIAL_ACCOUNTS: Omit<import('../types').FinancialAccount, 'id' | 'createdAt'>[] = [
    {
        accountName: 'Office Cash',
        accountType: 'Cash',
        openingBalance: 0,
        openingBalanceDate: new Date().toISOString().split('T')[0],
        status: 'Active',
        isDefault: true,
        remarks: 'Main physical cash in hand'
    },
    {
        accountName: 'Federal Bank Current Account',
        accountType: 'Bank',
        bankName: 'Federal Bank',
        openingBalance: 0,
        openingBalanceDate: new Date().toISOString().split('T')[0],
        status: 'Active',
        isDefault: false,
        remarks: 'Primary current account'
    },
    {
        accountName: 'Company UPI Wallet',
        accountType: 'UPI',
        openingBalance: 0,
        openingBalanceDate: new Date().toISOString().split('T')[0],
        status: 'Active',
        isDefault: false,
        remarks: 'Digital payment wallet'
    }
];

export async function initializeDefaultFinancialAccounts() {
    try {
        const q = query(collection(db, 'accounting_financial_accounts'));
        const snap = await getDocs(q);
        if (snap.empty) {
            for (const acc of DEFAULT_FINANCIAL_ACCOUNTS) {
                const docRef = doc(collection(db, 'accounting_financial_accounts'));
                await setDoc(docRef, cleanData({ ...acc, id: docRef.id, createdAt: new Date().toISOString() }));
            }
        }
    } catch (err) {
        console.error("Error initializing default financial accounts:", err);
    }
}

export async function addFinancialAccountToDB(account: Omit<import('../types').FinancialAccount, 'id' | 'createdAt'>) {
    // If set to isDefault, unset previous defaults
    if (account.isDefault) {
        await unsetPreviousDefaultFinancialAccount();
    }
    const docRef = doc(collection(db, 'accounting_financial_accounts'));
    const newAcc: import('../types').FinancialAccount = {
        ...account,
        id: docRef.id,
        createdAt: new Date().toISOString()
    };
    await setDoc(docRef, cleanData(newAcc));
    return docRef.id;
}

export async function updateFinancialAccountInDB(id: string, updates: Partial<import('../types').FinancialAccount>) {
    if (updates.isDefault) {
        await unsetPreviousDefaultFinancialAccount();
    }
    const docRef = doc(db, 'accounting_financial_accounts', id);
    await updateDoc(docRef, cleanData({ ...updates, updatedAt: new Date().toISOString() }));
}

export async function deleteFinancialAccountFromDB(id: string) {
    await deleteDoc(doc(db, 'accounting_financial_accounts', id));
}

async function unsetPreviousDefaultFinancialAccount() {
    try {
        const q = query(collection(db, 'accounting_financial_accounts'), where('isDefault', '==', true));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
            await updateDoc(doc(db, 'accounting_financial_accounts', d.id), { isDefault: false });
        }
    } catch (err) {
        console.error("Error unsetting default financial account:", err);
    }
}

/**
 * Record internal account transfer (Contra entry) between two financial accounts
 */
export async function recordAccountTransfer(params: {
    fromAccount: import('../types').FinancialAccount | AccountingCategory;
    toAccount: import('../types').FinancialAccount | AccountingCategory;
    amount: number;
    date: string;
    remarks?: string;
    createdBy?: string;
}) {
    const { fromAccount, toAccount, amount, date, remarks, createdBy } = params;

    const fromName = 'accountName' in fromAccount ? fromAccount.accountName : fromAccount.name;
    const toName = 'accountName' in toAccount ? toAccount.accountName : toAccount.name;
    const fromId = fromAccount.id;
    const toId = toAccount.id;

    if (fromId === toId) {
        throw new Error("Source and Destination accounts cannot be the same.");
    }

    const entries: JournalEntryLine[] = [
        {
            accountId: toId,
            financialAccountId: toId,
            accountName: toName,
            accountType: 'Asset',
            type: 'DEBIT',
            amount
        },
        {
            accountId: fromId,
            financialAccountId: fromId,
            accountName: fromName,
            accountType: 'Asset',
            type: 'CREDIT',
            amount
        }
    ];

    return createJournalEntry(
        date,
        'Asset',
        remarks || `Transfer: ${fromName} → ${toName}`,
        entries,
        undefined,
        createdBy,
        undefined,
        {
            subType: 'Account Transfer',
            transferFromAccount: fromName,
            transferToAccount: toName
        }
    );
}

/**
 * Calculates current real-time balances for all financial accounts based on opening balance + journal entries.
 */
export function calculateAccountBalances(
    accounts: import('../types').FinancialAccount[],
    journalEntries: JournalEntry[]
): { [accountId: string]: number } {
    const balances: { [accountId: string]: number } = {};

    accounts.forEach((acc) => {
        let bal = acc.openingBalance || 0;

        journalEntries.forEach((j) => {
            if (j.isVoided || j.subType === 'Opening Balance') return;
            j.entries.forEach((e) => {
                const matchesId = e.accountId === acc.id || e.financialAccountId === acc.id || j.financialAccountId === acc.id;
                const matchesName = e.accountName.toLowerCase().trim() === acc.accountName.toLowerCase().trim() ||
                    acc.accountName.toLowerCase().includes(e.accountName.toLowerCase());

                if (matchesId || (e.accountType === 'Asset' && matchesName)) {
                    if (e.type === 'DEBIT') {
                        bal += e.amount;
                    } else if (e.type === 'CREDIT') {
                        bal -= e.amount;
                    }
                }
            });
        });

        balances[acc.id] = bal;
    });

    return balances;
}

// ==========================================
// VENDOR MANAGEMENT HELPERS
// ==========================================

export async function addVendorToDB(vendor: Omit<import('../types').Vendor, 'id' | 'createdAt'>) {
    const docRef = doc(collection(db, 'accounting_vendors'));
    const newVendor: import('../types').Vendor = {
        ...vendor,
        id: docRef.id,
        createdAt: new Date().toISOString()
    };
    await setDoc(docRef, cleanData(newVendor));
    return docRef.id;
}

export async function updateVendorInDB(id: string, updates: Partial<import('../types').Vendor>) {
    const docRef = doc(db, 'accounting_vendors', id);
    await updateDoc(docRef, cleanData({ ...updates, updatedAt: new Date().toISOString() }));
}

export async function deleteVendorFromDB(id: string) {
    await deleteDoc(doc(db, 'accounting_vendors', id));
}


