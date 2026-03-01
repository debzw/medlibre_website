-- ============================================================
-- Migration: Filter output_grande_area tags from specialty performance topics
-- Rows in question_decs with tag_source = 'output_grande_area' are coarse
-- top-level area associations and should not appear in the topic breakdown.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_specialty_performance_diagnosis(
    p_user_id UUID,
    p_specialty TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_metrics JSON;
    v_topics JSON;
    v_evolution JSON;
BEGIN

    -- 1. Metrics Overview
    -- Filtering by especialidades_tags (TEXT[])
    WITH specialty_stats AS (
        SELECT
            COUNT(*) as filter_total,
            SUM(CASE WHEN qh.is_correct THEN 1 ELSE 0 END) as filter_correct,
            SUM(qh.time_spent_seconds) as filter_time
        FROM public.user_question_history qh
        JOIN public.questions q ON qh.question_id = q.id
        WHERE qh.user_id = p_user_id
          AND p_specialty = ANY(q.especialidades_tags)
    )
    SELECT json_build_object(
        'total_answered', filter_total,
        'total_correct', filter_correct,
        'accuracy', CASE WHEN filter_total > 0 THEN ROUND((filter_correct::numeric / filter_total::numeric) * 100, 1) ELSE 0 END,
        'total_time_seconds', COALESCE(filter_time, 0)
    ) INTO v_metrics
    FROM specialty_stats;

    -- 2. Topics Breakdown
    -- Using question_decs TABLE as the source of subthemes.
    -- Grouping by decs_code to merge different languages of the same concept.
    -- Excludes tags sourced from output_grande_area (coarse top-level area tags).
    WITH question_pool AS (
        -- Filter questions once for efficiency
        SELECT q.id
        FROM public.questions q
        WHERE p_specialty = ANY(q.especialidades_tags)
          AND (q.tem_anomalia IS NULL OR q.tem_anomalia != 1)
    ),
    unnested_topics AS (
        -- Join questions with question_decs table and then with decs_terms.
        -- Exclude output_grande_area tags and the specialty term itself.
        SELECT
            qp.id as question_id,
            dt.decs_code,
            dt.clean_term as raw_term
        FROM question_pool qp
        JOIN public.question_decs qd ON qp.id = qd.question_id
        JOIN public.decs_terms dt ON qd.decs_id = dt.id
        WHERE qd.tag_source != 'output_grande_area'
          AND lower(trim(dt.clean_term)) != lower(trim(p_specialty))
          AND dt.decs_code NOT IN (
            SELECT decs_code FROM public.decs_terms
            WHERE lower(trim(clean_term)) = lower(trim(p_specialty))
          )
    ),
    topic_base AS (
        -- Group by decs_code and pick the clean display name
        -- Also filters for themes with > 10 questions
        SELECT
            decs_code,
            MIN(raw_term) as canonical_topic,
            COUNT(DISTINCT question_id) as total_available
        FROM unnested_topics
        GROUP BY decs_code
        HAVING COUNT(DISTINCT question_id) > 10
    ),
    user_topic_stats AS (
        -- Calculate user mastery per canonical topic (decs_code)
        SELECT
            ut.decs_code,
            COUNT(*) as answered,
            SUM(CASE WHEN qh.is_correct THEN 1 ELSE 0 END) as correct
        FROM public.user_question_history qh
        JOIN unnested_topics ut ON qh.question_id = ut.question_id
        WHERE qh.user_id = p_user_id
        GROUP BY ut.decs_code
    )
    SELECT json_agg(
        json_build_object(
            'topic', t.canonical_topic,
            'total_available', t.total_available,
            'answered', COALESCE(uts.answered, 0),
            'correct', COALESCE(uts.correct, 0),
            'accuracy', CASE WHEN COALESCE(uts.answered, 0) > 0
                             THEN ROUND((COALESCE(uts.correct, 0)::numeric / uts.answered::numeric) * 100, 1)
                             ELSE 0 END,
            'status', CASE
                        WHEN COALESCE(uts.answered, 0) = 0 THEN 'Ignored'
                        WHEN (COALESCE(uts.correct, 0)::numeric / uts.answered::numeric) >= 0.8 THEN 'Strong'
                        WHEN (COALESCE(uts.correct, 0)::numeric / uts.answered::numeric) < 0.6 THEN 'Weak'
                        ELSE 'Average'
                      END
        ) ORDER BY COALESCE(uts.answered, 0) DESC, t.canonical_topic ASC
    ) INTO v_topics
    FROM topic_base t
    LEFT JOIN user_topic_stats uts ON t.decs_code = uts.decs_code;

    -- 3. Evolution (Last 30 days)
    WITH daily_data AS (
        SELECT
            DATE(qh.answered_at) as study_date,
            COUNT(*) as day_total,
            SUM(CASE WHEN qh.is_correct THEN 1 ELSE 0 END) as day_correct
        FROM public.user_question_history qh
        JOIN public.questions q ON qh.question_id = q.id
        WHERE qh.user_id = p_user_id
          AND p_specialty = ANY(q.especialidades_tags)
          AND qh.answered_at >= (CURRENT_DATE - INTERVAL '30 days')
        GROUP BY DATE(qh.answered_at)
    )
    SELECT json_agg(
        json_build_object(
            'date', study_date,
            'accuracy', CASE WHEN day_total > 0 THEN ROUND((day_correct::numeric / day_total::numeric) * 100, 1) ELSE 0 END,
            'total', day_total
        ) ORDER BY study_date ASC
    ) INTO v_evolution
    FROM daily_data;

    RETURN json_build_object(
        'metrics', v_metrics,
        'topics', COALESCE(v_topics, '[]'::json),
        'evolution', COALESCE(v_evolution, '[]'::json)
    );
END;
$$;
