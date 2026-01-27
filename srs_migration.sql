-- ==========================================
-- MEDLIBRE SRS & INTELLIGENT SELECTION
-- Version: 2.0
-- Implementation of SM-2 Algorithm and Weighted Selection
-- ==========================================

-- 1. TABLES
CREATE TABLE IF NOT EXISTS public.user_spaced_repetition (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    interval INTEGER NOT NULL DEFAULT 1, -- in days
    ease_factor DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    streak INTEGER NOT NULL DEFAULT 0,
    consecutive_failures INTEGER DEFAULT 0,
    next_review TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_reviewed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, question_id)
);

CREATE TABLE IF NOT EXISTS public.user_theme_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    theme_name TEXT NOT NULL,
    total_answered INTEGER NOT NULL DEFAULT 0,
    total_correct INTEGER NOT NULL DEFAULT 0,
    mastery_score DOUBLE PRECISION NOT NULL DEFAULT 1.0, 
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, theme_name)
);

-- 2. INDEXES
CREATE INDEX IF NOT EXISTS idx_srs_next_review ON public.user_spaced_repetition (user_id, next_review);
CREATE INDEX IF NOT EXISTS idx_theme_mastery ON public.user_theme_stats (user_id, mastery_score);
CREATE INDEX IF NOT EXISTS idx_questions_tema_output ON public.questions(output_tema) WHERE output_tema IS NOT NULL;

-- 3. FUNCTIONS & TRIGGERS

-- SRS Update Function (SM-2 Algorithm)
CREATE OR REPLACE FUNCTION update_spaced_repetition()
RETURNS TRIGGER AS $$
DECLARE
    v_current_record RECORD;
    v_new_interval INTEGER;
    v_new_ease DOUBLE PRECISION;
    v_new_streak INTEGER;
    v_new_consecutive_failures INTEGER;
    v_quality INTEGER; 
BEGIN
    v_quality := CASE WHEN NEW.is_correct THEN 4 ELSE 0 END;
    
    SELECT * INTO v_current_record 
    FROM public.user_spaced_repetition 
    WHERE user_id = NEW.user_id AND question_id = NEW.question_id;
    
    IF FOUND THEN
        IF v_quality >= 3 THEN
            v_new_streak := v_current_record.streak + 1;
            v_new_consecutive_failures := 0;
            v_new_ease := GREATEST(1.3, v_current_record.ease_factor + (0.1 - (5 - v_quality) * (0.08 + (5 - v_quality) * 0.02)));
            
            IF v_new_streak = 1 THEN v_new_interval := 1;
            ELSIF v_new_streak = 2 THEN v_new_interval := 6;
            ELSE v_new_interval := ROUND(v_current_record.interval * v_new_ease)::INTEGER;
            END IF;
        ELSE
            v_new_streak := 0;
            v_new_consecutive_failures := v_current_record.consecutive_failures + 1;
            v_new_ease := GREATEST(1.3, v_current_record.ease_factor - 0.2);
            v_new_interval := 1;
        END IF;
        
        UPDATE public.user_spaced_repetition SET 
            interval = v_new_interval, ease_factor = v_new_ease, streak = v_new_streak,
            consecutive_failures = v_new_consecutive_failures,
            next_review = NOW() + (v_new_interval || ' days')::INTERVAL,
            last_reviewed = NOW()
        WHERE id = v_current_record.id;
    ELSE
        INSERT INTO public.user_spaced_repetition (user_id, question_id, interval, ease_factor, streak, consecutive_failures, next_review, last_reviewed)
        VALUES (NEW.user_id, NEW.question_id, 1, CASE WHEN NEW.is_correct THEN 2.5 ELSE 2.3 END, 
                CASE WHEN NEW.is_correct THEN 1 ELSE 0 END, CASE WHEN NEW.is_correct THEN 0 ELSE 1 END,
                NOW() + (CASE WHEN NEW.is_correct THEN '1 day'::INTERVAL ELSE '4 hours'::INTERVAL END), NOW());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_update_srs
AFTER INSERT ON public.user_question_history
FOR EACH ROW EXECUTE FUNCTION update_spaced_repetition();

-- Theme Stats Update Function
CREATE OR REPLACE FUNCTION update_theme_stats()
RETURNS TRIGGER AS $$
DECLARE
    v_theme TEXT;
    v_current_stats RECORD;
    v_new_mastery DOUBLE PRECISION;
    v_accuracy DOUBLE PRECISION;
