import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { SpecialtyDiagnosis } from '@/types/performance';

export function useSpecialtyPerformance(specialty: string, enabled = true) {
    const { user } = useAuthContext();

    return useQuery({
        queryKey: ['specialty-performance', user?.id, specialty],
        queryFn: async (): Promise<SpecialtyDiagnosis> => {
            if (!user) throw new Error('User not authenticated');

            // Decode the specialty from URL
            const decodedSpecialty = decodeURIComponent(specialty);

            const { data, error } = await supabase.rpc('get_specialty_performance_diagnosis', {
                p_user_id: user.id,
                p_specialty: decodedSpecialty,
            });

            if (error) {
                console.error('Error fetching specialty performance:', JSON.stringify(error), error);
                throw error;
            }

            return data as unknown as SpecialtyDiagnosis;
        },
        enabled: !!user && !!specialty && enabled,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
