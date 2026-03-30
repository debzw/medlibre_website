-- Fix Google OAuth users having null personal info in user_profiles.
--
-- Root cause: GoTrue (PKCE) sometimes INSERTs auth.users with empty raw_user_meta_data,
-- fires the INSERT trigger (producing null full_name/avatar_url/locale), then UPDATEs
-- raw_user_meta_data with the actual Google profile. The INSERT trigger never re-fires.
--
-- Fix: add an AFTER UPDATE trigger on auth.users that back-fills null personal-info
-- fields in user_profiles whenever real metadata becomes available.

-- ─── 1. Sync function ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_user_metadata_on_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Fast-exit: only proceed if there is actually useful metadata to sync
  IF (
    NEW.raw_user_meta_data->>'name'       IS NULL AND
    NEW.raw_user_meta_data->>'full_name'  IS NULL AND
    NEW.raw_user_meta_data->>'given_name' IS NULL AND
    NEW.raw_user_meta_data->>'picture'    IS NULL AND
    NEW.raw_user_meta_data->>'avatar_url' IS NULL
  ) THEN
    RETURN NEW;
  END IF;

  -- Only update rows that still have null personal-info fields (avoids touching
  -- complete profiles and keeps this trigger cheap on every sign-in UPDATE)
  UPDATE public.user_profiles
  SET
    full_name  = COALESCE(
                   full_name,
                   NEW.raw_user_meta_data->>'full_name',
                   NEW.raw_user_meta_data->>'name',
                   NEW.raw_user_meta_data->>'given_name'
                 ),
    avatar_url = COALESCE(
                   avatar_url,
                   NEW.raw_user_meta_data->>'avatar_url',
                   NEW.raw_user_meta_data->>'picture'
                 ),
    email      = COALESCE(email, NEW.email),
    locale     = COALESCE(locale, NEW.raw_user_meta_data->>'locale')
  WHERE id = NEW.id
    AND (full_name IS NULL OR avatar_url IS NULL OR email IS NULL);

  RETURN NEW;
END;
$$;

-- ─── 2. Attach trigger ───────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_metadata_on_update();

-- ─── 3. Backfill existing Google/OAuth users with null personal info ─────────
UPDATE public.user_profiles up
SET
  full_name  = COALESCE(
                 up.full_name,
                 au.raw_user_meta_data->>'full_name',
                 au.raw_user_meta_data->>'name',
                 au.raw_user_meta_data->>'given_name'
               ),
  avatar_url = COALESCE(
                 up.avatar_url,
                 au.raw_user_meta_data->>'avatar_url',
                 au.raw_user_meta_data->>'picture'
               ),
  email      = COALESCE(up.email, au.email),
  locale     = COALESCE(up.locale, au.raw_user_meta_data->>'locale')
FROM auth.users au
WHERE up.id = au.id
  AND (up.full_name IS NULL OR up.avatar_url IS NULL OR up.email IS NULL)
  AND au.raw_app_meta_data->>'provider' IN ('google', 'github', 'facebook', 'apple');
