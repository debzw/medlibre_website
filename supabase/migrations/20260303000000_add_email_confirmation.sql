-- Adiciona coluna de confirmação de email para novos usuários via Google OAuth.
-- DEFAULT TRUE garante que todos os usuários existentes não sejam afetados.
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS email_confirmed BOOLEAN NOT NULL DEFAULT TRUE;

-- Tabela de tokens de verificação de email.
-- Acesso restrito ao service_role (sem RLS policies públicas).
CREATE TABLE IF NOT EXISTS verification_tokens (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      TEXT        UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE verification_tokens ENABLE ROW LEVEL SECURITY;

-- Atualiza o trigger para que novos usuários sejam criados com email_confirmed = FALSE.
-- Usuários existentes já têm email_confirmed = TRUE pelo DEFAULT acima.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id, tier, questions_answered_today, last_reset_date, theme_preference, tier_expiry,
    email_confirmed, email, full_name, avatar_url, locale
  )
  VALUES (
    NEW.id,
    'paid',
    0,
    CURRENT_DATE,
    'dark',
    '2026-04-01 00:00:00-03',
    FALSE,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'given_name'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    NEW.raw_user_meta_data->>'locale'
  );
  RETURN NEW;
END; $$;
