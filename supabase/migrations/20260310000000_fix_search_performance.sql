-- ============================================================
-- Migration: fix_search_performance
-- Description:
-- 1. Enables pg_trgm extension for trigram-based fuzzy search
-- 2. Adds GIN trigram index on decs_terms.clean_term (fixes Layer 2 seq scan)
-- 3. Adds functional index on lower(clean_term) (fixes Layer 1 case mismatch)
-- 4. Adds pre-built tsvector GIN index on questions.enunciado (fixes FTS seq scan)
-- 5. Rewrites search_questions to use case-insensitive Layer 1 and % operator
--    in Layer 2 so PostgreSQL can use the GIN trgm index instead of seq scan.
-- ============================================================

-- ── 1. Enable pg_trgm ────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── 2. GIN trigram index on decs_terms.clean_term ────────────
-- Enables the % operator (and similarity()) to use index scan instead of
-- full sequential scan. Turns Layer 2 from ~60s to ~5ms.
CREATE INDEX IF NOT EXISTS idx_decs_terms_clean_term_trgm
  ON public.decs_terms USING GIN (clean_term gin_trgm_ops);

-- ── 3. Functional index for case-insensitive exact match ──────
-- decs_terms stores "Polimiosite" (capitalized) but v_clean_query is lowercase.
-- This index enables Layer 1 to match without falling through to Layer 2.
CREATE INDEX IF NOT EXISTS idx_decs_terms_clean_term_lower
  ON public.decs_terms (lower(clean_term));

-- ── 4. Pre-built tsvector GIN index on questions ──────────────
-- FTS fallback uses to_tsvector('portuguese', enunciado) on-the-fly.
-- This index lets PostgreSQL skip recomputation during queries.
CREATE INDEX IF NOT EXISTS idx_questions_enunciado_fts
  ON public.questions USING GIN (to_tsvector('portuguese', enunciado));

-- Update planner statistics
ANALYZE public.decs_terms;
ANALYZE public.questions;

-- ── 5. Rewrite search_questions with performance fixes ────────
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
  v_decs_id        UUID    := NULL;
  v_search_mode    TEXT    := 'fts';
  v_results        JSON;
  v_tsquery        tsquery;
  v_parent_paths   ltree[];
