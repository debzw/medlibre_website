import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { CalendarDays } from 'lucide-react';
import { DashboardWidget } from '../DashboardWidget';

interface RecentActivityWidgetProps {
    activity: { date: string; count: number }[];
    loading?: boolean;
}

export function RecentActivityWidget({ activity, loading }: RecentActivityWidgetProps) {
    const totalQuestions = activity.reduce((acc, curr) => acc + curr.count, 0);

    return (
        <DashboardWidget title="Atividade (7 dias)" icon={CalendarDays} loading={loading}>
            <div className="flex h-full flex-col justify-between pt-2">
                <div className="flex items-baseline justify-between mb-4">
                    <div className="flex flex-col">
                        <span className="text-3xl font-black tracking-tighter text-foreground tabular-nums">
                            {totalQuestions}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50">
                            Questões revisadas
                        </span>
                    </div>
                </div>

                <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={activity}>
                            <defs>
                                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.9} />
                                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="date"
                                tickFormatter={(value) => {
                                    const date = new Date(value);
                                    return `${date.getDate()}/${date.getMonth() + 1}`;
                                }}
                                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.3, fontWeight: 'bold' }}
                                axisLine={false}
                                tickLine={false}
                                dy={10}
                                className="text-foreground"
                            />
                            <Tooltip
                                cursor={{ fill: 'currentColor', opacity: 0.03, radius: 8 }}
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    borderRadius: '20px',
                                    border: '1px solid hsl(var(--border))',
                                    backdropFilter: 'blur(16px)',
                                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)'
                                }}
                                itemStyle={{ color: 'hsl(var(--foreground))', fontSize: '13px', fontWeight: 'bold' }}
                                labelStyle={{ color: 'hsl(var(--muted-foreground))', opacity: 0.7, fontSize: '10px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                                labelFormatter={(value) => {
                                    const date = new Date(value);
                                    return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' });
                                }}
                            />
                            <Bar
                                dataKey="count"
                                fill="url(#barGradient)"
                                radius={[8, 8, 2, 2]}
                                name="Questões"
                                maxBarSize={36}
                                animationDuration={1500}
                                animationEasing="ease-out"
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </DashboardWidget>
    );
}
