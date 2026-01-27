import { BookOpen, CheckCircle, XCircle } from 'lucide-react';
import { DashboardWidget } from '../DashboardWidget';

interface StudyVolumeWidgetProps {
    total: number;
    correct: number;
    incorrect: number;
    loading?: boolean;
}

export function StudyVolumeWidget({ total, correct, incorrect, loading }: StudyVolumeWidgetProps) {
    return (
        <DashboardWidget title="Volume de Estudo" icon={BookOpen} loading={loading}>
            <div className="flex h-full flex-col justify-center gap-4">
                <div className="grid grid-cols-3 gap-4">
                    <div className="group/item flex flex-col items-center justify-center rounded-[2rem] bg-card/40 p-5 text-center ring-1 ring-border/40 transition-all duration-500 hover:bg-card/60 hover:ring-primary/20 hover:-translate-y-1 shadow-sm hover:shadow-xl backdrop-blur-xl">
                        <div className="mb-3 rounded-2xl bg-primary/5 p-2.5 text-primary shadow-inner">
                            <BookOpen className="h-5 w-5" />
                        </div>
                        <span className="text-3xl font-black tracking-tighter leading-none mb-1">{total}</span>
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Total</span>
                    </div>

                    <div className="group/item flex flex-col items-center justify-center rounded-[2rem] bg-card/40 p-5 text-center ring-1 ring-border/40 transition-all duration-500 hover:bg-card/60 hover:ring-success/20 hover:-translate-y-1 shadow-sm hover:shadow-xl backdrop-blur-xl">
                        <div className="mb-3 rounded-2xl bg-success/5 p-2.5 text-success shadow-inner">
                            <CheckCircle className="h-5 w-5" />
                        </div>
                        <span className="text-3xl font-black tracking-tighter leading-none mb-1 text-success">{correct}</span>
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-success/40">Acertos</span>
                    </div>

                    <div className="group/item flex flex-col items-center justify-center rounded-[2rem] bg-card/40 p-5 text-center ring-1 ring-border/40 transition-all duration-500 hover:bg-card/60 hover:ring-destructive/20 hover:-translate-y-1 shadow-sm hover:shadow-xl backdrop-blur-xl">
                        <div className="mb-3 rounded-2xl bg-destructive/5 p-2.5 text-destructive shadow-inner">
                            <XCircle className="h-5 w-5" />
                        </div>
                        <span className="text-3xl font-black tracking-tighter leading-none mb-1 text-destructive">{incorrect}</span>
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-destructive/40">Erros</span>
                    </div>
                </div>
            </div>
        </DashboardWidget>
    );
}