BEGIN
  v_clean_query := lower(trim(p_query));

  IF v_clean_query = '' OR v_clean_query IS NULL THEN
    RETURN json_build_object(
      'results',      '[]'::json,
      'layer_used',   0,
      'search_mode',  'none',
      'next_cursor',  NULL
    );
  END IF;

  v_word_count := array_length(regexp_split_to_array(trim(v_clean_query), '\s+'), 1);

  -- ── Layer 1: Case-insensitive exact DeCS match ────────────
  -- FIX: Use lower(clean_term) = v_clean_query so "Polimiosite" matches
  -- "polimiosite". Uses idx_decs_terms_clean_term_lower functional index.
  SELECT clean_term INTO v_decs_term
  FROM public.decs_terms
  WHERE lower(clean_term) = v_clean_query
  LIMIT 1;

  IF v_decs_term IS NOT NULL THEN
    v_layer_used := 1;
  END IF;

  -- ── Layer 2: Trigram fuzzy correction ─────────────────────
  -- FIX: Use % operator (set_limit threshold) instead of similarity() > 0.60.
  -- The % operator triggers use of the GIN trigram index, turning a full
  -- sequential scan into an index scan. similarity() still used for ORDER BY
  -- but only over the small set of candidates returned by the index.
  IF v_decs_term IS NULL AND v_word_count <= 3 THEN
    PERFORM set_limit(0.60);
    SELECT clean_term INTO v_decs_term
    FROM public.decs_terms
    WHERE clean_term % v_clean_query
    ORDER BY similarity(clean_term, v_clean_query) DESC
    LIMIT 1;

    IF v_decs_term IS NOT NULL THEN
      v_layer_used := 2;
    END IF;
  END IF;

  -- ── Resolve canonical decs_id ─────────────────────────────
  IF v_decs_term IS NOT NULL THEN
    SELECT id INTO v_decs_id
    FROM public.decs_terms
    WHERE lower(clean_term) = lower(v_decs_term)
    LIMIT 1;
  END IF;

  -- ── Structured Path: Hierarchical Search via GiST/GIN on ltree[] ──
  IF v_decs_id IS NOT NULL THEN

    SELECT array_agg(tree_path) INTO v_parent_paths
    FROM public.decs_tree_paths
    WHERE decs_id = v_decs_id;

    IF v_parent_paths IS NOT NULL AND array_length(v_parent_paths, 1) > 0 THEN
      v_search_mode := 'hierarchical';

      WITH ranked_ids AS (
        SELECT
          q.id,
          s.score
        FROM public.questions q
        CROSS JOIN LATERAL (
           SELECT
             CASE
               WHEN q.decs_hierarquia_encontrada::text[] && v_parent_paths::text[] THEN 1.0
               ELSE 0.7
             END * GREATEST(0.3, 1.0 - (EXTRACT(YEAR FROM NOW())::INTEGER - q.ano) * 0.02) AS score
        ) s
        LEFT JOIN public.user_question_history uqh
          ON uqh.question_id = q.id AND uqh.user_id = p_user_id AND p_user_id IS NOT NULL
        WHERE
          q.decs_hierarquia_encontrada <@ ANY (v_parent_paths)
          AND (q.tem_anomalia IS NULL OR q.tem_anomalia != 1)
          AND (p_banca IS NULL OR q.banca = p_banca)
          AND (p_ano IS NULL OR q.ano = p_ano)
          AND (p_campo IS NULL OR q.output_grande_area = p_campo)
          AND (p_especialidade IS NULL OR p_especialidade = ANY(q.especialidades_tags))
          AND (p_tema IS NULL OR q.output_tema = p_tema)
          AND (NOT p_hide_answered OR p_user_id IS NULL OR uqh.id IS NULL)
          AND (
            p_last_score IS NULL OR p_last_id IS NULL
            OR (s.score, q.id::text) < (p_last_score, p_last_id::text)
          )
        ORDER BY s.score DESC, q.id DESC
        LIMIT p_limit
      )
      SELECT json_build_object(
        'results',        COALESCE(json_agg(row_to_json(r_out.*) ORDER BY r_out.score DESC, r_out.id DESC), '[]'::json),
        'layer_used',     v_layer_used,
        'corrected_term', v_decs_term,
        'search_mode',    v_search_mode,
        'next_cursor',    CASE
          WHEN count(*) = p_limit THEN json_build_object(
            'last_score', min(r_out.score),
            'last_id',    (array_agg(r_out.id ORDER BY r_out.score DESC, r_out.id DESC))[p_limit]
          )
          ELSE NULL
        END
      )
      INTO v_results
      FROM (
        SELECT
          q2.id, q2.banca, q2.ano, q2.enunciado, q2.imagem_url, q2.opcoes,
          q2.resposta_correta, q2.status_imagem, q2.referencia_imagem,
          q2.alternativa_a, q2.alternativa_b, q2.alternativa_c,
          q2.alternativa_d, q2.alternativa_e, q2.especialidade,
          q2.output_gabarito, q2.output_explicacao, q2.output_grande_area,
          q2.output_especialidade, q2.output_tema, q2.output_subtema,
          q2.output_taxa_certeza, q2.processado, q2.created_at,
          q2.id_integracao, q2.numero, q2.tipo, q2.texto_base,
          q2.imagem_alt_a, q2.imagem_alt_b, q2.imagem_alt_c,
          q2.imagem_alt_d, q2.imagem_alt_e, q2.exam_type,
          q2.texto_base_processado, q2.tem_anomalia, q2.log_anomalia,
          q2.vetorizado, q2.exportado, q2.imagem_nova,
          q2.especialidades_tags, q2.decs_hierarquia_encontrada,
          r.score
        FROM ranked_ids r
        JOIN public.questions q2 ON q2.id = r.id
        ORDER BY r.score DESC, r.id DESC
      ) r_out;

      IF (v_results->>'results') <> '[]' THEN
        RETURN v_results;
      END IF;
    END IF;
  END IF;

  -- ── FTS Fallback ──────────────────────────────────────────
  -- Uses idx_questions_enunciado_fts GIN index automatically via planner.
  v_search_mode := 'fts';
  BEGIN
    IF v_decs_term IS NOT NULL THEN
      v_tsquery := plainto_tsquery('portuguese', v_decs_term);
    ELSE
      v_layer_used := 3;
      v_tsquery := plainto_tsquery('portuguese', v_clean_query);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_layer_used := 3;
    v_tsquery := websearch_to_tsquery('portuguese', v_clean_query);
  END;

  WITH ranked_ids AS (
    SELECT
      q.id,
      s.score
    FROM public.questions q
    CROSS JOIN LATERAL (
      SELECT
        CASE
          WHEN v_layer_used IN (1, 2) THEN
            (
              ts_rank(to_tsvector('portuguese', q.enunciado), v_tsquery)
              + CASE WHEN lower(coalesce(q.output_tema, ''))          LIKE '%' || v_decs_term || '%' THEN 0.3 ELSE 0 END
              + CASE WHEN lower(coalesce(q.output_especialidade, '')) LIKE '%' || v_decs_term || '%' THEN 0.2 ELSE 0 END
            )
            * GREATEST(0.3, 1.0 - (EXTRACT(YEAR FROM NOW())::INTEGER - q.ano) * 0.02)
          ELSE
            ts_rank(to_tsvector('portuguese', q.enunciado), v_tsquery)
            * GREATEST(0.3, 1.0 - (EXTRACT(YEAR FROM NOW())::INTEGER - q.ano) * 0.02)
        END AS score
    ) s
    LEFT JOIN public.user_question_history uqh
      ON uqh.question_id = q.id AND uqh.user_id = p_user_id AND p_user_id IS NOT NULL
    WHERE
      (q.tem_anomalia IS NULL OR q.tem_anomalia != 1)
      AND to_tsvector('portuguese', q.enunciado) @@ v_tsquery
      AND (p_banca IS NULL OR q.banca = p_banca)
      AND (p_ano IS NULL OR q.ano = p_ano)
      AND (p_campo IS NULL OR q.output_grande_area = p_campo)
      AND (p_especialidade IS NULL OR p_especialidade = ANY(q.especialidades_tags))
      AND (p_tema IS NULL OR q.output_tema = p_tema)
      AND (NOT p_hide_answered OR p_user_id IS NULL OR uqh.id IS NULL)
      AND (
        p_last_score IS NULL OR p_last_id IS NULL
        OR (s.score, q.id::text) < (p_last_score, p_last_id::text)
      )
    ORDER BY s.score DESC, q.id DESC
    LIMIT p_limit
  )
  SELECT json_build_object(
    'results',        COALESCE(json_agg(row_to_json(r_out.*) ORDER BY r_out.score DESC, r_out.id DESC), '[]'::json),
    'layer_used',     v_layer_used,
    'corrected_term', v_decs_term,
    'search_mode',    v_search_mode,
    'next_cursor',    CASE
      WHEN count(*) = p_limit THEN json_build_object(
        'last_score', min(r_out.score),
        'last_id',    (array_agg(r_out.id ORDER BY r_out.score DESC, r_out.id DESC))[p_limit]
      )
      ELSE NULL
    END
  )
  INTO v_results
  FROM (
    SELECT
      q2.id, q2.banca, q2.ano, q2.enunciado, q2.imagem_url, q2.opcoes,
      q2.resposta_correta, q2.status_imagem, q2.referencia_imagem,
      q2.alternativa_a, q2.alternativa_b, q2.alternativa_c,
      q2.alternativa_d, q2.alternativa_e, q2.especialidade,
      q2.output_gabarito, q2.output_explicacao, q2.output_grande_area,
      q2.output_especialidade, q2.output_tema, q2.output_subtema,
      q2.output_taxa_certeza, q2.processado, q2.created_at,
      q2.id_integracao, q2.numero, q2.tipo, q2.texto_base,
      q2.imagem_alt_a, q2.imagem_alt_b, q2.imagem_alt_c,
      q2.imagem_alt_d, q2.imagem_alt_e, q2.exam_type,
      q2.texto_base_processado, q2.tem_anomalia, q2.log_anomalia,
      q2.vetorizado, q2.exportado, q2.imagem_nova,
      q2.especialidades_tags, q2.decs_hierarquia_encontrada,
      r.score
    FROM ranked_ids r
    JOIN public.questions q2 ON q2.id = r.id
    ORDER BY r.score DESC, r.id DESC
  ) r_out;

  RETURN v_results;
END;
$$;
