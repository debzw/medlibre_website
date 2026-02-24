-- ============================================================
-- Migration: Search Engine v2 — Funnel Search with DeCS + FTS
-- ============================================================
-- What this adds:
--   1. GIN FTS index on questions.enunciado (replaces sequential scan)
--   2. GIN trigram index on decs_terms.clean_term (for fuzzy/typo correction)
--   3. B-Tree index on decs_terms.clean_term (for exact match)
--   4. RPC search_questions() — 3-layer funnel router with ranking + keyset pagination
-- ============================================================

-- 1. GIN Full-Text Search index on enunciado (Portuguese)
-- Critical: without this, every FTS query does a sequential scan on the entire table.
CREATE INDEX IF NOT EXISTS idx_questions_enunciado_fts
  ON public.questions USING GIN (to_tsvector('portuguese', enunciado));

-- 2. GIN trigram index on decs_terms.clean_term (for fuzzy/similarity search)
-- Requires pg_trgm (already enabled by a previous migration).
CREATE INDEX IF NOT EXISTS idx_decs_clean_term_trgm
  ON public.decs_terms USING GIN (clean_term gin_trgm_ops);

-- 3. B-Tree index on decs_terms.clean_term (for exact ILIKE match in Layer 1)
CREATE INDEX IF NOT EXISTS idx_decs_clean_term_btree
  ON public.decs_terms (clean_term);

-- ============================================================
-- RPC: search_questions
-- ============================================================
-- Funnel routing:
--   Layer 1 — Exact DeCS match: query hits decs_terms.clean_term exactly.
--             Also expands to search output_tema and output_especialidade.
--   Layer 2 — Fuzzy/Typo: if Layer 1 finds nothing and query is short (≤ 3 words),
--             uses pg_trgm similarity on decs_terms to find the closest term.
--   Layer 3 — FTS fallback: long queries (clinical cases) use plainto_tsquery.
--
-- Ranking: ts_rank * temporal_decay
--   decay = GREATEST(0.3, 1.0 - (current_year - ano) * 0.02)
--   This applies a soft 2%/year penalty, floored at 30% so old questions
--   can still rank if highly relevant.
--
-- Keyset Pagination: pass p_last_score + p_last_id from previous page.
--   Uses (score, id) < (p_last_score, p_last_id) for zero-duplicate scrolling.
--
-- hideAnswered: uses LEFT JOIN instead of NOT IN — avoids large ID list problem.
-- ============================================================

