import { db } from './firebase';
import { collection, doc, setDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { JournalEntry, JournalEntryLine, AccountingCategory, AccountingAsset, AccountingLoan, PaymentAlert } from '../types';

function generateId() {
    return Math.random().toString(36).substring(2, 15);
}

// Utility to create a balanced journal entry
export async function createJournalEntry(
    date: string,
    type: 'Revenue' | 'Expense' | 'Asset' | 'Loan' | 'Capital',
    remarks: string,
    entries: JournalEntryLine[],
    referenceId?: string,
    createdBy?: string
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
            return snapshot.docs[0].id; // Return existing ID
        }
    }

    const entryDoc = doc(collection(db, 'journal_entries'));

    const journalEntry: JournalEntry = {
        id: entryDoc.id,
        date,
        type,
        referenceId,
        remarks,
        entries,
        createdBy: createdBy || 'System',
        createdAt: new Date().toISOString()
    };

    await setDoc(entryDoc, journalEntry);
    return entryDoc.id;
}

// Helper: Record Revenue
export async function recordRevenue(
    amount: number,
    revenueCategory: AccountingCategory,
    paymentAccount: AccountingCategory, // e.g., Bank, UPI, Cash
    date: string,
    remarks: string,
    referenceId?: string,
    createdBy?: string
) {
    const entries: JournalEntryLine[] = [
        {
            accountId: paymentAccount.id,
            accountName: paymentAccount.name,
            accountType: 'Asset',
            amount: amount,
            type: 'DEBIT' // Increase Asset
        },
        {
            accountId: revenueCategory.id,
            accountName: revenueCategory.name,
            accountType: 'Revenue',
            amount: amount,
            type: 'CREDIT' // Increase Revenue
        }
    ];

    return createJournalEntry(date, 'Revenue', remarks, entries, referenceId, createdBy);
}

// Helper: Record Expense
export async function recordExpense(
    amount: number,
    expenseCategory: AccountingCategory,
    paymentAccount: AccountingCategory,
    date: string,
    remarks: string,
    referenceId?: string,
    createdBy?: string
) {
    const entries: JournalEntryLine[] = [
        {
            accountId: expenseCategory.id,
            accountName: expenseCategory.name,
            accountType: 'Expense',
            amount: amount,
            type: 'DEBIT' // Increase Expense
        },
        {
            accountId: paymentAccount.id,
            accountName: paymentAccount.name,
            accountType: 'Asset',
            amount: amount,
            type: 'CREDIT' // Decrease Asset
        }
    ];

    return createJournalEntry(date, 'Expense', remarks, entries, referenceId, createdBy);
}

// Helper: Record Asset Purchase
export async function recordAssetPurchase(
    asset: AccountingAsset,
    paymentAccount: AccountingCategory,
    createdBy?: string
) {
    const entries: JournalEntryLine[] = [
        {
            accountId: asset.id, // The specific asset acts as its own sub-ledger
            accountName: asset.name,
            accountType: 'Asset',
            amount: asset.cost,
            type: 'DEBIT' // Increase Asset
        },
        {
            accountId: paymentAccount.id,
            accountName: paymentAccount.name,
            accountType: 'Asset',
            amount: asset.cost,
            type: 'CREDIT' // Decrease Asset (Cash/Bank)
        }
    ];

    const journalId = await createJournalEntry(asset.purchaseDate, 'Asset', `Purchased Asset: ${asset.name}`, entries, undefined, createdBy);

    // Save Asset Record
    const assetDoc = doc(collection(db, 'accounting_assets'), asset.id);
    await setDoc(assetDoc, { ...asset, journalEntryId: journalId });

    return journalId;
}

// Helper: Record Capital Entry
export async function recordCapital(
    amount: number,
    sourceAccount: AccountingCategory, // Bank/Cash
    date: string,
    remarks: string,
    createdBy?: string
) {
    const entries: JournalEntryLine[] = [
        {
            accountId: sourceAccount.id,
            accountName: sourceAccount.name,
            accountType: 'Asset',
            amount,
            type: 'DEBIT' // Increase Asset
        },
        {
            accountId: 'owner_equity_main',
            accountName: 'Owner Capital',
            accountType: 'Equity',
            amount,
            type: 'CREDIT' // Increase Equity
        }
    ];

    return createJournalEntry(date, 'Capital', remarks, entries, undefined, createdBy);
}

// Helper: Record Loan
export async function recordLoan(
    loan: AccountingLoan,
    destinationAccount: AccountingCategory,
    createdBy?: string
) {
    const entries: JournalEntryLine[] = [
        {
            accountId: destinationAccount.id,
            accountName: destinationAccount.name,
            accountType: 'Asset',
            amount: loan.amount,
            type: 'DEBIT' // Increase Asset
        },
        {
            accountId: loan.id,
            accountName: `Loan: ${loan.name}`,
            accountType: 'Liability',
            amount: loan.amount,
            type: 'CREDIT' // Increase Liability
        }
    ];

    const journalId = await createJournalEntry(loan.date, 'Loan', `Received Loan from ${loan.lender}`, entries, undefined, createdBy);

    const loanDoc = doc(collection(db, 'accounting_loans'), loan.id);
    await setDoc(loanDoc, { ...loan, journalEntryId: journalId });

    return journalId;
}

