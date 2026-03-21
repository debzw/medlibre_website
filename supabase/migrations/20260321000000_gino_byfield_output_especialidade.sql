-- ============================================================
-- Migration: Ginecologia e Obstetrícia exception — byField uses
-- output_especialidade instead of especialidades_tags.
-- All other grandes áreas keep using especialidades_tags.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_stats_by_grande_area(
  p_user_id     UUID,
  p_time_filter TEXT DEFAULT 'all',
  p_grande_area TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since    TIMESTAMPTZ;
  v_result   JSON;
  v_byfield  JSON;
BEGIN
  v_since := CASE p_time_filter
    WHEN 'today' THEN (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE::TIMESTAMPTZ
    WHEN 'week'  THEN NOW() - INTERVAL '7 days'
    WHEN 'month' THEN NOW() - INTERVAL '30 days'
    ELSE '1970-01-01'::TIMESTAMPTZ
  END;

  IF p_grande_area = 'Ginecologia e Obstetrícia' THEN
    -- Exception: group by output_especialidade (single scalar column)
    SELECT COALESCE(
      json_object_agg(
        sub.tag,
        json_build_object(
          'correct', sub.correct_cnt,
          'total',   sub.total_cnt,
          'avgTime', sub.avg_time
        )
      ),
      '{}'::json
    )
    INTO v_byfield
    FROM (
      SELECT
        tq.tag,
        COALESCE(SUM(CASE WHEN h.is_correct THEN 1 ELSE 0 END), 0) AS correct_cnt,
        COALESCE(COUNT(h.id), 0)                                    AS total_cnt,
        COALESCE(AVG(h.time_spent_seconds), 0)                      AS avg_time
      FROM (
        SELECT DISTINCT
          q.output_especialidade AS tag,
          q.id                   AS question_id
        FROM public.questions q
        WHERE q.output_grande_area = p_grande_area
          AND q.output_especialidade IS NOT NULL
          AND trim(q.output_especialidade) != ''
      ) tq
      LEFT JOIN public.user_question_history h
        ON  h.question_id = tq.question_id
        AND h.user_id     = p_user_id
        AND h.answered_at >= v_since
      WHERE tq.tag IS NOT NULL
        AND trim(tq.tag) != ''
      GROUP BY tq.tag
    ) sub;

  ELSE
    -- Default: group by unnested especialidades_tags
    SELECT COALESCE(
      json_object_agg(
        sub.tag,
        json_build_object(
          'correct', sub.correct_cnt,
          'total',   sub.total_cnt,
          'avgTime', sub.avg_time
        )
      ),
      '{}'::json
    )
    INTO v_byfield
    FROM (
      SELECT
        tq.tag,
        COALESCE(SUM(CASE WHEN h.is_correct THEN 1 ELSE 0 END), 0) AS correct_cnt,
        COALESCE(COUNT(h.id), 0)                                    AS total_cnt,
        COALESCE(AVG(h.time_spent_seconds), 0)                      AS avg_time
      FROM (
        SELECT DISTINCT
          unnest(q.especialidades_tags) AS tag,
          q.id                          AS question_id
        FROM public.questions q
        WHERE q.output_grande_area = p_grande_area
          AND q.especialidades_tags IS NOT NULL
          AND cardinality(q.especialidades_tags) > 0
      ) tq
      LEFT JOIN public.user_question_history h
        ON  h.question_id = tq.question_id
        AND h.user_id     = p_user_id
        AND h.answered_at >= v_since
      WHERE tq.tag IS NOT NULL
        AND trim(tq.tag) != ''
        AND NOT (
          p_grande_area = 'Cirurgia'
          AND tq.tag = ANY(ARRAY['Cardiologia', 'Neurologia', 'Gastroenterologia', 'Coloproctologia'])
        )
      GROUP BY tq.tag
    ) sub;

  END IF;

  -- Top-level KPIs
  SELECT json_build_object(
    'totalAnswered',      COALESCE(COUNT(*), 0),
    'totalCorrect',       COALESCE(SUM(CASE WHEN h.is_correct THEN 1 ELSE 0 END), 0),
    'totalIncorrect',     COALESCE(SUM(CASE WHEN NOT h.is_correct THEN 1 ELSE 0 END), 0),
    'accuracy',           CASE WHEN COUNT(*) > 0
                            THEN ROUND(SUM(CASE WHEN h.is_correct THEN 1.0 ELSE 0 END) / COUNT(*) * 100, 1)
                            ELSE 0 END,
    'averageTimeSeconds', COALESCE(AVG(h.time_spent_seconds), 0),
    'totalTimeSeconds',   COALESCE(SUM(h.time_spent_seconds), 0),
    'byField',            v_byfield,
    'byBanca',            '{}',
    'recentActivity',     '[]',
    'streakDays',         0
  )
  INTO v_result
  FROM public.user_question_history h
  JOIN public.questions q ON q.id = h.question_id
  WHERE h.user_id = p_user_id
    AND h.answered_at >= v_since
    AND (p_grande_area IS NULL OR q.output_grande_area = p_grande_area);

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_stats_by_grande_area(UUID, TEXT, TEXT) TO authenticated;
