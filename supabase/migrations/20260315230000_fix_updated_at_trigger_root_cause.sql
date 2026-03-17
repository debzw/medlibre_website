-- ============================================================
-- Fix: 42703 "record new has no field updated_at"
-- ============================================================
-- Root cause: update_updated_at_column() was attached to
-- user_question_history via a trigger created outside the
-- migration system (e.g. Supabase Dashboard). That function
-- executes NEW.updated_at = now(), but the column did not
-- exist on user_question_history at the time.
--
-- Previous attempts that did NOT fix this:
--   - 20260312000000: Added the column (correct direction,
--     but only works if the migration was applied AND if the
--     errant trigger is not BEFORE INSERT with a missing col)
--   - 20260315220000: "Force recompile" via pg_get_functiondef()
--     — wrong diagnosis; PostgreSQL 42703 is a runtime schema
--     check, not a stale plan cache. Re-executing the same
--     function body is a no-op.
--
-- Correct fix (three steps):
--   1. Ensure updated_at column exists (idempotent).
--   2. Drop every trigger on user_question_history that calls
--      update_updated_at_column(), regardless of its name
--      (Supabase Dashboard auto-names these unpredictably).
--   3. Re-attach a clean, properly-named trigger so updated_at
--      is kept current on future UPDATEs.
-- ============================================================

-- Step 1: Guarantee the column exists
ALTER TABLE public.user_question_history
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Step 2: Drop any trigger on user_question_history that
-- references update_updated_at_column(), by name-agnostic lookup
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_proc    p ON p.oid = t.tgfoid
    JOIN pg_class   c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'user_question_history'
      AND p.proname = 'update_updated_at_column'
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON public.user_question_history',
      r.tgname
    );
  END LOOP;
END;
$$;

-- Step 3: Re-attach with a deterministic name (BEFORE UPDATE only —
-- the DEFAULT NOW() on the column handles INSERT automatically)
DROP TRIGGER IF EXISTS trg_uqh_set_updated_at ON public.user_question_history;
CREATE TRIGGER trg_uqh_set_updated_at
  BEFORE UPDATE ON public.user_question_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
