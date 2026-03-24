import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cancelSubscription, createSubscription, translateAsaasError } from '@/lib/asaas'

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

  try {
    await cancelSubscription(profile.asaas_subscription_id)

    const nextDueDate = new Date().toISOString().slice(0, 10)
    const newSubscription = await createSubscription({
      customer: profile.asaas_customer_id!,
      billingType: 'PIX',
      value: 699.0,
      nextDueDate,
      cycle: 'YEARLY',
      description: 'MedLibre Anual — upgrade',
    })

    await adminSupabase
      .from('user_profiles')
      .update({
        asaas_subscription_id: newSubscription.id,
        billing_cycle: 'annual',
        subscription_status: 'pending',
      })
      .eq('id', user.id)

    return NextResponse.json({
      subscriptionId: newSubscription.id,
      nextDueDate: newSubscription.nextDueDate,
    })
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    console.error('change-plan error', raw)
    return NextResponse.json({ error: translateAsaasError(raw) }, { status: 502 })
  }
}
