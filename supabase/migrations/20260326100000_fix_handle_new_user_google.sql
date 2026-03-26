-- Corrige handle_new_user: Google/GitHub OAuth já verificam o email,
-- então email_confirmed deve ser TRUE para esses providers.
-- Inclui colunas do branch Asaas: subscription_status, beta_extension_claimed.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _provider TEXT;
  _email_confirmed BOOLEAN;
BEGIN
  _provider := NEW.raw_app_meta_data->>'provider';
  -- OAuth social providers já verificam o email
  _email_confirmed := _provider IN ('google', 'github', 'facebook', 'apple');

  INSERT INTO public.user_profiles (
    id, tier, tier_expiry, questions_answered_today, last_reset_date,
    theme_preference, email_confirmed, email, full_name, avatar_url, locale,
    subscription_status, beta_extension_claimed
  )
  VALUES (
    NEW.id,
    'paid',
    now() + interval '1 month',
    0,
    CURRENT_DATE,
    'dark',
    _email_confirmed,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'given_name'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    NEW.raw_user_meta_data->>'locale',
    'none',
    false
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END; $$;
