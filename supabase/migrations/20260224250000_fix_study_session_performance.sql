-- ============================================================
-- Migration: Fix study session query timeouts
-- ============================================================
-- Root causes fixed:
--   1. Missing B-Tree indexes on questions filter columns
--      → Every filter query was a full sequential scan
--   2. NOT IN (SELECT ...) anti-pattern in cascading CTEs
--      → Replaced with NOT EXISTS (index-backed)
--   3. Cold start: ROW_NUMBER() OVER (PARTITION BY ... ORDER BY RANDOM())
--      applied to the entire question pool (~100k rows globally)
--      → Replaced with LATERAL JOIN per specialty (sorts ~few hundred rows per specialty)
--   4. general_new: ORDER BY RANDOM() on entire filtered pool
--      → Replaced with TABLESAMPLE SYSTEM(10) (reads ~10% of pages, no sort needed)
--   5. filtered_pool CTE had no tem_anomalia filter
--      → Anomalous questions now excluded at source in all paths
-- ============================================================


-- ── 1. Indexes on questions filter columns ────────────────────────────────────

-- Individual filter columns (used in WHERE clauses with = operator)
CREATE INDEX IF NOT EXISTS idx_questions_banca
  ON public.questions (banca);

CREATE INDEX IF NOT EXISTS idx_questions_ano
  ON public.questions (ano);

CREATE INDEX IF NOT EXISTS idx_questions_grande_area
  ON public.questions (output_grande_area);

CREATE INDEX IF NOT EXISTS idx_questions_especialidade
  ON public.questions (output_especialidade);

CREATE INDEX IF NOT EXISTS idx_questions_tema
  ON public.questions (output_tema);

-- Partial index: only indexes the rare rows that DO have anomalies.
-- This makes (tem_anomalia IS NULL OR tem_anomalia != 1) cheap to evaluate.
CREATE INDEX IF NOT EXISTS idx_questions_has_anomalia
  ON public.questions (tem_anomalia)
  WHERE tem_anomalia = 1;

-- Composite for the most common multi-filter path
CREATE INDEX IF NOT EXISTS idx_questions_area_esp_tema
  ON public.questions (output_grande_area, output_especialidade, output_tema);


-- ── 2. Indexes on related tables ─────────────────────────────────────────────

-- Critical for NOT EXISTS checks in every CTE path
CREATE INDEX IF NOT EXISTS idx_uqh_user_question
  ON public.user_question_history (user_id, question_id);

-- SRS due-date query
CREATE INDEX IF NOT EXISTS idx_usr_user_next_review
  ON public.user_spaced_repetition (user_id, next_review);

-- Discovery LEFT JOIN
CREATE INDEX IF NOT EXISTS idx_uts_user_theme
  ON public.user_theme_stats (user_id, theme_name);


