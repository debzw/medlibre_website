# Asaas Payment Integration — MedLibre

> Design approved: 2026-03-23 · Last updated: 2026-03-29

---

## Overview

MedLibre uses **Asaas** as its payment processor (Brazilian gateway). Users never leave the site — checkout is hosted on MedLibre with a tokenized form. Asaas handles PIX, credit card, and boleto.

The integration has four moving parts:

```
Browser → Next.js API routes → Asaas API
                ↑
Asaas Webhook → Next.js /api/asaas/webhook → Supabase Edge Function
                                                (process-payment-event)
                                                        ↑
                              Supabase Cron ← check-subscriptions (daily)
```

---

## Plans & Prices

| Plan | Price | Cycle | Notes |
|---|---|---|---|
| Mensal | R$ 79,90/mês | MONTHLY | No lock-in |
| Anual | R$ 699,00/ano | YEARLY | ~R$ 58,25/mês · save 26% |
| Fundadores | R$ 249,00/ano | YEARLY | 500 slots · 30-day promo |
| Early Adopter | R$ 349,00/ano | YEARLY | 60-day promo |

**Price floor:** R$ 249,00 (enforced server-side — no coupon or promo can go below).

**Coupon + promo stacking:** forbidden. Only one discount per checkout.

---

## Database Schema

### `user_profiles` — payment columns

| Column | Type | Description |
|---|---|---|
| `asaas_customer_id` | TEXT | Asaas customer ID (`cus_xxx`) |
| `asaas_subscription_id` | TEXT | Active Asaas subscription ID (`sub_xxx`) — NULL after cancellation |
| `subscription_status` | TEXT | `none` · `pending` · `active` · `overdue` · `cancelled` |
| `billing_cycle` | TEXT | `monthly` · `annual` · NULL |
| `tier_expiry` | TIMESTAMPTZ | When premium access expires. Used by cron to downgrade. |
| `cancel_at_period_end` | BOOLEAN | True when user cancelled future charges but access still active until `tier_expiry` |
| `beta_extension_claimed` | BOOLEAN | Whether beta extension was applied |

### `subscriptions` — payment history

Each confirmed (or attempted) payment creates a row. The `asaas_payment_id` column has a `UNIQUE` constraint to enforce idempotency at the DB level.

| Column | Description |
|---|---|
| `asaas_subscription_id` | Links back to `user_profiles` |
| `asaas_payment_id` | Unique per payment event — prevents duplicate processing |
| `plan` | `monthly` · `annual` · `founders` · `early_adopter` |
| `status` | `pending` · `confirmed` · `overdue` · `refunded` · `cancelled` |
| `payment_method` | `CREDIT_CARD` · `PIX` · `BOLETO` |
| `boleto_url` | Boleto/invoice URL for pending boleto payments |
| `coupon_id` | FK to `coupons` if applied |
| `created_at` | Used to calculate 7-day refund window and 14-day revocation |

### `cancellation_requests`

Records every user-initiated cancellation. Admin reviews refund requests here.

| Column | Description |
|---|---|
| `request_type` | `refund` (≤7 days) · `cancel_future` (>7 days) |
| `feedback` | User's cancellation reason (required for refund, optional for cancel_future) |
| `status` | `pending` · `processed` · `rejected` |
| `processed_at` / `processed_by` | Admin fills these when handling |

### `coupons`

Influencer/partner codes. Access only via `validate_coupon` RPC — no direct SELECT for authenticated users.

### `promotions`

Time/slot-based offers (Founders, Early Adopter). `slots_used` is incremented atomically via `decrement_promotion_slot` RPC.

### `webhook_events`

Dead-letter queue. Any webhook that fails processing lands here and is retried by the `check-subscriptions` cron every 5 minutes.

---

## Checkout Flow (step-by-step)

