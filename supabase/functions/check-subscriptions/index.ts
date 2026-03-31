import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const resend = Deno.env.get('RESEND_API_KEY')
  ? new Resend(Deno.env.get('RESEND_API_KEY'))
  : null
const PROCESS_PAYMENT_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-payment-event`
const FROM = 'Medlibre <noreply@medlibre.com.br>'

Deno.serve(async () => {
  try {
    const now = new Date()

    // ── 1. DOWNGRADE EXPIRED USERS ────────────────────────────────────────────
    // Covers:
    //   - Trial users whose tier_expiry passed (subscription_status = 'none')
    //   - Cancelled users (cancel_at_period_end) whose tier_expiry passed
    //   - Overdue users whose tier_expiry passed
    // Protected: users with subscription_status = 'active' are skipped
    const { data: expiredUsers, error: fetchError } = await supabase
      .from('user_profiles')
      .select('id, tier, tier_expiry, subscription_status')
      .eq('tier', 'paid')
      .lt('tier_expiry', now.toISOString())
      .not('subscription_status', 'eq', 'active')

    if (fetchError) throw fetchError

    const expiredIds = expiredUsers?.map((u) => u.id) ?? []

    if (expiredIds.length > 0) {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ tier: 'free', cancel_at_period_end: false })
        .in('id', expiredIds)

      if (updateError) console.error('Error downgrading users:', updateError)
      else console.log(`Downgraded ${expiredIds.length} users to FREE.`)
    }

    // ── 2. REVOKE UNCONFIRMED PAYMENTS AFTER 14 DAYS ─────────────────────────
    // If a user has subscription_status = 'pending' and their subscription row
    // is older than 14 days, it means payment was never confirmed. Revert to free.
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

    const { data: staleSubscriptions, error: staleErr } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('status', 'pending')
      .lt('created_at', fourteenDaysAgo)

    if (staleErr) console.error('Error fetching stale subscriptions:', staleErr)

    const staleUserIds = [...new Set(staleSubscriptions?.map((s) => s.user_id) ?? [])]

    if (staleUserIds.length > 0) {
      // Only revoke if the user's profile is still in 'pending' status
      const { data: pendingProfiles } = await supabase
        .from('user_profiles')
        .select('id')
        .in('id', staleUserIds)
        .eq('subscription_status', 'pending')

      const pendingIds = pendingProfiles?.map((p) => p.id) ?? []

      if (pendingIds.length > 0) {
        await supabase
          .from('user_profiles')
          .update({
            tier: 'free',
            subscription_status: 'cancelled',
            asaas_subscription_id: null,
            tier_expiry: now.toISOString(),
          })
          .in('id', pendingIds)

        console.log(`Revoked ${pendingIds.length} unconfirmed subscriptions after 14 days.`)
      }
    }

    // ── 3. SEND TRIAL EXPIRY WARNINGS (7 days before) ────────────────────────
    const sevenDaysFromNow = new Date()
    sevenDaysFromNow.setDate(now.getDate() + 7)
    const startRange = new Date(sevenDaysFromNow.setHours(0, 0, 0, 0)).toISOString()
    const endRange = new Date(sevenDaysFromNow.setHours(23, 59, 59, 999)).toISOString()

    const { data: warningUsers } = await supabase
      .from('user_profiles')
      .select('id, tier_expiry, subscription_status')
      .eq('tier', 'paid')
      .gte('tier_expiry', startRange)
      .lte('tier_expiry', endRange)
      .eq('subscription_status', 'none') // only trial/beta users without active subscription

    if (warningUsers && warningUsers.length > 0 && resend) {
      for (const userProfile of warningUsers) {
        const { data: { user } } = await supabase.auth.admin.getUserById(userProfile.id)
        if (user?.email) {
          await resend.emails.send({
            from: FROM,
            to: [user.email],
            subject: 'Seu período de teste termina em 7 dias — MedLibre',
            html: `
              <h2>Olá! Seu período de teste está chegando ao fim.</h2>
              <p>Seu acesso Premium expira em <strong>${new Date(userProfile.tier_expiry).toLocaleDateString('pt-BR')}</strong>.</p>
              <p>Para continuar com questões ilimitadas e análise avançada de desempenho, assine agora:</p>
              <a href="https://medlibre.com.br/pricing" style="background:#EDB92E;color:#212329;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
                Ver planos
              </a>
            `,
          }).catch(console.error)
        }
      }
    }

    // ── 4. RETRY DEAD-LETTER WEBHOOK EVENTS (older than 5 min, unprocessed) ──
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const { data: pendingEvents } = await supabase
      .from('webhook_events')
      .select('*')
      .eq('processed', false)
      .lt('created_at', fiveMinutesAgo)
      .limit(20)

    let retriedCount = 0
    for (const event of pendingEvents ?? []) {
      try {
        const payload = event.payload as Record<string, unknown>
        const res = await fetch(PROCESS_PAYMENT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('CRON_SECRET')}`,
          },
          body: JSON.stringify({
            eventType: event.event_type,
            payment: payload.payment ?? {},
            subscription: payload.subscription ?? {},
          }),
        })

        if (res.ok) {
          await supabase.from('webhook_events').update({
            processed: true,
            processed_at: new Date().toISOString(),
            error: null,
          }).eq('id', event.id)
          retriedCount++
        } else {
          const errorText = await res.text()
          await supabase.from('webhook_events').update({
            error: `retry failed: ${errorText}`,
          }).eq('id', event.id)
        }
      } catch (err) {
        await supabase.from('webhook_events').update({
          error: String(err),
        }).eq('id', event.id)
      }
    }

    return new Response(JSON.stringify({
      message: 'Check complete',
      downgraded: expiredIds.length,
      revoked_unconfirmed: staleUserIds.length,
      warnings_sent: warningUsers?.length ?? 0,
      retried_events: retriedCount,
    }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
