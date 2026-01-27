'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, BrainCircuit, Lightbulb, TrendingUp, Sparkles, Target } from 'lucide-react';
import { DashboardWidget } from '../DashboardWidget';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ActionableGuideWidgetProps {
    byField: Record<string, { correct: number; total: number }>;
    loading?: boolean;
}

export function ActionableGuideWidget({ byField, loading }: ActionableGuideWidgetProps) {
    const router = useRouter();

    // Logic remains the same
    const areas = Object.entries(byField).map(([name, stats]) => ({
        name,
        accuracy: (stats.correct / stats.total) * 100,
        total: stats.total
    }));

    const weakSpot = areas
        .filter(a => a.total >= 3)
        .sort((a, b) => a.accuracy - b.accuracy)[0];

    const strongSpot = areas
        .filter(a => a.total >= 3)
        .sort((a, b) => b.accuracy - a.accuracy)[0];

    // --- EMPTY STATE ---
    if (!weakSpot) {
        return (
            <DashboardWidget
                colSpan={2}
                className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 min-h-[400px]"
                loading={loading}
            >
                <div className="flex flex-col items-center justify-center h-full py-12 text-center z-10 relative">
                    <div className="relative mb-8">
                        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-150 animate-pulse" />
                        <div className="relative rounded-3xl bg-gradient-to-br from-primary to-primary/60 p-6 shadow-2xl ring-1 ring-white/20">
                            <BrainCircuit className="h-12 w-12 text-white" />
                        </div>
                    </div>
                    <h3 className="text-3xl font-black tracking-tighter mb-3 text-foreground">Prepare sua Mente</h3>
                    <p className="mb-10 max-w-sm text-balance text-muted-foreground font-medium leading-relaxed">
                        O Guia Inteligente está analisando seus padrões. Responda <span className="text-primary font-bold">5 questões</span> para desbloquear seu roteiro de alta performance.
                    </p>
                    <Button
                        onClick={() => router.push('/app')}
                        size="lg"
                        className="rounded-2xl px-10 h-14 bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_20px_40px_-10px_rgba(var(--primary-rgb),0.3)] hover:scale-[1.02] active:scale-95 transition-all font-black uppercase tracking-widest text-xs"
                    >
                        Começar Agora <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>

                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 -mt-20 -mr-20 h-64 w-64 rounded-full bg-primary/10 blur-[100px]" />
                <div className="absolute bottom-0 left-0 -mb-20 -ml-20 h-64 w-64 rounded-full bg-primary/10 blur-[100px]" />
            </DashboardWidget>
        );
    }

    // --- ACTIVE STATE ---
    return (
        <DashboardWidget
            colSpan={2}
            className="group relative border-border/5 bg-card/20 p-0 overflow-hidden"
            loading={loading}
        >
            {/* Unified Soft Background Gradients */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -left-1/4 -top-1/4 h-full w-full bg-destructive/[0.04] blur-[150px] rounded-full transition-opacity duration-1000 opacity-60 group-hover:opacity-100" />
                <div className="absolute -right-1/4 -bottom-1/4 h-full w-full bg-success/[0.03] blur-[150px] rounded-full transition-opacity duration-1000 opacity-40 group-hover:opacity-80" />
            </div>

            <div className="flex flex-col md:flex-row h-full min-h-[400px] relative z-10">

                {/* LEFT SIDE: PRIMARY ACTION (Weak Spot) */}
                <div className="flex-1 p-10 flex flex-col justify-center relative">
                    <div className="flex items-center gap-2.5 text-destructive bg-destructive/10 w-fit px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] ring-1 ring-destructive/20 mb-8 backdrop-blur-md">
                        <Target className="h-3.5 w-3.5" />
                        Prioridade Máxima
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-5xl font-black tracking-tighter text-foreground leading-[0.9] group-hover:text-primary transition-colors duration-500">
                            {weakSpot.name}
                        </h4>
                        <div className="flex items-center gap-4 mt-6">
                            <div className="h-px w-10 bg-border/50" />
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Acurácia Atual</span>
                            <span className="text-4xl font-black text-destructive tracking-tighter">{Math.round(weakSpot.accuracy)}%</span>
                        </div>
                    </div>

                    <p className="mt-8 text-muted-foreground/80 max-w-sm text-sm leading-relaxed font-medium transition-colors group-hover:text-muted-foreground">
                        Identificamos uma lacuna estratégica. Consolidar <span className="text-foreground font-bold">{weakSpot.name}</span> agora é o caminho mais curto para elevar sua média geral.
                    </p>

                    <div className="mt-10">
                        <Button
                            onClick={() => router.push(`/app?campo=${encodeURIComponent(weakSpot.name)}`)}
                            size="lg"
                            className="rounded-2xl bg-destructive hover:bg-destructive/90 text-white shadow-[0_20px_40px_-10px_rgba(220,38,38,0.3)] transition-all hover:scale-[1.02] active:scale-95 px-10 h-14 font-black uppercase tracking-widest text-xs"
                        >
                            Treinar Agora
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>

                    {/* Subtle bg decoration */}
                    <div className="absolute -right-16 top-1/2 -translate-y-1/2 opacity-[0.02] pointer-events-none group-hover:opacity-[0.04] transition-all duration-1000 group-hover:scale-110 group-hover:rotate-6">
                        <Target className="h-96 w-96" />
                    </div>
                </div>

                {/* RIGHT SIDE: SECONDARY INFO (Strong Spot + Tip) */}
                <div className="md:w-[340px] p-10 flex flex-col justify-between relative bg-muted/[0.03] md:bg-transparent backdrop-blur-3xl md:backdrop-blur-none">
                    {/* Vertical Divider Line */}
                    <div className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 h-3/5 w-px bg-gradient-to-b from-transparent via-border/50 to-transparent" />

                    {strongSpot && strongSpot.name !== weakSpot.name && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-2.5 text-success text-[10px] font-black uppercase tracking-[0.25em]">
                                <Sparkles className="h-3.5 w-3.5" />
                                Zona de Domínio
                            </div>
                            <div className="space-y-1">
                                <h5 className="font-bold text-foreground/90 text-xl tracking-tight leading-tight truncate" title={strongSpot.name}>
                                    {strongSpot.name}
                                </h5>
                                <div className="text-4xl font-black text-success tabular-nums tracking-tighter">
                                    {Math.round(strongSpot.accuracy)}%
                                </div>
                            </div>
                            <div className="h-3 w-full bg-muted/30 rounded-full overflow-hidden p-0.5 ring-1 ring-border/20 shadow-inner">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${strongSpot.accuracy}%` }}
                                    transition={{ duration: 1.5, ease: "easeOut" }}
                                    className="h-full bg-gradient-to-r from-success/80 to-success rounded-full shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                                />
                            </div>
                        </div>
                    )}

                    <div className="mt-12 md:mt-0 rounded-[2rem] bg-card/40 p-6 border border-border/40 shadow-xl backdrop-blur-2xl group/tip hover:bg-card/60 transition-all duration-500 hover:-translate-y-1">
                        <div className="flex flex-col gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-glow/10 text-amber-glow ring-1 ring-amber-glow/20 group-hover/tip:scale-110 transition-transform duration-500 shadow-inner">
                                <Lightbulb className="h-5 w-5" />
                            </div>
                            <div className="space-y-2">
                                <span className="text-[10px] font-black tracking-[0.25em] text-amber-glow/90 uppercase block">Expert Tip</span>
                                <p className="text-[12px] font-medium text-muted-foreground/90 leading-relaxed transition-colors group-hover/tip:text-foreground">
                                    Intercale estudos de alta densidade com seu ponto forte para manter o ritmo sem burnout.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardWidget>
    );
}
