-- Garante ON DELETE CASCADE em user_profiles → auth.users
-- e cria RPC para o cron de limpeza de usuários não confirmados.

-- 1. Recriar FK de user_profiles com ON DELETE CASCADE
DO $$
DECLARE
  _cname TEXT;
BEGIN
  SELECT conname INTO _cname
  FROM pg_constraint
  WHERE conrelid = 'public.user_profiles'::regclass
    AND confrelid = 'auth.users'::regclass
    AND contype = 'f'
  LIMIT 1;

  IF _cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.user_profiles DROP CONSTRAINT %I', _cname);
  END IF;
END $$;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Função RPC: retorna user_ids de não confirmados com token expirado
-- Usada pelo endpoint cron /api/cron/cleanup-unconfirmed
CREATE OR REPLACE FUNCTION public.get_expired_unconfirmed_users()
RETURNS TABLE(user_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT vt.user_id
  FROM public.verification_tokens vt
  JOIN public.user_profiles up ON up.id = vt.user_id
  WHERE up.email_confirmed = FALSE
    AND vt.expires_at < NOW();
$$;
