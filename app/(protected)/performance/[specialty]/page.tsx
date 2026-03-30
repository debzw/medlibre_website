'use client';

import { useParams, useRouter } from 'next/navigation';
import { useSpecialtyPerformance } from '@/hooks/useSpecialtyPerformance';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BrainCircuit } from 'lucide-react';
import { motion } from 'framer-motion';
import { MetricsOverview } from '@/components/performance/MetricsOverview';
import { TopicAnalysis } from '@/components/performance/TopicAnalysis';
import { PerformanceEvolution } from '@/components/performance/PerformanceEvolution';

export default function SpecialtyPerformancePage() {
    const params = useParams();
    const router = useRouter();
    const specialtyRaw = params.specialty as string;
    const specialty = decodeURIComponent(specialtyRaw);

    const { data, isLoading, error } = useSpecialtyPerformance(specialtyRaw);

    if (error) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4">
                <p className="text-destructive font-bold">Erro ao carregar dados da especialidade.</p>
                <Button onClick={() => router.back()}>Voltar</Button>
            </div>
        );
    }

    return (
        <div className="container min-h-screen px-4 py-8 pb-32 space-y-8 max-w-[1600px] mx-auto">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="sticky top-0 z-[50] -mx-4 px-4 py-4 mb-4 bg-background/80 backdrop-blur-2xl border-b border-border/50 flex items-center gap-4"
            >
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-4">
                    <div className="rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 p-3 shadow-lg shadow-purple-900/20">
                        <BrainCircuit className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-foreground/90">{specialty}</h1>
                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Diagnóstico de Performance</p>
                    </div>
                </div>
            </motion.div>

            {/* Content */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="space-y-8"
            >
                {/* 1. Metrics Overview */}
                <MetricsOverview
                    metrics={data?.metrics || { total_answered: 0, total_correct: 0, accuracy: 0, total_time_seconds: 0 }}
                    loading={isLoading}
                />

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* 2. Topic Analysis (Main Column) */}
                    <div className="xl:col-span-2">
                        <div className="rounded-3xl border border-border/50 bg-card/20 p-6 backdrop-blur-sm">
                            <TopicAnalysis
                                topics={data?.topics || []}
                                loading={isLoading}
                            />
                        </div>
                    </div>

                    {/* 3. Evolution & Insights (Side Column) */}
                    <div className="space-y-6">
                        <PerformanceEvolution
                            data={data?.evolution || []}
                            loading={isLoading}
                        />

                        {/* Future: Add AI detailed insights here */}
                        <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 p-6">
                            <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Dica Estratégica</h4>
                            <p className="text-sm text-foreground/80 leading-relaxed">
                                Foque nos temas marcados como <span className="text-yellow-500 font-bold">Pontos de Atenção</span>.
                                Eles representam ganho rápido de performance, pois você já estudou mas está errando.
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
