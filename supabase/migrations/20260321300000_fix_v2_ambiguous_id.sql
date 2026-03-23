-- ============================================================
-- Fix: get_study_session_questions_v2 — column reference "id" is ambiguous
--
-- Problema: a função usa RETURNS TABLE(id UUID, banca TEXT, ...).
-- Em PL/pgSQL, cada coluna do RETURNS TABLE vira uma variável OUT em escopo
-- por toda a função. No SELECT final, sem qualificação de tabela, o PostgreSQL
-- não distingue entre o parâmetro OUT "id" e a coluna "id" do CTE lector_filtered.
--
-- Fix: adicionar alias "lf" em FROM lector_filtered e qualificar todas as
-- colunas do SELECT final com "lf.", eliminando a ambiguidade.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_study_session_questions_v2(
    p_user_id        UUID,
    p_limit          INTEGER DEFAULT 20,
    p_hide_answered  BOOLEAN DEFAULT FALSE,
    p_banca          TEXT    DEFAULT NULL,
    p_ano            INTEGER DEFAULT NULL,
    p_campo          TEXT    DEFAULT NULL,
    p_especialidade  TEXT    DEFAULT NULL,
    p_tema           TEXT    DEFAULT NULL
)
RETURNS TABLE(
    id                          UUID,
    banca                       TEXT,
    ano                         INTEGER,
    enunciado                   TEXT,
    imagem_url                  TEXT,
    opcoes                      JSONB,
    resposta_correta            INTEGER,
    status_imagem               INTEGER,
    referencia_imagem           TEXT,
    alternativa_a               TEXT,
    alternativa_b               TEXT,
    alternativa_c               TEXT,
    alternativa_d               TEXT,
    alternativa_e               TEXT,
    especialidade               TEXT,
    output_gabarito             TEXT,
    output_explicacao           TEXT,
    output_grande_area          TEXT,
    output_especialidade        TEXT,
    output_tema                 TEXT,
    output_subtema              TEXT,
    output_taxa_certeza         DOUBLE PRECISION,
    processado                  INTEGER,
    created_at                  TIMESTAMPTZ,
    id_integracao               TEXT,
    decs_hierarquia_encontrada  LTREE[],
    source_bucket               TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_srs_limit       INTEGER;
    v_weak_limit      INTEGER;
    v_discovery_limit INTEGER;
    v_total_answered  INTEGER;
    v_lector_max_per_branch INTEGER := 2;
BEGIN
    SELECT COUNT(*) INTO v_total_answered
    FROM public.user_question_history
    WHERE user_id = p_user_id;

    -- ── COLD START (< 50 questions answered) ──────────────────────────────────
    IF v_total_answered < 50 THEN
        RETURN QUERY
        WITH sampled_per_specialty AS (
            SELECT q2.*
            FROM (
                SELECT DISTINCT unnest(especialidades_tags) AS tag
                FROM public.questions
                WHERE (p_banca         IS NULL OR banca              = p_banca)
                  AND (p_ano           IS NULL OR ano                = p_ano)
                  AND (p_campo         IS NULL OR output_grande_area = p_campo)
                  AND (p_especialidade IS NULL OR p_especialidade = ANY(especialidades_tags))
                  AND (p_tema          IS NULL OR output_tema        = p_tema)
                  AND (tem_anomalia IS NULL OR tem_anomalia != 1)
                  AND especialidades_tags IS NOT NULL
                  AND cardinality(especialidades_tags) > 0
            ) esp
            CROSS JOIN LATERAL (
                SELECT q.*
                FROM public.questions q
                WHERE esp.tag = ANY(q.especialidades_tags)
                  AND (p_banca IS NULL OR q.banca             = p_banca)
                  AND (p_ano   IS NULL OR q.ano               = p_ano)
                  AND (p_campo IS NULL OR q.output_grande_area = p_campo)
                  AND (p_tema  IS NULL OR q.output_tema        = p_tema)
                  AND (q.tem_anomalia IS NULL OR q.tem_anomalia != 1)
                  AND NOT EXISTS (
                      SELECT 1 FROM public.user_question_history uqh
                      WHERE uqh.user_id = p_user_id AND uqh.question_id = q.id
                  )
                ORDER BY RANDOM()
                LIMIT 2
            ) q2
        )
        SELECT
            q.id, q.banca, q.ano, q.enunciado, q.imagem_url, q.opcoes, q.resposta_correta,
            q.status_imagem, q.referencia_imagem, q.alternativa_a, q.alternativa_b,
            q.alternativa_c, q.alternativa_d, q.alternativa_e, q.especialidade,
            q.output_gabarito, q.output_explicacao, q.output_grande_area,
            q.output_especialidade, q.output_tema, q.output_subtema,
            q.output_taxa_certeza, q.processado, q.created_at, q.id_integracao,
            q.decs_hierarquia_encontrada,
            'cold_start'::TEXT AS source_bucket
        FROM sampled_per_specialty q
        ORDER BY RANDOM()
        LIMIT p_limit;
        RETURN;
    END IF;

    -- ── STANDARD LOGIC (>= 50 questions answered) ─────────────────────────────
    v_srs_limit       := CEIL(p_limit * 0.25);
    v_weak_limit      := CEIL(p_limit * 0.25);
    v_discovery_limit := CEIL(p_limit * 0.25);

    RETURN QUERY
    WITH
    answered_ids AS MATERIALIZED (
        SELECT question_id
        FROM public.user_question_history
        WHERE user_id = p_user_id
    ),

    srs_due AS MATERIALIZED (
        SELECT q.*, 1 AS priority, r.retrievability AS weight
        FROM public.questions q
        JOIN public.user_spaced_repetition s ON q.id = s.question_id
        CROSS JOIN LATERAL (
            SELECT
                CASE
                    WHEN s.stability IS NOT NULL AND s.stability > 0 THEN
                        public.calculate_retrievability(s.stability, s.last_reviewed)
                    ELSE
                        GREATEST(0.0, 1.0 - EXTRACT(EPOCH FROM (NOW() - s.next_review)) / 86400.0 / 10.0)
                END AS retrievability
        ) r
        WHERE s.user_id = p_user_id
          AND (
              (s.stability IS NOT NULL AND s.stability > 0 AND r.retrievability < 0.9)
              OR
              (s.stability IS NULL AND s.next_review <= NOW())
          )
          AND (p_banca         IS NULL OR q.banca              = p_banca)
          AND (p_ano           IS NULL OR q.ano                = p_ano)
          AND (p_campo         IS NULL OR q.output_grande_area = p_campo)
          AND (p_especialidade IS NULL OR p_especialidade = ANY(q.especialidades_tags))
          AND (p_tema          IS NULL OR q.output_tema        = p_tema)
          AND (q.tem_anomalia  IS NULL OR q.tem_anomalia       != 1)
          AND (NOT p_hide_answered OR NOT EXISTS (
              SELECT 1 FROM answered_ids ai WHERE ai.question_id = q.id
          ))
        ORDER BY r.retrievability ASC
        LIMIT v_srs_limit
    ),

    weak_themes AS (
        SELECT theme_name, mastery_score
        FROM public.user_theme_stats
        WHERE user_id = p_user_id AND mastery_score < 0.75
        ORDER BY mastery_score ASC, total_answered DESC
        LIMIT 10
    ),
    weak_theme_questions AS MATERIALIZED (
        SELECT q.*, 2 AS priority, (1.0 - wt.mastery_score) AS weight
        FROM public.questions q
        JOIN weak_themes wt ON q.output_tema = wt.theme_name
        WHERE (p_banca         IS NULL OR q.banca              = p_banca)
          AND (p_ano           IS NULL OR q.ano                = p_ano)
          AND (p_campo         IS NULL OR q.output_grande_area = p_campo)
          AND (p_especialidade IS NULL OR p_especialidade = ANY(q.especialidades_tags))
          AND (q.tem_anomalia  IS NULL OR q.tem_anomalia       != 1)
          AND NOT EXISTS (SELECT 1 FROM answered_ids    ai WHERE ai.question_id = q.id)
          AND NOT EXISTS (SELECT 1 FROM srs_due         sr WHERE sr.id          = q.id)
        ORDER BY wt.mastery_score ASC
        LIMIT v_weak_limit
    ),

    discovery_questions AS MATERIALIZED (
        SELECT q.*, 3 AS priority, RANDOM() AS weight
        FROM public.questions AS q TABLESAMPLE SYSTEM(5)
        LEFT JOIN public.user_theme_stats uts
               ON q.output_tema = uts.theme_name AND uts.user_id = p_user_id
        WHERE (p_banca         IS NULL OR q.banca              = p_banca)
          AND (p_ano           IS NULL OR q.ano                = p_ano)
          AND (p_campo         IS NULL OR q.output_grande_area = p_campo)
          AND (p_especialidade IS NULL OR p_especialidade = ANY(q.especialidades_tags))
          AND (p_tema          IS NULL OR q.output_tema        = p_tema)
          AND (q.tem_anomalia  IS NULL OR q.tem_anomalia       != 1)
          AND uts.theme_name IS NULL
          AND NOT EXISTS (SELECT 1 FROM answered_ids         ai WHERE ai.question_id = q.id)
          AND NOT EXISTS (SELECT 1 FROM srs_due              sr WHERE sr.id          = q.id)
          AND NOT EXISTS (SELECT 1 FROM weak_theme_questions wt WHERE wt.id          = q.id)
        LIMIT v_discovery_limit
    ),

    general_new AS (
        SELECT q.*, 4 AS priority, RANDOM() AS weight
        FROM public.questions AS q TABLESAMPLE SYSTEM(2)
        WHERE (p_banca         IS NULL OR q.banca              = p_banca)
          AND (p_ano           IS NULL OR q.ano                = p_ano)
          AND (p_campo         IS NULL OR q.output_grande_area = p_campo)
          AND (p_especialidade IS NULL OR p_especialidade = ANY(q.especialidades_tags))
          AND (p_tema          IS NULL OR q.output_tema        = p_tema)
          AND (q.tem_anomalia  IS NULL OR q.tem_anomalia       != 1)
          AND NOT EXISTS (SELECT 1 FROM answered_ids         ai WHERE ai.question_id = q.id)
          AND NOT EXISTS (SELECT 1 FROM srs_due              sr WHERE sr.id          = q.id)
          AND NOT EXISTS (SELECT 1 FROM weak_theme_questions wt WHERE wt.id          = q.id)
          AND NOT EXISTS (SELECT 1 FROM discovery_questions  dq WHERE dq.id          = q.id)
        LIMIT p_limit
    ),

    all_candidates AS (
        SELECT * FROM srs_due
        UNION ALL
        SELECT * FROM weak_theme_questions
        UNION ALL
        SELECT * FROM discovery_questions
        UNION ALL
        SELECT * FROM general_new
    ),

    candidates_with_branch AS (
        SELECT
            ac.*,
            COALESCE(
                SPLIT_PART(
                    (SELECT MIN(h::TEXT) FROM unnest(ac.decs_hierarquia_encontrada) h),
                    '.', 1
                ),
                'UNCONSTRAINED_' || ac.id::TEXT
            ) AS lector_branch
        FROM all_candidates ac
    ),

    lector_filtered AS (
        SELECT *,
               ROW_NUMBER() OVER (
                   PARTITION BY lector_branch
                   ORDER BY priority ASC, weight DESC
               ) AS branch_rank
        FROM candidates_with_branch
    )

    -- FIX: alias "lf" elimina ambiguidade entre coluna "id" do CTE
    -- e o parâmetro OUT "id" do RETURNS TABLE.
    SELECT
        lf.id, lf.banca, lf.ano, lf.enunciado, lf.imagem_url, lf.opcoes, lf.resposta_correta,
        lf.status_imagem, lf.referencia_imagem, lf.alternativa_a, lf.alternativa_b,
        lf.alternativa_c, lf.alternativa_d, lf.alternativa_e, lf.especialidade,
        lf.output_gabarito, lf.output_explicacao, lf.output_grande_area,
        lf.output_especialidade, lf.output_tema, lf.output_subtema,
        lf.output_taxa_certeza, lf.processado, lf.created_at, lf.id_integracao,
        lf.decs_hierarquia_encontrada,
        CASE lf.priority
            WHEN 1 THEN 'srs'
            WHEN 2 THEN 'weak_theme'
            WHEN 3 THEN 'discovery'
            WHEN 4 THEN 'general'
            ELSE 'unknown'
        END::TEXT AS source_bucket
    FROM lector_filtered lf
    WHERE lf.branch_rank <= v_lector_max_per_branch
    ORDER BY lf.priority ASC, lf.weight DESC
    LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_study_session_questions_v2(UUID,INTEGER,BOOLEAN,TEXT,INTEGER,TEXT,TEXT,TEXT) TO authenticated;
