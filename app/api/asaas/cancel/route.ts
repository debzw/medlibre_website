import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cancelSubscription, translateAsaasError } from '@/lib/asaas'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const adminSupabase = createClient(SUPABASE_URL, SERVICE_KEY)

/**
 * POST /api/asaas/cancel
 *
 * Two cancellation flows:
 *
 * 1. refund (≤ 7 days since subscription created_at)
 *    - Records a cancellation_request (type='refund')
 *    - Does NOT call Asaas — admin reviews and cancels manually
 *    - User remains premium until admin acts
 *
 * 2. cancel_future (> 7 days)
 *    - Sets cancel_at_period_end = true on user_profiles
 *    - Calls Asaas DELETE /subscriptions/{id} to stop future charges
 *    - access preserved until tier_expiry (webhook respects cancel_at_period_end)
 *    - Records a cancellation_request (type='cancel_future')
 *
 * Body: { feedback?: string }
 * The server determines which flow applies based on subscription age.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userSupabase = createClient(SUPABASE_URL, ANON_KEY)
  const { data: { user }, error: authError } = await userSupabase.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { feedback?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  // Load profile
  const { data: profile, error: profileErr } = await adminSupabase
    .from('user_profiles')
    .select('subscription_status, asaas_subscription_id, billing_cycle, cancel_at_period_end')
    .eq('id', user.id)
    .single()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 })
  }

  if (!profile.asaas_subscription_id || profile.subscription_status === 'cancelled') {
    return NextResponse.json({ error: 'Nenhuma assinatura ativa para cancelar.' }, { status: 400 })
  }

  if (profile.cancel_at_period_end) {
    return NextResponse.json({ error: 'Cancelamento já solicitado.' }, { status: 409 })
  }

  // Guard: prevent duplicate refund requests
  const { data: existingRequest } = await adminSupabase
    .from('cancellation_requests')
    .select('id')
    .eq('user_id', user.id)
    .eq('asaas_subscription_id', profile.asaas_subscription_id)
    .eq('status', 'pending')
    .maybeSingle()

  if (existingRequest) {
    return NextResponse.json({ error: 'Cancelamento já solicitado.' }, { status: 409 })
  }

  // Find the most recent subscription row to determine age
  const { data: subRow } = await adminSupabase
    .from('subscriptions')
    .select('created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const subscriptionCreatedAt = subRow?.created_at ? new Date(subRow.created_at) : null
  const now = new Date()
  const daysSinceCreation = subscriptionCreatedAt
    ? (now.getTime() - subscriptionCreatedAt.getTime()) / (1000 * 60 * 60 * 24)
    : Infinity

  const isWithinRefundWindow = daysSinceCreation <= 7

  if (isWithinRefundWindow) {
    // ── REFUND FLOW ────────────────────────────────────────────
    // Record request only. Admin handles manually.
    const { error: insertErr } = await adminSupabase
      .from('cancellation_requests')
      .insert({
        user_id: user.id,
        asaas_subscription_id: profile.asaas_subscription_id,
        request_type: 'refund',
        feedback: body.feedback ?? null,
        status: 'pending',
      })

    if (insertErr) {
      console.error('cancel refund insert error', insertErr)
      return NextResponse.json({ error: 'Erro ao registrar solicitação.' }, { status: 500 })
    }

    return NextResponse.json({ type: 'refund' })
  }

  // ── CANCEL FUTURE INVOICES FLOW ────────────────────────────
  // 1. Set cancel_at_period_end flag BEFORE calling Asaas
  //    (webhook checks this flag to preserve tier_expiry)
  const { error: flagErr } = await adminSupabase
    .from('user_profiles')
    .update({ cancel_at_period_end: true })
    .eq('id', user.id)

  if (flagErr) {
    console.error('cancel_at_period_end update error', flagErr)
    return NextResponse.json({ error: 'Erro ao processar cancelamento.' }, { status: 500 })
  }

  try {
    await cancelSubscription(profile.asaas_subscription_id)
  } catch (err) {
    // Rollback flag if Asaas call fails
    await adminSupabase
      .from('user_profiles')
      .update({ cancel_at_period_end: false })
      .eq('id', user.id)

    const raw = err instanceof Error ? err.message : String(err)
    console.error('cancel subscription error', raw)
    return NextResponse.json({ error: translateAsaasError(raw) }, { status: 502 })
  }

  // 2. Record the cancellation request
  await adminSupabase
    .from('cancellation_requests')
    .insert({
      user_id: user.id,
      asaas_subscription_id: profile.asaas_subscription_id,
      request_type: 'cancel_future',
      feedback: body.feedback ?? null,
      status: 'processed',
      processed_at: now.toISOString(),
    })

  return NextResponse.json({ type: 'cancel_future' })
}
