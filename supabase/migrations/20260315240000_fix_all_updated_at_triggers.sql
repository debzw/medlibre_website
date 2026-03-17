-- ============================================================
-- Fix: 42703 "record new has no field updated_at" — all tables
-- ============================================================
-- The previous migration (20260315230000) fixed user_question_history.
-- But the Supabase Dashboard attached update_updated_at_column() to
-- other tables in the trigger chain (user_spaced_repetition,
-- user_theme_stats, user_daily_stats, or study_sessions) that also
-- lack the updated_at column.
--
-- This migration self-heals ALL affected tables by scanning the
-- pg_trigger catalog and adding the missing column wherever needed.
-- ============================================================

DO $$
DECLARE
  r          RECORD;
  col_exists BOOLEAN;
BEGIN
  FOR r IN
    SELECT DISTINCT c.relname AS tbl
    FROM pg_trigger t
    JOIN pg_proc    p ON p.oid = t.tgfoid
    JOIN pg_class   c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'update_updated_at_column'
      AND NOT t.tgisinternal
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = r.tbl
        AND column_name  = 'updated_at'
    ) INTO col_exists;

    IF NOT col_exists THEN
      RAISE NOTICE 'Adding updated_at to table: %', r.tbl;
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()',
        r.tbl
      );
    END IF;
  END LOOP;
END;
$$;
