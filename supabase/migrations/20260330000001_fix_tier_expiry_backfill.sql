-- Fix tier_expiry for all users.
--
-- Root cause: migration 20260210_beta_period.sql (now renamed) hardcoded
-- 2026-04-01 for ALL users. This migration:
--   1. Ensures compute_tier_expiry() exists with the correct formula.
--   2. Resets the column DEFAULT to a dynamic expression.
--   3. Recomputes tier_expiry for every existing user.
--   4. Ensures the handle_new_user trigger uses the correct formula.

-- ─── 1. Fix column DEFAULT ────────────────────────────────────────────────────
ALTER TABLE public.user_profiles
  ALTER COLUMN tier_expiry SET DEFAULT (now() + INTERVAL '1 month');

-- ─── 2. Ensure compute_tier_expiry() is up to date ───────────────────────────
--    Formula: created_at + 1 month
--             + 3 months if the user submitted beta feedback
--             + 1 month  per user referred
CREATE OR REPLACE FUNCTION public.compute_tier_expiry(p_user_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created_at     TIMESTAMPTZ;
  v_has_feedback   BOOLEAN;
  v_referral_count INT;
  v_expiry         TIMESTAMPTZ;
BEGIN
  SELECT created_at INTO v_created_at FROM auth.users WHERE id = p_user_id;
  IF v_created_at IS NULL THEN RETURN NULL; END IF;

  -- Base: 1 month after account creation
  v_expiry := v_created_at + INTERVAL '1 month';

  -- +3 months if the user submitted beta feedback
  SELECT EXISTS (
    SELECT 1 FROM public.user_feedback WHERE user_id = p_user_id
  ) INTO v_has_feedback;

  IF v_has_feedback THEN
    v_expiry := v_expiry + INTERVAL '3 months';
  END IF;

  -- +1 month per user referred
  SELECT COUNT(*) INTO v_referral_count
  FROM public.referral_uses
  WHERE referrer_id = p_user_id;

  v_expiry := v_expiry + (v_referral_count * INTERVAL '1 month');

  RETURN v_expiry;
END;
$$;

-- ─── 3. Ensure handle_new_user trigger uses dynamic formula ──────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id, tier, tier_expiry, questions_answered_today, last_reset_date,
    theme_preference, email_confirmed, email, full_name, avatar_url, locale,
    subscription_status, beta_extension_claimed
  )
  VALUES (
    NEW.id,
    'paid',
    now() + INTERVAL '1 month',
    0,
    CURRENT_DATE,
    'dark',
    false,
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

-- ─── 4. Backfill: recompute tier_expiry for ALL existing users ────────────────
--    Uses created_at from auth.users + feedback + referrals.
--    Skips users not in auth.users (shouldn't exist, but safe guard).
UPDATE public.user_profiles
SET tier_expiry = public.compute_tier_expiry(id)
WHERE id IN (SELECT id FROM auth.users);
