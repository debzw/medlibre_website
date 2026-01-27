import { motion } from 'framer-motion';
import { Building2 } from 'lucide-react';
import { DashboardWidget } from '../DashboardWidget';
import { getPerformanceColor } from '../DashboardColors';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BancaEntry {
    name: string;
    correct: number;
    total: number;
    accuracy: number;
}

interface BancaPerformanceWidgetProps {
    byBanca: Record<string, { correct: number; total: number }>;
    loading?: boolean;
}

export function BancaPerformanceWidget({ byBanca, loading }: BancaPerformanceWidgetProps) {
    const data: BancaEntry[] = Object.entries(byBanca)
        .map(([name, stats]) => ({
            name,
            correct: stats.correct,
            total: stats.total,
            accuracy: Math.round((stats.correct / stats.total) * 100),
        }))
        .sort((a, b) => b.total - a.total);

    return (
        <DashboardWidget title="Desempenho por Banca" icon={Building2} loading={loading}>
            <ScrollArea className="h-[320px] -mr-4 pr-4">
                <div className="flex flex-col gap-8 pt-4">
                    {data.length > 0 ? (
                        data.map((banca) => (
                            <div key={banca.name} className="group/banca flex flex-col gap-3">
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[13px] font-black uppercase tracking-wider text-foreground/80 group-hover/banca:text-foreground transition-colors leading-none">{banca.name}</span>
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/30">{banca.total} QUESTÕES</span>
                                    </div>
                                    <span className="text-xl font-black tabular-nums tracking-tighter" style={{ color: getPerformanceColor(banca.accuracy) }}>
                                        {banca.accuracy}%
                                    </span>
                                </div>
                                <div className="h-2.5 w-full overflow-hidden rounded-full bg-card/40 p-[2px] ring-1 ring-border/20 shadow-inner backdrop-blur-3xl group-hover/banca:ring-primary/20 transition-all duration-500">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${banca.accuracy}%` }}
                                        transition={{ duration: 1.5, ease: "easeOut" }}
                                        className="h-full rounded-full transition-all duration-1000 ease-out"
                                        style={{
                                            backgroundColor: getPerformanceColor(banca.accuracy),
                                            boxShadow: `0 0 15px ${getPerformanceColor(banca.accuracy)}33`
                                        }}
                                    />
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-20 text-center relative overflow-hidden rounded-[2.5rem] bg-muted/[0.02] border border-dashed border-border/20">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/20">SEM REGISTROS</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </DashboardWidget>
    );
}
