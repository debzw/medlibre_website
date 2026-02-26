import Link from 'next/link';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, BookOpen } from 'lucide-react';
import { DashboardWidget } from '../DashboardWidget';
import { getPerformanceColor } from '../DashboardColors';
import { useSpecialtyPerformance } from '@/hooks/useSpecialtyPerformance';
import { cn } from '@/lib/utils';

interface ThemeEntryProps {
    topic: string;
    correct: number;
    total: number;
    accuracy: number;
}

function ThemeEntry({ topic, correct, total, accuracy }: ThemeEntryProps) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-border/5 last:border-0 group/theme">
            <div className="flex flex-col gap-1 min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 group-hover/theme:text-foreground transition-colors truncate">
                    {topic}
                </span>
                <div className="flex items-center gap-3">
                    <div className="h-1 flex-1 bg-muted/20 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${accuracy}%` }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: getPerformanceColor(accuracy) }}
                        />
                    </div>
                    <span className="text-[10px] font-black tabular-nums" style={{ color: getPerformanceColor(accuracy) }}>
                        {accuracy}%
                    </span>
                </div>
            </div>
            <div className="ml-4 text-[9px] font-black uppercase text-muted-foreground/30 whitespace-nowrap">
                {correct}/{total} Q
            </div>
        </div>
    );
}

interface SpecialtyEntryProps {
    name: string;
    correct: number;
    total: number;
    accuracy: number;
}

function SpecialtyItem({ name, correct, total, accuracy }: SpecialtyEntryProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const { data: details, isLoading } = useSpecialtyPerformance(name);

    return (
        <div className="w-full flex flex-col gap-2">
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="group/item relative flex flex-col gap-3 transition-all duration-500 hover:bg-muted/10 p-2 rounded-xl -mx-2 cursor-pointer"
            >
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 min-w-0">
                        <button className="p-1 hover:bg-muted/20 rounded-md transition-colors">
                            <ChevronRight className={cn("h-3 w-3 transition-transform duration-300", isExpanded && "rotate-90")} />
                        </button>
                        <span className="text-[13px] font-black uppercase tracking-widest text-foreground/70 group-hover/item:text-foreground transition-colors truncate">
                            {name}
                        </span>
                    </div>
                    <span className="text-xl font-black tabular-nums tracking-tighter" style={{ color: getPerformanceColor(accuracy) }}>
                        {accuracy}%
                    </span>
                </div>

                <div className="relative h-3 w-full overflow-hidden rounded-full bg-card/40 p-[2px] ring-1 ring-border/20 shadow-inner backdrop-blur-3xl group-hover/item:ring-primary/20 transition-all duration-500">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${accuracy}%` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className="h-full rounded-full transition-all duration-1000 ease-out"
                        style={{
                            backgroundColor: getPerformanceColor(accuracy),
                            boxShadow: `0 0 20px ${getPerformanceColor(accuracy)}44`
                        }}
                    />
                </div>

                <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 px-1">
                    <span className="flex items-center gap-1.5 ring-1 ring-border/5 px-2 py-0.5 rounded-full">
                        <span className="h-1 w-1 rounded-full bg-success/40" />
                        {correct} ACERTOS
                    </span>
                    <span className="flex items-center gap-1.5 ring-1 ring-border/5 px-2 py-0.5 rounded-full">
                        <span className="h-1 w-1 rounded-full bg-primary/40" />
                        {total} QUESTÕES
                    </span>
                </div>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="flex flex-col gap-1 pl-4 pr-2 py-2 bg-muted/5 rounded-xl border border-border/5">
                            {isLoading ? (
                                <div className="py-4 flex justify-center">
                                    <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                </div>
                            ) : details?.topics && details.topics.length > 0 ? (
                                details.topics.map((t) => (
                                    <ThemeEntry
                                        key={t.topic}
                                        topic={t.topic}
                                        correct={t.correct}
                                        total={t.total_available}
                                        accuracy={Math.round(t.accuracy)}
                                    />
                                ))
                            ) : (
                                <p className="text-[10px] text-center py-4 text-muted-foreground/40 font-bold uppercase tracking-widest">
                                    Sem dados para subtemas
                                </p>
                            )}
                            <Link
                                href={`/performance/${encodeURIComponent(name)}`}
                                className="mt-2 py-2 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-primary hover:text-primary/70 transition-colors"
                            >
                                Ver diagnóstico completo <ChevronRight className="h-2 w-2" />
                            </Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

interface SpecialtyPerformanceWidgetProps {
    byField: Record<string, { correct: number; total: number; avgTime: number }>;
    loading?: boolean;
}

export function SpecialtyPerformanceWidget({ byField, loading }: SpecialtyPerformanceWidgetProps) {
    const data = Object.entries(byField)
        .map(([name, stats]) => ({
            name,
            correct: stats.correct,
            total: stats.total,
            accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total);

    return (
        <DashboardWidget
            colSpan={2}
            title="Desempenho por Especialidade"
            icon={BookOpen}
            loading={loading}
        >
            <div className="overflow-y-auto overflow-x-hidden max-h-[300px] pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border/30 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-border/60">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 pt-4">
                    {data.length > 0 ? (
                        data.map((item) => (
                            <SpecialtyItem
                                key={item.name}
                                name={item.name}
                                correct={item.correct}
                                total={item.total}
                                accuracy={item.accuracy}
                            />
                        ))
                    ) : (
                        <div className="col-span-2 py-20 text-center relative overflow-hidden rounded-[2rem] bg-muted/[0.02] border border-dashed border-border/20">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/20">
                                AGUARDANDO DADOS PARA MAPEAMENTO
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </DashboardWidget>
    );
}
