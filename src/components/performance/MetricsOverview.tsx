import { motion } from 'framer-motion';
import { CheckCircle2, Crosshair, Timer, Target } from 'lucide-react';
import { SpecialtyMetrics } from '@/types/performance';
import { getPerformanceColor } from '@/components/dashboard/DashboardColors';

interface MetricsOverviewProps {
    metrics: SpecialtyMetrics;
    loading?: boolean;
}

export function MetricsOverview({ metrics, loading }: MetricsOverviewProps) {
    if (loading) {
        return <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 rounded-2xl bg-muted/20" />
            ))}
        </div>;
    }

    const items = [
        {
            label: 'Questões Resolvidas',
            value: metrics.total_answered,
            icon: CheckCircle2,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10',
        },
        {
            label: 'Acertos',
            value: metrics.total_correct,
            icon: Target,
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10',
        },
        {
            label: 'Precisão Global',
            value: `${metrics.accuracy}%`,
            icon: Crosshair,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10',
            textColor: getPerformanceColor(metrics.accuracy),
        },
        {
            label: 'Tempo Total',
            value: `${Math.round(metrics.total_time_seconds / 60)} min`,
            icon: Timer,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10',
        },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {items.map((item, index) => (
                <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/30 p-5 backdrop-blur-sm transition-all hover:bg-card/50"
                >
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                {item.label}
                            </p>
                            <p className={`text-2xl font-black tracking-tight ${item.textColor || 'text-foreground'}`}>
                                {item.value}
                            </p>
                        </div>
                        <div className={`rounded-xl p-2 ${item.bg}`}>
                            <item.icon className={`h-5 w-5 ${item.color}`} />
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
