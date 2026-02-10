  -- ==========================================
  -- MEDLIBRE CONSOLIDATED CLEAN SCHEMA
  -- Version: 1.2
  -- Generated based on Application Source of Truth & Verified Column List
  -- ==========================================

  -- 1. ENUMS
  CREATE TYPE public.user_tier AS ENUM ('free', 'paid');

  -- 2. TABLES

  -- QUESTIONS TABLE
  CREATE TABLE public.questions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    -- Core identification
    banca TEXT NOT NULL,
    ano INT NOT NULL,
    enunciado TEXT NOT NULL,
    
    -- UI & Processing Extras        -- Used in UI filters/hooks
    imagem_url TEXT,                     -- Used for legacy/cdn images
    opcoes JSONB NOT NULL,               -- Array of options
    resposta_correta INT NOT NULL,       -- Index of correct option
    
    -- Metadata columns (Verificada contra lista do usuário)
    status_imagem INTEGER DEFAULT 0,      -- 0=no, 1=yes
    referencia_imagem TEXT,              -- Image path/ref
    alternativa_a TEXT,
    alternativa_b TEXT,
    alternativa_c TEXT,
    alternativa_d TEXT,
    alternativa_e TEXT,
    especialidade TEXT,                  -- Source specialty
    
    -- AI Output Mappings
    output_gabarito TEXT,                -- Final answer text (A, B, C, D, E)
    output_explicacao TEXT,              -- :explicacao
    output_grande_area TEXT,             -- :n1
    output_especialidade TEXT,           -- :n2
    output_tema TEXT,                    -- Replaces old tema_especifico
    output_subtema TEXT,                 -- :n4
    output_taxa_certeza numeric,         -- :certeza
    processado INTEGER DEFAULT 0,        -- Flag (0=unprocessed, 1=processed)
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
  );

  -- USER PROFILES TABLE
  CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tier user_tier NOT NULL DEFAULT 'paid', -- Default to paid during beta
    tier_expiry TIMESTAMP WITH TIME ZONE DEFAULT '2026-04-01 00:00:00-03', -- Beta expiry
    questions_answered_today INT NOT NULL DEFAULT 0,
    last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
    theme_preference TEXT CHECK (theme_preference IN ('light', 'dark')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
  );

  -- USER QUESTION HISTORY TABLE
  CREATE TABLE public.user_question_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    selected_answer INTEGER NOT NULL,
    is_correct BOOLEAN NOT NULL,
    answered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    time_spent_seconds INTEGER DEFAULT NULL,
    UNIQUE(user_id, question_id, answered_at)
  );

  -- 3. SECURITY (RLS)
  ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.user_question_history ENABLE ROW LEVEL SECURITY;

  -- Policies
  CREATE POLICY "Questions are publicly readable" ON public.questions FOR SELECT USING (true);
  CREATE POLICY "Users can view own profile" ON public.user_profiles FOR SELECT TO authenticated USING (auth.uid() = id);
  CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
  CREATE POLICY "Users can insert own profile" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
  CREATE POLICY "Users can view own history" ON public.user_question_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
  CREATE POLICY "Users can insert own history" ON public.user_question_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "Users can update own history" ON public.user_question_history FOR UPDATE TO authenticated USING (auth.uid() = user_id);
  CREATE POLICY "Users can delete own history" ON public.user_question_history FOR DELETE TO authenticated USING (auth.uid() = user_id);

  -- 4. FUNCTIONS & TRIGGERS
  CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
  BEGIN
    INSERT INTO public.user_profiles (id, tier, questions_answered_today, last_reset_date, theme_preference, tier_expiry)
    VALUES (NEW.id, 'paid', 0, CURRENT_DATE, 'dark', '2026-04-01 00:00:00-03');
    RETURN NEW;
  END; $$;

  CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

  CREATE OR REPLACE FUNCTION public.update_updated_at_column()
  RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

  CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

  -- 5. INDEXES
  CREATE INDEX IF NOT EXISTS idx_questions_banca ON public.questions(banca);
  CREATE INDEX IF NOT EXISTS idx_questions_ano ON public.questions(ano);
  CREATE INDEX IF NOT EXISTS idx_questions_grande_area ON public.questions(output_grande_area);
  CREATE INDEX IF NOT EXISTS idx_questions_processado ON public.questions(processado);
  CREATE INDEX IF NOT EXISTS idx_user_question_history_user_id ON public.user_question_history(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_question_history_answered_at ON public.user_question_history(answered_at);


-- deduplicate when adding questions automatically
-- Cria a coluna para guardar o ID do seu SQLite
ALTER TABLE public.questions 
ADD COLUMN id_integracao INTEGER;

-- Cria a regra: Não aceita dois números iguais nesta coluna
ALTER TABLE public.questions 
ADD CONSTRAINT unique_sqlite_id UNIQUE (id_integracao);