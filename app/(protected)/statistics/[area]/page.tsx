'use client';

import { useState, use } from 'react';
import { useRouter, notFound } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAreaStats } from '@/hooks/useAreaStats';
import { type TimeFilter } from '@/hooks/useQuestionHistory';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReportDialog } from '@/components/modals/ReportDialog';

import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { DashboardKPIs } from '@/components/dashboard/DashboardKPIs';
import { PerformanceHeatmap } from '@/components/dashboard/PerformanceHeatmap';
import { AreaStatsTable } from '@/components/dashboard/AreaStatsTable';

const AREA_MAP: Record<string, { label: string; dbValue: string }> = {
    'clinica-medica': { label: 'Clínica Médica', dbValue: 'Clínica Médica' },
    'cirurgia-geral': { label: 'Cirurgia Geral', dbValue: 'Cirurgia' },
    'preventiva': { label: 'Preventiva', dbValue: 'Preventiva' },
    'ginecologia-obstetricia': { label: 'Ginecologia e Obstetrícia', dbValue: 'Ginecologia e Obstetrícia' },
    'pediatria': { label: 'Pediatria', dbValue: 'Pediatria' },
};

export default function AreaStatisticsPage({ params }: { params: Promise<{ area: string }> }) {
    const { area } = use(params);
    const router = useRouter();
    const { user, loading: authLoading } = useAuthContext();
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
    const [heatmapMode, setHeatmapMode] = useState<'binary' | 'accuracy'>('binary');
    const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);

    const areaConfig = AREA_MAP[area];

    const { stats, isLoading, isError } = useAreaStats(areaConfig?.dbValue ?? '', timeFilter);

    // Unknown area slug → 404 (after hooks to comply with Rules of Hooks)
    if (!areaConfig && !authLoading) {
        notFound();
    }

    if (!user && !authLoading) {
        return (
            <div className="container mx-auto px-4 py-32 flex justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex max-w-md flex-col items-center gap-6 rounded-3xl border border-border/50 bg-card/20 p-10 text-center backdrop-blur-xl"
                >
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
                        <TrendingUp className="h-10 w-10 text-primary" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-3xl font-bold tracking-tight text-foreground">Estatísticas Avançadas</h2>
                        <p className="text-muted-foreground text-lg">
                            Desbloqueie insights detalhados sobre seu desempenho e acelere sua aprovação.
                        </p>
                    </div>
                    <Button onClick={() => router.push('/auth')} size="lg" className="w-full rounded-xl text-md font-semibold h-12">
                        Entrar ou Cadastrar
                    </Button>
                </motion.div>
            </div>
        );
    }

    if (authLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
            </div>
        );
    }

    const accuracy = stats.totalAnswered > 0 ? (stats.totalCorrect / stats.totalAnswered) * 100 : 0;
    const timePerQ = stats.averageTimeSeconds;
    const totalTime = stats.totalTimeSeconds;
    const totalQ = stats.totalAnswered;
    const correctQ = stats.totalCorrect;

    return (
        <div className="flex h-[calc(100vh-64px)] w-full bg-background text-foreground font-sans overflow-hidden transition-colors duration-300">
            {/* Left Sidebar */}
            <DashboardSidebar />

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col p-6 sm:p-10 lg:pl-16 overflow-y-auto">
                {/* Header: centered toggle with area name absolutely positioned to the left */}
                <header className="flex justify-center mb-6 relative">
                    <motion.h1
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3 }}
                        className="absolute left-0 top-1/2 -translate-y-1/2 text-xl font-bold tracking-tight text-foreground"
                    >
                        {areaConfig?.label}
                    </motion.h1>
                    <Tabs defaultValue="all" value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
                        <TabsList className="bg-secondary/20 dark:bg-white/5 border border-border dark:border-white/10 p-1 rounded-full ring-0 shadow-sm h-auto flex gap-1">
                            <TabsTrigger
                                value="today"
                                className="rounded-full data-[state=active]:bg-background dark:data-[state=active]:bg-white/10 data-[state=active]:text-foreground dark:data-[state=active]:text-white data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground dark:hover:text-white font-bold text-[9px] sm:text-[11px] uppercase tracking-widest px-3 sm:px-5 py-1.5 transition-all"
                            >
                                Hoje
                            </TabsTrigger>
                            <TabsTrigger
                                value="week"
                                className="rounded-full data-[state=active]:bg-background dark:data-[state=active]:bg-white/10 data-[state=active]:text-foreground dark:data-[state=active]:text-white data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground dark:hover:text-white font-bold text-[9px] sm:text-[11px] uppercase tracking-widest px-3 sm:px-5 py-1.5 transition-all"
                            >
                                Semana
                            </TabsTrigger>
                            <TabsTrigger
                                value="month"
                                className="rounded-full data-[state=active]:bg-background dark:data-[state=active]:bg-white/10 data-[state=active]:text-foreground dark:data-[state=active]:text-white data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground dark:hover:text-white font-bold text-[9px] sm:text-[11px] uppercase tracking-widest px-3 sm:px-5 py-1.5 transition-all"
                            >
                                Mês
                            </TabsTrigger>
                            <TabsTrigger
                                value="all"
                                className="rounded-full data-[state=active]:bg-background dark:data-[state=active]:bg-white/20 data-[state=active]:text-foreground dark:data-[state=active]:text-white data-[state=active]:shadow-sm text-muted-foreground hover:text-foreground dark:hover:text-white font-bold text-[9px] sm:text-[11px] uppercase tracking-widest px-3 sm:px-5 py-1.5 transition-all"
                            >
                                Sempre
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </header>

                <div className="mx-auto w-full md:w-max">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={timeFilter}
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <DashboardKPIs
                                accuracy={accuracy}
                                totalTimeSeconds={totalTime}
                                timePerQuestionSeconds={timePerQ}
                                totalQuestions={totalQ}
                                correctQuestions={correctQ}
                                onAccuracyClick={() => setHeatmapMode(m => m === 'accuracy' ? 'binary' : 'accuracy')}
                                accuracyActive={heatmapMode === 'accuracy'}
                            />
                        </motion.div>
                    </AnimatePresence>

                    {/* Heatmap filtered to this grande área */}
                    <div className="mt-16 px-2">
                        <PerformanceHeatmap mode={heatmapMode} areaFilter={areaConfig?.dbValue} />
                    </div>

                    {/* Area Specialties Stats Table */}
                    <div className="mt-32 px-2 pb-16">
                        {isError ? (
                            <p className="text-xs text-destructive/70 text-center py-4">
                                Erro ao carregar dados de especialidades.
                            </p>
                        ) : (
                            <AreaStatsTable statsByField={stats.byField} isLoading={isLoading} />
                        )}
                    </div>
                </div>

                <ReportDialog
                    isOpen={isReportDialogOpen}
                    onClose={() => setIsReportDialogOpen(false)}
                    type="statistics"
                    targetId={`statistics_${area}`}
                    targetName={`Estatísticas — ${areaConfig?.label}`}
                />
            </main>
        </div>
    );
}
