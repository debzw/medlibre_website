-- Add tier_expiry column if it doesn't exist.
-- The DEFAULT here is a fallback only; the handle_new_user trigger and
-- compute_tier_expiry() function (migration 20260328100000) set the real value.
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS tier_expiry TIMESTAMP WITH TIME ZONE
  DEFAULT (now() + INTERVAL '1 month');
