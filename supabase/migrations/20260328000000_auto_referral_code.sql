-- Migration: auto-generate referral_code on profile creation/update
-- Ensures every user_profile always has a referral_code without manual admin action.

-- Function to generate a unique referral code
CREATE OR REPLACE FUNCTION generate_unique_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    code := 'MED-';
    FOR i IN 1..4 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;

    SELECT TRUE INTO exists
    FROM public.user_profiles
    WHERE referral_code = code;

    EXIT WHEN exists IS NULL;
  END LOOP;
  RETURN code;
END;
$$;

-- Trigger function: assign referral_code if missing
CREATE OR REPLACE FUNCTION assign_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_unique_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to user_profiles (fires on INSERT and on UPDATE when code is set to NULL)
DROP TRIGGER IF EXISTS trg_assign_referral_code ON public.user_profiles;
CREATE TRIGGER trg_assign_referral_code
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION assign_referral_code();

-- Back-fill existing users who have NULL referral_code
UPDATE public.user_profiles
SET referral_code = generate_unique_referral_code()
WHERE referral_code IS NULL;
