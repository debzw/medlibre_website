-- ============================================================
-- Cancel At Period End + Cancellation Requests
-- 2026-03-29
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. user_profiles: cancel_at_period_end flag
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;

-- ─────────────────────────────────────────────────────────────
-- 2. cancellation_requests table (refund requests — manual admin review)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cancellation_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  asaas_subscription_id TEXT,
  request_type          TEXT NOT NULL CHECK (request_type IN ('refund', 'cancel_future')),
  -- 'refund'        → within 7 days, admin handles manually
  -- 'cancel_future' → beyond 7 days, cancels via Asaas immediately
  feedback              TEXT,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'processed', 'rejected')),
  created_at            TIMESTAMPTZ DEFAULT now(),
  processed_at          TIMESTAMPTZ,
  processed_by          TEXT   -- admin identifier
);

ALTER TABLE public.cancellation_requests ENABLE ROW LEVEL SECURITY;

-- Users can read their own requests
CREATE POLICY "cancellation_requests_user_select"
  ON public.cancellation_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own requests
CREATE POLICY "cancellation_requests_user_insert"
  ON public.cancellation_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role has full access (admin operations)
CREATE POLICY "cancellation_requests_service_all"
  ON public.cancellation_requests
  FOR ALL USING (true) WITH CHECK (true);
