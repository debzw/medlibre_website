import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { MedLibreLogo } from '@/components/ui/MedLibreLogo';
import { DashboardWidget } from '../DashboardWidget';
import { getPerformanceColor } from '../DashboardColors';

interface SpecialtyEntry {
    name: string;
    correct: number;
    total: number;
    accuracy: number;
}

interface SpecialtyPerformanceWidgetProps {
    byField: Record<string, { correct: number; total: number; avgTime: number }>;
    loading?: boolean;
}

export function SpecialtyPerformanceWidget({ byField, loading }: SpecialtyPerformanceWidgetProps) {
    const data: SpecialtyEntry[] = Object.entries(byField)
        .map(([name, stats]) => ({
            name,
            correct: stats.correct,
            total: stats.total,
            accuracy: Math.round((stats.correct / stats.total) * 100),
        }))
        .sort((a, b) => b.accuracy - a.accuracy)
        .slice(0, 6);

    return (
        <DashboardWidget colSpan={2} title="Desempenho por Especialidade" icon={MedLibreLogo} loading={loading}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 pt-4">
                {data.length > 0 ? (
                    data.map((item) => (
                        <div key={item.name} className="group/item relative flex flex-col gap-3 transition-all duration-500">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-[13px] font-black uppercase tracking-widest text-foreground/70 group-hover/item:text-foreground transition-colors truncate pr-4">
                                    {item.name}
                                </span>
                                <span className="text-xl font-black tabular-nums tracking-tighter" style={{ color: getPerformanceColor(item.accuracy) }}>
                                    {item.accuracy}%
                                </span>
                            </div>

                            <div className="relative h-3 w-full overflow-hidden rounded-full bg-card/40 p-[2px] ring-1 ring-border/20 shadow-inner backdrop-blur-3xl group-hover/item:ring-primary/20 transition-all duration-500">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${item.accuracy}%` }}
                                    transition={{ duration: 1.5, ease: "easeOut" }}
                                    className="h-full rounded-full transition-all duration-1000 ease-out"
                                    style={{
                                        backgroundColor: getPerformanceColor(item.accuracy),
                                        boxShadow: `0 0 20px ${getPerformanceColor(item.accuracy)}44`
                                    }}
                                />
                            </div>

                            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 px-1">
                                <span className="flex items-center gap-1.5 ring-1 ring-border/5 px-2 py-0.5 rounded-full">
                                    <span className="h-1 w-1 rounded-full bg-success/40" />
                                    {item.correct} ACERTOS
                                </span>
                                <span className="flex items-center gap-1.5 ring-1 ring-border/5 px-2 py-0.5 rounded-full">
                                    <span className="h-1 w-1 rounded-full bg-primary/40" />
                                    {item.total} QUESTÕES
                                </span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-2 py-20 text-center relative overflow-hidden rounded-[2rem] bg-muted/[0.02] border border-dashed border-border/20">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/20">AGUARDANDO DADOS PARA MAPEAMENTO</p>
                    </div>
                )}
            </div>
        </DashboardWidget>
    );
}