-- ── 3. Rewrite get_study_session_questions ────────────────────────────────────

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
    v_srs_ratio       FLOAT := 0.25;
    v_weak_ratio      FLOAT := 0.25;
    v_discovery_ratio FLOAT := 0.25;

    v_srs_limit       INTEGER;
    v_weak_limit      INTEGER;
    v_discovery_limit INTEGER;

    v_total_answered  INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_answered
    FROM public.user_question_history
    WHERE user_id = p_user_id;

    -- ── COLD START (< 50 questions answered) ──────────────────────────────
    -- Instead of ROW_NUMBER() OVER (PARTITION BY ... ORDER BY RANDOM()) on
    -- the entire pool, we LATERAL JOIN per specialty so each per-specialty
    -- ORDER BY RANDOM() sorts only ~hundreds of rows, not ~100k.
    IF v_total_answered < 50 THEN
        RETURN QUERY
        WITH sampled_per_specialty AS (
            SELECT q2.*
            FROM (
                -- Distinct specialties that have unanswered questions
                SELECT DISTINCT output_especialidade
                FROM public.questions
                WHERE (p_banca          IS NULL OR banca               = p_banca)
                  AND (p_ano            IS NULL OR ano                 = p_ano)
                  AND (p_campo          IS NULL OR output_grande_area  = p_campo)
                  AND (p_especialidade  IS NULL OR output_especialidade = p_especialidade)
                  AND (p_tema           IS NULL OR output_tema         = p_tema)
                  AND (tem_anomalia IS NULL OR tem_anomalia != 1)
                  AND output_especialidade IS NOT NULL
            ) esp
            CROSS JOIN LATERAL (
                -- 2 random candidates per specialty (cheap: index scan + tiny sort)
                SELECT q.*
                FROM public.questions q
                WHERE q.output_especialidade = esp.output_especialidade
                  AND (p_banca         IS NULL OR q.banca               = p_banca)
                  AND (p_ano           IS NULL OR q.ano                 = p_ano)
                  AND (p_campo         IS NULL OR q.output_grande_area  = p_campo)
                  AND (p_tema          IS NULL OR q.output_tema         = p_tema)
                  AND (q.tem_anomalia  IS NULL OR q.tem_anomalia        != 1)
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

    -- ── STANDARD LOGIC (>= 50 questions answered) ─────────────────────────
    v_srs_limit       := CEIL(p_limit * v_srs_ratio);
    v_weak_limit      := CEIL(p_limit * v_weak_ratio);
    v_discovery_limit := CEIL(p_limit * v_discovery_ratio);

    RETURN QUERY
    WITH
    -- Materialized once; all subsequent NOT EXISTS reference this in-memory set.
    answered_ids AS MATERIALIZED (
        SELECT question_id
        FROM public.user_question_history
        WHERE user_id = p_user_id
    ),

    -- 1. SRS: questions due for spaced-repetition review
    srs_due AS MATERIALIZED (
        SELECT q.*, 1 AS priority,
               (1.0 / (EXTRACT(EPOCH FROM (NOW() - s.next_review)) + 1)) AS weight
        FROM public.questions q
        JOIN public.user_spaced_repetition s ON q.id = s.question_id
        WHERE s.user_id          = p_user_id
          AND s.next_review      <= NOW()
          AND (p_banca         IS NULL OR q.banca               = p_banca)
          AND (p_ano           IS NULL OR q.ano                 = p_ano)
          AND (p_campo         IS NULL OR q.output_grande_area  = p_campo)
          AND (p_especialidade IS NULL OR q.output_especialidade = p_especialidade)
          AND (p_tema          IS NULL OR q.output_tema         = p_tema)
          AND (q.tem_anomalia  IS NULL OR q.tem_anomalia        != 1)
          AND (NOT p_hide_answered OR NOT EXISTS (
              SELECT 1 FROM answered_ids ai WHERE ai.question_id = q.id
          ))
        ORDER BY s.next_review ASC
        LIMIT v_srs_limit
    ),

    -- 2. Weak themes: topics where mastery < 75%
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

    -- 3. Discovery: topics not yet in user_theme_stats (never studied)
    --    LEFT JOIN + IS NULL replaces NOT IN (SELECT theme_name FROM user_theme_stats)
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

    -- 4. General backfill
    --    TABLESAMPLE SYSTEM(10) scans ~10% of physical pages in O(pages/10)
    --    instead of the full table. No sort required — page-level randomness
    --    is sufficient for a backfill bucket.
    general_new AS (
        SELECT q.*, 4 AS priority, RANDOM() AS weight
        FROM public.questions TABLESAMPLE SYSTEM(10) q
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
    )
    SELECT
        id, banca, ano, enunciado, imagem_url, opcoes, resposta_correta,
        status_imagem, referencia_imagem, alternativa_a, alternativa_b,
        alternativa_c, alternativa_d, alternativa_e, especialidade,
        output_gabarito, output_explicacao, output_grande_area,
        output_especialidade, output_tema, output_subtema,
        output_taxa_certeza, processado, created_at, id_integracao
    FROM all_candidates
    ORDER BY priority ASC, weight DESC
    LIMIT p_limit;
END;
$$;
