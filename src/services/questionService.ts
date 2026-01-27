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
    let query = supabase.from('questions').select('*');

    if (filters.banca) {
        query = query.eq('banca', filters.banca);
    }
    if (filters.ano) {
        query = query.eq('ano', filters.ano);
    }
    if (filters.area) {
        // The column in DB might be 'output_grande_area' or similar.
        // Based on types/database.ts: output_grande_area?: string | null;
        query = query.eq('output_grande_area', filters.area);
    }
    if (filters.especialidade) {
        // Based on types/database.ts: output_especialidade?: string | null;
        query = query.eq('output_especialidade', filters.especialidade);
    }
    if (filters.tema) {
        // Based on types/database.ts: output_tema?: string | null;
        query = query.eq('output_tema', filters.tema);
    }

    // Limit the number of questions.
    // Since we want "original order" (presumably standard DB order or ID order), we won't randomize unless requested.
    // However, for "Focused Study", random is usually better. 
    // BUT the requirement says "Questions must maintain their original order".
    // I will assume simple fetch with limit.
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
        if (Array.isArray(parsedOpcoes)) {
            parsedOpcoes = parsedOpcoes.map((opt: any) =>
                typeof opt === 'object' && opt !== null && 'texto' in opt ? opt.texto : opt
            );
        } else {
            parsedOpcoes = [];
        }

        return {
            ...q,
            opcoes: parsedOpcoes,
            campo_medico: q.output_grande_area || q.especialidade || 'Geral',
        };
    }) as Question[];

    return parsedQuestions;
};
