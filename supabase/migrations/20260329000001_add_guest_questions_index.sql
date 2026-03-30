-- Fast partial index for the guest question feed query.
-- The guest path orders by created_at DESC and filters out anomalous questions.
-- Without this index, Postgres does a full sequential scan + sort on every
-- unauthenticated page load (observed: ~8 s). With the index, it becomes an
-- index scan returning the top 50 rows in < 200 ms.
CREATE INDEX IF NOT EXISTS idx_questions_created_at_guest
  ON public.questions (created_at DESC)
  WHERE tem_anomalia IS NULL OR tem_anomalia != 1;