// Calculate Depreciation on the fly
export function calculateDepreciation(asset: AccountingAsset, reportDate: Date) {
    const purchaseDate = new Date(asset.purchaseDate);
    if (reportDate < purchaseDate) {
        return { accumulated: 0, currentValue: asset.cost };
    }

    const yearsElapsed = (reportDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    const cappedYears = Math.min(yearsElapsed, asset.usefulLifeYears);

    const annualDepreciation = asset.cost / asset.usefulLifeYears;
    const accumulated = cappedYears * annualDepreciation;

    return {
        accumulated,
        currentValue: Math.max(0, asset.cost - accumulated)
    };
}

// Settings / Categories Defaults Helper
export const DEFAULT_CATEGORIES: Omit<AccountingCategory, 'id' | 'createdAt'>[] = [
    { name: 'Service Revenue', type: 'Revenue', status: 'Active', isDefault: true },
    { name: 'Consulting Income', type: 'Revenue', status: 'Active', isDefault: true },
    { name: 'Project Payment', type: 'Revenue', status: 'Active', isDefault: true },
    { name: 'Other Income', type: 'Revenue', status: 'Active', isDefault: true },
    { name: 'Office Rent', type: 'Expense', status: 'Active', isDefault: true },
    { name: 'Salary', type: 'Expense', status: 'Active', isDefault: true },
    { name: 'Internet', type: 'Expense', status: 'Active', isDefault: true },
    { name: 'Electricity', type: 'Expense', status: 'Active', isDefault: true },
    { name: 'Software', type: 'Expense', status: 'Active', isDefault: true },
    { name: 'Marketing', type: 'Expense', status: 'Active', isDefault: true },
    { name: 'Travel', type: 'Expense', status: 'Active', isDefault: true },
    { name: 'Equipment', type: 'Expense', status: 'Active', isDefault: true },
    { name: 'Miscellaneous', type: 'Expense', status: 'Active', isDefault: true },
    { name: 'Bank Account', type: 'Asset', status: 'Active', isDefault: true },
    { name: 'UPI Wallet', type: 'Asset', status: 'Active', isDefault: true },
    { name: 'Cash', type: 'Asset', status: 'Active', isDefault: true },
    { name: 'Electronics', type: 'Asset', status: 'Active', isDefault: true },
    { name: 'Furniture', type: 'Asset', status: 'Active', isDefault: true },
    { name: 'Office Infrastructure', type: 'Asset', status: 'Active', isDefault: true },
    { name: 'Owner Capital', type: 'Equity', status: 'Active', isDefault: true },
    { name: 'Retained Earnings', type: 'Equity', status: 'Active', isDefault: true },
];

export async function initializeDefaultCategories() {
    const q = query(collection(db, 'accounting_categories'));
    const snap = await getDocs(q);
    if (snap.empty) {
        for (const cat of DEFAULT_CATEGORIES) {
            const docRef = doc(collection(db, 'accounting_categories'));
            await setDoc(docRef, { ...cat, id: docRef.id, createdAt: new Date().toISOString() });
        }
    }
}

export async function processAutomaticRevenue(alert: PaymentAlert, actualAmount: number) {
    try {
        const catQuery = query(collection(db, 'accounting_categories'), where('isDefault', '==', true));
        const snap = await getDocs(catQuery);
        const categories: AccountingCategory[] = snap.docs.map(d => d.data() as AccountingCategory);

        const revenueCat = categories.find(c => c.name === 'Service Revenue');
        const upiCat = categories.find(c => c.name === 'UPI Wallet');

        if (!revenueCat || !upiCat) {
            console.warn("Default accounting categories missing. Skipping auto-revenue.");
            return;
        }

        await recordRevenue(
            actualAmount,
            revenueCat,
            upiCat,
            new Date().toISOString(),
            `Auto-Revenue: ${alert.clientName} - ${alert.packageName || alert.taskName || 'N/A'}`,
            alert.id, // Use alert.id as referenceId to prevent duplicates
            'System Auto'
        );
    } catch (e) {
        console.error("Error processing auto revenue", e);
    }
}

export async function deleteJournalEntry(id: string) {
    await deleteDoc(doc(db, 'journal_entries', id));
}

export async function deleteAsset(id: string) {
    await deleteDoc(doc(db, 'accounting_assets', id));
}

export async function deleteLoan(id: string) {
    await deleteDoc(doc(db, 'accounting_loans', id));
}
