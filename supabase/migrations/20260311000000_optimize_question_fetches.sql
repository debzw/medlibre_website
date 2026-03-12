-- ============================================================
-- Migration: optimize_question_fetches
-- Description:
-- 1. Índices em user_question_history para status filter e ordenação.
-- 2. get_filter_options() RPC — substitui SELECT * em toda a tabela no
--    useFilterOptions. Usa índices B-Tree existentes via SELECT DISTINCT,
--    retorna apenas os valores únicos (~10-50 linhas vs 50k+).
-- 3. get_questions_by_status() RPC — elimina o padrão de dois queries seriais
--    (buscar IDs do histórico → IN enorme). Faz EXISTS JOIN server-side em
--    um único round-trip. Também cobre p_hide_answered via NOT EXISTS.
-- ============================================================

-- ── 1. Índices para status filter ───────────────────────────────────────────
-- Existente: idx_uqh_user_question(user_id, question_id) — cobre NOT EXISTS.
-- Novo: cobre WHERE user_id = ? AND is_correct = ? no EXISTS do status filter.
CREATE INDEX IF NOT EXISTS idx_uqh_user_is_correct
  ON public.user_question_history (user_id, is_correct)
  WHERE is_correct IS NOT NULL;

-- Cobre ORDER BY answered_at DESC no get_questions_by_status
CREATE INDEX IF NOT EXISTS idx_uqh_user_answered_at
  ON public.user_question_history (user_id, answered_at DESC NULLS LAST);

ANALYZE public.user_question_history;

-- ── 2. get_filter_options ────────────────────────────────────────────────────
-- Antes: frontend fazia .from('questions').select('banca, ano, output_grande_area')
-- retornando TODAS as linhas e deduplicava no cliente com Set().
-- Agora: SELECT DISTINCT usa os B-Tree indexes já existentes em cada coluna —
-- retorna apenas os ~10-50 valores distintos por campo.
CREATE OR REPLACE FUNCTION public.get_filter_options()
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'bancas', COALESCE(
      (SELECT json_agg(b ORDER BY b)
       FROM (
         SELECT DISTINCT banca AS b
         FROM public.questions
         WHERE tem_anomalia IS NULL OR tem_anomalia != 1
       ) sub
       WHERE b IS NOT NULL),
      '[]'::json
    ),
    'anos', COALESCE(
      (SELECT json_agg(a ORDER BY a DESC)
       FROM (
         SELECT DISTINCT ano AS a
         FROM public.questions
         WHERE tem_anomalia IS NULL OR tem_anomalia != 1
       ) sub
       WHERE a IS NOT NULL),
      '[]'::json
    ),
    'campos', COALESCE(
      (SELECT json_agg(c ORDER BY c)
       FROM (
         SELECT DISTINCT output_grande_area AS c
         FROM public.questions
         WHERE output_grande_area IS NOT NULL
           AND output_grande_area != ''
           AND (tem_anomalia IS NULL OR tem_anomalia != 1)
       ) sub),
      '[]'::json
    )
  );
$$;

-- ── 3. get_questions_by_status ───────────────────────────────────────────────
-- Substitui o padrão frontend de dois queries seriais:
--   1. SELECT question_id FROM user_question_history WHERE user_id=? AND is_correct=?
--   2. SELECT * FROM questions WHERE id IN (lista enorme)
-- O IN(...) com milhares de UUIDs não usa índice — PostgreSQL faz seq scan no array.
--
-- Aqui: EXISTS(...) server-side com idx_uqh_user_is_correct. Um único round-trip.
-- p_hide_answered também é tratado aqui via NOT EXISTS para evitar o segundo
-- padrão de dois queries que existe no fallback path (linhas 257-281 do hook).
CREATE OR REPLACE FUNCTION public.get_questions_by_status(
  p_user_id       UUID,
  p_status        TEXT,      -- 'all_answered' | 'correct' | 'incorrect'
  p_banca         TEXT    DEFAULT NULL,
  p_ano           INTEGER DEFAULT NULL,
  p_campo         TEXT    DEFAULT NULL,
  p_especialidade TEXT    DEFAULT NULL,
  p_tema          TEXT    DEFAULT NULL,
  p_hide_answered BOOLEAN DEFAULT FALSE,
  p_limit         INTEGER DEFAULT 50
)
RETURNS SETOF public.questions
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  -- p_hide_answered + status filter é contradição lógica (status já implica respondida),
  -- mas mantemos o parâmetro para compatibilidade com o frontend.
  RETURN QUERY
  SELECT q.*
  FROM public.questions q
  WHERE
    -- Filtra pelo status. EXISTS evita duplicatas de questões respondidas N vezes.
    EXISTS (
      SELECT 1
      FROM public.user_question_history uqh
      WHERE uqh.question_id = q.id
        AND uqh.user_id = p_user_id
        AND (
          p_status = 'all_answered'
          OR (p_status = 'correct'   AND uqh.is_correct = true)
          OR (p_status = 'incorrect' AND uqh.is_correct = false)
        )
    )
    -- Opcional: esconder respondidas (por NOT EXISTS separado se necessário)
    AND (
      NOT p_hide_answered
      OR NOT EXISTS (
        SELECT 1 FROM public.user_question_history uqh2
        WHERE uqh2.question_id = q.id AND uqh2.user_id = p_user_id
      )
    )
    AND (q.tem_anomalia IS NULL OR q.tem_anomalia != 1)
    AND (p_banca         IS NULL OR q.banca                      = p_banca)
    AND (p_ano           IS NULL OR q.ano                        = p_ano)
    AND (p_campo         IS NULL OR q.output_grande_area         = p_campo)
    AND (p_especialidade IS NULL OR p_especialidade = ANY(q.especialidades_tags))
    AND (p_tema          IS NULL OR q.output_tema                = p_tema)
  ORDER BY q.created_at DESC
  LIMIT p_limit;
END;
$$;
