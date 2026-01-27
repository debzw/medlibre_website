import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type ReportType = 'question' | 'statistics' | 'general' | 'bridge';

export interface ReportData {
    type: ReportType;
    category: string;
    target_id: string;
    description?: string;
    metadata?: Record<string, any>;
}

export function useReport() {
    const { user } = useAuthContext();
    const { toast } = useToast();

    const submitReport = async (data: ReportData) => {
        try {
            const { error } = await supabase.from('reports').insert({
                user_id: user?.id,
                type: data.type,
                category: data.category,
                target_id: data.target_id,
                description: data.description,
                metadata: data.metadata || {},
            });

            if (error) throw error;

            toast({
                title: "Relatório enviado",
                description: "Obrigado por nos ajudar a melhorar o MedLibre!",
            });

            return { success: true };
        } catch (error) {
            console.error('Error submitting report:', error);
            toast({
                title: "Erro ao enviar relatório",
                description: "Não foi possível enviar o seu relatório agora. Tente novamente mais tarde.",
                variant: "destructive",
            });
            return { success: false, error };
        }
    };

    return { submitReport };
}
