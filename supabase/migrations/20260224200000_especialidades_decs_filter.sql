-- ============================================================
-- Migration: Filtro Especialidade → especialidades_tags (TEXT[])
-- ============================================================
-- Substitui output_especialidade pelo array DeCS já validado.
-- Mudanças:
--   1. get_question_metadata_summary — unnest(especialidades_tags)
--      Sem validação contra decs_terms (termos já são DeCS).
--      Tema continua validado como antes.
--   2. get_study_session_questions  — p_especialidade = ANY(especialidades_tags)
--   3. search_questions             — p_especialidade = ANY(q.especialidades_tags)
-- ============================================================


-- ============================================================
-- 1. get_question_metadata_summary
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_question_metadata_summary()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result       json;
    combinations json;
    stats        json;
BEGIN
    WITH
    -- Step 1: Unnest especialidades_tags para tratar cada termo individualmente.
    -- Questões sem especialidades (NULL ou array vazio) geram uma linha com especialidade = ''.
    unnested AS (
        SELECT
            banca,
            ano,
            output_grande_area          AS grande_area,
            output_tema                 AS raw_tema,
            UNNEST(
                COALESCE(NULLIF(especialidades_tags, ARRAY[]::TEXT[]), ARRAY['']::TEXT[])
            ) AS especialidade
        FROM public.questions
        WHERE tem_anomalia IS NULL OR tem_anomalia != 1
    ),

    -- Step 2: Agrupa por todas as 5 dimensões e conta questões
    raw_counts AS (
        SELECT
            banca,
            ano,
            especialidade,
            grande_area,
            raw_tema,
            COUNT(*) AS q_count
        FROM unnested
        GROUP BY banca, ano, especialidade, grande_area, raw_tema
    ),

    -- Step 3: Valida apenas output_tema contra DeCS (especialidade já é DeCS)
    validated AS (
        SELECT
            r.banca,
            r.ano,
            r.grande_area,
            r.q_count,
            r.especialidade,
            CASE WHEN dt.clean_term IS NOT NULL THEN r.raw_tema ELSE '' END AS tema
        FROM raw_counts r
        LEFT JOIN public.decs_terms dt ON lower(trim(r.raw_tema)) = dt.clean_term
    ),

    -- Step 4: Re-agrega (temas que viraram '' se somam)
    aggregated AS (
        SELECT
            banca, ano, especialidade, grande_area, tema,
            SUM(q_count) AS q_count
        FROM validated
        GROUP BY banca, ano, especialidade, grande_area, tema
    )

    SELECT json_agg(
        json_build_array(banca, ano, especialidade, grande_area, tema, q_count)
    )
    INTO combinations
    FROM aggregated;

    -- Stats (inalterado)
    SELECT json_build_object(
        'total_questions', (SELECT COUNT(*) FROM public.questions),
        'unique_bancas',   (SELECT COUNT(DISTINCT banca) FROM public.questions),
        'unique_areas',    (SELECT COUNT(DISTINCT output_grande_area) FROM public.questions)
    ) INTO stats;

    result := json_build_object(
        'combinations', COALESCE(combinations, '[]'::json),
        'stats',        stats,
        'generated_at', now()
    );

    RETURN result;
END;
$$;


