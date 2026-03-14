-- ============================================================
-- Migration: Função de debug com timing por etapa
-- USO: SELECT get_study_session_questions_debug('uuid-do-usuario');
-- Logs aparecem em Supabase → Logs → Postgres (ou via RAISE NOTICE no SQL Editor)
-- REMOVER após diagnosticar: DROP FUNCTION public.get_study_session_questions_debug;
-- ============================================================

DROP FUNCTION IF EXISTS public.get_study_session_questions_debug;

CREATE OR REPLACE FUNCTION public.get_study_session_questions_debug(
    p_user_id        UUID,
    p_limit          INTEGER DEFAULT 20,
    p_hide_answered  BOOLEAN DEFAULT FALSE,
    p_banca          TEXT    DEFAULT NULL,
    p_ano            INTEGER DEFAULT NULL,
    p_campo          TEXT    DEFAULT NULL,
    p_especialidade  TEXT    DEFAULT NULL,
    p_tema           TEXT    DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_t0              TIMESTAMPTZ;
    v_t1              TIMESTAMPTZ;
    v_srs_limit       INTEGER;
    v_weak_limit      INTEGER;
    v_discovery_limit INTEGER;
    v_total_answered  INTEGER;
    v_lector_max_per_branch INTEGER := 2;
    v_count           INTEGER;
    v_has_stability   BOOLEAN;
BEGIN
    v_t0 := clock_timestamp();

    -- Detecta se a coluna stability existe (migration 20260225000000 aplicada?)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'user_spaced_repetition'
          AND column_name  = 'stability'
    ) INTO v_has_stability;
    RAISE NOTICE '[INFO] stability_column_exists=%', v_has_stability;

    -- ── Passo 0: contar histórico ────────────────────────────────────────────
    SELECT COUNT(*) INTO v_total_answered
    FROM public.user_question_history
    WHERE user_id = p_user_id;

    v_t1 := clock_timestamp();
    RAISE NOTICE '[TIMING] 0_count_history: %ms | total_answered=%',
        ROUND(EXTRACT(MILLISECONDS FROM (v_t1 - v_t0))::NUMERIC, 1), v_total_answered;

    IF v_total_answered < 50 THEN
        RAISE NOTICE '[TIMING] → cold start path (< 50 respostas, SRS não será testado)';
        RAISE NOTICE '[TIMING] TOTAL: %ms',
            ROUND(EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_t0))::NUMERIC, 1);
        RETURN;
    END IF;

    RAISE NOTICE '[TIMING] → standard path';
    v_srs_limit       := CEIL(p_limit * 0.25);
    v_weak_limit      := CEIL(p_limit * 0.25);
    v_discovery_limit := CEIL(p_limit * 0.25);

    -- ── Passo 1: answered_ids ────────────────────────────────────────────────
    DROP TABLE IF EXISTS _dbg_answered;
    CREATE TEMP TABLE _dbg_answered AS
        SELECT question_id
        FROM public.user_question_history
        WHERE user_id = p_user_id;

    v_t1 := clock_timestamp();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '[TIMING] 1_answered_ids: %ms | rows=%',
        ROUND(EXTRACT(MILLISECONDS FROM (v_t1 - v_t0))::NUMERIC, 1), v_count;

    -- ── Passo 2: srs_due ─────────────────────────────────────────────────────
    DROP TABLE IF EXISTS _dbg_srs;
    IF v_has_stability THEN
        EXECUTE '
            CREATE TEMP TABLE _dbg_srs AS
            SELECT q.id, 1 AS priority, r.retrievability AS weight
            FROM public.questions q
            JOIN public.user_spaced_repetition s ON q.id = s.question_id
            CROSS JOIN LATERAL (
                SELECT CASE
                    WHEN s.stability IS NOT NULL AND s.stability > 0 THEN
                        public.calculate_retrievability(s.stability, s.last_reviewed)
                    ELSE
                        GREATEST(0.0, 1.0 - EXTRACT(EPOCH FROM (NOW() - s.next_review)) / 86400.0 / 10.0)
                END AS retrievability
            ) r
            WHERE s.user_id = $1
              AND ((s.stability IS NOT NULL AND s.stability > 0 AND r.retrievability < 0.9)
                   OR (s.stability IS NULL AND s.next_review <= NOW()))
              AND ($2 IS NULL OR q.banca = $2)
              AND (q.tem_anomalia IS NULL OR q.tem_anomalia != 1)
              AND (NOT $3 OR NOT EXISTS (SELECT 1 FROM _dbg_answered ai WHERE ai.question_id = q.id))
            ORDER BY r.retrievability ASC
            LIMIT $4'
        USING p_user_id, p_banca, p_hide_answered, v_srs_limit;
    ELSE
        RAISE NOTICE '[WARN] stability não existe → usando SM-2 fallback (next_review <= NOW())';
        CREATE TEMP TABLE _dbg_srs AS
            SELECT q.id, 1 AS priority,
                   GREATEST(0.0, 1.0 - EXTRACT(EPOCH FROM (NOW() - s.next_review)) / 86400.0 / 10.0) AS weight
            FROM public.questions q
            JOIN public.user_spaced_repetition s ON q.id = s.question_id
            WHERE s.user_id = p_user_id
              AND s.next_review <= NOW()
              AND (q.tem_anomalia IS NULL OR q.tem_anomalia != 1)
              AND (NOT p_hide_answered OR NOT EXISTS (
                  SELECT 1 FROM _dbg_answered ai WHERE ai.question_id = q.id
              ))
            ORDER BY s.next_review ASC
            LIMIT v_srs_limit;
    END IF;

    v_t1 := clock_timestamp();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '[TIMING] 2_srs_due: %ms | rows=%',
        ROUND(EXTRACT(MILLISECONDS FROM (v_t1 - v_t0))::NUMERIC, 1), v_count;

    -- ── Passo 3: weak_theme_questions ────────────────────────────────────────
    DROP TABLE IF EXISTS _dbg_weak;
    CREATE TEMP TABLE _dbg_weak AS
        SELECT q.id, 2 AS priority, (1.0 - wt.mastery_score)::FLOAT AS weight
        FROM public.questions q
        JOIN (
            SELECT theme_name, mastery_score
            FROM public.user_theme_stats
            WHERE user_id = p_user_id AND mastery_score < 0.75
            ORDER BY mastery_score ASC, total_answered DESC
            LIMIT 10
        ) wt ON q.output_tema = wt.theme_name
        WHERE (p_banca         IS NULL OR q.banca               = p_banca)
          AND (p_ano           IS NULL OR q.ano                 = p_ano)
          AND (p_campo         IS NULL OR q.output_grande_area  = p_campo)
          AND (p_especialidade IS NULL OR q.output_especialidade = p_especialidade)
          AND (q.tem_anomalia  IS NULL OR q.tem_anomalia        != 1)
          AND NOT EXISTS (SELECT 1 FROM _dbg_answered ai WHERE ai.question_id = q.id)
          AND NOT EXISTS (SELECT 1 FROM _dbg_srs      sr WHERE sr.id          = q.id)
        ORDER BY wt.mastery_score ASC
        LIMIT v_weak_limit;

    v_t1 := clock_timestamp();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '[TIMING] 3_weak_themes: %ms | rows=%',
        ROUND(EXTRACT(MILLISECONDS FROM (v_t1 - v_t0))::NUMERIC, 1), v_count;

    -- ── Passo 4: discovery_questions ─────────────────────────────────────────
    DROP TABLE IF EXISTS _dbg_discovery;
    CREATE TEMP TABLE _dbg_discovery AS
        SELECT q.id, 3 AS priority, RANDOM()::FLOAT AS weight
        FROM public.questions AS q TABLESAMPLE SYSTEM(5)
        LEFT JOIN public.user_theme_stats uts
               ON q.output_tema = uts.theme_name AND uts.user_id = p_user_id
        WHERE (p_banca         IS NULL OR q.banca               = p_banca)
          AND (p_ano           IS NULL OR q.ano                 = p_ano)
          AND (p_campo         IS NULL OR q.output_grande_area  = p_campo)
          AND (p_especialidade IS NULL OR q.output_especialidade = p_especialidade)
          AND (p_tema          IS NULL OR q.output_tema         = p_tema)
          AND (q.tem_anomalia  IS NULL OR q.tem_anomalia        != 1)
          AND uts.theme_name IS NULL
          AND NOT EXISTS (SELECT 1 FROM _dbg_answered  ai WHERE ai.question_id = q.id)
          AND NOT EXISTS (SELECT 1 FROM _dbg_srs        sr WHERE sr.id          = q.id)
          AND NOT EXISTS (SELECT 1 FROM _dbg_weak        wt WHERE wt.id          = q.id)
        LIMIT v_discovery_limit;

    v_t1 := clock_timestamp();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '[TIMING] 4_discovery: %ms | rows=%',
        ROUND(EXTRACT(MILLISECONDS FROM (v_t1 - v_t0))::NUMERIC, 1), v_count;

    -- ── Passo 5: general_new ─────────────────────────────────────────────────
    DROP TABLE IF EXISTS _dbg_general;
    CREATE TEMP TABLE _dbg_general AS
        SELECT q.id, 4 AS priority, RANDOM()::FLOAT AS weight
        FROM public.questions AS q TABLESAMPLE SYSTEM(2)
        WHERE (p_banca         IS NULL OR q.banca               = p_banca)
          AND (p_ano           IS NULL OR q.ano                 = p_ano)
          AND (p_campo         IS NULL OR q.output_grande_area  = p_campo)
          AND (p_especialidade IS NULL OR q.output_especialidade = p_especialidade)
          AND (p_tema          IS NULL OR q.output_tema         = p_tema)
          AND (q.tem_anomalia  IS NULL OR q.tem_anomalia        != 1)
          AND NOT EXISTS (SELECT 1 FROM _dbg_answered   ai WHERE ai.question_id = q.id)
          AND NOT EXISTS (SELECT 1 FROM _dbg_srs         sr WHERE sr.id          = q.id)
          AND NOT EXISTS (SELECT 1 FROM _dbg_weak         wt WHERE wt.id          = q.id)
          AND NOT EXISTS (SELECT 1 FROM _dbg_discovery    dq WHERE dq.id          = q.id)
        LIMIT p_limit;

    v_t1 := clock_timestamp();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '[TIMING] 5_general_new: %ms | rows=%',
        ROUND(EXTRACT(MILLISECONDS FROM (v_t1 - v_t0))::NUMERIC, 1), v_count;

    -- ── Passo 6: LECTOR (só conta, não retorna linhas) ───────────────────────
    SELECT COUNT(*) INTO v_count
    FROM (
        SELECT id FROM _dbg_srs
        UNION ALL SELECT id FROM _dbg_weak
        UNION ALL SELECT id FROM _dbg_discovery
        UNION ALL SELECT id FROM _dbg_general
    ) all_candidates;

    v_t1 := clock_timestamp();
    RAISE NOTICE '[TIMING] 6_lector_candidates: %ms | total_candidates=%',
        ROUND(EXTRACT(MILLISECONDS FROM (v_t1 - v_t0))::NUMERIC, 1), v_count;

    RAISE NOTICE '[TIMING] TOTAL: %ms',
        ROUND(EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_t0))::NUMERIC, 1);

    -- Cleanup
    DROP TABLE IF EXISTS _dbg_answered;
    DROP TABLE IF EXISTS _dbg_srs;
    DROP TABLE IF EXISTS _dbg_weak;
    DROP TABLE IF EXISTS _dbg_discovery;
    DROP TABLE IF EXISTS _dbg_general;
END;
$$;
