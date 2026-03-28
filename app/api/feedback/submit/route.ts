import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyFeedbackToken } from '@/lib/betaEndingEmail';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, ...feedback } = body as {
      token: string;
      rating_overall: number;
      rating_content_quality: number;
      rating_interface: number;
      rating_study_algorithm: number;
      rating_performance: number;
      rating_value: number;
      most_useful: string;
      needs_improvement: string;
      missing_features: string;
      would_recommend: boolean;
      willing_to_pay: boolean;
      suggested_price: string;
      free_comment: string;
    };

    // Valida token
    const userId = await verifyFeedbackToken(token);
    if (!userId) {
      return NextResponse.json(
        { error: 'Link inválido ou expirado. Solicite um novo link através do e-mail recebido.' },
        { status: 401 }
      );
    }

    // Verifica se já enviou feedback (idempotente)
    const { data: existing } = await supabaseAdmin
      .from('user_feedback')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Você já enviou seu feedback. Obrigado!' },
        { status: 409 }
      );
    }

    // Valida ratings mínimos
    const ratings = [
      feedback.rating_overall,
      feedback.rating_content_quality,
      feedback.rating_interface,
      feedback.rating_study_algorithm,
      feedback.rating_performance,
      feedback.rating_value,
    ];
    if (ratings.some((r) => !r || r < 1 || r > 5)) {
      return NextResponse.json({ error: 'Preencha todas as avaliações (1–5).' }, { status: 400 });
    }

    // Insere feedback — o trigger trg_feedback_extend_premium recalcula tier_expiry automaticamente
    const { error: insertError } = await supabaseAdmin.from('user_feedback').insert({
      user_id: userId,
      ...feedback,
      premium_extended_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error('[feedback/submit] insert error:', insertError);
      return NextResponse.json({ error: 'Erro ao salvar feedback.' }, { status: 500 });
    }

    // Lê o novo expiry calculado pelo trigger para devolver ao cliente
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('tier_expiry')
      .eq('id', userId)
      .single();

    return NextResponse.json({ success: true, new_expiry: profile?.tier_expiry ?? null });
  } catch (err) {
    console.error('[feedback/submit] unexpected error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
