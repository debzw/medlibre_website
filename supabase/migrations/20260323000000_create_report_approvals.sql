-- Migration: create report_approvals table for the report auto-correct pipeline

CREATE TABLE IF NOT EXISTS public.report_approvals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id      UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  token          UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  ai_analysis    TEXT,
  proposed_fix   JSONB,
  -- proposed_fix shape: { "field": string, "old_value": string, "new_value": string } | null
  is_valid_error  BOOLEAN,
  reporter_email  TEXT,
  reporter_name   TEXT,
  expires_at      TIMESTAMPTZ NOT NULL,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_approvals_token_idx    ON public.report_approvals (token);
CREATE INDEX IF NOT EXISTS report_approvals_report_idx   ON public.report_approvals (report_id);
CREATE INDEX IF NOT EXISTS report_approvals_status_idx   ON public.report_approvals (status);

-- RLS: only service role can access this table (admin pipeline only)
ALTER TABLE public.report_approvals ENABLE ROW LEVEL SECURITY;

-- No public policies — accessed exclusively via service role key in API routes