BEGIN
    SELECT output_tema INTO v_theme FROM public.questions WHERE id = NEW.question_id;
    IF v_theme IS NULL THEN RETURN NEW; END IF;
    
    SELECT * INTO v_current_stats FROM public.user_theme_stats WHERE user_id = NEW.user_id AND theme_name = v_theme;
    
    IF FOUND THEN
        v_accuracy := (v_current_stats.total_correct + CASE WHEN NEW.is_correct THEN 1 ELSE 0 END)::DOUBLE PRECISION / (v_current_stats.total_answered + 1);
        v_new_mastery := 0.2 * v_current_stats.mastery_score + 0.8 * v_accuracy;
        UPDATE public.user_theme_stats SET 
            total_answered = total_answered + 1, total_correct = total_correct + CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
            mastery_score = v_new_mastery, last_updated = NOW()
        WHERE id = v_current_stats.id;
    ELSE
        INSERT INTO public.user_theme_stats (user_id, theme_name, total_answered, total_correct, mastery_score, last_updated)
        VALUES (NEW.user_id, v_theme, 1, CASE WHEN NEW.is_correct THEN 1 ELSE 0 END, CASE WHEN NEW.is_correct THEN 1.0 ELSE 0.0 END, NOW());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_update_theme_stats
AFTER INSERT ON public.user_question_history
FOR EACH ROW EXECUTE FUNCTION update_theme_stats();

-- 4. INTELLIGENT SELECTION FUNCTION
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
    v_srs_ratio FLOAT := 0.45;
    v_weak_ratio FLOAT := 0.30;
    v_discovery_ratio FLOAT := 0.15;
    v_srs_limit INTEGER; v_weak_limit INTEGER; v_discovery_limit INTEGER; v_random_limit INTEGER;
BEGIN
    v_srs_limit := CEIL(p_limit * v_srs_ratio);
    v_weak_limit := CEIL(p_limit * v_weak_ratio);
    v_discovery_limit := CEIL(p_limit * v_discovery_ratio);
    v_random_limit := p_limit - v_srs_limit - v_weak_limit - v_discovery_limit;

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
    srs_due AS (
        SELECT q.*, 1 as priority, (1.0 / (EXTRACT(EPOCH FROM (NOW() - s.next_review)) + 1)) as weight
        FROM filtered_pool q
        JOIN public.user_spaced_repetition s ON q.id = s.question_id
        WHERE s.user_id = p_user_id AND s.next_review <= NOW()
          AND (NOT p_hide_answered OR q.id NOT IN (SELECT question_id FROM answered_ids))
        ORDER BY s.next_review ASC LIMIT v_srs_limit
    ),
    weak_themes AS (
        SELECT theme_name, mastery_score FROM public.user_theme_stats
        WHERE user_id = p_user_id AND mastery_score < 0.75
        ORDER BY mastery_score ASC, total_answered DESC LIMIT 10
    ),
    weak_theme_questions AS (
        SELECT q.*, 2 as priority, (1.0 - wt.mastery_score) as weight
        FROM filtered_pool q
        JOIN weak_themes wt ON q.output_tema = wt.theme_name
        WHERE q.id NOT IN (SELECT question_id FROM answered_ids) AND q.id NOT IN (SELECT id FROM srs_due)
        ORDER BY wt.mastery_score ASC, RANDOM() LIMIT v_weak_limit
    ),
    discovery_questions AS (
        SELECT q.*, 3 as priority, RANDOM() as weight
        FROM filtered_pool q
        WHERE q.id NOT IN (SELECT question_id FROM answered_ids) AND q.id NOT IN (SELECT id FROM srs_due)
          AND q.id NOT IN (SELECT id FROM weak_theme_questions)
          AND q.output_tema NOT IN (SELECT theme_name FROM public.user_theme_stats WHERE user_id = p_user_id)
        ORDER BY RANDOM() LIMIT v_discovery_limit
    ),
    general_new AS (
        SELECT q.*, 4 as priority, RANDOM() as weight
        FROM filtered_pool q
        WHERE q.id NOT IN (SELECT question_id FROM answered_ids) AND q.id NOT IN (SELECT id FROM srs_due)
          AND q.id NOT IN (SELECT id FROM weak_theme_questions) AND q.id NOT IN (SELECT id FROM discovery_questions)
        ORDER BY RANDOM() LIMIT v_random_limit
    ),
    all_candidates AS (
        SELECT * FROM srs_due UNION ALL SELECT * FROM weak_theme_questions UNION ALL
        SELECT * FROM discovery_questions UNION ALL SELECT * FROM general_new
    )
    SELECT id, banca, ano, enunciado, imagem_url, opcoes, resposta_correta, created_at,
           especialidade, output_grande_area, output_especialidade, output_tema, 
           output_subtema, output_explicacao, output_gabarito, status_imagem, referencia_imagem
    FROM all_candidates ORDER BY priority ASC, weight DESC LIMIT p_limit;
END;
$$;
