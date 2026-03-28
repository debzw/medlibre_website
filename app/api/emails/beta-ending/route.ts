import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { signFeedbackToken, sendBetaEndingEmail } from '@/lib/betaEndingEmail';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Envia em batches de 10 com pausa de 1s entre batches (respeita rate limit Resend)
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(request: NextRequest) {
  // Autenticação por CRON_SECRET
  const secret = request.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parâmetro opcional: dry_run=true apenas lista os usuários sem enviar
  const { dry_run } = (await request.json().catch(() => ({}))) as { dry_run?: boolean };

  // Busca todos os usuários com email + referral_code
  const { data: profiles, error } = await supabaseAdmin
    .from('user_profiles')
    .select('id, email, full_name, referral_code')
    .not('email', 'is', null)
    .not('referral_code', 'is', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ message: 'Nenhum usuário encontrado.' });
  }

  if (dry_run) {
    return NextResponse.json({
      dry_run: true,
      total: profiles.length,
      sample: profiles.slice(0, 5).map((p) => ({ email: p.email, referral_code: p.referral_code })),
    });
  }

  let sent = 0;
  const errors: Array<{ email: string; error: string }> = [];

  for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
    const batch = profiles.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(
      batch.map(async (profile) => {
        try {
          const feedbackToken = await signFeedbackToken(profile.id);
          const firstName = profile.full_name?.split(' ')[0] ?? 'Estudante';

          await sendBetaEndingEmail({
            to: profile.email,
            firstName,
            referralCode: profile.referral_code,
            feedbackToken,
          });
          sent++;
        } catch (err) {
          errors.push({ email: profile.email, error: String(err) });
        }
      })
    );

    if (i + BATCH_SIZE < profiles.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return NextResponse.json({ sent, total: profiles.length, errors });
}
