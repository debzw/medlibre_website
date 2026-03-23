import { supabase } from "@/integrations/supabase/client";
import { Question } from "@/types/database";

interface FilterState {
    banca?: string | null;
    ano?: number | null;
    area?: string | null;
    especialidade?: string | null;
    tema?: string | null;
}

const parseQuestions = (data: any[]): Question[] =>
    data.map(q => {
        let parsedOpcoes = typeof q.opcoes === 'string' ? JSON.parse(q.opcoes) : q.opcoes;
        if (Array.isArray(parsedOpcoes) && parsedOpcoes.length > 0) {
            parsedOpcoes = parsedOpcoes.map((opt: any) =>
                typeof opt === 'object' && opt !== null && 'texto' in opt ? opt.texto : opt
            );
        } else {
            parsedOpcoes = [q.alternativa_a, q.alternativa_b, q.alternativa_c, q.alternativa_d, q.alternativa_e].filter(Boolean);
        }
        return { ...q, opcoes: parsedOpcoes, campo_medico: q.output_grande_area || q.output_especialidade || 'Geral' };
    }) as Question[];

export const fetchQuestionsForExport = async (filters: FilterState, limit: number, userId: string): Promise<Question[]> => {
    // Try the SRS RPC first (same feed logic as the study session)
    const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('get_study_session_questions_v2', {
        p_user_id: userId,
        p_limit: limit,
        p_hide_answered: false,
        p_banca: filters.banca || null,
        p_ano: filters.ano || null,
        p_campo: filters.area || null,
        p_especialidade: filters.especialidade || null,
        p_tema: filters.tema || null,
    });

    if (!rpcError) {
        return parseQuestions(rpcData || []);
    }

    console.warn('SRS RPC falhou, usando query direta como fallback:', rpcError.message);

    // Fallback: direct table query
    let query = supabase
        .from('questions')
        .select('*')
        .or('tem_anomalia.is.null,tem_anomalia.neq.1');

    if (filters.banca) query = query.eq('banca', filters.banca);
    if (filters.ano) query = query.eq('ano', filters.ano);
    if (filters.area) query = query.eq('output_grande_area', filters.area);
    if (filters.especialidade) query = query.eq('output_especialidade', filters.especialidade);
    if (filters.tema) query = query.eq('output_tema', filters.tema);
    query = query.limit(limit);

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching questions for export (fallback):", error);
        throw error;
    }

    return parseQuestions(data || []);
};
