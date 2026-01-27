
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS preferred_banca TEXT,
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS locale TEXT,
ADD COLUMN IF NOT EXISTS university TEXT,
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS graduation_year INTEGER;

-- 2. ATUALIZAR A FUNÇÃO DE TRIGGER (HANDLE_NEW_USER)
-- Isso garante que novos usuários continuem sendo criados corretamente com as colunas novas
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id, 
    email,
    full_name,
    avatar_url,
    locale,
    university,
    tier, 
    questions_answered_today, 
    last_reset_date, 
    theme_preference,
    preferred_banca,
    age,
    graduation_year
  )
  VALUES (
    NEW.id, 
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    NEW.raw_user_meta_data->>'locale',
    NULL,
    'free', 
    0, 
    CURRENT_DATE, 
    'dark',
    NULL,
    NULL,
    NULL
  );
  RETURN NEW;
END; $$;

-- 3. GARANTIR QUE AS POLÍTICAS DE RLS PERMITAM ALTERAR ESSAS COLUNAS
-- (Geralmente as políticas existentes de UPDATE já cobrem isso, mas é bom validar)
