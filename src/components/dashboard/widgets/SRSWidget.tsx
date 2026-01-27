'use client';

import { Repeat } from 'lucide-react';
import { DashboardWidget } from '../DashboardWidget';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export function SRSWidget({ loading }: { loading?: boolean }) {
    const router = useRouter();
    // Mock data for now, would come from `user_spaced_repetition` table
    const reviewsDue = 0;

    return (
        <DashboardWidget title="Revisão Espaçada" icon={Repeat} loading={loading}>
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
                <div className="rounded-full bg-blue-500/10 p-4">
                    <span className="text-3xl font-bold text-blue-600">{reviewsDue}</span>
                </div>
                <div>
                    <p className="font-medium text-foreground">Cartões para revisar</p>
                    <p className="text-sm text-muted-foreground">Otimize sua memória de longo prazo</p>
                </div>
                <Button
                    variant="outline"
                    className="w-full"
                    disabled={reviewsDue === 0}
                    onClick={() => router.push('/flashcards')}
                >
                    {reviewsDue > 0 ? 'Iniciar Revisão' : 'Tudo em dia! 🎉'}
                </Button>
            </div>
        </DashboardWidget>
    );
}
