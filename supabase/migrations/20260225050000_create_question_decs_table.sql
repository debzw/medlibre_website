-- ============================================================
-- Migration: Create question_decs junction table
-- Links questions to DeCS terms for structured topic tagging.
-- Applied locally before 20260226000000_specialty_performance_decs_v2.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.question_decs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
  decs_id     UUID REFERENCES public.decs_terms(id) ON DELETE CASCADE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(question_id, decs_id)
);

CREATE INDEX IF NOT EXISTS idx_question_decs_question_id ON public.question_decs(question_id);
CREATE INDEX IF NOT EXISTS idx_question_decs_decs_id     ON public.question_decs(decs_id);
