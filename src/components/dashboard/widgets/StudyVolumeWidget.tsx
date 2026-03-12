import { useRouter } from 'next/navigation';
import { DashboardWidget } from '../DashboardWidget';
import { DASHBOARD_COLORS } from '../DashboardColors';

interface StudyVolumeWidgetProps {
    total: number;
    correct: number;
    incorrect: number;
    loading?: boolean;
}

export function StudyVolumeWidget({ total, correct, incorrect, loading }: StudyVolumeWidgetProps) {
    const router = useRouter();

    const handleNavigate = (status: string) => {
        router.push(`/app?status=${status}`);
    };

    return (
        <DashboardWidget title="Desempenho por Banca" loading={loading}>
            <div className="flex h-full flex-col justify-center gap-4">
                <div className="grid grid-cols-3 gap-4">
                    <div
                        onClick={() => handleNavigate('all_answered')}
                        className="group/item flex flex-col items-center justify-center rounded-[2rem] bg-card/40 p-5 text-center ring-1 ring-border/40 transition-all duration-500 hover:bg-card/60 hover:ring-primary/20 hover:-translate-y-1 shadow-sm hover:shadow-xl backdrop-blur-xl cursor-pointer"
                    >
                        <span className="text-3xl font-black tracking-tighter leading-none mb-1">{total}</span>
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Total</span>
                    </div>

                    <div
                        onClick={() => handleNavigate('correct')}
                        className="group/item flex flex-col items-center justify-center rounded-[2rem] bg-card/40 p-5 text-center ring-1 ring-border/40 transition-all duration-500 hover:bg-card/60 hover:ring-success/20 hover:-translate-y-1 shadow-sm hover:shadow-xl backdrop-blur-xl cursor-pointer"
                    >
                        <span className="text-3xl font-black tracking-tighter leading-none mb-1" style={{ color: DASHBOARD_COLORS.good }}>{correct}</span>
                        <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: DASHBOARD_COLORS.good + '66' }}>Acertos</span>
                    </div>

                    <div
                        onClick={() => handleNavigate('incorrect')}
                        className="group/item flex flex-col items-center justify-center rounded-[2rem] bg-card/40 p-5 text-center ring-1 ring-border/40 transition-all duration-500 hover:bg-card/60 hover:ring-destructive/20 hover:-translate-y-1 shadow-sm hover:shadow-xl backdrop-blur-xl cursor-pointer"
                    >
                        <span className="text-3xl font-black tracking-tighter leading-none mb-1" style={{ color: DASHBOARD_COLORS.critical }}>{incorrect}</span>
                        <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: DASHBOARD_COLORS.critical + '66' }}>Erros</span>
                    </div>
                </div>
            </div>
        </DashboardWidget>
    );
}
