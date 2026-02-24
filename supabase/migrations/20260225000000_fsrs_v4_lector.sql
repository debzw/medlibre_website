-- ============================================================
-- Migration: FSRS v4 + LECTOR Semantic Diversity Constraint
-- ============================================================
-- Changes:
--   1. Add FSRS v4 columns to user_spaced_repetition
--      (stability, difficulty, last_confidence)
--   2. GIN index on decs_terms.tree_numbers (TEXT[]) for LECTOR unnest queries
--   3. calculate_retrievability(S, last_review) helper: R = 0.9^(t/S)
--   4. Replace get_study_session_questions() with FSRS-aware selection
--      + LECTOR constraint (max 2 questions per DeCS top-level branch)
-- ============================================================


-- ── 1. FSRS v4 columns on user_spaced_repetition ─────────────────────────────
-- Non-destructive: existing SM-2 rows get NULL for new columns.
-- Legacy SM-2 records are handled gracefully in the updated function below.

ALTER TABLE public.user_spaced_repetition
    ADD COLUMN IF NOT EXISTS stability       FLOAT   DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS difficulty      FLOAT   DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS last_confidence INTEGER DEFAULT NULL;

-- NOTE: FSRS reuses the existing last_reviewed TIMESTAMPTZ column as its
-- "last_review" timestamp. No new column needed for that field.


-- ── 2. GIN index on decs_terms.tree_numbers for LECTOR ───────────────────────
-- tree_numbers is TEXT[] (array populated by import_decs.cjs via '|' split).
-- GIN is required for array columns; supports ANY() / @> containment ops.
-- The LECTOR CTE uses unnest() on this column to extract branch prefixes.

CREATE INDEX IF NOT EXISTS idx_decs_tree_numbers_gin
    ON public.decs_terms USING GIN (tree_numbers);


-- ── 3. Retrievability helper function ────────────────────────────────────────
-- R = 0.9 ^ (t / S)
-- where t = days elapsed since last review, S = stability in days.
-- Returns value in [0.0, 1.0]; lower R = more forgetting = higher review priority.

CREATE OR REPLACE FUNCTION public.calculate_retrievability(
    p_stability   FLOAT,
    p_last_review TIMESTAMPTZ
)
RETURNS FLOAT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT
        CASE
            WHEN p_stability IS NULL OR p_stability <= 0 THEN 0.0
            ELSE POWER(
                0.9,
                EXTRACT(EPOCH FROM (NOW() - p_last_review)) / 86400.0 / p_stability
            )
        END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_retrievability(FLOAT, TIMESTAMPTZ)
    TO authenticated, anon;


-- ── 4. Updated get_study_session_questions with FSRS + LECTOR ────────────────

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

    -- LECTOR: maximum questions per DeCS top-level branch in the final batch
    v_lector_max_per_branch INTEGER := 2;
BEGIN
    SELECT COUNT(*) INTO v_total_answered
    FROM public.user_question_history
    WHERE user_id = p_user_id;

    -- ── COLD START (< 50 questions answered) ──────────────────────────────────
    -- LATERAL per-specialty sampling already ensures diversity.
    -- LECTOR is not applied here to avoid over-constraining new users.
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
    -- Materialised once; index-backed. All NOT EXISTS checks reference this.
    answered_ids AS MATERIALIZED (
        SELECT question_id
        FROM public.user_question_history
        WHERE user_id = p_user_id
    ),

    -- ── 1. SRS: FSRS retrievability-aware priority ─────────────────────────────
    -- FSRS: due when R < 0.9 (below 90% retention threshold).
    -- Legacy SM-2: due when next_review <= NOW() (stability IS NULL).
    -- Ordered by weight ASC = lowest retrievability first (most urgent review).
    srs_due AS MATERIALIZED (
        SELECT q.*, 1 AS priority,
               CASE
                   WHEN s.stability IS NOT NULL AND s.stability > 0 THEN
                       -- FSRS: actual retrievability score
                       public.calculate_retrievability(s.stability, s.last_reviewed)
                   ELSE
                       -- SM-2 legacy: pseudo-R decays as overdue time grows
                       GREATEST(0.0,
                           1.0 - EXTRACT(EPOCH FROM (NOW() - s.next_review)) / 86400.0 / 10.0)
               END AS weight
        FROM public.questions q
        JOIN public.user_spaced_repetition s ON q.id = s.question_id
        WHERE s.user_id = p_user_id
          -- FSRS path: R below threshold
          AND (
              (s.stability IS NOT NULL AND s.stability > 0
               AND public.calculate_retrievability(s.stability, s.last_reviewed) < 0.9)
              OR
              -- SM-2 legacy path: scheduled date has passed
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
        ORDER BY weight ASC
        LIMIT v_srs_limit
    ),

    -- ── 2. Weak themes (mastery < 75%) ────────────────────────────────────────
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

    -- ── 3. Discovery: topics never in user_theme_stats ────────────────────────
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

    -- ── 4. General backfill ───────────────────────────────────────────────────
    -- TABLESAMPLE SYSTEM(10) reads ~10% of pages without a full-table sort.
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

    -- ── 5. Merge all candidate buckets ────────────────────────────────────────
    all_candidates AS (
        SELECT * FROM srs_due
        UNION ALL
        SELECT * FROM weak_theme_questions
        UNION ALL
        SELECT * FROM discovery_questions
        UNION ALL
        SELECT * FROM general_new
    ),

    -- ── 6. LECTOR: Attach DeCS top-level branch prefix ───────────────────────
    -- tree_numbers is TEXT[] (e.g. '{C14.280.647,C14.280.123}').
    -- We unnest the array, take MIN of the individual strings for determinism
    -- (handles polyhierarchical terms that appear in multiple branches), then
    -- extract the first segment before '.' as the top-level chapter (e.g. 'C14').
    --
    -- The B-Tree index on decs_terms.clean_term (migration 20260224000000) and
    -- the new GIN index on tree_numbers together make this correlated subquery
    -- fast. Candidate set is at most p_limit*4 rows (≤ 80), so O(small).
    --
    -- Sentinel for unmatched questions: 'UNCONSTRAINED_<uuid>' is unique per
    -- question, so ROW_NUMBER always returns 1 → they always pass the cap.
    candidates_with_branch AS (
        SELECT
            ac.*,
            COALESCE(
                (SELECT SPLIT_PART(MIN(tn), '.', 1)
                 FROM public.decs_terms dt,
                      unnest(dt.tree_numbers) AS tn
                 WHERE lower(trim(ac.output_tema)) = dt.clean_term),
                'UNCONSTRAINED_' || ac.id::TEXT
            ) AS lector_branch
        FROM all_candidates ac
    ),

    -- ── 7. LECTOR cap: max 2 questions per DeCS branch ───────────────────────
    -- ROW_NUMBER resets to 1 for each branch partition.
    -- Questions 1 and 2 pass; question 3+ in the same branch are dropped.
    lector_filtered AS (
        SELECT *,
               ROW_NUMBER() OVER (
                   PARTITION BY lector_branch
                   ORDER BY priority ASC, weight DESC
               ) AS branch_rank
        FROM candidates_with_branch
    )

    -- ── 8. Final result — SETOF public.questions column list ─────────────────
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
