import { Flame } from 'lucide-react';
import { DashboardWidget } from '../DashboardWidget';
import { cn } from '@/lib/utils';
import { DASHBOARD_COLORS } from '../DashboardColors';

interface StreakWidgetProps {
    streakDays: number;
    totalAnswered: number;
    timeFilterLabel: string;
    loading?: boolean;
}

export function StreakWidget({ streakDays, totalAnswered, timeFilterLabel, loading }: StreakWidgetProps) {
    return (
        <DashboardWidget title="Consistência" loading={loading}>
            <div className="flex flex-col items-center justify-center h-full">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-4">
                    consistência é a chave
                </p>

                <div className="relative flex items-center justify-center">
                    {/* Glowing background for the circle */}
                    <div
                        className={cn(
                            "absolute h-32 w-32 rounded-full blur-[40px] opacity-20 transition-all duration-700",
                            streakDays === 0 && "bg-muted"
                        )}
                        style={streakDays > 0 ? { backgroundColor: DASHBOARD_COLORS.gold } : undefined}
                    />

                    {/* The Circle */}
                    <div
                        className={cn(
                            "relative h-28 w-28 rounded-full border-4 flex flex-col items-center justify-center transition-all duration-500 shadow-2xl",
                            streakDays === 0 && "border-border/50 bg-muted/30"
                        )}
                        style={streakDays > 0 ? {
                            borderColor: DASHBOARD_COLORS.gold,
                            backgroundColor: DASHBOARD_COLORS.gold + '0D',
                            boxShadow: `0 25px 50px -12px ${DASHBOARD_COLORS.gold}33, 0 0 0 4px ${DASHBOARD_COLORS.gold}1A`,
                        } : undefined}
                    >
                        <span
                            className={cn("text-4xl font-black tracking-tighter leading-none", streakDays === 0 && "text-muted-foreground/30")}
                            style={streakDays > 0 ? { color: DASHBOARD_COLORS.gold } : undefined}
                        >
                            {streakDays}
                        </span>
                        <span
                            className={cn("text-[10px] font-bold uppercase tracking-widest mt-1", streakDays === 0 && "text-white/10")}
                            style={streakDays > 0 ? { color: DASHBOARD_COLORS.gold + '99' } : undefined}
                        >
                            dias
                        </span>
                    </div>

                </div>

                <div className="mt-6 flex flex-col items-center">
                    <div className="text-2xl font-black text-foreground tabular-nums">
                        {totalAnswered}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 text-center">
                        questões <br /> {timeFilterLabel}
                    </div>
                </div>
            </div>
        </DashboardWidget>
    );
}
