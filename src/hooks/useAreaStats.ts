import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { type TimeFilter, type UserStats } from '@/hooks/useQuestionHistory';

const EMPTY_STATS: UserStats = {
    totalAnswered: 0,
    totalCorrect: 0,
    totalIncorrect: 0,
    accuracy: 0,
    averageTimeSeconds: 0,
    totalTimeSeconds: 0,
    byField: {},
    byBanca: {},
    recentActivity: [],
    streakDays: 0,
};

export function useAreaStats(grandeArea: string, timeFilter: TimeFilter = 'all') {
    const { user } = useAuthContext();

    const { data: stats, isLoading, isError } = useQuery({
        queryKey: ['userStats', user?.id, timeFilter, grandeArea],
        queryFn: async (): Promise<UserStats> => {
            if (!user) return EMPTY_STATS;

            const { data, error } = await supabase
                .rpc('get_user_stats_by_grande_area', {
                    p_user_id: user.id,
                    p_time_filter: timeFilter,
                    p_grande_area: grandeArea,
                });

            if (error) {
                console.error('Error fetching area stats:', error);
                throw error;
            }

            return data as unknown as UserStats;
        },
        enabled: !!user && !!grandeArea,
    });

    return { stats: stats ?? EMPTY_STATS, isLoading, isError };
}
