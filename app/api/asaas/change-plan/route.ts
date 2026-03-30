import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  cancelSubscription,
  createSubscription,
  getSubscriptionPayments,
  translateAsaasError,
  type BillingType,
} from '@/lib/asaas'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const adminSupabase = createClient(SUPABASE_URL, SERVICE_KEY)

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userSupabase = createClient(SUPABASE_URL, ANON_KEY)
  const { data: { user }, error: authError } = await userSupabase.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { newPlan: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  if (body.newPlan !== 'annual') {
    return NextResponse.json({ error: 'Apenas upgrade para anual é suportado.' }, { status: 400 })
  }

  const { data: profile } = await adminSupabase
    .from('user_profiles')
    .select('asaas_subscription_id, asaas_customer_id')
    .eq('id', user.id)
    .single()

  if (!profile?.asaas_subscription_id) {
    return NextResponse.json({ error: 'Nenhuma assinatura ativa encontrada.' }, { status: 404 })
  }

  // Read the user's original payment method so we can create the new subscription with the same method
  const { data: lastSub } = await adminSupabase
    .from('subscriptions')
    .select('payment_method')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const billingType: BillingType =
    (lastSub?.payment_method as BillingType | undefined) ?? 'PIX'

  // BUG 2 FIX: set cancel_at_period_end = true BEFORE cancelling the old subscription.
  // This prevents the SUBSCRIPTION_DELETED webhook from immediately revoking tier access
  // (process-payment-event checks this flag to distinguish graceful cancels from admin deletes).
  const { error: flagErr } = await adminSupabase
    .from('user_profiles')
    .update({ cancel_at_period_end: true })
    .eq('id', user.id)

  if (flagErr) {
    console.error('cancel_at_period_end pre-set error', flagErr)
    return NextResponse.json({ error: 'Erro ao processar upgrade.' }, { status: 500 })
  }

  try {
    await cancelSubscription(profile.asaas_subscription_id)

    const nextDueDate = new Date().toISOString().slice(0, 10)
    const newSubscription = await createSubscription({
      customer: profile.asaas_customer_id!,
      billingType,
      value: 699.0,
      nextDueDate,
      cycle: 'YEARLY',
      description: 'MedLibre Anual — upgrade',
    })

    // BUG 2 FIX (continued): reset cancel_at_period_end now that the new subscription is live,
    // then write the new subscription ID and updated status.
    await adminSupabase
      .from('user_profiles')
      .update({
        asaas_subscription_id: newSubscription.id,
        billing_cycle: 'annual',
        subscription_status: 'pending',
        cancel_at_period_end: false,   // ← clear flag; plan change is complete
      })
      .eq('id', user.id)

    // BUG 4 FIX: insert a subscriptions row so the 14-day pending-revocation cron can track it
    const payments = await getSubscriptionPayments(newSubscription.id)
    const firstPayment = payments[0]

    await adminSupabase.from('subscriptions').insert({
      user_id: user.id,
      asaas_subscription_id: newSubscription.id,
      asaas_payment_id: firstPayment?.id ?? null,
      plan: 'annual',
      amount_cents: 69900,
      status: 'pending',
      payment_method: billingType,
      boleto_url: firstPayment?.bankSlipUrl ?? firstPayment?.invoiceUrl ?? null,
    })

    return NextResponse.json({
      subscriptionId: newSubscription.id,
      nextDueDate: newSubscription.nextDueDate,
      pixQrCode: firstPayment?.pixQrCodeImage ?? null,
      pixCopiaECola: firstPayment?.pixCopiaECola ?? null,
    })
  } catch (err) {
    // Rollback the flag if anything fails after the cancel — leave in a safe state
    await adminSupabase
      .from('user_profiles')
      .update({ cancel_at_period_end: false })
      .eq('id', user.id)

    const raw = err instanceof Error ? err.message : String(err)
    console.error('change-plan error', raw)
    return NextResponse.json({ error: translateAsaasError(raw) }, { status: 502 })
  }
}
