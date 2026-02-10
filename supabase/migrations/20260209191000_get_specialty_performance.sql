-- RPC: Get Detailed Performance Diagnosis for a specific Specialty
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
    WITH specialty_stats AS (
        SELECT 
            COUNT(*) as filter_total,
            SUM(CASE WHEN qh.is_correct THEN 1 ELSE 0 END) as filter_correct,
            SUM(qh.time_spent_seconds) as filter_time
        FROM public.user_question_history qh
        JOIN public.questions q ON qh.question_id = q.id
        WHERE qh.user_id = p_user_id
          AND (q.output_especialidade = p_specialty OR q.output_grande_area = p_specialty)
    )
    SELECT json_build_object(
        'total_answered', filter_total,
        'total_correct', filter_correct,
        'accuracy', CASE WHEN filter_total > 0 THEN ROUND((filter_correct::numeric / filter_total::numeric) * 100, 1) ELSE 0 END,
        'total_time_seconds', COALESCE(filter_time, 0)
    ) INTO v_metrics
    FROM specialty_stats;

    -- 2. Topics Breakdown
    -- We need to see ALL topics for this specialty, even if the user hasn't answered any.
    -- We can get the list of topics from the questions table itself.
    WITH all_topics AS (
        SELECT DISTINCT output_tema as topic
        FROM public.questions
        WHERE (output_especialidade = p_specialty OR output_grande_area = p_specialty)
          AND output_tema IS NOT NULL
    ),
    -- User stats per topic
    user_topic_stats AS (
        SELECT 
            q.output_tema,
            COUNT(*) as answered,
            SUM(CASE WHEN qh.is_correct THEN 1 ELSE 0 END) as correct
        FROM public.user_question_history qh
        JOIN public.questions q ON qh.question_id = q.id
        WHERE qh.user_id = p_user_id
          AND (q.output_especialidade = p_specialty OR q.output_grande_area = p_specialty)
        GROUP BY q.output_tema
    ),
    -- Total questions available per topic in the DB (for context)
    db_topic_stats AS (
        SELECT 
            output_tema,
            COUNT(*) as total_available
        FROM public.questions
        WHERE (output_especialidade = p_specialty OR output_grande_area = p_specialty)
        GROUP BY output_tema
    )
    SELECT json_agg(
        json_build_object(
            'topic', t.topic,
            'total_available', COALESCE(dts.total_available, 0),
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
        ) ORDER BY COALESCE(uts.answered, 0) DESC, t.topic ASC
    ) INTO v_topics
    FROM all_topics t
    LEFT JOIN user_topic_stats uts ON t.topic = uts.output_tema
    LEFT JOIN db_topic_stats dts ON t.topic = dts.output_tema;

    -- 3. Evolution (Last 30 days)
    WITH daily_data AS (
        SELECT 
            DATE(qh.answered_at) as study_date,
            COUNT(*) as day_total,
            SUM(CASE WHEN qh.is_correct THEN 1 ELSE 0 END) as day_correct
        FROM public.user_question_history qh
        JOIN public.questions q ON qh.question_id = q.id
        WHERE qh.user_id = p_user_id
          AND (q.output_especialidade = p_specialty OR q.output_grande_area = p_specialty)
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
