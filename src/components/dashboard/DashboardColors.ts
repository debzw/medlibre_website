export const DASHBOARD_COLORS = {
    critical: '#D13934', // Red
    warning: '#F58B2B',  // Orange
    gold: '#EDB92E',     // Yellow/Gold
    good: '#38BE58',     // Green
    info: '#2DC0E0',     // Cyan/Blue
    neutral: '#6B7280',  // Gray
} as const;

export type PerformanceStatus = 'critical' | 'warning' | 'good' | 'gold' | 'info' | 'neutral';

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
