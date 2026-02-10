-- Add tier_expiry column if it doesn't exist
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS tier_expiry TIMESTAMP WITH TIME ZONE DEFAULT '2026-04-01 00:00:00-03';

-- Update existing users to Premium until 2026-04-01
UPDATE public.user_profiles
SET tier = 'paid',
    tier_expiry = '2026-04-01 00:00:00-03';

-- Update the trigger function for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (id, tier, questions_answered_today, last_reset_date, theme_preference, tier_expiry)
  VALUES (NEW.id, 'paid', 0, CURRENT_DATE, 'dark', '2026-04-01 00:00:00-03');
  RETURN NEW;
END; $$;
