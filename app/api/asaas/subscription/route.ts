import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const adminSupabase = createClient(SUPABASE_URL, SERVICE_KEY)

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userSupabase = createClient(SUPABASE_URL, ANON_KEY)
  const { data: { user }, error } = await userSupabase.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error: profileError } = await adminSupabase
    .from('user_profiles')
    .select('subscription_status, billing_cycle, tier_expiry, asaas_subscription_id')
    .eq('id', user.id)
    .single()

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({
    status: data.subscription_status,
    billingCycle: data.billing_cycle,
    nextDueDate: data.tier_expiry,
    hasActiveSubscription: !!data.asaas_subscription_id,
  })
}
