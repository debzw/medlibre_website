-- Migration: referral system + user feedback
-- Branch: main

-- ─── 1. Extend user_profiles ────────────────────────────────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by   TEXT;   -- referral_code de quem indicou

-- ─── 2. referral_uses ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referral_uses (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code  TEXT        NOT NULL,
  referrer_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  new_user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.referral_uses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own referrals"
  ON public.referral_uses FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = new_user_id);

-- ─── 3. user_feedback ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_feedback (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID        REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Avaliações 1-5
  rating_overall         INT         CHECK (rating_overall         BETWEEN 1 AND 5),
  rating_content_quality INT         CHECK (rating_content_quality BETWEEN 1 AND 5),
  rating_interface       INT         CHECK (rating_interface       BETWEEN 1 AND 5),
  rating_study_algorithm INT         CHECK (rating_study_algorithm BETWEEN 1 AND 5),
  rating_performance     INT         CHECK (rating_performance     BETWEEN 1 AND 5),
  rating_value           INT         CHECK (rating_value           BETWEEN 1 AND 5),

  -- Campos abertos
  most_useful            TEXT,
  needs_improvement      TEXT,
  missing_features       TEXT,
  would_recommend        BOOLEAN,
  willing_to_pay         BOOLEAN,
  suggested_price        TEXT,
  free_comment           TEXT,

  -- Metadata
  submitted_at           TIMESTAMPTZ DEFAULT NOW(),
  premium_extended_at    TIMESTAMPTZ
);

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own feedback"
  ON public.user_feedback FOR ALL
  USING (auth.uid() = user_id);
