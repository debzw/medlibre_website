import { MedLibreLogo } from '@/components/ui/MedLibreLogo';
import { DashboardWidget } from '../DashboardWidget';
import { DASHBOARD_COLORS } from '../DashboardColors';

export function MasteryWidget({ loading }: { loading?: boolean }) {
    // Mock mastery score
    const masteryScore = 0;

    return (
        <DashboardWidget title="Nível de Maestria" icon={MedLibreLogo} loading={loading}>
            <div className="flex flex-col items-center space-y-4">
                <div className="relative flex items-center justify-center">
                    <svg className="h-24 w-24 -rotate-90 transform">
                        <circle
                            cx="48"
                            cy="48"
                            r="40"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="transparent"
                            className="text-secondary"
                        />
                        <circle
                            cx="48"
                            cy="48"
                            r="40"
                            stroke={DASHBOARD_COLORS.gold}
                            strokeWidth="8"
                            fill="transparent"
                            strokeDasharray={251.2}
                            strokeDashoffset={251.2 - (251.2 * masteryScore) / 100}
                            className="transition-all duration-1000 ease-out"
                        />
                    </svg>
                    <span className="absolute text-2xl font-bold">{masteryScore}%</span>
                </div>
                <div className="text-center">
                    <p className="text-sm text-muted-foreground">Score Global de Domínio</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Baseado na consistência de acertos em temas fundamentais.
                    </p>
                </div>
            </div>
        </DashboardWidget>
    );
}
