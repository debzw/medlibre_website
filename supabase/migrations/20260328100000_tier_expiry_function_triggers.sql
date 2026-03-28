-- Migration: compute_tier_expiry function + triggers
-- Formula: created_at + 1 month + 3 months (if feedback) + N months (N referrals)
-- Triggers fire only for the affected user on feedback/referral insert.
-- Backfill runs once for all existing users.

-- ─── 1. Core compute function ────────────────────────────────────────────────
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

-- ─── 2. Trigger: recompute for the user who just submitted feedback ──────────
CREATE OR REPLACE FUNCTION public.trg_recompute_expiry_on_feedback()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.user_profiles
  SET tier_expiry = public.compute_tier_expiry(NEW.user_id)
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_feedback_extend_premium ON public.user_feedback;
CREATE TRIGGER trg_feedback_extend_premium
  AFTER INSERT ON public.user_feedback
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_expiry_on_feedback();

-- ─── 3. Trigger: recompute for the referrer when a new referral is registered ─
CREATE OR REPLACE FUNCTION public.trg_recompute_expiry_on_referral()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.user_profiles
  SET tier_expiry = public.compute_tier_expiry(NEW.referrer_id)
  WHERE id = NEW.referrer_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_extend_premium ON public.referral_uses;
CREATE TRIGGER trg_referral_extend_premium
  AFTER INSERT ON public.referral_uses
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_expiry_on_referral();

-- ─── 4. Backfill: recompute for all existing users ───────────────────────────
UPDATE public.user_profiles
SET tier_expiry = public.compute_tier_expiry(id)
WHERE id IN (SELECT id FROM auth.users);
