import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { signFeedbackToken } from '@/lib/betaEndingEmail';

// Rota de desenvolvimento apenas — gera token de feedback para um usuário
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const email = request.nextUrl.searchParams.get('email');
  if (!email) {
    return NextResponse.json({ error: 'Passe ?email=seu@email.com' }, { status: 400 });
  }

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('id, full_name, referral_code')
    .eq('email', email)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }

  const token = await signFeedbackToken(profile.id);
  const feedbackUrl = `http://localhost:3000/feedback?token=${token}`;

  return NextResponse.json({
    user_id: profile.id,
    full_name: profile.full_name,
    referral_code: profile.referral_code,
    feedback_url: feedbackUrl,
    token,
  });
}
