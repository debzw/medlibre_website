import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  findOrCreateCustomer,
  createSubscription,
  getSubscriptionPayments,
  translateAsaasError,
  type BillingType,
  type BillingCycle,
  type AsaasCreditCard,
  type AsaasCreditCardHolderInfo,
} from '@/lib/asaas'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

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
    .select('asaas_subscription_id, asaas_customer_id')
    .eq('id', user.id)
    .single()

  if (currentProfile?.asaas_subscription_id) {
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

  // Enforce R$249 price floor
  const PRICE_FLOOR_CENTS = 24900
  if (finalPriceCents < PRICE_FLOOR_CENTS) {
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

    // Fetch first payment details (PIX QR / boleto URL)
    const payments = await getSubscriptionPayments(subscription.id)
    const firstPayment = payments[0]

    // Insert subscriptions row
    await adminSupabase.from('subscriptions').insert({
      user_id: user.id,
      asaas_subscription_id: subscription.id,
      asaas_payment_id: firstPayment?.id ?? null,
      plan,
      amount_cents: finalPriceCents,
      status: 'pending',
      payment_method: paymentMethod,
      boleto_url: firstPayment?.bankSlipUrl ?? firstPayment?.invoiceUrl ?? null,
      coupon_id: couponId,
    })

    return NextResponse.json({
      subscriptionId: subscription.id,
      status: subscription.status,
      pixQrCode: firstPayment?.pixQrCodeImage ?? null,
      pixCopiaECola: firstPayment?.pixCopiaECola ?? null,
      boletoUrl: firstPayment?.bankSlipUrl ?? firstPayment?.invoiceUrl ?? null,
      nextDueDate: subscription.nextDueDate,
    })
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    console.error('checkout error', raw)
    return NextResponse.json({ error: translateAsaasError(raw) }, { status: 502 })
  }
}
