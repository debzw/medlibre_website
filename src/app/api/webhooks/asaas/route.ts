import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN ?? ''
const PROCESS_PAYMENT_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-payment-event`

function constantTimeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) {
      // Still do comparison to prevent timing side-channel on length
      timingSafeEqual(bufA, bufA)
      return false
    }
    return timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  // Validate Asaas webhook token (constant-time)
  const incomingToken = req.headers.get('asaas-access-token') ?? ''
  if (!WEBHOOK_TOKEN || !constantTimeEqual(incomingToken, WEBHOOK_TOKEN)) {
    // Return 200 to prevent Asaas from retrying with valid probes
    console.error('Invalid webhook token received')
    return NextResponse.json({ ok: false }, { status: 200 })
  }

  let payload: {
    event: string
    payment?: Record<string, unknown>
    subscription?: Record<string, unknown>
  }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 })
  }

  // Insert into dead-letter queue immediately
  const { data: eventRow, error: insertError } = await adminSupabase
    .from('webhook_events')
    .insert({
      event_type: payload.event,
      payload,
      processed: false,
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('webhook_events insert failed', insertError)
    // Return 200 — Asaas should not retry for DB issues
    return NextResponse.json({ ok: false, reason: 'db_insert_failed' }, { status: 200 })
  }

  // Call Edge Function to process event
  try {
    const res = await fetch(PROCESS_PAYMENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        eventType: payload.event,
        payment: payload.payment ?? {},
        subscription: payload.subscription ?? {},
      }),
    })

    if (res.ok) {
      await adminSupabase
        .from('webhook_events')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('id', eventRow.id)
    } else {
      const errorText = await res.text()
      await adminSupabase
        .from('webhook_events')
        .update({ error: `edge_fn: ${res.status} ${errorText}` })
        .eq('id', eventRow.id)
    }
  } catch (err) {
    await adminSupabase
      .from('webhook_events')
      .update({ error: String(err) })
      .eq('id', eventRow.id)
  }

  // Always return 200 quickly — Asaas requires fast response
  return NextResponse.json({ ok: true }, { status: 200 })
}
