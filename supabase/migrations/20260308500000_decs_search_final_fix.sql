-- ============================================================
-- Migration: decs_search_final_fix
-- Description: 
--  1. Fixes Postgres 500 error: operator does not exist: json <> json.
--  2. Uses explicit 'unnest' to do nested hierarchical joins preventing sequential scan.
--  3. Solves the fallback logic missing parent vs child terms.
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
  v_decs_id        UUID    := NULL;
  v_desc_decs_ids  UUID[]  := NULL;
  v_search_mode    TEXT    := 'fts';
  v_results        JSON;
  v_tsquery        tsquery;
  v_parent_path    TEXT;
  v_batch_ids      UUID[];
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

  -- ── Layer 1: Exact DeCS match ─────────────────────────────
  SELECT clean_term INTO v_decs_term
  FROM public.decs_terms
  WHERE clean_term = v_clean_query
  LIMIT 1;

  IF v_decs_term IS NOT NULL THEN
    v_layer_used := 1;
  END IF;

  -- ── Layer 2: Fuzzy correction ─────────────────────────────
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

  -- ── Resolve canonical decs_id ─────────────────────────────
  IF v_decs_term IS NOT NULL THEN
    SELECT id INTO v_decs_id
    FROM public.decs_terms
    WHERE clean_term = v_decs_term
    LIMIT 1;
  END IF;

  -- ── Attempt Hierarchical Search ───────────────────────────
  IF v_decs_id IS NOT NULL THEN
    v_desc_decs_ids := ARRAY[v_decs_id]; -- Includes parent explicitly

    FOR v_parent_path IN
      SELECT tree_path FROM public.decs_tree_paths WHERE decs_id = v_decs_id
    LOOP
      SELECT array_agg(DISTINCT decs_id) INTO v_batch_ids
      FROM public.decs_tree_paths
      WHERE tree_path LIKE v_parent_path || '.%';

      IF v_batch_ids IS NOT NULL THEN
        v_desc_decs_ids := v_desc_decs_ids || v_batch_ids;
      END IF;
    END LOOP;

    -- Deduplicate paths
    SELECT array_agg(DISTINCT x) INTO v_desc_decs_ids 
    FROM unnest(v_desc_decs_ids) AS x;

    IF v_desc_decs_ids IS NOT NULL AND array_length(v_desc_decs_ids, 1) > 0 THEN
      v_search_mode := 'hierarchical';

      WITH best_match AS (
        SELECT qd.question_id, 
               MAX(CASE WHEN qd.decs_id = v_decs_id THEN 1.0 ELSE 0.7 END) AS tag_multiplier
        FROM unnest(v_desc_decs_ids) AS search_decs_id
        JOIN public.question_decs qd ON qd.decs_id = search_decs_id
        GROUP BY qd.question_id
      ),
      ranked AS (
        SELECT 
          q.*,
          s.score
        FROM best_match bm
        JOIN public.questions q ON q.id = bm.question_id
        CROSS JOIN LATERAL (
           SELECT bm.tag_multiplier * GREATEST(0.3, 1.0 - (EXTRACT(YEAR FROM NOW())::INTEGER - q.ano) * 0.02) AS score
        ) s
        LEFT JOIN public.user_question_history uqh
          ON uqh.question_id = q.id AND uqh.user_id = p_user_id AND p_user_id IS NOT NULL
        WHERE
          (q.tem_anomalia IS NULL OR q.tem_anomalia != 1)
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
      )
      SELECT json_build_object(
        'results',        COALESCE(json_agg(row_to_json(r.*) ORDER BY r.score DESC, r.id DESC), '[]'::json),
        'layer_used',     v_layer_used,
        'corrected_term', v_decs_term,
        'search_mode',    v_search_mode,
        'next_cursor',    CASE
          WHEN count(*) = p_limit THEN json_build_object(
            'last_score', min(r.score),
            'last_id',    (array_agg(r.id ORDER BY r.score DESC, r.id DESC))[p_limit]
          )
          ELSE NULL
        END
      )
      INTO v_results
      FROM (SELECT * FROM ranked ORDER BY score DESC, id DESC LIMIT p_limit) r;

      -- BUGFIX: 'json != json' throws "operator does not exist" in Postgres.
      -- Replaced with text representation comparison.
      IF v_results->>'results' != '[]' THEN
        RETURN v_results;
      END IF;
    END IF;
  END IF;

  -- ── FTS Fallback ──────────────────────────────────────────
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

  WITH ranked AS (
    SELECT
      q.*,
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
  )
  SELECT json_build_object(
    'results',        COALESCE(json_agg(row_to_json(r.*) ORDER BY r.score DESC, r.id DESC), '[]'::json),
    'layer_used',     v_layer_used,
    'corrected_term', v_decs_term,
    'search_mode',    v_search_mode,
    'next_cursor',    CASE
      WHEN count(*) = p_limit THEN json_build_object(
        'last_score', min(r.score),
        'last_id',    (array_agg(r.id ORDER BY r.score DESC, r.id DESC))[p_limit]
      )
      ELSE NULL
    END
  )
  INTO v_results
  FROM (SELECT * FROM ranked ORDER BY score DESC, id DESC LIMIT p_limit) r;

  RETURN v_results;
END;
$$;
