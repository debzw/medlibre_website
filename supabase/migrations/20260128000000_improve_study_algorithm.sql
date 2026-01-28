-- Implement Cold Start Logic: First 50 questions bypass SRS and use equitable distribution
-- Equitable distribution uses PARTITION BY output_especialidade to ensure variety across specialties

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
    -- Ratios
    v_srs_ratio FLOAT := 0.25;
    v_weak_ratio FLOAT := 0.25;
    v_discovery_ratio FLOAT := 0.25;
    
    -- Limits
    v_srs_limit INTEGER; 
    v_weak_limit INTEGER; 
    v_discovery_limit INTEGER; 
    
    -- User Stats
    v_total_answered INTEGER;
BEGIN
    -- Check total questions answered by user
    SELECT COUNT(*) INTO v_total_answered FROM public.user_question_history WHERE user_id = p_user_id;

    -- COLD START LOGIC (< 50 questions)
    IF v_total_answered < 50 THEN
        RETURN QUERY
        WITH 
        filtered_pool AS (
            SELECT * FROM public.questions
            WHERE (p_banca IS NULL OR banca = p_banca)
              AND (p_ano IS NULL OR ano = p_ano)
              AND (p_campo IS NULL OR output_grande_area = p_campo)
              AND (p_especialidade IS NULL OR output_especialidade = p_especialidade)
              AND (p_tema IS NULL OR output_tema = p_tema)
        ),
        answered_ids AS (SELECT DISTINCT question_id FROM public.user_question_history WHERE user_id = p_user_id),
        -- Equitable selection using Window Function
        equitable_candidates AS (
            SELECT *, 
                   ROW_NUMBER() OVER (PARTITION BY output_especialidade ORDER BY RANDOM()) as rnk
            FROM filtered_pool
            WHERE id NOT IN (SELECT question_id FROM answered_ids)
        )
        SELECT 
            id, banca, ano, enunciado, imagem_url, opcoes, resposta_correta, 
            status_imagem, referencia_imagem, alternativa_a, alternativa_b, 
            alternativa_c, alternativa_d, alternativa_e, especialidade, 
            output_gabarito, output_explicacao, output_grande_area, 
            output_especialidade, output_tema, output_subtema, 
            output_taxa_certeza, processado, created_at, id_integracao
        FROM equitable_candidates
        ORDER BY rnk ASC, RANDOM() -- rnk 1 from all specialties first, then rnk 2...
        LIMIT p_limit;
        
        RETURN; -- Exit function after returning cold start questions
    END IF;

    -- STANDARD LOGIC (>= 50 questions)
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
          AND (p_especialidade IS NULL OR output_especialidade = p_especialidade)
          AND (p_tema IS NULL OR output_tema = p_tema)
    ),
    answered_ids AS (SELECT DISTINCT question_id FROM public.user_question_history WHERE user_id = p_user_id),
    
    -- 1. SRS (Spaced Repetition)
    srs_due AS (
        SELECT q.*, 1 as priority, (1.0 / (EXTRACT(EPOCH FROM (NOW() - s.next_review)) + 1)) as weight
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
        SELECT q.*, 2 as priority, (1.0 - wt.mastery_score) as weight
        FROM filtered_pool q
        JOIN weak_themes wt ON q.output_tema = wt.theme_name
        WHERE q.id NOT IN (SELECT question_id FROM answered_ids) 
          AND q.id NOT IN (SELECT id FROM srs_due)
        ORDER BY wt.mastery_score ASC, RANDOM() LIMIT v_weak_limit
    ),
    
    -- 3. Discovery
    discovery_questions AS (
        SELECT q.*, 3 as priority, RANDOM() as weight
        FROM filtered_pool q
        WHERE q.id NOT IN (SELECT question_id FROM answered_ids) 
          AND q.id NOT IN (SELECT id FROM srs_due)
          AND q.id NOT IN (SELECT id FROM weak_theme_questions)
          AND q.output_tema NOT IN (SELECT theme_name FROM public.user_theme_stats WHERE user_id = p_user_id)
        ORDER BY RANDOM() LIMIT v_discovery_limit
    ),
    
    -- 4. General / Random Backfill
    general_new AS (
        SELECT q.*, 4 as priority, RANDOM() as weight
        FROM filtered_pool q
        WHERE q.id NOT IN (SELECT question_id FROM answered_ids) 
          AND q.id NOT IN (SELECT id FROM srs_due)
          AND q.id NOT IN (SELECT id FROM weak_theme_questions) 
          AND q.id NOT IN (SELECT id FROM discovery_questions)
        ORDER BY RANDOM() LIMIT p_limit
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
    FROM all_candidates ORDER BY priority ASC, weight DESC LIMIT p_limit;
END;
$$
