import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const resend = Deno.env.get('RESEND_API_KEY')
  ? new Resend(Deno.env.get('RESEND_API_KEY'))
  : null

const FROM = 'Medlibre <noreply@medlibre.com.br>'

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
    .select('id, billing_cycle, cancel_at_period_end, full_name, email')
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

      let confirmedPlan = isAnnual ? 'annual' : 'monthly'

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

        const resolvedPlan = existingRow?.plan ?? confirmedPlan
        confirmedPlan = resolvedPlan

        await supabase.from('subscriptions').upsert({
          user_id: userId,
          asaas_subscription_id: asaasSubscriptionId,
          asaas_payment_id: paymentId,
          plan: resolvedPlan,
          amount_cents: Math.round((value ?? 0) * 100),
          status: 'confirmed',
          payment_method: billingType,
          event_type: eventType,
        }, { onConflict: 'asaas_payment_id', ignoreDuplicates: true })
      }

      // Send confirmation email only on PAYMENT_RECEIVED — Asaas fires both
      // PAYMENT_CONFIRMED and PAYMENT_RECEIVED for card payments,
      // so gating on PAYMENT_RECEIVED avoids sending the email twice.
      // PIX also only fires PAYMENT_RECEIVED, so all methods are covered.
      if (resend && eventType === 'PAYMENT_RECEIVED') {
        const userEmail = profile.email
          ?? (await supabase.auth.admin.getUserById(userId)).data.user?.email

        if (userEmail) {
          const firstName = (profile.full_name ?? '').split(' ')[0] || 'você'

          const planLabels: Record<string, string> = {
            founders: 'Fundadores',
            early_adopter: 'Early Adopter',
            annual: 'Anual',
            monthly: 'Mensal',
          }
          const planLabel = planLabels[confirmedPlan] ?? confirmedPlan

          const methodLabels: Record<string, string> = {
            PIX: 'Pix',
            CREDIT_CARD: 'Cartão de crédito',
          }
          const methodLabel = methodLabels[billingType ?? ''] ?? billingType ?? '—'

          const expiryDate = new Intl.DateTimeFormat('pt-BR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'America/Sao_Paulo',
          }).format(new Date(newExpiry))

          const amountFmt = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }).format(value ?? 0)

          await resend.emails.send({
            from: FROM,
            to: [userEmail],
            subject: 'Pagamento confirmado ✓ — Medlibre Premium',
            html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Pagamento confirmado — Medlibre</title>
</head>
<body style="margin:0;padding:0;background-color:#F6F5F4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F6F5F4" style="background-color:#F6F5F4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <span style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:900;color:#212329;letter-spacing:-0.5px;">
                Med<span style="color:#EDB92E;">libre</span>
              </span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td bgcolor="#ffffff" style="background-color:#ffffff;border-radius:16px;border:1px solid #E8E5E0;padding:40px 36px;">

              <!-- Success badge -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom:20px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="width:64px;height:64px;border-radius:50%;background-color:#38BE58;">
                          <span style="display:block;font-size:30px;line-height:64px;color:#ffffff;font-weight:bold;">✓</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Title -->
                <tr>
                  <td align="center" style="padding-bottom:8px;">
                    <h1 style="margin:0;font-size:24px;font-weight:700;color:#212329;letter-spacing:-0.3px;">
                      Pagamento confirmado!
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:32px;">
                    <p style="margin:0;font-size:15px;color:#6B7280;line-height:1.6;">
                      Obrigado, ${firstName}! Seu acesso Premium está ativo e pronto para usar.
                    </p>
                  </td>
                </tr>

                <!-- Details table -->
                <tr>
                  <td style="padding-bottom:32px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F9F8F6" style="background-color:#F9F8F6;border-radius:10px;overflow:hidden;">
                      <tr>
                        <td style="padding:12px 16px;border-bottom:1px solid #E8E5E0;font-size:13px;color:#6B7280;">Plano</td>
                        <td style="padding:12px 16px;border-bottom:1px solid #E8E5E0;font-size:14px;font-weight:600;color:#212329;text-align:right;">${planLabel}</td>
                      </tr>
                      <tr>
                        <td style="padding:12px 16px;border-bottom:1px solid #E8E5E0;font-size:13px;color:#6B7280;">Valor pago</td>
                        <td style="padding:12px 16px;border-bottom:1px solid #E8E5E0;font-size:14px;font-weight:600;color:#212329;text-align:right;">${amountFmt}</td>
                      </tr>
                      <tr>
                        <td style="padding:12px 16px;border-bottom:1px solid #E8E5E0;font-size:13px;color:#6B7280;">Forma de pagamento</td>
                        <td style="padding:12px 16px;border-bottom:1px solid #E8E5E0;font-size:14px;font-weight:600;color:#212329;text-align:right;">${methodLabel}</td>
                      </tr>
                      <tr>
                        <td style="padding:12px 16px;font-size:13px;color:#6B7280;">Acesso válido até</td>
                        <td style="padding:12px 16px;font-size:14px;font-weight:600;color:#212329;text-align:right;">${expiryDate}</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- CTA -->
                <tr>
                  <td align="center">
                    <a href="https://medlibre.com.br/dashboard"
                       style="display:inline-block;background-color:#EDB92E;color:#212329;text-decoration:none;font-size:15px;font-weight:700;padding:14px 40px;border-radius:10px;letter-spacing:0.2px;">
                      Acessar o Medlibre &rarr;
                    </a>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 0 0;font-size:12px;color:#9CA3AF;line-height:1.7;">
              Medlibre &mdash; Estudo inteligente para residência médica<br>
              Você está recebendo este email porque realizou uma compra na plataforma.<br>
              <a href="https://medlibre.com.br" style="color:#EDB92E;text-decoration:none;">medlibre.com.br</a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
          }).catch(console.error)
        }
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
            subject: 'Pagamento vencido — Medlibre Premium',
            html: `
              <h2>Atenção: seu pagamento está vencido</h2>
              <p>Identificamos que seu pagamento do Medlibre Premium não foi compensado.</p>
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
            subject: 'Assinatura cancelada — Medlibre Premium',
            html: `
              <h2>Sua assinatura foi cancelada</h2>
              <p>Seu acesso Premium ao Medlibre foi encerrado. Você voltou para o plano gratuito.</p>
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
              subject: 'Assinatura cancelada — Medlibre Premium',
              html: `
                <h2>Sua assinatura foi cancelada</h2>
                <p>Seu acesso Premium ao Medlibre foi encerrado. Você voltou para o plano gratuito.</p>
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
