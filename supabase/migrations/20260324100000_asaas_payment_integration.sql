-- ============================================================
-- Asaas Payment Integration
-- 2026-03-24
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. user_profiles additions
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS asaas_customer_id        TEXT,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id    TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status      TEXT DEFAULT 'none',
  -- 'none' | 'pending' | 'active' | 'overdue' | 'cancelled'
  ADD COLUMN IF NOT EXISTS billing_cycle            TEXT,
  -- 'monthly' | 'annual' | NULL
  ADD COLUMN IF NOT EXISTS beta_extension_claimed   BOOLEAN DEFAULT false;

-- ─────────────────────────────────────────────────────────────
-- 2. coupons table (must exist before subscriptions FK)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coupons (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT UNIQUE NOT NULL,
  label            TEXT,
  influencer_name  TEXT,
  discount_type    TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed_cents')),
  discount_value   INTEGER NOT NULL,
  applicable_plans TEXT[] DEFAULT ARRAY['monthly','annual'],
  max_uses         INTEGER,          -- NULL = unlimited
  uses_count       INTEGER DEFAULT 0,
  valid_from       TIMESTAMPTZ DEFAULT now(),
  valid_until      TIMESTAMPTZ,      -- NULL = no expiry
  active           BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
-- No direct SELECT for authenticated users — access only via RPC

-- ─────────────────────────────────────────────────────────────
-- 3. promotions table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.promotions (
  id           TEXT PRIMARY KEY,  -- 'founders' | 'early_adopter'
  label        TEXT NOT NULL,
  price_cents  INTEGER NOT NULL,
  slots_total  INTEGER,
  slots_used   INTEGER DEFAULT 0,
  active_until TIMESTAMPTZ,
  active       BOOLEAN DEFAULT true
);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- Anyone can read active promotions (needed for pricing page)
CREATE POLICY "promotions_public_read" ON public.promotions
  FOR SELECT USING (true);

INSERT INTO public.promotions (id, label, price_cents, slots_total, slots_used, active_until, active)
VALUES
  ('founders',      'Fundadores',    24900, 500,  0, now() + interval '30 days', true),
  ('early_adopter', 'Early Adopter', 34900, NULL, 0, now() + interval '60 days', true)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 4. subscriptions table (history + idempotency)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  asaas_subscription_id TEXT NOT NULL,
  asaas_payment_id      TEXT UNIQUE,  -- DB-enforced idempotency
  plan                  TEXT NOT NULL CHECK (plan IN ('monthly','annual','founders','early_adopter')),
  amount_cents          INTEGER NOT NULL,
  status                TEXT NOT NULL,
  payment_method        TEXT,         -- 'CREDIT_CARD' | 'PIX' | 'BOLETO'
  event_type            TEXT,
  boleto_url            TEXT,
  coupon_id             UUID REFERENCES public.coupons(id),
  created_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription history
CREATE POLICY "subscriptions_user_select" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 5. webhook_events dead-letter table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   TEXT NOT NULL,
  payload      JSONB NOT NULL,
  processed    BOOLEAN DEFAULT false,
  error        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
-- service_role only — no user policies

-- ─────────────────────────────────────────────────────────────
-- 6. validate_coupon RPC (no direct SELECT on coupons)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_coupon(p_code TEXT, p_plan TEXT)
RETURNS TABLE (
  valid           BOOLEAN,
  discount_type   TEXT,
  discount_value  INTEGER,
  final_price_cents INTEGER,
  label           TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_coupon public.coupons%ROWTYPE;
  v_base_price INTEGER;
BEGIN
  -- base prices in cents
  v_base_price := CASE p_plan
    WHEN 'monthly' THEN 7990
    WHEN 'annual'  THEN 69900  -- 69.90 × 12? or total? Design says R$699 total
    ELSE 0
  END;

  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE code = upper(trim(p_code))
    AND active = true
    AND p_plan = ANY(applicable_plans)
    AND (valid_from IS NULL OR valid_from <= now())
    AND (valid_until IS NULL OR valid_until > now())
    AND (max_uses IS NULL OR uses_count < max_uses);

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    true,
    v_coupon.discount_type,
    v_coupon.discount_value,
    CASE v_coupon.discount_type
      WHEN 'percent'     THEN v_base_price - (v_base_price * v_coupon.discount_value / 100)
      WHEN 'fixed_cents' THEN v_base_price - v_coupon.discount_value
    END,
    v_coupon.label;
END; $$;

GRANT EXECUTE ON FUNCTION public.validate_coupon(TEXT, TEXT) TO authenticated, anon;

-- ─────────────────────────────────────────────────────────────
-- 7. decrement_promotion_slot RPC
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decrement_promotion_slot(p_promotion_id TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.promotions
  SET slots_used = slots_used + 1
  WHERE id = p_promotion_id
    AND active = true
    AND (slots_total IS NULL OR slots_used < slots_total);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Promotion slot unavailable';
  END IF;
END; $$;

GRANT EXECUTE ON FUNCTION public.decrement_promotion_slot(TEXT) TO service_role;

-- ─────────────────────────────────────────────────────────────
-- 8. increment_coupon_uses RPC
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_coupon_uses(p_coupon_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.coupons
  SET uses_count = uses_count + 1
  WHERE id = p_coupon_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.increment_coupon_uses(UUID) TO service_role;

-- ─────────────────────────────────────────────────────────────
-- 9. Beta extension — new users get 1-month free trial
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    tier,
    questions_answered_today,
    last_reset_date,
    theme_preference,
    tier_expiry,
    subscription_status,
    beta_extension_claimed
  )
  VALUES (
    NEW.id,
    'paid',
    0,
    CURRENT_DATE,
    'dark',
    now() + interval '1 month',
    'none',
    false
  );
  RETURN NEW;
END; $$;