```
1. User selects plan on /pricing
2. CheckoutModal opens (hosted on MedLibre)
3. User enters billing info + payment method
4. POST /api/asaas/checkout
   a. Validate JWT → get user
   b. Idempotency check: already has asaas_subscription_id? → 409
   c. Validate coupon (server-side RPC) or promo slot
   d. Enforce price floor (R$249)
   e. findOrCreateCustomer on Asaas (lookup by email first)
   f. Write asaas_customer_id + subscription_status='pending' to DB
      (BEFORE calling Asaas — prevents race if browser closes)
   g. createSubscription on Asaas
   h. Write asaas_subscription_id + billing_cycle to DB
   i. Decrement promo slot / increment coupon uses (atomic RPCs)
   j. Fetch first payment details (PIX QR / boleto URL)
   k. Insert subscriptions row
   l. Return PIX QR code or boleto URL to browser
5. Browser shows PIX QR or boleto link
6. User pays → Asaas sends webhook
```

---

## Webhook Flow

**Entry point:** `POST /api/asaas/webhook` (Next.js route, not shown in code — validates Asaas signature, writes to `webhook_events`, then calls `process-payment-event` Edge Function).

### `process-payment-event` Edge Function

Handles these Asaas event types:

#### `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED`
- Sets `tier = 'paid'`, `subscription_status = 'active'`
- Sets `tier_expiry`:
  - Annual: `now() + 370 days` (365 + 5 grace)
  - Monthly: `now() + 35 days` (30 + 5 grace)
- Upserts `subscriptions` row (idempotent via `asaas_payment_id`)

#### `PAYMENT_AWAITING_RISK_ANALYSIS`
- Sets `subscription_status = 'pending'` only (no tier change)

#### `PAYMENT_OVERDUE`
- Sets `subscription_status = 'overdue'`
- Sends overdue warning email via Resend

#### `PAYMENT_REFUNDED` / `PAYMENT_DELETED`
- Immediate revocation: `tier = 'free'`, `tier_expiry = now()`, `subscription_status = 'cancelled'`
- Clears `asaas_subscription_id`
- Sends cancellation email

#### `SUBSCRIPTION_DELETED`
- **Checks `cancel_at_period_end` flag:**
  - `true` (user-initiated graceful cancel):
    → Sets `subscription_status = 'cancelled'`, clears `asaas_subscription_id`
    → Does NOT touch `tier` or `tier_expiry` — access preserved until natural expiry
    → `check-subscriptions` cron handles downgrade when `tier_expiry` passes
  - `false` (admin-initiated delete):
    → Immediate full revocation (same as PAYMENT_REFUNDED)
    → Sends cancellation email

---

## Cancellation Flow

Two paths determined by subscription age (`subscriptions.created_at`):

### Within 7 days — Refund Request

```
1. User clicks "Gerenciar Assinatura" on /profile (Assinatura tab)
2. System checks subscription age → ≤ 7 days
3. Dialog shows: "Solicitar reembolso" + required feedback field
4. POST /api/asaas/cancel { feedback }
5. Server: inserts cancellation_requests row (type='refund', status='pending')
6. Does NOT call Asaas — admin reviews manually
7. User sees: "Enviado ao nosso time. Em breve entraremos em contato via email."
8. User remains premium while admin handles
9. When admin cancels via Asaas dashboard:
   → Asaas fires PAYMENT_REFUNDED/SUBSCRIPTION_DELETED webhook
   → Immediate access revocation
```

**Admin action:** Check `cancellation_requests` table for `request_type='refund'` and `status='pending'`. Process refund in Asaas dashboard, then update `status='processed'`.

### After 7 days — Cancel Future Invoices

```
1. User clicks "Gerenciar Assinatura"
2. System checks subscription age → > 7 days
3. Dialog shows: cancellation info + optional feedback
4. POST /api/asaas/cancel { feedback }
5. Server:
   a. Sets cancel_at_period_end = true (BEFORE Asaas call)
   b. Calls DELETE /subscriptions/{id} on Asaas
   c. On Asaas error → rollback cancel_at_period_end = false
   d. Inserts cancellation_requests row (type='cancel_future', status='processed')
6. Asaas fires SUBSCRIPTION_DELETED webhook
7. Webhook sees cancel_at_period_end=true → preserves tier_expiry
8. User sees: "Cancelamento concluído. Recursos premium ativos até [data]."
9. check-subscriptions cron downgrades user when tier_expiry passes
```

