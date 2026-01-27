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
                    <div className="flex items-center gap-4">
                        <div className="rounded-2xl bg-blue-500/5 p-3 text-blue-500 shadow-inner group-hover/time:scale-110 transition-transform duration-500 ring-1 ring-blue-500/10">
                            <Clock className="h-5 w-5" />
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Tempo Médio</p>
                            <p className="text-xs font-bold text-foreground/70 uppercase tracking-widest">por questão</p>
                        </div>
                    </div>
                    <span className="text-3xl font-black tracking-tighter tabular-nums leading-none text-blue-500">{formatTime(averageTimeSeconds)}</span>
                </div>

                <div className="flex items-center justify-between rounded-[2rem] bg-card/40 border border-border/40 p-5 backdrop-blur-3xl transition-all duration-500 hover:bg-card/60 hover:-translate-y-1 shadow-sm hover:shadow-xl group/total">
                    <div className="flex items-center gap-4">
                        <div className="rounded-2xl bg-purple-500/5 p-3 text-purple-500 shadow-inner group-hover/total:scale-110 transition-transform duration-500 ring-1 ring-purple-500/10">
                            <Timer className="h-5 w-5" />
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Tempo Total</p>
                            <p className="text-xs font-bold text-foreground/70 uppercase tracking-widest">de foco</p>
                        </div>
                    </div>
                    <span className="text-3xl font-black tracking-tighter tabular-nums leading-none text-purple-500">{formatTotalTime(totalTimeSeconds)}</span>
                </div>
            </div>
        </DashboardWidget>
    );
}
