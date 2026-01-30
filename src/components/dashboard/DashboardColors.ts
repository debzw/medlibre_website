export const DASHBOARD_COLORS = {
    critical: '#E53935', // Red
    good: '#8BC34A',     // Light Green
    gold: '#EDB92E',     // Gold
    neutral: '#6B7280',  // Gray
} as const;

export type PerformanceStatus = 'critical' | 'good' | 'gold' | 'neutral';

export const getPerformanceColor = (percentage: number): string => {
    if (percentage >= 90) return DASHBOARD_COLORS.good;
    if (percentage >= 60) return DASHBOARD_COLORS.gold;
    return DASHBOARD_COLORS.critical;
};

export const getPerformanceStatus = (percentage: number): PerformanceStatus => {
    if (percentage >= 90) return 'good';
    if (percentage >= 60) return 'gold';
    return 'critical';
};
