-- ============================================================
-- Migration: Metadata RPC v2 — DeCS-validated Tema + Especialidade
-- ============================================================
-- Changes from original get_question_metadata_summary:
--   1. Adds output_tema to the grouping (was missing — tema filter was broken)
--   2. Validates output_especialidade and output_tema against decs_terms.clean_term
--      → Non-matching values become '' (empty string, filtered client-side)
--   3. Always returns 6-element arrays: [banca, ano, esp, area, tema, count]
--   4. Combinations with '' tema/esp still appear (for banca/ano/area counting)
--      but are hidden in dropdowns by the !!key filter in useSmartFilters.ts
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_question_metadata_summary()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result    json;
    combinations json;
    stats     json;
BEGIN
    WITH
    -- Step 1: Count by all 5 dimensions (banca, ano, esp, area, tema)
    raw_counts AS (
        SELECT
            banca,
            ano,
            output_especialidade    AS especialidade,
            output_grande_area      AS grande_area,
            output_tema             AS raw_tema,
            COUNT(*)                AS q_count
        FROM public.questions
        WHERE tem_anomalia IS NULL OR tem_anomalia != 1
        GROUP BY banca, ano, output_especialidade, output_grande_area, output_tema
    ),

    -- Step 2: Validate especialidade and tema against DeCS
    --   Match uses: lower(trim(value)) = decs_terms.clean_term
    --   No match → empty string (combo kept for count aggregation, hidden in UI)
    validated AS (
        SELECT
            r.banca,
            r.ano,
            r.grande_area,
            r.q_count,
            CASE WHEN de.clean_term IS NOT NULL THEN r.especialidade ELSE '' END AS especialidade,
            CASE WHEN dt.clean_term IS NOT NULL THEN r.raw_tema       ELSE '' END AS tema
        FROM raw_counts r
        LEFT JOIN public.decs_terms de ON lower(trim(r.especialidade)) = de.clean_term
        LEFT JOIN public.decs_terms dt ON lower(trim(r.raw_tema))      = dt.clean_term
    ),

    -- Step 3: Re-aggregate — multiple raw_temas that became '' get their counts merged
    aggregated AS (
        SELECT
            banca, ano, especialidade, grande_area, tema,
            SUM(q_count) AS q_count
        FROM validated
        GROUP BY banca, ano, especialidade, grande_area, tema
    )

    SELECT json_agg(
        json_build_array(banca, ano, especialidade, grande_area, tema, q_count)
    )
    INTO combinations
    FROM aggregated;

    -- Stats (unchanged)
    SELECT json_build_object(
        'total_questions', (SELECT COUNT(*) FROM public.questions),
        'unique_bancas',   (SELECT COUNT(DISTINCT banca) FROM public.questions),
        'unique_areas',    (SELECT COUNT(DISTINCT output_grande_area) FROM public.questions)
    ) INTO stats;

    result := json_build_object(
        'combinations', COALESCE(combinations, '[]'::json),
        'stats',        stats,
        'generated_at', now()
    );

    RETURN result;
END;
$$;
