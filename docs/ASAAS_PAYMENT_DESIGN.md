# Asaas Payment Integration — Design Document

> Status: **APPROVED** · Reviewed via multi-agent brainstorming · 2026-03-23

---

## Understanding Summary

- **What:** Full Asaas payment integration — monthly + annual subscriptions, PIX + boleto + card, Fundadores promo (R$249/ano, 500 slots), influencer coupon codes, webhook pipeline
- **Why:** Beta ends April 1 2026; extended to April 30 for existing users; new signups get 1-month free trial; need to accept payments before anyone gets downgraded
- **Who:** Brazilian medical students preparing for residency exams (ENARE)
- **Stack:** Next.js 15 App Router, Supabase, Vercel, Asaas API, TypeScript, Tailwind, Radix UI
- **Explicit non-goals (this phase):** Modo Simulado, heatmaps, Premium+ tier, B2B billing, admin panel

---

## Assumptions

- Asaas sandbox credentials obtained before development begins
- Hosting is Vercel — Next.js API routes supported, 10s default timeout
- `NEXT_PUBLIC_APP_URL` = `https://medlibre.com.br`
- `ASAAS_WEBHOOK_TOKEN` stored as server-only env var
- `ASAAS_API_KEY` stored as server-only env var, never exposed to client
- `ASAAS_MOCK=true` only valid when `NODE_ENV !== 'production'`
- PIX + boleto subscriptions: tier stays `paid` while charge is `PENDING`; downgrade only when `tier_expiry` passes naturally
- Annual tier_expiry = now() + 370 days (5-day grace); monthly = now() + 35 days (5-day grace)

---

## Plans & Pricing

| Plan | Preço | Total Anual | Asaas billingCycle |
|---|---|---|---|
| Mensal — Sem Compromisso | R$79,90/mês | R$958,80 | `MONTHLY` |
| Anual — Acesso Completo | R$69,90×12 | R$699,00 (PIX/Boleto à vista) | `YEARLY` |
| Influenciador (25% off) | R$59,90/mês | — | `MONTHLY` (via coupon) |
| Fundadores (promo) | — | R$249,00 | `YEARLY` |
| Early Adopter (promo) | — | R$349,00 | `YEARLY` |

**Rules:** Never price below R$249/ano. Always show R$79,90 riscado next to R$69,90 on annual card.

---

## Database Schema

### 1. `user_profiles` additions

```sql
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none',
  -- 'none' | 'pending' | 'active' | 'overdue' | 'cancelled'
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT;
  -- 'monthly' | 'annual' | NULL
```

### 2. `subscriptions` table (history + dead-letter)

```sql
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  asaas_subscription_id TEXT NOT NULL,
  asaas_payment_id TEXT UNIQUE,        -- UNIQUE for idempotency
  plan TEXT NOT NULL,                  -- 'monthly'|'annual'|'founders'|'early_adopter'
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL,
  payment_method TEXT,                 -- 'CREDIT_CARD'|'PIX'|'BOLETO'
  event_type TEXT,
  boleto_url TEXT,                     -- persisted for boleto recovery
  coupon_id UUID REFERENCES public.coupons(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: users SELECT own rows; service_role INSERT/UPDATE
```

### 3. `webhook_events` table (dead-letter queue)

```sql
CREATE TABLE public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);
-- RLS: service_role only
```

### 4. `promotions` table

```sql
CREATE TABLE public.promotions (
  id TEXT PRIMARY KEY,           -- 'founders' | 'early_adopter'
  label TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  slots_total INTEGER,
  slots_used INTEGER DEFAULT 0,
  active_until TIMESTAMPTZ,
  active BOOLEAN DEFAULT true
);

INSERT INTO public.promotions VALUES
  ('founders', 'Fundadores', 24900, 500, 0, now() + interval '30 days', true),
  ('early_adopter', 'Early Adopter', 34900, NULL, 0, now() + interval '60 days', true);
```

### 5. `coupons` table

```sql
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label TEXT,
  influencer_name TEXT,
  discount_type TEXT NOT NULL,         -- 'percent' | 'fixed_cents'
  discount_value INTEGER NOT NULL,
  applicable_plans TEXT[] DEFAULT ARRAY['monthly','annual'],
  max_uses INTEGER,                    -- NULL = unlimited
  uses_count INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,             -- NULL = no expiry
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: NO direct SELECT for authenticated users
-- Access only via server-side RPC validate_coupon(code, plan)
```

### 6. Beta extension migration

Beta extension to 2026-04-30 is **NOT automatic** — requires email validation.

**Flow:**
1. Send validation email to all current beta users (tier='paid', tier_expiry='2026-04-01')
2. Email contains a signed link: `/api/beta/confirm-extension?token=<jwt>`
3. User clicks → API route verifies JWT → sets `tier_expiry = '2026-04-30'`
4. Users who do NOT click are downgraded naturally on April 1 by `check-subscriptions`

