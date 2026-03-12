-- Fix: "record new has no field updated_at" (PG error 42703)
-- A trigger on user_question_history references NEW.updated_at but the column is missing.
ALTER TABLE public.user_question_history
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
