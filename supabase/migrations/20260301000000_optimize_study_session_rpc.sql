-- ============================================================
-- Migration: Optimize get_study_session_questions for performance
-- ============================================================
-- 1. Fix calculate_retrievability volatility (IMMUTABLE -> STABLE)
-- 2. Inline retrievability calculation via LATERAL to avoid double function calls
-- 3. Replace LECTOR correlated subquery with JOIN via question_decs
-- 4. Reduce TABLESAMPLE SYSTEM(10) -> SYSTEM(2) for lighter backfill
-- ============================================================

-- ── 1. Fix calculate_retrievability volatility ──────────────────────────────
-- Using NOW() makes it STABLE, not IMMUTABLE.
CREATE OR REPLACE FUNCTION public.calculate_retrievability(
    p_stability   FLOAT,
    p_last_review TIMESTAMPTZ
)
RETURNS FLOAT
LANGUAGE sql
STABLE
AS $$
    SELECT
        CASE
            WHEN p_last_review IS NULL THEN 0.0
            WHEN p_stability IS NULL OR p_stability <= 0 THEN 0.0
            ELSE POWER(
                0.9,
                EXTRACT(EPOCH FROM (NOW() - p_last_review)) / 86400.0 / p_stability
            )
        END;
$$;

-- ── 2. Optimized get_study_session_questions ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_study_session_questions(
    p_user_id        UUID,
    p_limit          INTEGER DEFAULT 20,
    p_hide_answered  BOOLEAN DEFAULT FALSE,
    p_banca          TEXT    DEFAULT NULL,
    p_ano            INTEGER DEFAULT NULL,
    p_campo          TEXT    DEFAULT NULL,
    p_especialidade  TEXT    DEFAULT NULL,
    p_tema           TEXT    DEFAULT NULL
)
RETURNS SETOF public.questions
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
                SELECT DISTINCT output_especialidade
                FROM public.questions
                WHERE (p_banca         IS NULL OR banca               = p_banca)
                  AND (p_ano           IS NULL OR ano                 = p_ano)
                  AND (p_campo         IS NULL OR output_grande_area  = p_campo)
                  AND (p_especialidade IS NULL OR output_especialidade = p_especialidade)
                  AND (p_tema          IS NULL OR output_tema         = p_tema)
                  AND (tem_anomalia IS NULL OR tem_anomalia != 1)
                  AND output_especialidade IS NOT NULL
            ) esp
            CROSS JOIN LATERAL (
                SELECT q.*
                FROM public.questions q
                WHERE q.output_especialidade = esp.output_especialidade
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
            id, banca, ano, enunciado, imagem_url, opcoes, resposta_correta,
            status_imagem, referencia_imagem, alternativa_a, alternativa_b,
            alternativa_c, alternativa_d, alternativa_e, especialidade,
            output_gabarito, output_explicacao, output_grande_area,
            output_especialidade, output_tema, output_subtema,
            output_taxa_certeza, processado, created_at, id_integracao
        FROM sampled_per_specialty
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

    -- 1. SRS: Optimized with LATERAL to calculate weight once
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
          AND (p_banca         IS NULL OR q.banca               = p_banca)
          AND (p_ano           IS NULL OR q.ano                 = p_ano)
          AND (p_campo         IS NULL OR q.output_grande_area  = p_campo)
          AND (p_especialidade IS NULL OR q.output_especialidade = p_especialidade)
          AND (p_tema          IS NULL OR q.output_tema         = p_tema)
          AND (q.tem_anomalia  IS NULL OR q.tem_anomalia        != 1)
          AND (NOT p_hide_answered OR NOT EXISTS (
              SELECT 1 FROM answered_ids ai WHERE ai.question_id = q.id
          ))
        ORDER BY r.retrievability ASC
        LIMIT v_srs_limit
    ),

    -- 2. Weak themes
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
        WHERE (p_banca         IS NULL OR q.banca               = p_banca)
          AND (p_ano           IS NULL OR q.ano                 = p_ano)
          AND (p_campo         IS NULL OR q.output_grande_area  = p_campo)
          AND (p_especialidade IS NULL OR q.output_especialidade = p_especialidade)
          AND (q.tem_anomalia  IS NULL OR q.tem_anomalia        != 1)
          AND NOT EXISTS (SELECT 1 FROM answered_ids    ai WHERE ai.question_id = q.id)
          AND NOT EXISTS (SELECT 1 FROM srs_due         sr WHERE sr.id          = q.id)
        ORDER BY wt.mastery_score ASC, RANDOM()
        LIMIT v_weak_limit
    ),

    -- 3. Discovery
    discovery_questions AS MATERIALIZED (
        SELECT q.*, 3 AS priority, RANDOM() AS weight
        FROM public.questions q
        LEFT JOIN public.user_theme_stats uts
               ON q.output_tema = uts.theme_name AND uts.user_id = p_user_id
        WHERE (p_banca         IS NULL OR q.banca               = p_banca)
          AND (p_ano           IS NULL OR q.ano                 = p_ano)
          AND (p_campo         IS NULL OR q.output_grande_area  = p_campo)
          AND (p_especialidade IS NULL OR q.output_especialidade = p_especialidade)
          AND (p_tema          IS NULL OR q.output_tema         = p_tema)
          AND (q.tem_anomalia  IS NULL OR q.tem_anomalia        != 1)
          AND uts.theme_name IS NULL
          AND NOT EXISTS (SELECT 1 FROM answered_ids         ai WHERE ai.question_id = q.id)
          AND NOT EXISTS (SELECT 1 FROM srs_due              sr WHERE sr.id          = q.id)
          AND NOT EXISTS (SELECT 1 FROM weak_theme_questions wt WHERE wt.id          = q.id)
        ORDER BY RANDOM()
        LIMIT v_discovery_limit
    ),

    -- 4. General backfill: Reduced TABLESAMPLE SYSTEM(10) -> SYSTEM(2)
    general_new AS (
        SELECT q.*, 4 AS priority, RANDOM() AS weight
        FROM public.questions TABLESAMPLE SYSTEM(2) q
        WHERE (p_banca         IS NULL OR q.banca               = p_banca)
          AND (p_ano           IS NULL OR q.ano                 = p_ano)
          AND (p_campo         IS NULL OR q.output_grande_area  = p_campo)
          AND (p_especialidade IS NULL OR q.output_especialidade = p_especialidade)
          AND (p_tema          IS NULL OR q.output_tema         = p_tema)
          AND (q.tem_anomalia  IS NULL OR q.tem_anomalia        != 1)
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

    -- 6. LECTOR: Optimized via JOIN on question_decs junction table
    candidates_with_branch AS (
        SELECT
            ac.*,
            COALESCE(
                (SELECT SPLIT_PART(MIN(tn), '.', 1)
                 FROM public.question_decs qd
                 JOIN public.decs_terms dt ON qd.decs_id = dt.id,
                      unnest(dt.tree_numbers) AS tn
                 WHERE qd.question_id = ac.id),
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

    SELECT
        id, banca, ano, enunciado, imagem_url, opcoes, resposta_correta,
        status_imagem, referencia_imagem, alternativa_a, alternativa_b,
        alternativa_c, alternativa_d, alternativa_e, especialidade,
        output_gabarito, output_explicacao, output_grande_area,
        output_especialidade, output_tema, output_subtema,
        output_taxa_certeza, processado, created_at, id_integracao
    FROM lector_filtered
    WHERE branch_rank <= v_lector_max_per_branch
    ORDER BY priority ASC, weight DESC
    LIMIT p_limit;
END;
$$;
