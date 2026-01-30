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

// Widgets
import { ActionableGuideWidget } from '@/components/dashboard/widgets/ActionableGuideWidget';
import { AccuracyWidget } from '@/components/dashboard/widgets/AccuracyWidget';
import { StudyVolumeWidget } from '@/components/dashboard/widgets/StudyVolumeWidget';
import { TimeEfficiencyWidget } from '@/components/dashboard/widgets/TimeEfficiencyWidget';
import { SpecialtyPerformanceWidget } from '@/components/dashboard/widgets/SpecialtyPerformanceWidget';
import { BancaPerformanceWidget } from '@/components/dashboard/widgets/BancaPerformanceWidget';
import { RecentActivityWidget } from '@/components/dashboard/widgets/RecentActivityWidget';
import { StreakWidget } from '@/components/dashboard/widgets/StreakWidget';

export default function StatisticsPage() {
    const router = useRouter();
    const { user, loading: authLoading, userType } = useAuthContext();
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
    const { stats, isLoading } = useQuestionHistory(timeFilter);
    const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);

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

    return (
        <div className="container min-h-screen px-4 py-8 pb-32 space-y-8 max-w-[1600px] mx-auto">
            {/* Header with Glassmorphism */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="sticky top-0 z-[50] -mx-4 px-4 py-4 mb-4 bg-background/80 backdrop-blur-2xl border-b border-border/50 flex flex-col md:flex-row items-center justify-between gap-4"
            >
                <div className="flex items-center gap-4">
                    <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/40 p-3 shadow-[0_10px_20px_-5px_rgba(var(--primary-rgb),0.3)]">
                        <LayoutDashboard className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-foreground/90">Dashboard</h1>
                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Sua Central de Comando</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Tabs defaultValue="all" value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)} className="w-full md:w-auto">
                        <TabsList className="bg-muted p-1 rounded-2xl w-full md:w-auto ring-1 ring-border/50">
                            <TabsTrigger value="today" className="rounded-xl data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-widest px-6">Hoje</TabsTrigger>
                            <TabsTrigger value="week" className="rounded-xl data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-widest px-6">Semana</TabsTrigger>
                            <TabsTrigger value="month" className="rounded-xl data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-widest px-6">Mês</TabsTrigger>
                            <TabsTrigger value="all" className="rounded-xl data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-widest px-6">Sempre</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl bg-muted/50 border border-border/50">
                                <MoreVertical className="h-5 w-5 text-muted-foreground" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                            <DropdownMenuItem
                                onClick={() => setIsReportDialogOpen(true)}
                                className="gap-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/5"
                            >
                                <Flag className="h-4 w-4" />
                                Reportar erro nos dados
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </motion.div>

            <ReportDialog
                isOpen={isReportDialogOpen}
                onClose={() => setIsReportDialogOpen(false)}
                type="statistics"
                targetId="statistics_page"
                targetName="Página de Estatísticas"
            />

            {/* Bento Grid Layout */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={timeFilter}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="grid grid-flow-dense grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 auto-rows-auto md:auto-rows-[minmax(180px,auto)]"
                >
                    <div className="md:col-span-2 xl:col-span-2 md:row-span-2 h-full">
                        <ActionableGuideWidget byField={stats.byField} loading={isLoading} />
                    </div>

                    <div className="md:col-span-1 xl:col-span-1 md:row-span-1 h-full">
                        <AccuracyWidget correct={stats.totalCorrect} total={stats.totalAnswered} loading={isLoading} />
                    </div>

                    <div className="md:col-span-1 xl:col-span-1 md:row-span-1 h-full">
                        <StreakWidget
                            streakDays={stats.streakDays || 0}
                            totalAnswered={stats.totalAnswered}
                            timeFilterLabel={
                                timeFilter === 'today' ? 'hoje' :
                                    timeFilter === 'week' ? 'nesta semana' :
                                        timeFilter === 'month' ? 'neste mês' : 'no total'
                            }
                            loading={isLoading}
                        />
                    </div>

                    <div className="md:col-span-2 xl:col-span-1 md:row-span-1 h-full">
                        <StudyVolumeWidget total={stats.totalAnswered} correct={stats.totalCorrect} incorrect={stats.totalIncorrect} loading={isLoading} />
                    </div>

                    <div className="md:col-span-2 xl:col-span-1 md:row-span-1 h-full">
                        <TimeEfficiencyWidget averageTimeSeconds={stats.averageTimeSeconds} totalTimeSeconds={stats.totalTimeSeconds} loading={isLoading} />
                    </div>

                    <div className="md:col-span-2 xl:col-span-2 md:row-span-2 h-full">
                        <SpecialtyPerformanceWidget byField={stats.byField} loading={isLoading} />
                    </div>

                    <div className="md:col-span-2 xl:col-span-1 md:row-span-2 h-full">
                        <RecentActivityWidget activity={stats.recentActivity} loading={isLoading} />
                    </div>

                    <div className="md:col-span-1 xl:col-span-1 md:row-span-2 h-full">
                        <BancaPerformanceWidget byBanca={stats.byBanca} loading={isLoading} />
                    </div>

                </motion.div>
            </AnimatePresence>
        </div>
    );
}
