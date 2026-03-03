import { PaymentAlert } from '../../types';

export const getMonthYearString = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const getTargetForMonth = (year: number, monthIndex: number): number => {
    // monthIndex is 0-indexed (0 = Jan, 11 = Dec)
    if (year === 2026) {
        if (monthIndex >= 0 && monthIndex <= 2) return 60000; // Jan-Mar
        if (monthIndex >= 3 && monthIndex <= 5) return 80000; // Apr-Jun
        return 100000; // Jul-Dec
    }
    if (year === 2027) return 250000;
    if (year === 2028) return 500000;
    if (year === 2029) return 800000;
    if (year >= 2030) return 1200000;

    return 60000; // Fallback
};

export const getAnnualTarget = (year: number): number => {
    if (year === 2026) {
        // Exact summation of the gradual months:
        // (60k * 3) + (80k * 3) + (100k * 6) = 180k + 240k + 600k = 10,20,000
        return 1020000;
    }
    if (year === 2027) return 3000000; // 30L
    if (year === 2028) return 6000000; // 60L
    if (year === 2029) return 9600000; // 96L
    if (year >= 2030) return 14400000; // 144L

    return 0;
};

// Returns a map of "YYYY-MM" to total received revenue
export const aggregateMonthlyRevenue = (payments: PaymentAlert[]): Record<string, number> => {
    const MonthlyNav: Record<string, number> = {};

    payments.forEach(payment => {
        if (payment.status === 'received' && payment.resolvedAt) {
            // payment.resolvedAt is usually an ISO string.
            // E.g. "2026-03-01T12:00:00.000Z"
            const date = new Date(payment.resolvedAt);
            const key = getMonthYearString(date);
            const amount = payment.actualAmount !== undefined ? payment.actualAmount : payment.amount;

            if (!MonthlyNav[key]) MonthlyNav[key] = 0;
            MonthlyNav[key] += Math.max(0, amount);
        }
    });

    return MonthlyNav;
};

// Gets the rolling average for a specific target month
export const getRolling3MonthAverage = (targetDate: Date, monthlyRevenue: Record<string, number>): { avg: number; monthsFound: number } => {
    let total = 0;
    let monthsFound = 0;

    for (let i = 0; i < 3; i++) {
        const d = new Date(targetDate.getFullYear(), targetDate.getMonth() - i, 1);
        const key = getMonthYearString(d);

        // We strictly check if the month exists in our records (even if 0 revenue recorded, it might not be in the dictionary)
        // Actually, if we are in operation, a month with 0 revenue still counts as a month of operation.
        // For simplicity, we just add the revenue if it exists.
        // Wait, to do rolling average correctly: if the system just started 1 month ago, we divide by 1.
        // How do we know when the system started? Let's just use the dictionary keys to find the earliest payment.

        total += monthlyRevenue[key] || 0;
        monthsFound++; // Technically this assumes the business existed. If we want true "active months":
    }

    // To prevent dividing by 3 when only 1 month of data exists overall in the system:
    const allKeys = Object.keys(monthlyRevenue).sort();
    if (allKeys.length === 0) return { avg: 0, monthsFound: 0 };

    const earliestDateStr = allKeys[0];
    const earliestDate = new Date(earliestDateStr + '-01'); // "YYYY-MM-01"

    // Calculate how many months have actually passed since the earliest payment
    const monthsSinceStart = (targetDate.getFullYear() - earliestDate.getFullYear()) * 12 + (targetDate.getMonth() - earliestDate.getMonth()) + 1;
    const divisor = Math.min(3, Math.max(1, monthsSinceStart));

    return { avg: total / divisor, monthsFound: divisor };
};

export const calculatePercentage = (actual: number, target: number): number => {
    if (target === 0) return 0;
    return (actual / target) * 100;
};

export interface ProjectionData {
    year: number;
    targetProjection: number;
    actualProjection: number; // The blue line
}

export const generate5YearProjections = (currentDate: Date, rollingAvg: number, performancePct: number): ProjectionData[] => {
    const currentYear = currentDate.getFullYear();
    const baseYear = Math.max(2026, currentYear); // Start at least at 2026
    const projections: ProjectionData[] = [];

    // Year 0 (Current Year)
    // According to prompt: current_year_projection = rolling_avg * 12
    let lastActualProjection = rollingAvg * 12;

    for (let year = 2026; year <= 2030; year++) {
        if (year < baseYear) {
            // Past years - we technically could calculate real past annual data, 
            // but for simplicity of the 5-year forecast prompt:
            // We'll just build it chronologically. If they are in 2026, it works perfect.
            // If they are in 2027, 2026 is just target projection.
            projections.push({
                year,
                targetProjection: getAnnualTarget(year),
                actualProjection: 0 // Will overwrite below if needed
            });
            continue;
        }

        if (year === baseYear) {
            // Base year computation
            projections.push({
                year,
                targetProjection: getAnnualTarget(year),
                actualProjection: lastActualProjection
            });
            continue;
        }

        // Future years compounding logic
        let multiplier = 1;

        // Only apply growth multiplier if performance >= 85% of current target
        if (performancePct >= 85) {
            if (year === 2027) multiplier = 2.5;
            else if (year === 2028) multiplier = 2.0;
            else if (year === 2029) multiplier = 1.6;
            else if (year === 2030) multiplier = 1.5;
        } else if (performancePct < 70) {
            // Flatline
            multiplier = 1.0;
        } else {
            // Between 70 and 85 we might just do a slight growth or flat. 
            // The prompt says "If performance < 70%: Projection remains flat." 
            // It doesn't specify 70-84%, so let's assume flatline or 1.0 multiplier.
            multiplier = 1.0;
        }

        lastActualProjection = lastActualProjection * multiplier;

        projections.push({
            year,
            targetProjection: getAnnualTarget(year),
            actualProjection: lastActualProjection
        });
    }

    return projections;
};
