-- ============================================================
-- Migration: Phase 1 — Analytics Integrity & Event Sourcing
-- ============================================================
-- Changes:
--   1. Add idempotency_key + source_bucket to user_question_history
--   2. Create user_daily_stats table (derive daily count from events)
--   3. Create trigger to maintain user_daily_stats on INSERT
--   4. Create atomic record_answer RPC (replaces dual-write anti-pattern)
--   5. Replace increment_daily_usage to derive count from user_daily_stats
-- ============================================================

-- ── 1. Schema evolution on user_question_history ─────────────────────────────

-- Idempotency key: unique per client click — prevents ghost data from retries / double-clicks
ALTER TABLE public.user_question_history
  ADD COLUMN IF NOT EXISTS idempotency_key UUID DEFAULT gen_random_uuid();

-- Backfill existing rows with a unique UUID each (safe — just filling nulls)
UPDATE public.user_question_history
SET idempotency_key = gen_random_uuid()
WHERE idempotency_key IS NULL;

-- Make it NOT NULL now that all rows have a value
ALTER TABLE public.user_question_history
  ALTER COLUMN idempotency_key SET NOT NULL;

-- UNIQUE constraint: the DB-level guard against duplicate inserts
ALTER TABLE public.user_question_history
  DROP CONSTRAINT IF EXISTS uq_uqh_idempotency_key;
ALTER TABLE public.user_question_history
  ADD CONSTRAINT uq_uqh_idempotency_key UNIQUE (idempotency_key);

-- source_bucket: tracks which algorithm path served this question
-- Values: 'srs' | 'weak_theme' | 'discovery' | 'general' | 'cold_start' | 'manual' | 'unknown'
ALTER TABLE public.user_question_history
  ADD COLUMN IF NOT EXISTS source_bucket TEXT DEFAULT 'unknown';


-- ── 2. user_daily_stats — replaces the counter on user_profiles ──────────────
-- One row per (user, day). Maintained by trigger — no manual INSERTs needed.

CREATE TABLE IF NOT EXISTS public.user_daily_stats (
  user_id           UUID        NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  stat_date         DATE        NOT NULL DEFAULT CURRENT_DATE,
  total_answered    INT         NOT NULL DEFAULT 0,
  total_correct     INT         NOT NULL DEFAULT 0,
  total_time_seconds INT        NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, stat_date)
);

-- Index for fast lookups by user (most common query: "give me today's stats")
CREATE INDEX IF NOT EXISTS idx_user_daily_stats_user_date
  ON public.user_daily_stats (user_id, stat_date DESC);

-- RLS: users can only see their own daily stats
ALTER TABLE public.user_daily_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_daily_stats_select_own" ON public.user_daily_stats;
CREATE POLICY "user_daily_stats_select_own"
  ON public.user_daily_stats FOR SELECT
  USING (auth.uid() = user_id);


-- ── 3. Trigger: maintain user_daily_stats on every answer INSERT ──────────────

CREATE OR REPLACE FUNCTION public.update_daily_stats_on_answer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_daily_stats (user_id, stat_date, total_answered, total_correct, total_time_seconds)
  VALUES (
    NEW.user_id,
    (NEW.answered_at AT TIME ZONE 'America/Sao_Paulo')::DATE,  -- BRT-aware date
    1,
    CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
    COALESCE(NEW.time_spent_seconds, 0)
  )
  ON CONFLICT (user_id, stat_date)
  DO UPDATE SET
    total_answered     = user_daily_stats.total_answered + 1,
    total_correct      = user_daily_stats.total_correct + (CASE WHEN NEW.is_correct THEN 1 ELSE 0 END),
    total_time_seconds = user_daily_stats.total_time_seconds + COALESCE(NEW.time_spent_seconds, 0);

  RETURN NEW;
END;
$$;

-- Drop and recreate trigger cleanly
DROP TRIGGER IF EXISTS trg_update_daily_stats ON public.user_question_history;
CREATE TRIGGER trg_update_daily_stats
  AFTER INSERT ON public.user_question_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_daily_stats_on_answer();


-- ── 4. Atomic record_answer RPC ───────────────────────────────────────────────
-- Replaces the frontend dual-write (saveAnswer + incrementUsage).
-- Single call, single transaction, idempotent via ON CONFLICT DO NOTHING.

CREATE OR REPLACE FUNCTION public.record_answer(
  p_question_id       UUID,
  p_selected_answer   INT,
  p_is_correct        BOOLEAN,
  p_time_spent        INT      DEFAULT NULL,
  p_idempotency_key   UUID     DEFAULT gen_random_uuid(),
  p_source_bucket     TEXT     DEFAULT 'unknown'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID;
  v_inserted    BIGINT := 0;   -- GET DIAGNOSTICS ROW_COUNT returns BIGINT
  v_today_count INT;
  v_today_date  DATE;
BEGIN
  -- Auth check
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- BRT-aware today
  v_today_date := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;

  -- Atomic INSERT with idempotency guard.
  -- If same idempotency_key arrives twice (retry/double-click), DO NOTHING.
  INSERT INTO public.user_question_history (
    user_id,
    question_id,
    selected_answer,
    is_correct,
    time_spent_seconds,
    idempotency_key,
    source_bucket
  )
  VALUES (
    v_user_id,
    p_question_id,
    p_selected_answer,
    p_is_correct,
    p_time_spent,
    p_idempotency_key,
    p_source_bucket
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  -- Check if row was actually inserted (vs. duplicate)
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  -- ROW_COUNT is 1 if inserted, 0 if duplicate

  -- Get "today's" count from user_daily_stats (maintained by trigger above)
  SELECT COALESCE(total_answered, 0) INTO v_today_count
  FROM public.user_daily_stats
  WHERE user_id  = v_user_id
    AND stat_date = v_today_date;

  -- Also keep the legacy user_profiles counter in sync for backward compatibility.
  -- We only update it if the row was actually inserted (not a duplicate).
  IF v_inserted > 0 THEN
    UPDATE public.user_profiles
    SET
      questions_answered_today = CASE
        WHEN last_reset_date < v_today_date THEN 1
        ELSE questions_answered_today + 1
      END,
      last_reset_date = v_today_date
    WHERE id = v_user_id;
  END IF;

  -- Return result: was_duplicate flag + today's count
  RETURN json_build_object(
    'was_duplicate',  v_inserted = 0,
    'today_count',    COALESCE(v_today_count, 0)
  );
END;
$$;

-- ── 5. Update increment_daily_usage to be a thin wrapper ─────────────────────
-- Keep it as backward compat for any other callers, but derive the count
-- from user_daily_stats instead of the raw counter.

CREATE OR REPLACE FUNCTION public.increment_daily_usage()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID;
  v_today_date DATE;
  v_count      INTEGER;
BEGIN
  v_user_id    := auth.uid();
  v_today_date := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Derive count from the event log (single source of truth)
  SELECT COALESCE(total_answered, 0) INTO v_count
  FROM public.user_daily_stats
  WHERE user_id  = v_user_id
    AND stat_date = v_today_date;

  RETURN COALESCE(v_count, 0);
END;
$$;
