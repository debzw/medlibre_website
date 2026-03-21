-- Backfill user_daily_stats from user_question_history for all historical data.
-- The trigger update_daily_stats_on_answer() only fires on new inserts, so rows
-- answered before the trigger was created (20260315) are missing from the table.
-- This migration computes the same aggregation the trigger would have produced,
-- using BRT (America/Sao_Paulo) for stat_date — consistent with the trigger.

INSERT INTO public.user_daily_stats (user_id, stat_date, total_answered, total_correct, total_time_seconds)
SELECT
    user_id,
    (answered_at AT TIME ZONE 'America/Sao_Paulo')::DATE AS stat_date,
    COUNT(*)                                               AS total_answered,
    SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)           AS total_correct,
    COALESCE(SUM(time_spent_seconds), 0)                   AS total_time_seconds
FROM public.user_question_history
GROUP BY user_id, (answered_at AT TIME ZONE 'America/Sao_Paulo')::DATE
ON CONFLICT (user_id, stat_date) DO UPDATE SET
    total_answered     = EXCLUDED.total_answered,
    total_correct      = EXCLUDED.total_correct,
    total_time_seconds = EXCLUDED.total_time_seconds;
