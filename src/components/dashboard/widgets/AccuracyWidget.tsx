import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Target } from 'lucide-react';
import { DashboardWidget } from '../DashboardWidget';
import { DASHBOARD_COLORS, getPerformanceColor } from '../DashboardColors';

interface AccuracyWidgetProps {
    correct: number;
    total: number;
    loading?: boolean;
}

export function AccuracyWidget({ correct, total, loading }: AccuracyWidgetProps) {
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
    const color = getPerformanceColor(percentage);

    const data = [
        { name: 'Corretas', value: correct },
        { name: 'Incorretas', value: total - correct },
    ];

    return (
        <DashboardWidget title="Precisão Global" icon={Target} loading={loading}>
            <div className="flex h-full flex-col items-center justify-center -mt-4">
                <div className="relative h-44 w-full flex items-center justify-center">
                    {/* Background Glow based on performance */}
                    <div
                        className="absolute h-32 w-32 rounded-full blur-[50px] opacity-30 transition-all duration-1000"
                        style={{ backgroundColor: color }}
                    />
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={78}
                                paddingAngle={0}
                                dataKey="value"
                                startAngle={90}
                                endAngle={-270}
                                stroke="none"
                            >
                                <Cell fill={color} className="drop-shadow-[0_0_12px_rgba(0,0,0,0.3)] transition-all duration-700" />
                                <Cell fill="rgba(255,255,255,0.03)" />
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
                        <span className="text-5xl font-black tracking-tighter leading-none" style={{ color }}>
                            {percentage}
                            <span className="text-xl font-bold ml-0.5">%</span>
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/40 mt-1">ACERTO</span>
                    </div>
                </div>
                <div className="mt-6 flex items-center gap-3 rounded-2xl bg-card/40 px-5 py-2.5 ring-1 ring-border/40 shadow-xl backdrop-blur-xl group/info hover:border-primary/20 transition-all">
                    <div className="h-2 w-2 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.2)]" style={{ backgroundColor: color }} />
                    <p className="text-xs font-bold text-muted-foreground/80 group-hover:text-foreground transition-colors uppercase tracking-wider">
                        {correct} <span className="text-muted-foreground/40 font-medium">/</span> {total} <span className="text-[10px] ml-1 opacity-60">QUESTÕES</span>
                    </p>
                </div>
            </div>
        </DashboardWidget>
    );
}
