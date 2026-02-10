import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { PerformanceEvolution as IPerformanceEvolution } from '@/types/performance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PerformanceEvolutionProps {
    data: IPerformanceEvolution[];
    loading?: boolean;
}

export function PerformanceEvolution({ data, loading }: PerformanceEvolutionProps) {
    if (loading) return <div className="h-80 rounded-2xl bg-muted/20 animate-pulse" />;

    const chartData = useMemo(() => {
        return data.map(d => ({
            ...d,
            formattedDate: format(parseISO(d.date), 'dd/MM', { locale: ptBR }),
        }));
    }, [data]);

    return (
        <Card className="border-border/50 bg-card/20 backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="text-lg font-bold">Evolução Recente</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorAccuracy" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis
                                dataKey="formattedDate"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 12, fill: '#6B7280' }}
                                dy={10}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 12, fill: '#6B7280' }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(17, 24, 39, 0.9)',
                                    borderColor: 'rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                    color: '#fff'
                                }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="accuracy"
                                stroke="#f59e0b"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorAccuracy)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
