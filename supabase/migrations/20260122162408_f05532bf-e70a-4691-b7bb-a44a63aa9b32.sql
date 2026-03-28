-- Add theme_preference column to user_profiles table (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'user_profiles'
      AND column_name  = 'theme_preference'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD COLUMN theme_preference text DEFAULT 'dark';
  END IF;
END;
$$;
