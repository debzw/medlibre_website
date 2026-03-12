-- ============================================================
-- Migration: decs_tree_paths — Fast Hierarchical DeCS Lookup
-- ============================================================
-- Problem: The descendant expansion in search_questions used a
-- CROSS JOIN LATERAL unnest() + LIKE, which does a full table scan
-- on decs_terms (O(n × avg_tree_numbers)). The GIN index on
-- tree_numbers doesn't help for prefix LIKE on unnested values.
--
-- Solution: Normalize tree_numbers into scalar rows in decs_tree_paths
-- and add a B-tree index with text_pattern_ops. This turns the prefix
-- scan into an O(log n) index seek.
--
-- Multi-branch terms: a term with tree_numbers = ["C05.651.594", "C17.300.339"]
-- generates 2 rows — the JOIN naturally covers all branches.
-- ============================================================

-- ── 1. Normalized paths table ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.decs_tree_paths (
    decs_id   UUID NOT NULL REFERENCES public.decs_terms(id) ON DELETE CASCADE,
    tree_path TEXT NOT NULL,
    PRIMARY KEY (decs_id, tree_path)
);

-- B-tree with text_pattern_ops: required for fast LIKE 'prefix.%' queries.
-- Standard B-tree doesn't support prefix LIKE with non-C locales.
CREATE INDEX IF NOT EXISTS idx_decs_tree_paths_path_pattern
    ON public.decs_tree_paths (tree_path text_pattern_ops);

-- ── 2. Populate from existing decs_terms ────────────────────
INSERT INTO public.decs_tree_paths (decs_id, tree_path)
SELECT id, unnest(tree_numbers)
FROM public.decs_terms
ON CONFLICT DO NOTHING;

-- ── 3. Trigger to stay in sync on future imports ────────────
CREATE OR REPLACE FUNCTION public.sync_decs_tree_paths()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.decs_tree_paths WHERE decs_id = NEW.id;
  INSERT INTO public.decs_tree_paths (decs_id, tree_path)
  SELECT NEW.id, unnest(NEW.tree_numbers);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_decs_tree_paths ON public.decs_terms;
CREATE TRIGGER trg_sync_decs_tree_paths
AFTER INSERT OR UPDATE OF tree_numbers ON public.decs_terms
FOR EACH ROW EXECUTE FUNCTION public.sync_decs_tree_paths();

-- ── 4. Replace slow descendant expansion in search_questions ─
-- Replaces the LATERAL unnest + LIKE cross join in 20260308000000
-- with an indexed two-table JOIN.
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

  -- ── Layer 2: Fuzzy/trigram correction (short queries) ─────
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

  -- ── Resolve decs_id ───────────────────────────────────────
  IF v_decs_term IS NOT NULL THEN
    SELECT id INTO v_decs_id
    FROM public.decs_terms
    WHERE clean_term = v_decs_term
    LIMIT 1;
  END IF;

  -- ── Structured path: direct → hierarchical ────────────────
  IF v_decs_id IS NOT NULL THEN

    -- Attempt 1: direct question_decs match
    IF EXISTS (
      SELECT 1 FROM public.question_decs WHERE decs_id = v_decs_id LIMIT 1
    ) THEN
      v_search_mode := 'direct';

      WITH ranked AS (
        SELECT DISTINCT ON (q.id)
          q.id, q.banca, q.ano, q.enunciado, q.opcoes,
          q.resposta_correta, q.output_gabarito, q.output_explicacao,
          q.output_grande_area, q.output_especialidade, q.output_tema,
          q.output_subtema, q.output_taxa_certeza, q.imagem_url,
          q.status_imagem, q.referencia_imagem,
          q.alternativa_a, q.alternativa_b, q.alternativa_c,
          q.alternativa_d, q.alternativa_e,
          q.processado, q.created_at, q.especialidades_tags,
          GREATEST(0.3, 1.0 - (EXTRACT(YEAR FROM NOW())::INTEGER - q.ano) * 0.02) AS score
        FROM public.questions q
        JOIN public.question_decs qd ON qd.question_id = q.id AND qd.decs_id = v_decs_id
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
            OR (GREATEST(0.3, 1.0 - (EXTRACT(YEAR FROM NOW())::INTEGER - q.ano) * 0.02), q.id::text)
               < (p_last_score, p_last_id::text)
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
    END IF;

    -- Attempt 2: hierarchical descendant expansion (FAST — uses indexed decs_tree_paths)
    -- pp returns one row per tree_number of the searched term (handles multi-branch terms).
    -- For each branch, the text_pattern_ops B-tree finds all descendant paths via LIKE prefix.
    SELECT array_agg(DISTINCT cp.decs_id) INTO v_desc_decs_ids
    FROM public.decs_tree_paths pp
    JOIN public.decs_tree_paths cp
      ON cp.tree_path LIKE pp.tree_path || '.%'
    WHERE pp.decs_id = v_decs_id;

    IF v_desc_decs_ids IS NOT NULL AND array_length(v_desc_decs_ids, 1) > 0 THEN
      v_search_mode := 'hierarchical';

      WITH ranked AS (
        SELECT DISTINCT ON (q.id)
          q.id, q.banca, q.ano, q.enunciado, q.opcoes,
          q.resposta_correta, q.output_gabarito, q.output_explicacao,
          q.output_grande_area, q.output_especialidade, q.output_tema,
          q.output_subtema, q.output_taxa_certeza, q.imagem_url,
          q.status_imagem, q.referencia_imagem,
          q.alternativa_a, q.alternativa_b, q.alternativa_c,
          q.alternativa_d, q.alternativa_e,
          q.processado, q.created_at, q.especialidades_tags,
          0.7 * GREATEST(0.3, 1.0 - (EXTRACT(YEAR FROM NOW())::INTEGER - q.ano) * 0.02) AS score
        FROM public.questions q
        JOIN public.question_decs qd ON qd.question_id = q.id AND qd.decs_id = ANY(v_desc_decs_ids)
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
            OR (0.7 * GREATEST(0.3, 1.0 - (EXTRACT(YEAR FROM NOW())::INTEGER - q.ano) * 0.02), q.id::text)
               < (p_last_score, p_last_id::text)
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

      IF (v_results->>'results')::json != '[]'::json THEN
        RETURN v_results;
      END IF;
    END IF;

  END IF;

  -- ── FTS fallback ──────────────────────────────────────────
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
      q.id, q.banca, q.ano, q.enunciado, q.opcoes,
      q.resposta_correta, q.output_gabarito, q.output_explicacao,
      q.output_grande_area, q.output_especialidade, q.output_tema,
      q.output_subtema, q.output_taxa_certeza, q.imagem_url,
      q.status_imagem, q.referencia_imagem,
      q.alternativa_a, q.alternativa_b, q.alternativa_c,
      q.alternativa_d, q.alternativa_e,
      q.processado, q.created_at, q.especialidades_tags,
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
    FROM public.questions q
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
        OR (score, q.id::text) < (p_last_score, p_last_id::text)
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

GRANT EXECUTE ON FUNCTION public.search_questions(
  TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, UUID, BOOLEAN, FLOAT, UUID, INTEGER
) TO authenticated, anon;
