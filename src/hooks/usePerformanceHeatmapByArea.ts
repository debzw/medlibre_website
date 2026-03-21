import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { type DailyAccuracy } from '@/hooks/usePerformanceHeatmap';

export function usePerformanceHeatmapByArea(grandeArea: string, days = 140) {
    const { user } = useAuthContext();

    return useQuery({
        queryKey: ['performance-heatmap-area', user?.id, grandeArea, days],
        queryFn: async (): Promise<DailyAccuracy[]> => {
            if (!user) throw new Error('User not authenticated');

            const { data, error } = await supabase
                .rpc('get_daily_stats_by_grande_area', {
                    p_user_id: user.id,
                    p_grande_area: grandeArea,
                    p_days: days,
                });

            if (error) throw error;

            return (data ?? []).map((row: { stat_date: string; total_answered: number; total_correct: number }) => ({
                date: row.stat_date,
                accuracy: row.total_answered > 0
                    ? Math.round((row.total_correct / row.total_answered) * 100)
                    : 0,
            }));
        },
        enabled: !!user && !!grandeArea,
        staleTime: 5 * 60 * 1000,
    });
}
