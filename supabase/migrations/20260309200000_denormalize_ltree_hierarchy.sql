-- ============================================================
-- Migration: denormalize_ltree_hierarchy
-- Description:
-- 1. Drops old column, adds decs_hierarquia_encontrada as ltree[]
-- 2. Populates current data aggregated from decs_tree_paths
-- 3. Creates GIN index for arrays of ltrees
-- 4. Creates sync trigger to maintain denormalization
-- 5. Refactors search_questions to use `<@ ANY (array_de_caminhos_do_pai)` 
--    and resolves `json <> json` persistence issue by using text.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS ltree;

-- 1. Migração da Coluna
-- Substituir a coluna existente de texto genérico/array por ltree[] strict
ALTER TABLE public.questions 
  DROP COLUMN IF EXISTS decs_hierarquia_encontrada;

ALTER TABLE public.questions 
  ADD COLUMN decs_hierarquia_encontrada ltree[] DEFAULT '{}'::ltree[];

-- 2. População de dados (DML de UPDATE a partir de question_decs e decs_tree_paths)
UPDATE public.questions q
SET decs_hierarquia_encontrada = COALESCE((
    SELECT array_agg(DISTINCT cp.tree_path)
    FROM public.question_decs qd
    JOIN public.decs_tree_paths cp ON cp.decs_id = qd.decs_id
    WHERE qd.question_id = q.id AND cp.tree_path IS NOT NULL
), '{}'::ltree[])
WHERE EXISTS (
    SELECT 1 
    FROM public.question_decs qd 
    WHERE qd.question_id = q.id
);

-- Garantir que não existam linhas com arrays NULL puramente
UPDATE public.questions
SET decs_hierarquia_encontrada = '{}'::ltree[]
WHERE decs_hierarquia_encontrada IS NULL;

-- 3. Criação de Índice Especializado GIN
CREATE INDEX IF NOT EXISTS idx_questions_decs_hierarquia_gin 
ON public.questions USING GIN (decs_hierarquia_encontrada);

-- 4. Trigger de Sincronização Automática
CREATE OR REPLACE FUNCTION public.fn_sync_question_decs_hierarchy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Rebuild completo para o question_id que sofreu update/insert
        UPDATE public.questions
        SET decs_hierarquia_encontrada = COALESCE((
            SELECT array_agg(DISTINCT cp.tree_path)
            FROM public.question_decs qd
            JOIN public.decs_tree_paths cp ON cp.decs_id = qd.decs_id
            WHERE qd.question_id = NEW.question_id AND cp.tree_path IS NOT NULL
        ), '{}'::ltree[])
        WHERE id = NEW.question_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Rebuild completo para o question_id que perdeu o tag decs
        UPDATE public.questions
        SET decs_hierarquia_encontrada = COALESCE((
            SELECT array_agg(DISTINCT cp.tree_path)
            FROM public.question_decs qd
            JOIN public.decs_tree_paths cp ON cp.decs_id = qd.decs_id
            WHERE qd.question_id = OLD.question_id AND cp.tree_path IS NOT NULL
        ), '{}'::ltree[])
        WHERE id = OLD.question_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_question_decs_hierarchy ON public.question_decs;
CREATE TRIGGER trg_sync_question_decs_hierarchy
AFTER INSERT OR UPDATE OR DELETE ON public.question_decs
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_question_decs_hierarchy();

-- 5. Versão Final Otimizada da Function search_questions
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

  -- ── Structured Path: Hierarchical Search via GiST/GIN on ltree[] ──
  IF v_decs_id IS NOT NULL THEN
    
    -- Identify ALL valid tree paths for the matched term
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
               -- If any of the exact parent path is found in the question's array, we grade it 1.0. 
               -- Otherwise, as a descendant match, we grade it 0.7.
               WHEN q.decs_hierarquia_encontrada::text[] && v_parent_paths::text[] THEN 1.0 
               ELSE 0.7 
             END * GREATEST(0.3, 1.0 - (EXTRACT(YEAR FROM NOW())::INTEGER - q.ano) * 0.02) AS score
        ) s
        LEFT JOIN public.user_question_history uqh
          ON uqh.question_id = q.id AND uqh.user_id = p_user_id AND p_user_id IS NOT NULL
        WHERE
          -- Filtros Otimizados pelo INDICE GIN da Tabela questions
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
        -- Deferred Join: Fetch massive q.* fields only for limited results
        SELECT q2.*, r.score 
        FROM ranked_ids r 
        JOIN public.questions q2 ON q2.id = r.id 
        ORDER BY r.score DESC, r.id DESC
      ) r_out;

      -- Otimização de Tipagem: Resolver erro json <> json convertendo para TEXTO
      IF (v_results->>'results') <> '[]' THEN
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
    -- Deferred Join again, prevents massive sorts for generic FTS requests
    SELECT q2.*, r.score 
    FROM ranked_ids r 
    JOIN public.questions q2 ON q2.id = r.id 
    ORDER BY r.score DESC, r.id DESC
  ) r_out;

  RETURN v_results;
END;
$$;
