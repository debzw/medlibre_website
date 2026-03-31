'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';
import { useQuestionHistory, type TimeFilter } from '@/hooks/useQuestionHistory';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, LayoutDashboard, MoreVertical, Flag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReportDialog } from '@/components/modals/ReportDialog';

// New Components
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { DashboardKPIs } from '@/components/dashboard/DashboardKPIs';
import { PerformanceHeatmap } from '@/components/dashboard/PerformanceHeatmap';

export default function StatisticsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuthContext();
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
    const { stats, isLoading } = useQuestionHistory(timeFilter);
    const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
    const [heatmapMode, setHeatmapMode] = useState<'binary' | 'accuracy'>('binary');

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
    const timePerQ = stats.totalAnswered > 0 ? stats.averageTimeSeconds : 0;
    const totalTime = stats.totalTimeSeconds ?? 0;
    const totalQ = stats.totalAnswered ?? 0;
    const correctQ = stats.totalCorrect ?? 0;

    return (
        <div className="flex h-[calc(100vh-64px)] w-full bg-background text-foreground font-sans overflow-hidden transition-colors duration-300">
            {/* Left Sidebar */}
            <DashboardSidebar />

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col p-6 sm:p-10 lg:pl-16 overflow-y-auto">
                {/* Header Segment for Time Period */}
                <header className="flex justify-center mb-10 mt-2">
                    <Tabs defaultValue="all" value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
                        <TabsList className="bg-secondary/30 dark:bg-white/5 backdrop-blur-xl border border-border/40 p-1.5 rounded-full shadow-inner h-auto flex gap-1">
                            {/* HOJE */}
                            <TabsTrigger 
                                value="today" 
                                className="rounded-full data-[state=active]:bg-background dark:data-[state=active]:bg-white/15 data-[state=active]:text-foreground dark:data-[state=active]:text-white data-[state=active]:shadow-md text-muted-foreground hover:text-foreground dark:hover:text-white font-bold text-[10px] sm:text-xs uppercase tracking-widest px-4 sm:px-6 py-2 transition-all duration-300"
                            >
                                Hoje
                            </TabsTrigger>
                            {/* SEMANA */}
                            <TabsTrigger 
                                value="week" 
                                className="rounded-full data-[state=active]:bg-background dark:data-[state=active]:bg-white/15 data-[state=active]:text-foreground dark:data-[state=active]:text-white data-[state=active]:shadow-md text-muted-foreground hover:text-foreground dark:hover:text-white font-bold text-[10px] sm:text-xs uppercase tracking-widest px-4 sm:px-6 py-2 transition-all duration-300"
                            >
                                Semana
                            </TabsTrigger>
                            {/* MÊS */}
                            <TabsTrigger 
                                value="month" 
                                className="rounded-full data-[state=active]:bg-background dark:data-[state=active]:bg-white/15 data-[state=active]:text-foreground dark:data-[state=active]:text-white data-[state=active]:shadow-md text-muted-foreground hover:text-foreground dark:hover:text-white font-bold text-[10px] sm:text-xs uppercase tracking-widest px-4 sm:px-6 py-2 transition-all duration-300"
                            >
                                Mês
                            </TabsTrigger>
                            {/* SEMPRE */}
                            <TabsTrigger 
                                value="all" 
                                className="rounded-full data-[state=active]:bg-background dark:data-[state=active]:bg-white/15 data-[state=active]:text-foreground dark:data-[state=active]:text-white data-[state=active]:shadow-md text-muted-foreground hover:text-foreground dark:hover:text-white font-bold text-[10px] sm:text-xs uppercase tracking-widest px-4 sm:px-6 py-2 transition-all duration-300"
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
                            {/* 3 Column KPIs */}
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

                    {/* Heatmap Area - Static, not affected by time filter */}
                    <div className="mt-2 pl-2">
                        <PerformanceHeatmap mode={heatmapMode} />
                    </div>
                </div>
                
                <ReportDialog
                    isOpen={isReportDialogOpen}
                    onClose={() => setIsReportDialogOpen(false)}
                    type="statistics"
                    targetId="statistics_page"
                    targetName="Página de Estatísticas"
                />
            </main>
        </div>
    );
}
