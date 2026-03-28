import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyFeedbackToken } from '@/lib/betaEndingEmail';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Beta encerra em 07/04/2026 — premium estendido por 3 meses a partir dessa data
const BETA_END = new Date('2026-04-07T23:59:59Z');
const EXTENSION_MONTHS = 3;

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

    const now = new Date();
    const baseDate = now > BETA_END ? now : BETA_END;
    const newExpiry = new Date(baseDate);
    newExpiry.setMonth(newExpiry.getMonth() + EXTENSION_MONTHS);
    const newExpiryISO = newExpiry.toISOString();

    // Insere feedback
    const { error: insertError } = await supabaseAdmin.from('user_feedback').insert({
      user_id: userId,
      ...feedback,
      premium_extended_at: now.toISOString(),
    });

    if (insertError) {
      console.error('[feedback/submit] insert error:', insertError);
      return NextResponse.json({ error: 'Erro ao salvar feedback.' }, { status: 500 });
    }

    // Estende tier_expiry
    const { error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .update({ tier: 'paid', tier_expiry: newExpiryISO })
      .eq('id', userId);

    if (updateError) {
      console.error('[feedback/submit] update tier error:', updateError);
      // Não falha o request — o feedback foi salvo, o admin pode corrigir manualmente
    }

    return NextResponse.json({ success: true, new_expiry: newExpiryISO });
  } catch (err) {
    console.error('[feedback/submit] unexpected error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
