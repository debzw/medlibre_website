# Report Auto-Correct Pipeline — Design Document

**Date:** 2026-03-23
**Status:** Approved — ready for implementation

---

## Understanding Summary

- **What:** An automated pipeline that processes user-submitted question error reports, evaluates them with Vertex AI (Gemini), notifies the admin by email with a proposed text fix, and — upon one-click approval — applies the fix to the database and notifies the reporter.
- **Why:** Reports currently land in the DB and are never acted on. This closes the loop: errors get fixed, reporters feel heard, admin retains full control.
- **Who:** Admin (owner) + authenticated users who submitted reports.
- **Key constraints:** Text-only fixes (typos, grammar, wrong answer key, wrong explanation). One-click approve/reject in admin email (no login required). 7-day token expiry. Reporter email from `user_profiles.email`.
- **Non-goals:** No auto-applying fixes without admin approval. No reporter notification on rejection. No structural/DeCS/relational corrections. No admin UI — email-only flow.

---

## Assumptions

1. `user_profiles.email` is populated for all authenticated users (nullable — missing email = no thank-you sent).
2. Admin email configured via `ADMIN_EMAIL` env var.
3. Vertex AI credentials stored as JSON string in `GOOGLE_APPLICATION_CREDENTIALS_JSON` env var (no filesystem — Vercel compatible).
4. Supabase Database Webhook configured on `INSERT` into `reports`, pointing to `POST /api/reports/process`, with `WEBHOOK_SECRET` in the `Authorization` header.
5. Only reports with `type === 'question'` are processed; other types are silently ignored.
6. The `proposed_fix` always patches exactly one field per report.

---

## Decision Log

| # | Decision | Alternatives Considered | Reason |
|---|----------|------------------------|--------|
| 1 | Next.js API Routes (Option A) | Supabase Edge Functions, Supabase DB triggers | Consistent with existing patterns; Node.js runtime needed for Vertex AI SDK; uses existing `WEBHOOK_SECRET` |
| 2 | Vertex AI / Gemini | Claude API, OpenAI | User requirement — credentials JSON file provided |
| 3 | Opaque UUID token in approve/reject URLs | Signed JWT, report ID in URL | No guessable data in URL; simpler to validate; already used by `verification_tokens` |
| 4 | Text-only fixes (scope A) | Structural fixes, relational fixes | User decision — keeps AI scope narrow and safe for medical content |
| 5 | No rejection notification to reporter | Notify on rejection | User decision — simpler UX, avoids user friction |
| 6 | Reporter email from `user_profiles` | Add email field to ReportDialog | Email already on file for auth users; no extra UI needed |
| 7 | Inline HTML emails (no React Email template) | React Email components | Consistent with `send-verification` pattern already in codebase |
| 8 | `report_approvals` as separate table | Columns on `reports` | Clean separation of concerns; token, diff, and AI output don't belong on the report row |

---

## Final Design

### 1. Data Layer

**New migration:** `supabase/migrations/20260323000000_create_report_approvals.sql`

```sql
CREATE TABLE report_approvals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id      UUID NOT NULL REFERENCES reports(id),
  token          UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status         TEXT NOT NULL DEFAULT 'pending',
  -- status values: pending | approved | rejected | expired
  ai_analysis    TEXT,
  proposed_fix   JSONB,
  -- shape: { "field": string, "old_value": string, "new_value": string } | null
  is_valid_error BOOLEAN,
  expires_at     TIMESTAMPTZ NOT NULL,
  resolved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON report_approvals (token);
CREATE INDEX ON report_approvals (report_id);
```

**`reports.status` lifecycle:** `pending → processing → resolved | dismissed | processing_failed`
No schema change to `reports` — `status` column already exists.

---

### 2. New Environment Variables

```
ADMIN_EMAIL=you@medlibre.com.br
GOOGLE_VERTEX_PROJECT=<gcp-project-id>
GOOGLE_VERTEX_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS_JSON=<full JSON string of service account file>
```

---

### 3. New Files

```
app/
  api/
    reports/
      process/route.ts      ← POST  (webhook receiver)
      approve/route.ts      ← GET   (approve link handler)
      reject/route.ts       ← GET   (reject link handler)
src/
  lib/
    vertexAI.ts             ← Vertex AI client + evaluateReport()
    reportEmails.ts         ← sendAdminReportEmail() + sendReporterThankYouEmail()
```

---

### 4. API Route: `POST /api/reports/process`

**Triggered by:** Supabase Database Webhook on `INSERT` into `reports`.

