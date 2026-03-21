import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';

export interface DailyAccuracy {
    date: string;    // YYYY-MM-DD (BRT)
    accuracy: number; // 0-100
}

export function usePerformanceHeatmap(days = 140) {
    const { user } = useAuthContext();

    return useQuery({
        queryKey: ['performance-heatmap', user?.id, days],
        queryFn: async (): Promise<DailyAccuracy[]> => {
            if (!user) throw new Error('User not authenticated');

            const { data, error } = await supabase
                .from('user_daily_stats')
                .select('stat_date, total_answered, total_correct')
                .eq('user_id', user.id)
                .order('stat_date', { ascending: false })
                .limit(days);

            if (error) throw error;

            return (data ?? []).map(row => ({
                date: row.stat_date,
                accuracy: row.total_answered > 0
                    ? Math.round((row.total_correct / row.total_answered) * 100)
                    : 0,
            }));
        },
        enabled: !!user,
        staleTime: 5 * 60 * 1000,
    });
}
