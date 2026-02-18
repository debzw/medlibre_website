import { supabase } from "@/integrations/supabase/client";
import { Question } from "@/types/database";

interface FilterState {
    banca?: string | null;
    ano?: number | null;
    area?: string | null;
    especialidade?: string | null;
    tema?: string | null;
}

export const fetchQuestionsForExport = async (filters: FilterState, limit: number): Promise<Question[]> => {
    let query = supabase
        .from('questions')
        .select('*')
        .or('tem_anomalia.is.null,tem_anomalia.neq.1');

    if (filters.banca) {
        query = query.eq('banca', filters.banca);
    }
    if (filters.ano) {
        query = query.eq('ano', filters.ano);
    }
    if (filters.area) {
        query = query.eq('output_grande_area', filters.area);
    }
    if (filters.especialidade) {
        query = query.eq('output_especialidade', filters.especialidade);
    }
    if (filters.tema) {
        query = query.eq('output_tema', filters.tema);
    }

    query = query.limit(limit);

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching questions for export:", error);
        throw error;
    }

    // Apply the same parsing logic as in useQuestions hook
    const parsedQuestions = (data || []).map(q => {
        let parsedOpcoes = typeof q.opcoes === 'string' ? JSON.parse(q.opcoes) : q.opcoes;

        // Ensure opcoes is an array of strings
        if (Array.isArray(parsedOpcoes) && parsedOpcoes.length > 0) {
            parsedOpcoes = parsedOpcoes.map((opt: any) =>
                typeof opt === 'object' && opt !== null && 'texto' in opt ? opt.texto : opt
            );
        } else {
            // Fallback to alternativa_a...e
            parsedOpcoes = [
                q.alternativa_a,
                q.alternativa_b,
                q.alternativa_c,
                q.alternativa_d,
                q.alternativa_e
            ].filter(Boolean);
        }

        return {
            ...q,
            opcoes: parsedOpcoes,
            campo_medico: q.output_grande_area || q.output_especialidade || 'Geral',
        };
    }) as Question[];

    return parsedQuestions;
};
