-- Migration: Setup Bridge Metadata RPC
-- Objective: Provide a compressed summary of all valid question combinations for the "Focused Mode" bridge.

-- 1. Enable pg_trgm for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create the summary function
CREATE OR REPLACE FUNCTION public.get_question_metadata_summary()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
    combinations json;
    stats json;
BEGIN
    -- Get unique combinations of Banca, Ano, and Especialidade
    -- We use a CTE to keep it clean and performant
    WITH counts AS (
        SELECT 
            banca, 
            ano, 
            output_especialidade as especialidade, 
            output_grande_area as grande_area,
            COUNT(*) as q_count
        FROM public.questions
        GROUP BY banca, ano, output_especialidade, output_grande_area
    )
    SELECT json_agg(json_build_array(banca, ano, especialidade, grande_area, q_count))
    INTO combinations
    FROM counts;

    -- Get general stats
    SELECT json_build_object(
        'total_questions', (SELECT COUNT(*) FROM public.questions),
        'unique_bancas', (SELECT COUNT(DISTINCT banca) FROM public.questions),
        'unique_areas', (SELECT COUNT(DISTINCT output_grande_area) FROM public.questions)
    ) INTO stats;

    -- Combine into final payload
    result := json_build_object(
        'combinations', COALESCE(combinations, '[]'::json),
        'stats', stats,
        'generated_at', now()
    );

    RETURN result;
END;
$$;

-- 3. Add GIST index for trigram search on enunciado if it doesn't exist
-- This speeds up the "Search with Error Tolerance"
CREATE INDEX IF NOT EXISTS idx_questions_enunciado_trgm ON public.questions USING gist (enunciado gist_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_questions_tema_trgm ON public.questions USING gist (output_tema gist_trgm_ops);
