import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import {
  findOrCreateCustomer,
  createSubscription,
  getSubscriptionPayments,
  getPaymentPixQrCode,
  translateAsaasError,
  type BillingType,
  type BillingCycle,
  type AsaasCreditCard,
  type AsaasCreditCardHolderInfo,
} from '@/lib/asaas'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = 'Medlibre <noreply@medlibre.com.br>'

const PLAN_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  annual: 'Anual',
  founders: 'Fundadores',
  early_adopter: 'Early Adopter',
}

function pixConfirmationHtml(opts: {
  name: string
  pixCopiaECola: string
  pixQrCode: string | null
  plan: string
  amountReais: number
}): string {
  const { name, pixCopiaECola, pixQrCode, plan, amountReais } = opts
  const planLabel = PLAN_LABELS[plan] ?? plan
  const amountFmt = amountReais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1a1a2e">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:32px 40px;text-align:center">
            <p style="margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:.08em;color:#93c5fd;text-transform:uppercase">Medlibre Premium</p>
            <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff">Quase lá! 🎉</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px">
            <p style="margin:0 0 20px;font-size:16px;line-height:1.6">
              Olá, <strong>${name.split(' ')[0]}</strong>!<br><br>
              Obrigado por escolher o <strong>Medlibre Premium</strong>. Sua assinatura do plano <strong>${planLabel}</strong> (${amountFmt}) está quase ativa — só falta concluir o pagamento via PIX.
            </p>

            <!-- QR Code -->
            ${pixQrCode ? `
            <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#374151;text-align:center">Escaneie o QR Code:</p>
            <div style="text-align:center;margin-bottom:24px">
              <img src="${pixQrCode}" alt="QR Code PIX" width="180" height="180"
                style="border:4px solid #e5e7eb;border-radius:8px;display:inline-block">
            </div>` : ''}

            <!-- Copia e Cola -->
            <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#374151">Ou copie o código PIX:</p>
            <div style="background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;word-break:break-all;font-family:monospace;font-size:12px;color:#374151;margin-bottom:24px">
              ${pixCopiaECola}
            </div>

            <!-- Info box -->
            <div style="background:#eff6ff;border-left:4px solid #2563eb;border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:28px">
              <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.5">
                ⏱ O PIX expira em <strong>24 horas</strong>. Assim que identificarmos o pagamento, seu acesso Premium será ativado automaticamente.
              </p>
            </div>

            <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6">
              Se tiver qualquer dúvida, responda este e-mail ou acesse o <a href="https://medlibre.com.br/dashboard" style="color:#2563eb;text-decoration:none;font-weight:600">seu painel</a>.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb">
            <p style="margin:0;font-size:12px;color:#9ca3af">
              © ${new Date().getFullYear()} Medlibre · <a href="https://medlibre.com.br" style="color:#9ca3af">medlibre.com.br</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

const adminSupabase = createClient(SUPABASE_URL, SERVICE_KEY)

// Price in cents
const PLAN_PRICES: Record<string, number> = {
  monthly:      7990,
  annual:       69900,  // R$699 total
  founders:     24900,
  early_adopter: 34900,
}

const PLAN_CYCLE: Record<string, BillingCycle> = {
  monthly:      'MONTHLY',
  annual:       'YEARLY',
  founders:     'YEARLY',
  early_adopter: 'YEARLY',
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userSupabase = createClient(SUPABASE_URL, ANON_KEY)
  const { data: { user }, error: authError } = await userSupabase.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    plan: string
    paymentMethod: BillingType
    cardToken?: AsaasCreditCard
    holderInfo?: AsaasCreditCardHolderInfo
    billingInfo: { name: string; email: string; cpfCnpj?: string; phone?: string }
    couponCode?: string
    promotionId?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const { plan, paymentMethod, cardToken, holderInfo, billingInfo, couponCode, promotionId } = body

  if (!plan || !paymentMethod || !billingInfo) {
    return NextResponse.json({ error: 'Dados obrigatórios ausentes.' }, { status: 400 })
  }

  if (paymentMethod === 'CREDIT_CARD' && (!cardToken || !holderInfo)) {
    return NextResponse.json({ error: 'Dados do cartão são obrigatórios.' }, { status: 400 })
  }

  if (!PLAN_PRICES[plan]) {
    return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 })
  }

  // Guard: coupon + promo stacking forbidden
  if (couponCode && promotionId) {
    return NextResponse.json({ error: 'Não é possível combinar cupom e promoção.' }, { status: 400 })
  }

  // Idempotency guard: already subscribed?
  const { data: currentProfile } = await adminSupabase
    .from('user_profiles')
    .select('asaas_subscription_id, asaas_customer_id, subscription_status')
    .eq('id', user.id)
    .single()

  if (currentProfile?.asaas_subscription_id) {
    // If pending (PIX not paid yet), return existing QR code instead of blocking
    if (currentProfile.subscription_status === 'pending') {
      try {
        const payments = await getSubscriptionPayments(currentProfile.asaas_subscription_id)
        const payment = payments[0]
        let pixQrCode: string | null = null
        let pixCopiaECola: string | null = null
        if (payment?.id) {
          const pixData = await getPaymentPixQrCode(payment.id)
          pixQrCode = pixData.encodedImage ? `data:image/png;base64,${pixData.encodedImage}` : null
          pixCopiaECola = pixData.payload ?? null
        }
        return NextResponse.json({
          subscriptionId: currentProfile.asaas_subscription_id,
          status: 'PENDING',
          pixQrCode,
          pixCopiaECola,
        })
      } catch {
        // Fall through to error if we can't fetch the existing payment
      }
    }
    return NextResponse.json({ error: 'Você já possui uma assinatura ativa.' }, { status: 409 })
  }

  let finalPriceCents = PLAN_PRICES[plan]
  let couponId: string | null = null

  // Validate coupon (server-side)
  if (couponCode) {
    const { data: couponData } = await adminSupabase.rpc('validate_coupon', {
      p_code: couponCode,
      p_plan: plan,
    })
    const row = Array.isArray(couponData) ? couponData[0] : couponData
    if (!row?.valid) {
      return NextResponse.json({ error: 'Cupom inválido ou expirado.' }, { status: 400 })
    }
    finalPriceCents = row.final_price_cents
    // Fetch coupon id
    const { data: couponRow } = await adminSupabase
      .from('coupons')
      .select('id')
      .eq('code', couponCode.toUpperCase().trim())
      .single()
    couponId = couponRow?.id ?? null
  }

  // Validate & decrement promotion slot (SELECT FOR UPDATE via RPC)
  if (promotionId) {
    const { data: promo } = await adminSupabase
      .from('promotions')
      .select('price_cents, slots_total, slots_used, active, active_until')
      .eq('id', promotionId)
      .single()

    if (!promo || !promo.active) {
      return NextResponse.json({ error: 'Promoção não encontrada ou encerrada.' }, { status: 400 })
    }
    if (promo.active_until && new Date(promo.active_until) < new Date()) {
      return NextResponse.json({ error: 'Promoção expirada.' }, { status: 400 })
    }
    if (promo.slots_total !== null && promo.slots_used >= promo.slots_total) {
      return NextResponse.json({ error: 'Vagas esgotadas.' }, { status: 400 })
    }

    finalPriceCents = promo.price_cents
  }

  // Enforce R$249 price floor — only when a coupon or promotion discount was applied
  // (prevents discounting annual below the founders price; does not affect base plan prices)
  const PRICE_FLOOR_CENTS = 24900
  if ((couponCode || promotionId) && finalPriceCents < PRICE_FLOOR_CENTS) {
    finalPriceCents = PRICE_FLOOR_CENTS
  }

  const finalPriceReais = finalPriceCents / 100

  try {
    // Find or create Asaas customer
    const customer = await findOrCreateCustomer({
      name: billingInfo.name,
      email: billingInfo.email,
      cpfCnpj: billingInfo.cpfCnpj,
      phone: billingInfo.phone,
    })

    // Write customer ID + pending status BEFORE calling Asaas (prevents race)
    await adminSupabase
      .from('user_profiles')
      .update({
        asaas_customer_id: customer.id,
        subscription_status: 'pending',
      })
      .eq('id', user.id)

    const nextDueDate = new Date().toISOString().slice(0, 10)

    const subscription = await createSubscription({
      customer: customer.id,
      billingType: paymentMethod,
      value: finalPriceReais,
      nextDueDate,
      cycle: PLAN_CYCLE[plan],
      description: `MedLibre ${plan}`,
      ...(paymentMethod === 'CREDIT_CARD' && cardToken
        ? { creditCard: cardToken, creditCardHolderInfo: holderInfo }
        : {}),
    })

    // Write subscription ID + billing_cycle
    await adminSupabase
      .from('user_profiles')
      .update({
        asaas_subscription_id: subscription.id,
        billing_cycle: ['annual', 'founders', 'early_adopter'].includes(plan) ? 'annual' : 'monthly',
      })
      .eq('id', user.id)

    // Decrement promo slot (atomic via RPC)
    if (promotionId) {
      await adminSupabase.rpc('decrement_promotion_slot', { p_promotion_id: promotionId })
    }

    // Increment coupon uses
    if (couponId) {
      await adminSupabase.rpc('increment_coupon_uses', { p_coupon_id: couponId })
    }

    // Fetch first payment details (PIX QR code)
    const payments = await getSubscriptionPayments(subscription.id)
    const firstPayment = payments[0]

    // Fetch PIX QR code via dedicated endpoint (not included in list response)
    let pixQrCode: string | null = null
    let pixCopiaECola: string | null = null
    if (paymentMethod === 'PIX' && firstPayment?.id) {
      try {
        const pixData = await getPaymentPixQrCode(firstPayment.id)
        pixQrCode = pixData.encodedImage ? `data:image/png;base64,${pixData.encodedImage}` : null
        pixCopiaECola = pixData.payload ?? null
      } catch { /* ignore — user can still use copia e cola */ }
    }

    // Send PIX confirmation email (fire-and-forget)
    if (paymentMethod === 'PIX' && pixCopiaECola && resend) {
      resend.emails.send({
        from: FROM,
        to: [billingInfo.email],
        subject: 'Seu PIX para ativar o Medlibre Premium',
        html: pixConfirmationHtml({
          name: billingInfo.name,
          pixCopiaECola,
          pixQrCode,
          plan,
          amountReais: finalPriceReais,
        }),
      }).catch(console.error)
    }

    // Insert subscriptions row
    await adminSupabase.from('subscriptions').insert({
      user_id: user.id,
      asaas_subscription_id: subscription.id,
      asaas_payment_id: firstPayment?.id ?? null,
      plan,
      amount_cents: finalPriceCents,
      status: 'pending',
      payment_method: paymentMethod,
      coupon_id: couponId,
    })

    return NextResponse.json({
      subscriptionId: subscription.id,
      status: subscription.status,
      pixQrCode,
      pixCopiaECola,
      nextDueDate: subscription.nextDueDate,
    })
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    console.error('checkout error', raw)
    return NextResponse.json({ error: translateAsaasError(raw) }, { status: 502 })
  }
}
