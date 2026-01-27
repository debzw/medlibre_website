import { Microscope } from 'lucide-react';
import { DashboardWidget } from '../DashboardWidget';

export function ThemeWeaknessWidget({ loading }: { loading?: boolean }) {
    return (
        <DashboardWidget title="Raio-X de Temas" icon={Microscope} loading={loading}>
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
                <div className="rounded-full bg-secondary p-3">
                    <Microscope className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                    <h4 className="font-medium">Análise Detalhada em Breve</h4>
                    <p className="text-sm text-muted-foreground max-w-[200px] mx-auto">
                        Estamos processando seus dados para identificar falhas específicas em subtemas.
                    </p>
                </div>
            </div>
        </DashboardWidget>
    );
}