---

## `check-subscriptions` Cron (daily)

Runs as a Supabase Edge Function on a schedule.

### Step 1 — Downgrade expired users
Query: `tier='paid' AND tier_expiry < now() AND subscription_status != 'active'`

Covers:
- Trial users whose free month ended
- Cancelled users (`cancel_at_period_end=true`) whose period ended
- Overdue users who never paid

Action: `tier = 'free'`, `cancel_at_period_end = false`

> **Why skip `active` users?** Active users get their `tier_expiry` refreshed on every `PAYMENT_CONFIRMED` webhook. The cron never touches them — Asaas drives their lifecycle.

### Step 2 — Revoke unconfirmed payments after 14 days
Query: `subscriptions.status='pending' AND subscriptions.created_at < now()-14d`

Crossed with `user_profiles.subscription_status='pending'`

Action: `tier='free'`, `subscription_status='cancelled'`, `asaas_subscription_id=null`, `tier_expiry=now()`

This catches users who initiated checkout (PIX/boleto) but never paid within 14 days.

### Step 3 — Trial expiry warnings (7 days before)
Emails users with `subscription_status='none'` whose `tier_expiry` falls in the next 7 days.

### Step 4 — Retry dead-letter webhook events
Re-processes `webhook_events` rows where `processed=false` and `created_at < now()-5min`.

---

## `tier_expiry` and Bonus Days (feedback/referral)

`tier_expiry` is the **single access gate**. Multiple systems can extend it:
- Payment webhook: sets it on each confirmed payment
- Feedback/referral system: extends it by adding days

**No conflict by design:** Cancellation (`cancel_at_period_end`) does not touch `tier_expiry`. The user keeps whatever expiry they have (paid + bonus). The cron handles natural expiry. This means a user who earned referral bonus days keeps them even after cancelling their subscription.

---

## Mock Mode

Set `ASAAS_MOCK=true` (only works in non-production) to bypass all Asaas API calls. Mock functions return fake IDs. Useful for local development without a real Asaas sandbox key.

---

## Environment Variables

| Variable | Description |
|---|---|
| `ASAAS_BASE_URL` | Asaas API base (default: `https://api.asaas.com/v3`) |
| `ASAAS_API_KEY` | Asaas secret API key |
| `ASAAS_MOCK` | `true` to enable mock mode (non-production only) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server-side only) |
| `RESEND_API_KEY` | Resend API key for transactional emails |

---

## Error Handling

- **Asaas errors** are translated to PT-BR via `translateAsaasError()` in `src/lib/asaas.ts`
- **Webhook failures** land in `webhook_events` dead-letter queue and are retried by cron
- **Checkout race condition** prevented by writing `subscription_status='pending'` to DB before calling Asaas
- **Duplicate payment events** prevented by `UNIQUE(asaas_payment_id)` on `subscriptions` table
- **Cancel rollback** — if Asaas `DELETE` fails, `cancel_at_period_end` is reset to `false`

---

## Key Decisions Log

| Decision | Rationale |
|---|---|
| Asaas over Stripe | Brazilian processor, PIX support, local compliance |
| Read subscription status from DB only | Avoids latency of live Asaas API call on every page load |
| `cancel_at_period_end` flag | Lets webhook distinguish user-initiated graceful cancel from admin delete |
| Refund handled manually | Admin needs to verify legitimacy; no automatic storno risk |
| 7-day window from `subscriptions.created_at` | User intent at signup, not payment confirmation (avoids gaming) |
| 14-day unconfirmed revocation | Prevents free premium from abandoned PIX/boleto checkouts |
| Price floor R$249 | Coupon/promo abuse prevention; enforced server-side |
| Coupon+promo stacking forbidden | Margin protection |
| `tier_expiry` untouched on cancel_future | Bonus days (referral/feedback) are preserved — simpler, fairer |