```sql
-- Add column to track whether beta extension was claimed
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS beta_extension_claimed BOOLEAN DEFAULT false;

-- New users: 1 month free trial (automatic, no validation needed)
CREATE OR REPLACE FUNCTION public.handle_new_user() ...
  tier_expiry = now() + interval '1 month',
  subscription_status = 'none',
  beta_extension_claimed = false
```

**New API route:** `GET /api/beta/confirm-extension?token=<jwt>`
- Validates JWT (signed with `SUPABASE_JWT_SECRET`, contains `user_id`, expires April 1)
- Sets `tier_expiry = '2026-04-30'`, `beta_extension_claimed = true`
- Redirects to `/dashboard?beta=extended`

---

## API Routes (Next.js — `src/app/api/asaas/`)

### `POST /api/asaas/checkout`

```
Auth: required
Body: { plan, paymentMethod, cardToken?, billingInfo, couponCode?, promotionId? }

1. Guard: if user_profiles.asaas_subscription_id IS NOT NULL → return 409 (already subscribed)
2. Validate coupon OR promotion (not both — stacking forbidden)
3. Check promotion slots (SELECT FOR UPDATE on promotions row)
4. Calculate final price; enforce R$249 floor
5. Create/upsert Asaas customer by email
6. Write asaas_customer_id + subscription_status='pending' to user_profiles
7. Create Asaas subscription → get asaas_subscription_id
8. Write asaas_subscription_id + billing_cycle to user_profiles
9. Decrement promotions.slots_used (if promo) via RPC
10. Increment coupons.uses_count (if coupon) via RPC
11. Insert into subscriptions (status='pending', boleto_url if applicable)
12. Return { subscriptionId, status, pixQrCode?, boletoUrl?, nextDueDate }
```

### `POST /api/asaas/validate-coupon`

```
Auth: none (rate-limited — 10 req/min per IP)
Body: { code, plan }
→ Calls server-side validate_coupon(code, plan) RPC
→ Returns { valid, discountType, discountValue, finalPriceCents, label }
```

### `GET /api/asaas/subscription`

```
Auth: required
→ Reads from user_profiles (NOT a live Asaas API call)
→ Returns { status, nextDueDate, billingCycle, plan, boletoUrl? }
```

### `POST /api/asaas/change-plan`

```
Auth: required
Body: { newPlan: 'annual' }
→ Cancels existing Asaas subscription
→ Creates new annual subscription
→ Updates user_profiles.billing_cycle, asaas_subscription_id
→ Returns { subscriptionId, nextDueDate }
```

### `POST /api/webhooks/asaas`

```
Auth: header asaas-access-token validated via constant-time compare
→ Insert raw payload into webhook_events (processed=false)
→ Call Supabase Edge Function process-payment-event
→ On Edge Function success: mark webhook_events.processed=true
→ On Edge Function failure: mark webhook_events.error, leave processed=false
→ Return 200 immediately (Asaas expects fast response)
```

---

## Supabase Edge Functions

### `process-payment-event` (new)

```
Input: { eventType, payment, subscription }
Auth: Bearer SUPABASE_SERVICE_ROLE_KEY (called only from Next.js webhook route)

PAYMENT_CONFIRMED | PAYMENT_RECEIVED
  → Find user by asaas_subscription_id
  → tier = 'paid', subscription_status = 'active'
  → tier_expiry = now() + 35 days (monthly) OR 370 days (annual)
  → INSERT subscriptions (status='confirmed')

PAYMENT_AWAITING_RISK_ANALYSIS
  → subscription_status = 'pending'
  → DO NOT activate tier

PAYMENT_OVERDUE
  → subscription_status = 'overdue'
  → tier stays 'paid' (tier_expiry handles actual downgrade)
  → Send warning email via Resend
  → INSERT subscriptions (status='overdue')

PAYMENT_REFUNDED | PAYMENT_DELETED | SUBSCRIPTION_DELETED
  → tier = 'free', tier_expiry = now()
  → subscription_status = 'cancelled'
  → asaas_subscription_id = NULL
  → Send cancellation email via Resend
  → INSERT subscriptions (status='cancelled'/'refunded')
```

### `check-subscriptions` (updated)

```
CHANGE: Skip users with subscription_status = 'active'
Only downgrade users where:
  - tier = 'paid'
  - tier_expiry < now()
  - subscription_status IN ('none', 'pending', 'overdue')
  (i.e., beta/trial users or genuinely lapsed subscribers)

ADD: Retry unprocessed webhook_events older than 5 minutes
  → Re-call process-payment-event for each
  → Mark processed=true on success
```

---

## Frontend

### `/pricing` page (`src/app/pricing/page.tsx`)

- Toggle: Mensal / Anual (Anual default, highlighted)
- Fundadores banner (if `promotions.active=true AND slots_used < slots_total`):
  - Price: R$249/ano, countdown to `active_until`, slot progress bar
- Two plan cards with feature comparison table
- Coupon field: `[__________] [Aplicar]` → shows final price inline
- All "Assinar" buttons open `<CheckoutModal />`

### `CheckoutModal` (`src/components/CheckoutModal.tsx`)

