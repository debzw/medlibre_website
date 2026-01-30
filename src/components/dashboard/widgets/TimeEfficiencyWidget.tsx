import { Clock, Timer } from 'lucide-react';
import { DashboardWidget } from '../DashboardWidget';

interface TimeEfficiencyWidgetProps {
    averageTimeSeconds: number;
    totalTimeSeconds: number;
    loading?: boolean;
}

export function TimeEfficiencyWidget({ averageTimeSeconds, totalTimeSeconds, loading }: TimeEfficiencyWidgetProps) {
    const formatTime = (seconds: number): string => {
        if (seconds < 60) return `${seconds}s`;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    };

    const formatTotalTime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    };

    return (
        <DashboardWidget title="Gestão de Tempo" icon={Clock} loading={loading}>
            <div className="space-y-5 flex flex-col justify-center h-full">
                <div className="flex items-center justify-between rounded-[2rem] bg-card/40 border border-border/40 p-5 backdrop-blur-3xl transition-all duration-500 hover:bg-card/60 hover:-translate-y-1 shadow-sm hover:shadow-xl group/time">
                    <div className="space-y-0.5">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Tempo Médio</p>
                        <p className="text-xs font-bold text-foreground/70 uppercase tracking-widest">por questão</p>
                    </div>
                    <span className="text-3xl font-black tracking-tighter tabular-nums leading-none text-amber-500">{formatTime(averageTimeSeconds)}</span>
                </div>

                <div className="flex items-center justify-between rounded-[2rem] bg-card/40 border border-border/40 p-5 backdrop-blur-3xl transition-all duration-500 hover:bg-card/60 hover:-translate-y-1 shadow-sm hover:shadow-xl group/total">
                    <div className="space-y-0.5">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Tempo Total</p>
                        <p className="text-xs font-bold text-foreground/70 uppercase tracking-widest">de foco</p>
                    </div>
                    <span className="text-3xl font-black tracking-tighter tabular-nums leading-none text-muted-foreground">{formatTotalTime(totalTimeSeconds)}</span>
                </div>
            </div>
        </DashboardWidget>
    );
}
