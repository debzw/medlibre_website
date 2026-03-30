import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const resend = Deno.env.get('RESEND_API_KEY')
  ? new Resend(Deno.env.get('RESEND_API_KEY'))
  : null

const FROM = 'MedLibre <noreply@medlibre.com.br>'

Deno.serve(async (req) => {
  // Called only from Next.js webhook route — validate internal secret
  const auth = req.headers.get('Authorization') ?? ''
  const expectedSecret = Deno.env.get('CRON_SECRET') ?? ''
  if (!expectedSecret || auth !== `Bearer ${expectedSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: {
    eventType: string
    payment: Record<string, unknown>
    subscription: Record<string, unknown>
  }

  try {
    body = await req.json()
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  const { eventType, payment, subscription } = body
  const asaasSubscriptionId = (subscription?.id ?? payment?.subscription) as string | undefined

  if (!asaasSubscriptionId) {
    console.error('No subscription ID in payload', body)
    return new Response('Missing subscription id', { status: 422 })
  }

  // Find user by asaas_subscription_id
  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles')
    .select('id, billing_cycle, cancel_at_period_end')
    .eq('asaas_subscription_id', asaasSubscriptionId)
    .maybeSingle()

  if (profileErr) {
    console.error('profile lookup error', profileErr)
    return new Response(profileErr.message, { status: 500 })
  }

  if (!profile) {
    console.warn('No user found for subscription', asaasSubscriptionId)
    // Not an error — may be a test subscription
    return new Response('OK (unknown subscription)', { status: 200 })
  }

  const userId = profile.id
  const paymentId = payment?.id as string | undefined
  const billingType = payment?.billingType as string | undefined
  const value = payment?.value as number | undefined
  const boletoUrl = (payment?.bankSlipUrl ?? payment?.invoiceUrl) as string | undefined

  const isAnnual = profile.billing_cycle === 'annual'
  const daysGrace = isAnnual ? 370 : 35
  const newExpiry = new Date(Date.now() + daysGrace * 24 * 60 * 60 * 1000).toISOString()

  switch (eventType) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED': {
      await supabase.from('user_profiles').update({
        tier: 'paid',
        subscription_status: 'active',
        tier_expiry: newExpiry,
      }).eq('id', userId)

      if (paymentId) {
        // Look up the existing subscriptions row to preserve the exact plan name
        // (founders / early_adopter would be lost if we only use billing_cycle)
        const { data: existingRow } = await supabase
          .from('subscriptions')
          .select('plan')
          .eq('asaas_subscription_id', asaasSubscriptionId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()

        const resolvedPlan = existingRow?.plan ?? (isAnnual ? 'annual' : 'monthly')

        await supabase.from('subscriptions').upsert({
          user_id: userId,
          asaas_subscription_id: asaasSubscriptionId,
          asaas_payment_id: paymentId,
          plan: resolvedPlan,
          amount_cents: Math.round((value ?? 0) * 100),
          status: 'confirmed',
          payment_method: billingType,
          event_type: eventType,
          boleto_url: boletoUrl ?? null,
        }, { onConflict: 'asaas_payment_id', ignoreDuplicates: true })
      }
      break
    }

    case 'PAYMENT_AWAITING_RISK_ANALYSIS': {
      await supabase.from('user_profiles').update({
        subscription_status: 'pending',
      }).eq('id', userId)
      break
    }

    case 'PAYMENT_OVERDUE': {
      await supabase.from('user_profiles').update({
        subscription_status: 'overdue',
      }).eq('id', userId)

      if (paymentId) {
        await supabase.from('subscriptions').upsert({
          user_id: userId,
          asaas_subscription_id: asaasSubscriptionId,
          asaas_payment_id: paymentId,
          plan: isAnnual ? 'annual' : 'monthly',
          amount_cents: Math.round((value ?? 0) * 100),
          status: 'overdue',
          payment_method: billingType,
          event_type: eventType,
        }, { onConflict: 'asaas_payment_id', ignoreDuplicates: true })
      }

      // Send overdue warning email
      if (resend) {
        const { data: { user } } = await supabase.auth.admin.getUserById(userId)
        if (user?.email) {
          await resend.emails.send({
            from: FROM,
            to: [user.email],
            subject: 'Pagamento vencido — MedLibre Premium',
            html: `
              <h2>Atenção: seu pagamento está vencido</h2>
              <p>Identificamos que seu pagamento do MedLibre Premium não foi compensado.</p>
              <p>Seu acesso será mantido até o vencimento da sua assinatura. Regularize o pagamento para continuar sem interrupções.</p>
              <a href="https://medlibre.com.br/dashboard">Acessar painel</a>
            `,
          }).catch(console.error)
        }
      }
      break
    }

    case 'PAYMENT_REFUNDED':
    case 'PAYMENT_DELETED': {
      // Always revoke immediately — admin-initiated refund
      await supabase.from('user_profiles').update({
        tier: 'free',
        tier_expiry: new Date().toISOString(),
        subscription_status: 'cancelled',
        asaas_subscription_id: null,
        cancel_at_period_end: false,
      }).eq('id', userId)

      if (paymentId) {
        await supabase.from('subscriptions').upsert({
          user_id: userId,
          asaas_subscription_id: asaasSubscriptionId,
          asaas_payment_id: paymentId,
          plan: isAnnual ? 'annual' : 'monthly',
          amount_cents: Math.round((value ?? 0) * 100),
          status: eventType === 'PAYMENT_REFUNDED' ? 'refunded' : 'cancelled',
          payment_method: billingType,
          event_type: eventType,
        }, { onConflict: 'asaas_payment_id', ignoreDuplicates: true })
      }

      // Send cancellation email
      if (resend) {
        const { data: { user } } = await supabase.auth.admin.getUserById(userId)
        if (user?.email) {
          await resend.emails.send({
            from: FROM,
            to: [user.email],
            subject: 'Assinatura cancelada — MedLibre Premium',
            html: `
              <h2>Sua assinatura foi cancelada</h2>
              <p>Seu acesso Premium ao MedLibre foi encerrado. Você voltou para o plano gratuito.</p>
              <p>Se foi um engano, você pode assinar novamente a qualquer momento em <a href="https://medlibre.com.br/pricing">medlibre.com.br/pricing</a>.</p>
            `,
          }).catch(console.error)
        }
      }
      break
    }

    case 'SUBSCRIPTION_DELETED': {
      // If user triggered "cancel future invoices" (cancel_at_period_end = true):
      //   → only clear the subscription ID; tier_expiry and tier are preserved
      //   → the check-subscriptions cron handles natural expiry
      //
      // If admin deleted the subscription directly (cancel_at_period_end = false):
      //   → immediate full revocation (same as PAYMENT_REFUNDED)
      if (profile.cancel_at_period_end) {
        await supabase.from('user_profiles').update({
          subscription_status: 'cancelled',
          asaas_subscription_id: null,
          // cancel_at_period_end stays true so cron knows not to re-activate
        }).eq('id', userId)
      } else {
        await supabase.from('user_profiles').update({
          tier: 'free',
          tier_expiry: new Date().toISOString(),
          subscription_status: 'cancelled',
          asaas_subscription_id: null,
          cancel_at_period_end: false,
        }).eq('id', userId)

        // Send cancellation email for admin-initiated deletions
        if (resend) {
          const { data: { user } } = await supabase.auth.admin.getUserById(userId)
          if (user?.email) {
            await resend.emails.send({
              from: FROM,
              to: [user.email],
              subject: 'Assinatura cancelada — MedLibre Premium',
              html: `
                <h2>Sua assinatura foi cancelada</h2>
                <p>Seu acesso Premium ao MedLibre foi encerrado. Você voltou para o plano gratuito.</p>
                <p>Se foi um engano, você pode assinar novamente a qualquer momento em <a href="https://medlibre.com.br/pricing">medlibre.com.br/pricing</a>.</p>
              `,
            }).catch(console.error)
          }
        }
      }
      break
    }

    default:
      console.log('Unhandled event type', eventType)
  }

  return new Response(JSON.stringify({ ok: true, eventType }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
