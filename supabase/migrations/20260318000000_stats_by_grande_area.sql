-- ============================================================
-- Migration: Statistics filtered by Grande Área
-- ============================================================
-- Adds two RPCs:
--   1. get_user_stats_by_grande_area — KPI stats for a specific grande área + time filter
--   2. get_daily_stats_by_grande_area — daily accuracy for the heatmap, filtered by grande área

-- ── 1. get_user_stats_by_grande_area ─────────────────────────────────────────

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
  v_since TIMESTAMPTZ;
  v_result JSON;
BEGIN
  -- Resolve time filter into a cutoff timestamp (BRT)
  v_since := CASE p_time_filter
    WHEN 'today' THEN (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE::TIMESTAMPTZ
    WHEN 'week'  THEN NOW() - INTERVAL '7 days'
    WHEN 'month' THEN NOW() - INTERVAL '30 days'
    ELSE '1970-01-01'::TIMESTAMPTZ
  END;

  SELECT json_build_object(
    'totalAnswered',      COALESCE(COUNT(*), 0),
    'totalCorrect',       COALESCE(SUM(CASE WHEN h.is_correct THEN 1 ELSE 0 END), 0),
    'totalIncorrect',     COALESCE(SUM(CASE WHEN NOT h.is_correct THEN 1 ELSE 0 END), 0),
    'accuracy',           CASE WHEN COUNT(*) > 0
                            THEN ROUND(SUM(CASE WHEN h.is_correct THEN 1.0 ELSE 0 END) / COUNT(*) * 100, 1)
                            ELSE 0 END,
    'averageTimeSeconds', COALESCE(AVG(h.time_spent_seconds), 0),
    'totalTimeSeconds',   COALESCE(SUM(h.time_spent_seconds), 0),
    'byField',            '{}',
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


-- ── 2. get_daily_stats_by_grande_area ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_daily_stats_by_grande_area(
  p_user_id     UUID,
  p_grande_area TEXT,
  p_days        INT DEFAULT 140
)
RETURNS TABLE (
  stat_date       DATE,
  total_answered  INT,
  total_correct   INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (h.answered_at AT TIME ZONE 'America/Sao_Paulo')::DATE AS stat_date,
    COUNT(*)::INT                                            AS total_answered,
    SUM(CASE WHEN h.is_correct THEN 1 ELSE 0 END)::INT      AS total_correct
  FROM public.user_question_history h
  JOIN public.questions q ON q.id = h.question_id
  WHERE h.user_id = p_user_id
    AND (p_grande_area IS NULL OR q.output_grande_area = p_grande_area)
    AND h.answered_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY 1
  ORDER BY 1 DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_stats_by_grande_area(UUID, TEXT, INT) TO authenticated;