-- ============================================================
-- 2. get_study_session_questions
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_study_session_questions(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_hide_answered BOOLEAN DEFAULT FALSE,
    p_banca TEXT DEFAULT NULL,
    p_ano INTEGER DEFAULT NULL,
    p_campo TEXT DEFAULT NULL,
    p_especialidade TEXT DEFAULT NULL,
    p_tema TEXT DEFAULT NULL
)
RETURNS SETOF public.questions
LANGUAGE plpgsql
AS $$
DECLARE
    v_srs_ratio FLOAT := 0.25;
    v_weak_ratio FLOAT := 0.25;
    v_discovery_ratio FLOAT := 0.25;

    v_srs_limit INTEGER;
    v_weak_limit INTEGER;
    v_discovery_limit INTEGER;

    v_total_answered INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_answered
    FROM public.user_question_history
    WHERE user_id = p_user_id;

    -- COLD START (<50 questões respondidas)
    IF v_total_answered < 50 THEN
        RETURN QUERY
        WITH
        filtered_pool AS (
            SELECT * FROM public.questions
            WHERE (p_banca IS NULL OR banca = p_banca)
              AND (p_ano IS NULL OR ano = p_ano)
              AND (p_campo IS NULL OR output_grande_area = p_campo)
              AND (p_especialidade IS NULL OR p_especialidade = ANY(especialidades_tags))
              AND (p_tema IS NULL OR output_tema = p_tema)
              AND (tem_anomalia IS NULL OR tem_anomalia != 1)
        ),
        answered_ids AS (
            SELECT DISTINCT question_id FROM public.user_question_history WHERE user_id = p_user_id
        ),
        equitable_candidates AS (
            SELECT *,
                   ROW_NUMBER() OVER (PARTITION BY output_especialidade ORDER BY RANDOM()) AS rnk
            FROM filtered_pool
            WHERE id NOT IN (SELECT question_id FROM answered_ids)
        )
        SELECT
            id, banca, ano, enunciado, imagem_url, opcoes, resposta_correta,
            status_imagem, referencia_imagem, alternativa_a, alternativa_b,
            alternativa_c, alternativa_d, alternativa_e, especialidade,
            output_gabarito, output_explicacao, output_grande_area,
            output_especialidade, output_tema, output_subtema,
            output_taxa_certeza, processado, created_at, id_integracao,
            especialidades_tags
        FROM equitable_candidates
        ORDER BY rnk ASC, RANDOM()
        LIMIT p_limit;

        RETURN;
    END IF;

    -- STANDARD LOGIC (>=50 questões respondidas)
    v_srs_limit := CEIL(p_limit * v_srs_ratio);
    v_weak_limit := CEIL(p_limit * v_weak_ratio);
    v_discovery_limit := CEIL(p_limit * v_discovery_ratio);

    RETURN QUERY
    WITH
    filtered_pool AS (
        SELECT * FROM public.questions
        WHERE (p_banca IS NULL OR banca = p_banca)
          AND (p_ano IS NULL OR ano = p_ano)
          AND (p_campo IS NULL OR output_grande_area = p_campo)
          AND (p_especialidade IS NULL OR p_especialidade = ANY(especialidades_tags))
          AND (p_tema IS NULL OR output_tema = p_tema)
          AND (tem_anomalia IS NULL OR tem_anomalia != 1)
    ),
    answered_ids AS (
        SELECT DISTINCT question_id FROM public.user_question_history WHERE user_id = p_user_id
    ),

    -- 1. SRS
    srs_due AS (
        SELECT q.*, 1 AS priority,
               (1.0 / (EXTRACT(EPOCH FROM (NOW() - s.next_review)) + 1)) AS weight
        FROM filtered_pool q
        JOIN public.user_spaced_repetition s ON q.id = s.question_id
        WHERE s.user_id = p_user_id AND s.next_review <= NOW()
          AND (NOT p_hide_answered OR q.id NOT IN (SELECT question_id FROM answered_ids))
        ORDER BY s.next_review ASC LIMIT v_srs_limit
    ),

    -- 2. Weak Themes
    weak_themes AS (
        SELECT theme_name, mastery_score FROM public.user_theme_stats
        WHERE user_id = p_user_id AND mastery_score < 0.75
        ORDER BY mastery_score ASC, total_answered DESC LIMIT 10
    ),
    weak_theme_questions AS (
        SELECT q.*, 2 AS priority, (1.0 - wt.mastery_score) AS weight
        FROM filtered_pool q
        JOIN weak_themes wt ON q.output_tema = wt.theme_name
        WHERE q.id NOT IN (SELECT question_id FROM answered_ids)
          AND q.id NOT IN (SELECT id FROM srs_due)
        ORDER BY wt.mastery_score ASC, RANDOM() LIMIT v_weak_limit
    ),

    -- 3. Discovery
    discovery_questions AS (
        SELECT q.*, 3 AS priority, RANDOM() AS weight
        FROM filtered_pool q
        WHERE q.id NOT IN (SELECT question_id FROM answered_ids)
          AND q.id NOT IN (SELECT id FROM srs_due)
          AND q.id NOT IN (SELECT id FROM weak_theme_questions)
          AND q.output_tema NOT IN (SELECT theme_name FROM public.user_theme_stats WHERE user_id = p_user_id)
        ORDER BY RANDOM() LIMIT v_discovery_limit
    ),

    -- 4. General / Random Backfill
    general_new AS (
        SELECT q.*, 4 AS priority, RANDOM() AS weight
        FROM filtered_pool q
        WHERE q.id NOT IN (SELECT question_id FROM answered_ids)
          AND q.id NOT IN (SELECT id FROM srs_due)
          AND q.id NOT IN (SELECT id FROM weak_theme_questions)
          AND q.id NOT IN (SELECT id FROM discovery_questions)
        ORDER BY RANDOM() LIMIT p_limit
    ),

    all_candidates AS (
        SELECT * FROM srs_due
        UNION ALL SELECT * FROM weak_theme_questions
        UNION ALL SELECT * FROM discovery_questions
        UNION ALL SELECT * FROM general_new
    )
    SELECT
        id, banca, ano, enunciado, imagem_url, opcoes, resposta_correta,
        status_imagem, referencia_imagem, alternativa_a, alternativa_b,
        alternativa_c, alternativa_d, alternativa_e, especialidade,
        output_gabarito, output_explicacao, output_grande_area,
        output_especialidade, output_tema, output_subtema,
        output_taxa_certeza, processado, created_at, id_integracao,
        especialidades_tags
    FROM all_candidates
    ORDER BY priority ASC, weight DESC
    LIMIT p_limit;
END;
$$;


-- ============================================================
-- 3. search_questions — apenas muda o filtro de especialidade
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
  v_clean_query := lower(trim(p_query));

  IF v_clean_query = '' OR v_clean_query IS NULL THEN
    RETURN json_build_object(
      'results', '[]'::json,
      'layer_used', 0,
      'next_cursor', NULL
    );
  END IF;

  v_word_count := array_length(regexp_split_to_array(trim(v_clean_query), '\s+'), 1);

  -- LAYER 1: Exact DeCS match
  SELECT clean_term INTO v_decs_term
  FROM public.decs_terms
  WHERE clean_term = v_clean_query
  LIMIT 1;

  IF v_decs_term IS NOT NULL THEN
    v_layer_used := 1;
  END IF;

  -- LAYER 2: Fuzzy/Typo correction (short queries only)
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

  -- Build tsquery
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

  -- MAIN QUERY
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
      ON uqh.question_id = q.id
      AND uqh.user_id = p_user_id
      AND p_user_id IS NOT NULL
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

GRANT EXECUTE ON FUNCTION public.search_questions(
  TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, UUID, BOOLEAN, FLOAT, UUID, INTEGER
) TO authenticated, anon;
