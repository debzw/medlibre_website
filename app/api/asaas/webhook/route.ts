import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN ?? ''
const CRON_SECRET = process.env.CRON_SECRET ?? ''

const adminSupabase = createClient(SUPABASE_URL, SERVICE_KEY)

/**
 * POST /api/asaas/webhook
 *
 * Entry point for all Asaas webhook events.
 *
 * Flow:
 * 1. Validate the Asaas access_token header
 * 2. Write event to webhook_events dead-letter table
 * 3. Forward to process-payment-event Edge Function
 * 4. Mark event as processed (or leave unprocessed for cron retry on failure)
 * 5. Always return 200 immediately so Asaas does not retry
 */
export async function POST(req: NextRequest) {
  // Asaas sends its API key as the `access_token` header on every webhook call
  const incomingToken = req.headers.get('access_token') ?? ''
  if (!ASAAS_WEBHOOK_TOKEN || incomingToken !== ASAAS_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let rawBody: Record<string, unknown>
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 })
  }

  // Asaas webhook shape: { event: string, payment: {...} }
  const eventType = rawBody.event as string | undefined
  const payment = (rawBody.payment ?? {}) as Record<string, unknown>

  if (!eventType) {
    return NextResponse.json({ error: 'Missing event type' }, { status: 400 })
  }

  // Derive subscription object from the payment field
  const subscription: Record<string, unknown> = {}
  if (typeof payment.subscription === 'string') {
    subscription.id = payment.subscription
  }

  // 1. Write to dead-letter queue first (ensures retryability)
  const { data: eventRow, error: insertErr } = await adminSupabase
    .from('webhook_events')
    .insert({
      event_type: eventType,
      payload: rawBody,
      processed: false,
    })
    .select('id')
    .single()

  if (insertErr) {
    console.error('webhook_events insert error', insertErr)
    // Still return 200 so Asaas doesn't hammer us — the event is lost only if DB is completely down
    return NextResponse.json({ ok: false, error: 'DB insert failed' }, { status: 200 })
  }

  // 2. Forward to process-payment-event Edge Function
  const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/process-payment-event`

  try {
    const res = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
      body: JSON.stringify({ eventType, payment, subscription }),
    })

    if (res.ok) {
      // Mark as processed
      await adminSupabase
        .from('webhook_events')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('id', eventRow.id)
    } else {
      const errorText = await res.text()
      console.error(`process-payment-event error ${res.status}:`, errorText)
      await adminSupabase
        .from('webhook_events')
        .update({ error: `edge fn ${res.status}: ${errorText}` })
        .eq('id', eventRow.id)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('process-payment-event fetch error:', msg)
    await adminSupabase
      .from('webhook_events')
      .update({ error: msg })
      .eq('id', eventRow.id)
    // Leave processed=false — cron will retry
  }

  // Always return 200 to Asaas (retries are handled by our dead-letter cron)
  return NextResponse.json({ ok: true, eventType })
}
