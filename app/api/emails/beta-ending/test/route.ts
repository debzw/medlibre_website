import { NextRequest, NextResponse } from 'next/server';
import { signFeedbackToken, sendBetaEndingEmail } from '@/lib/betaEndingEmail';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Validação antecipada de env vars
  const missing = ['RESEND_API_KEY', 'ADMIN_EMAIL_SECRET', 'NEXT_PUBLIC_SITE_URL'].filter(
    (k) => !process.env[k]
  );
  if (missing.length > 0) {
    return NextResponse.json({ ok: false, error: `Env vars ausentes: ${missing.join(', ')}` }, { status: 500 });
  }

  const { to } = (await request.json().catch(() => ({}))) as { to?: string };
  if (!to) {
    return NextResponse.json({ ok: false, error: 'Campo "to" obrigatório.' }, { status: 400 });
  }

  try {
    // Usa UUID fixo para gerar um token real (exercita o fluxo completo)
    const feedbackToken = await signFeedbackToken('00000000-0000-0000-0000-000000000001');

    await sendBetaEndingEmail({
      to,
      firstName: 'Teste',
      referralCode: 'MED-TEST',
      feedbackToken,
    });

    return NextResponse.json({ ok: true, to });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