- Plan summary (with coupon/promo discount shown)
- Payment method tabs: [Cartão] [PIX] [Boleto]
- Cartão: Asaas.js tokenized form — name, number, expiry, CVV
- Submit button disabled on first click (prevents double-submit)
- Portuguese error message map for Asaas error codes
- PIX: show QR code → poll `GET /api/asaas/subscription` every 5s for up to 5 min → auto-advance to success
- Boleto: show link + instructions ("Acesso ativado após compensação — 1 a 3 dias úteis")
- Success: redirect to `/dashboard` with toast "Bem-vindo ao Premium!"

### `LimiteAtingidoModal` (`src/components/LimiteAtingidoModal.tsx`)

- Triggered when Explorador hits 20q/day limit
- If Fundadores active: show R$249 offer + countdown + slot bar
- If Fundadores expired/sold out: show standard annual (R$39,90×12)
- CTA opens `<CheckoutModal />` pre-filled with selected plan
- Secondary action: "Continuar no plano gratuito" (dismisses modal)

### Trial expiry banner

- Shown when `tier_expiry - now() < 7 days` AND `subscription_status = 'none'`
- "Seu período de teste termina em X dias — [Assinar agora]"

### Boleto recovery (`/dashboard`)

- If `subscription_status = 'pending'` AND `payment_method = 'BOLETO'`
- Show "Pagamento pendente" card with boleto link from `subscriptions.boleto_url`

---

## Decision Log

| # | Decision | Alternatives | Reason |
|---|---|---|---|
| 1 | Asaas (not Stripe) | Stripe | Brazilian processor required |
| 2 | Asaas native Subscriptions | Manual charge scheduling | Asaas manages recurring billing |
| 3 | MedLibre-hosted tokenized form | Asaas Payment Link | User never leaves the site |
| 4 | Beta → 2026-04-30; new users 1-month trial | Ship by April 1 | More time to build + test |
| 5 | user_profiles fast ref + subscriptions history | One table | Fast tier checks + full audit trail |
| 6 | promotions table with slots_used counter | RPC row lock / no hard limit | Simple, reliable at expected scale |
| 7 | Next.js validates webhook → Edge Function updates DB | All in one place | Security separation + DB colocation |
| 8 | PIX + boleto + card in scope | Card only | Brazilian market requires it |
| 9 | coupons table (code-based) separate from promotions | Single table | Different mechanics, different use cases |
| A | Write pending_asaas_subscription_id before calling Asaas | Write after | Prevents webhook timing race |
| B | Disable submit + guard on existing subscription_id | None | Prevents double-submit |
| C | Coupon + promo stacking forbidden | Allow stacking | Protect R$249 price floor |
| D | UNIQUE (asaas_payment_id) on subscriptions | App-level check only | DB-enforced idempotency |
| E | check-subscriptions skips subscription_status='active' | No change | Prevents cron from downgrading paying users |
| F | webhook_events dead-letter table + cron retry | Accept event loss | Ensures no payment event is silently lost |
| G | GET /api/asaas/subscription reads from DB only | Live Asaas API call | Eliminates 200-500ms latency |
| H | PAYMENT_REFUNDED → immediate downgrade | Grace period | Refunds are explicit cancellations |
| I | PAYMENT_AWAITING_RISK_ANALYSIS → status='pending', no tier | Activate optimistically | Avoid activating fraudulent payments |
| J | POST /api/asaas/change-plan for monthly→annual | Cancel + re-subscribe manually | Primary conversion goal — must be frictionless |
| K | Coupons via RPC only, no direct SELECT | RLS active=true | Prevents coupon code enumeration |
| L | Trial expiry banner at <7 days | No in-app warning | Prevents surprise downgrade experience |
| M | boleto_url persisted on subscriptions row | Require re-checkout | Boleto recovery without duplicate subscription |
| N | Portuguese error message map in CheckoutModal | Raw Asaas errors | UX — errors must be in Portuguese |

---

## Environment Variables Required

```bash
# Server-only (never NEXT_PUBLIC_)
ASAAS_API_KEY=              # Asaas API key
ASAAS_WEBHOOK_TOKEN=        # Token for webhook validation
ASAAS_BASE_URL=             # https://api.asaas.com/v3 (prod) or sandbox URL
ASAAS_MOCK=                 # 'true' only in dev/test, guarded by NODE_ENV check

# Already exists
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
RESEND_API_KEY=
```

---

## Implementation Order

1. **Migrations** — schema changes, beta extension, handle_new_user update
2. **`src/lib/asaas.ts`** — Asaas API client wrapper
3. **Supabase Edge Function** — `process-payment-event`
4. **Update `check-subscriptions`** — skip active subscribers, add retry cron
5. **API routes** — checkout, validate-coupon, subscription, change-plan, webhook
6. **Frontend** — /pricing page, CheckoutModal, LimiteAtingidoModal, trial banner, boleto recovery
7. **End-to-end test** — sandbox: card, PIX, boleto, webhook, refund, upgrade flow
