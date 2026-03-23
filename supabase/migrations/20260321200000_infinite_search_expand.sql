-- ============================================================
-- Migration: infinite_search_expand
-- Description:
--   1. Índices em question_decs para JOINs rápidos
--   2. Patch em search_questions: adiciona decs_id na resposta JSON
--   3. Nova função search_questions_expand: escalada hierárquica DeCS
--      - Nível 1: irmãos (filhos do pai do termo original)
--      - Nível 2: tios (filhos do avô, excluindo zona do pai)
--      - etc., suportando múltiplos tree_numbers por termo
-- Performance: usa NOT EXISTS + índices GiST/B-Tree; < 500ms esperado.
-- ============================================================

-- ── 1. Índices em question_decs ───────────────────────────────────────────────
-- Críticos para os JOINs na expansão hierárquica
CREATE INDEX IF NOT EXISTS idx_question_decs_decs_id
  ON public.question_decs (decs_id);

CREATE INDEX IF NOT EXISTS idx_question_decs_question_id
  ON public.question_decs (question_id);

ANALYZE public.question_decs;

-- ── 2. Patch em search_questions: adicionar decs_id na resposta ───────────────
-- Refaz a função adicionando 'decs_id' no json_build_object dos dois caminhos
-- (hierárquico e FTS). v_decs_id já existia em scope mas não era retornado.
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
BEGIN
  v_clean_query := lower(trim(p_query));
  IF v_clean_query = '' OR v_clean_query IS NULL THEN
    RETURN json_build_object(
      'results',      '[]'::json,
      'layer_used',   0,
      'search_mode',  'none',
      'decs_id',      NULL,
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
  -- ── Structured Path: Hierarchical Search via GiST/LTree ────
  IF v_decs_id IS NOT NULL THEN
    IF EXISTS (
        SELECT 1
        FROM public.decs_tree_paths pp
        JOIN public.decs_tree_paths cp ON cp.tree_path <@ pp.tree_path
        WHERE pp.decs_id = v_decs_id
        LIMIT 1
    ) THEN
      v_search_mode := 'hierarchical';
      WITH best_match AS (
        SELECT qd.question_id,
               MAX(CASE WHEN qd.decs_id = v_decs_id THEN 1.0 ELSE 0.7 END) AS tag_multiplier
        FROM public.decs_tree_paths pp
        JOIN public.decs_tree_paths cp ON cp.tree_path <@ pp.tree_path
        JOIN public.question_decs qd ON qd.decs_id = cp.decs_id
        WHERE pp.decs_id = v_decs_id
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
        'decs_id',        v_decs_id::text,
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
    'decs_id',        v_decs_id::text,
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

-- ── 3. Nova função: search_questions_expand ───────────────────────────────────
-- Escalada hierárquica DeCS: busca questões em irmãos/tios do termo original.
--
-- Como funciona:
--   - Nível 1: descendentes do pai QUE NÃO são descendentes do termo
--              → questões de irmãos e seus descendentes
--   - Nível 2: descendentes do avô QUE NÃO são descendentes do pai
--              → questões de tios e seus descendentes
--   - Suporta termos com múltiplos tree_numbers (todas as árvores em paralelo)
--
-- Estratégia de performance (v3 — single-pass anti-join):
--   1. v_expansion_label: computado antes do CTE principal (query pequena, separada)
--   2. ancestor_info AS MATERIALIZED: 1-2 linhas, avaliado uma única vez
--   3. new_zone_decs: UMA ÚNICA varredura GiST com filtro AND NOT (<@) por linha
--      → elimina o segundo scan GiST e o hash build do EXCEPT
--      → O(N_descendants) em vez de O(N_anc + N_prev + hash)
--   4. expansion_zone AS MATERIALIZED + LIMIT cedo: para de procurar após p_limit*5
--   5. ranked: join final com LIMIT p_limit
--
-- Teste de desempenho (Supabase SQL Editor):
--   EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
--   SELECT search_questions_expand('<uuid_do_decs_id>', 1);
--   Objetivo: < 150ms; deve aparecer Index Scan em decs_tree_paths_gist (1 vez).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.search_questions_expand(
  p_decs_id        UUID,
  p_expansion_level INTEGER DEFAULT 1,
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
  v_results         JSON;
  v_max_level       INTEGER;
  v_expansion_label TEXT;
BEGIN
  -- Profundidade máxima utilizável = nlevel máximo - 1
  SELECT MAX(nlevel(tree_path)) - 1 INTO v_max_level
  FROM public.decs_tree_paths
  WHERE decs_id = p_decs_id;

  -- Sem paths ou nível além do máximo → vazio
  IF v_max_level IS NULL OR p_expansion_level > v_max_level THEN
    RETURN json_build_object(
      'results',         '[]'::json,
      'expansion_level', p_expansion_level,
      'expansion_label', NULL,
      'can_expand_more', false,
      'next_cursor',     NULL
    );
  END IF;

  -- Computar expansion_label separadamente (query pequena, busca por igualdade exata)
  -- Evita subquery correlacionada dentro do json_build_object final.
  SELECT dt.term INTO v_expansion_label
  FROM public.decs_tree_paths src
  JOIN public.decs_tree_paths dtp
    ON dtp.tree_path = subpath(src.tree_path, 0, nlevel(src.tree_path) - p_expansion_level)
  JOIN public.decs_terms dt ON dt.id = dtp.decs_id
  WHERE src.decs_id = p_decs_id
    AND nlevel(src.tree_path) > p_expansion_level
  LIMIT 1;

  WITH
    -- Paths ancestrais (1-2 linhas). MATERIALIZED = avaliado uma única vez.
    ancestor_info AS MATERIALIZED (
      SELECT
        subpath(tree_path, 0, nlevel(tree_path) - p_expansion_level)     AS anc_path,
        subpath(tree_path, 0, nlevel(tree_path) - p_expansion_level + 1) AS prev_anc_path
      FROM public.decs_tree_paths
      WHERE decs_id = p_decs_id
        AND nlevel(tree_path) > p_expansion_level
    ),
    -- UMA ÚNICA varredura GiST: descendentes de anc_path que NÃO são
    -- descendentes de prev_anc_path. O filtro AND NOT (<@) é avaliado
    -- por linha (O(profundidade)) dentro da mesma varredura do índice —
    -- sem segundo scan, sem EXCEPT, sem hash build extra.
    new_zone_decs AS MATERIALIZED (
      SELECT DISTINCT dtp.decs_id
      FROM ancestor_info ai
      JOIN public.decs_tree_paths dtp
        ON dtp.tree_path <@ ai.anc_path
       AND NOT (dtp.tree_path <@ ai.prev_anc_path)
    ),
    -- Question IDs na zona nova (índice B-Tree em question_decs.decs_id)
    expansion_zone AS MATERIALIZED (
      SELECT DISTINCT qd.question_id
      FROM new_zone_decs nz
      JOIN public.question_decs qd ON qd.decs_id = nz.decs_id
      LIMIT p_limit * 5
    ),
    ranked AS (
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
        q.especialidades_tags,
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
        (1.0 / (1.0 + p_expansion_level))
          * GREATEST(0.3, 1.0 - (EXTRACT(YEAR FROM NOW())::INTEGER - q.ano) * 0.02) AS score
      FROM expansion_zone ez
      JOIN public.questions q ON q.id = ez.question_id
      LEFT JOIN public.user_question_history uqh
        ON uqh.question_id = q.id
        AND uqh.user_id = p_user_id
        AND p_user_id IS NOT NULL
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
          OR (
            (1.0 / (1.0 + p_expansion_level))
              * GREATEST(0.3, 1.0 - (EXTRACT(YEAR FROM NOW())::INTEGER - q.ano) * 0.02),
            q.id::text
          ) < (p_last_score, p_last_id::text)
        )
    )
  SELECT json_build_object(
    'results',         COALESCE(json_agg(row_to_json(r.*) ORDER BY r.score DESC, r.id DESC), '[]'::json),
    'expansion_level', p_expansion_level,
    'expansion_label', v_expansion_label,
    'can_expand_more', (p_expansion_level < v_max_level),
    'next_cursor', CASE
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

GRANT EXECUTE ON FUNCTION public.search_questions_expand(
  UUID, INTEGER, TEXT, INTEGER, TEXT, TEXT, TEXT, UUID, BOOLEAN, FLOAT, UUID, INTEGER
) TO authenticated, anon;