CREATE OR REPLACE FUNCTION public.search_questions(
  p_query          TEXT,
  p_banca          TEXT    DEFAULT NULL,
  p_ano            INTEGER DEFAULT NULL,
  p_campo          TEXT    DEFAULT NULL,
  p_especialidade  TEXT    DEFAULT NULL,
  p_tema           TEXT    DEFAULT NULL,
  p_user_id        UUID    DEFAULT NULL,
  p_hide_answered  BOOLEAN DEFAULT FALSE,
  p_last_score     FLOAT   DEFAULT NULL,
  p_last_id        UUID    DEFAULT NULL,
  p_limit          INTEGER DEFAULT 20
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clean_query    TEXT;
  v_word_count     INTEGER;
  v_layer_used     INTEGER := 3;
  v_decs_term      TEXT    := NULL;
  v_results        JSON;
  v_next_score     FLOAT   := NULL;
  v_next_id        UUID    := NULL;
  v_tsquery        tsquery;
BEGIN
  -- Normalize the query: trim whitespace, lowercase
  v_clean_query := lower(trim(p_query));

  IF v_clean_query = '' OR v_clean_query IS NULL THEN
    RETURN json_build_object(
      'results', '[]'::json,
      'layer_used', 0,
      'next_cursor', NULL
    );
  END IF;

  -- Count words to decide routing
  v_word_count := array_length(regexp_split_to_array(trim(v_clean_query), '\s+'), 1);

  -- ============================================================
  -- LAYER 1: Exact DeCS match
  -- ============================================================
  SELECT clean_term INTO v_decs_term
  FROM public.decs_terms
  WHERE clean_term = v_clean_query
  LIMIT 1;

  IF v_decs_term IS NOT NULL THEN
    v_layer_used := 1;
  END IF;

  -- ============================================================
  -- LAYER 2: Fuzzy/Typo correction (only for short queries)
  -- ============================================================
  IF v_decs_term IS NULL AND v_word_count <= 3 THEN
    SELECT clean_term INTO v_decs_term
    FROM public.decs_terms
    WHERE similarity(clean_term, v_clean_query) > 0.60
    ORDER BY similarity(clean_term, v_clean_query) DESC
    LIMIT 1;

    IF v_decs_term IS NOT NULL THEN
      v_layer_used := 2;
    END IF;
  END IF;

  -- ============================================================
  -- Build tsquery for FTS (Layer 3 fallback or when DeCS found)
  -- If we found a DeCS term, use it as the canonical query.
  -- Otherwise use the original query as-is.
  -- ============================================================
  BEGIN
    IF v_decs_term IS NOT NULL THEN
      v_tsquery := plainto_tsquery('portuguese', v_decs_term);
    ELSE
      v_layer_used := 3;
      v_tsquery := plainto_tsquery('portuguese', v_clean_query);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If tsquery parsing fails, fallback to simple websearch
    v_layer_used := 3;
    v_tsquery := websearch_to_tsquery('portuguese', v_clean_query);
  END;

  -- ============================================================
  -- MAIN QUERY with keyset pagination + ranking + hideAnswered
  -- ============================================================
  WITH ranked AS (
    SELECT
      q.id,
      q.banca,
      q.ano,
      q.enunciado,
      q.opcoes,
      q.resposta_correta,
      q.output_gabarito,
      q.output_explicacao,
      q.output_grande_area,
      q.output_especialidade,
      q.output_tema,
      q.output_subtema,
      q.output_taxa_certeza,
      q.imagem_url,
      q.status_imagem,
      q.referencia_imagem,
      q.alternativa_a,
      q.alternativa_b,
      q.alternativa_c,
      q.alternativa_d,
      q.alternativa_e,
      q.processado,
      q.created_at,
      -- Compute relevance score
      CASE
        WHEN v_layer_used IN (1, 2) THEN
          -- Layer 1/2: also boost if output_tema or output_especialidade matches the DeCS term
          (
            ts_rank(to_tsvector('portuguese', q.enunciado), v_tsquery)
            + CASE WHEN lower(coalesce(q.output_tema, '')) LIKE '%' || v_decs_term || '%' THEN 0.3 ELSE 0 END
            + CASE WHEN lower(coalesce(q.output_especialidade, '')) LIKE '%' || v_decs_term || '%' THEN 0.2 ELSE 0 END
          )
          * GREATEST(0.3, 1.0 - (EXTRACT(YEAR FROM NOW())::INTEGER - q.ano) * 0.02)
        ELSE
          -- Layer 3: pure FTS rank + temporal decay
          ts_rank(to_tsvector('portuguese', q.enunciado), v_tsquery)
          * GREATEST(0.3, 1.0 - (EXTRACT(YEAR FROM NOW())::INTEGER - q.ano) * 0.02)
      END AS score
    FROM public.questions q
    -- Left join for hideAnswered (server-side, avoids large NOT IN list)
    LEFT JOIN public.user_question_history uqh
      ON uqh.question_id = q.id
      AND uqh.user_id = p_user_id
      AND p_user_id IS NOT NULL
    WHERE
      -- Exclude anomalous questions
      (q.tem_anomalia IS NULL OR q.tem_anomalia != 1)
      -- FTS match
      AND to_tsvector('portuguese', q.enunciado) @@ v_tsquery
      -- Optional filters
      AND (p_banca IS NULL OR q.banca = p_banca)
      AND (p_ano IS NULL OR q.ano = p_ano)
      AND (p_campo IS NULL OR q.output_grande_area = p_campo)
      AND (p_especialidade IS NULL OR q.output_especialidade = p_especialidade)
      AND (p_tema IS NULL OR q.output_tema = p_tema)
      -- hideAnswered via LEFT JOIN (uqh.id IS NULL means not answered)
      AND (NOT p_hide_answered OR p_user_id IS NULL OR uqh.id IS NULL)
      -- Keyset pagination cursor
      AND (
        p_last_score IS NULL OR p_last_id IS NULL
        OR (score, q.id::text) < (p_last_score, p_last_id::text)
      )
  )
  SELECT
    json_build_object(
      'results', COALESCE(json_agg(row_to_json(r.*) ORDER BY r.score DESC, r.id DESC), '[]'::json),
      'layer_used', v_layer_used,
      'corrected_term', v_decs_term,
      'next_cursor', CASE
        WHEN count(*) = p_limit THEN json_build_object(
          'last_score', min(r.score),
          'last_id', (array_agg(r.id ORDER BY r.score DESC, r.id DESC))[p_limit]
        )
        ELSE NULL
      END
    )
  INTO v_results
  FROM (
    SELECT * FROM ranked ORDER BY score DESC, id DESC LIMIT p_limit
  ) r;

  RETURN v_results;
END;
$$;

-- Grant access to authenticated and anon roles
GRANT EXECUTE ON FUNCTION public.search_questions(
  TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, UUID, BOOLEAN, FLOAT, UUID, INTEGER
) TO authenticated, anon;