```
1.  Validate Authorization: Bearer <WEBHOOK_SECRET> → 401 if wrong
2.  Parse webhook payload → extract report row
3.  If report.type !== 'question' → return 200 (ignore)
4.  UPDATE reports SET status = 'processing' WHERE id = report.id
5.  Fetch question: SELECT * FROM questions WHERE id = report.target_id
    → If not found: UPDATE reports SET status = 'dismissed' → return 200
6.  Fetch reporter: SELECT email, full_name FROM user_profiles WHERE id = report.user_id
    (nullable — ok if missing)
7.  Call vertexAI.evaluateReport(question, report) → { is_valid_error, ai_analysis, proposed_fix }
8.  INSERT INTO report_approvals:
      { report_id, is_valid_error, ai_analysis, proposed_fix, expires_at: now()+7d }
9.  Send admin email (always — valid or not)
10. Return 200
```

---

### 5. Vertex AI Evaluation (`src/lib/vertexAI.ts`)

**Model:** `gemini-2.0-flash-001`
**Auth:** Exchange service account JSON → Google OAuth2 access token at runtime.

**System prompt:**
```
You are a medical question quality reviewer for a Brazilian medical residency
exam platform. Evaluate the user report and determine if it identifies a real
error in the question text. If yes, propose a minimal text-only fix to ONE field.
Respond ONLY with valid JSON matching the schema provided.
```

**Response schema:**
```typescript
{
  is_valid_error: boolean,
  ai_analysis: string,        // pt-BR, 2-3 sentences
  proposed_fix: {
    field: 'enunciado' | 'output_explicacao' | 'output_gabarito'
         | 'alternativa_a' | 'alternativa_b' | 'alternativa_c'
         | 'alternativa_d' | 'alternativa_e' | 'resposta_correta',
    old_value: string,
    new_value: string
  } | null
}
```

**Fallback:** If JSON parse fails → `{ is_valid_error: false, ai_analysis: 'Erro ao processar resposta da IA.', proposed_fix: null }`.

---

### 6. Admin Email

**From:** `MedLibre <institucional@medlibre.com.br>`
**To:** `ADMIN_EMAIL`
**Subject:** `[MedLibre] Relatório de erro — revisão necessária`

**Valid error variant** includes:
- Question number, banca, ano
- Report category + user description
- AI analysis paragraph
- Before/after diff of the proposed fix
- `[✅ APROVAR CORREÇÃO]` button → `GET /api/reports/approve?token=<uuid>`
- `[❌ REJEITAR]` button → `GET /api/reports/reject?token=<uuid>`
- Expiry notice: "Links expiram em 7 dias"

**Invalid error variant** includes same header info + AI analysis + "Nenhuma correção proposta."
No approve/reject buttons on invalid reports.

---

### 7. API Route: `GET /api/reports/approve?token=<uuid>`

```
1. SELECT * FROM report_approvals WHERE token = ?
2. If not found OR status !== 'pending' → return HTML: "Link inválido ou já utilizado"
3. If expires_at < now() → UPDATE status = 'expired' → return HTML: "Link expirado"
4. UPDATE questions SET [proposed_fix.field] = proposed_fix.new_value WHERE id = question_id
5. UPDATE report_approvals SET status = 'approved', resolved_at = now()
6. UPDATE reports SET status = 'resolved'
7. If reporter email exists → send thank-you email
8. Return HTML: "✓ Correção aplicada com sucesso"
```

---

### 8. API Route: `GET /api/reports/reject?token=<uuid>`

```
1. SELECT * FROM report_approvals WHERE token = ?
2. If not found OR status !== 'pending' → return HTML: "Link inválido ou já utilizado"
3. If expires_at < now() → UPDATE status = 'expired' → return HTML: "Link expirado"
4. UPDATE report_approvals SET status = 'rejected', resolved_at = now()
5. UPDATE reports SET status = 'dismissed'
6. Return HTML: "Relatório rejeitado."
```

---

### 9. Reporter Thank-You Email

**Subject:** `Obrigado pelo seu relatório — MedLibre`

**Content:**
```
Olá [full_name],

Identificamos e corrigimos o erro que você reportou na questão #[numero].

O que foi alterado:
  Campo:  [field label in pt-BR]
  Antes:  "[old_value]"
  Depois: "[new_value]"

Obrigado por nos ajudar a melhorar o MedLibre!
```

---

### 10. Supabase Webhook Configuration

In Supabase Dashboard → Database → Webhooks:
- **Table:** `reports`
- **Events:** `INSERT`
- **URL:** `https://medlibre.com.br/api/reports/process`
- **Headers:** `Authorization: Bearer <WEBHOOK_SECRET>`

---

## Implementation Plan

1. Write migration `20260323000000_create_report_approvals.sql`
2. Create `src/lib/vertexAI.ts` (auth + evaluateReport)
3. Create `src/lib/reportEmails.ts` (admin email + thank-you email)
4. Create `app/api/reports/process/route.ts`
5. Create `app/api/reports/approve/route.ts`
6. Create `app/api/reports/reject/route.ts`
7. Add env vars to `.env.local` and Vercel dashboard
8. Configure Supabase webhook
9. Test with a real report submission
