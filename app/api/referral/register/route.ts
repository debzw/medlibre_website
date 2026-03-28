import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Valida o Bearer token enviado pelo cliente
    const authHeader = request.headers.get('authorization') ?? '';
    const accessToken = authHeader.replace('Bearer ', '').trim();
    if (!accessToken) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });
    }

    const { referral_code } = await request.json() as { referral_code: string };
    if (!referral_code || typeof referral_code !== 'string') {
      return NextResponse.json({ error: 'Código inválido.' }, { status: 400 });
    }

    const code = referral_code.toUpperCase().trim();

    // Verifica que o novo usuário ainda não foi referenciado
    const { data: myProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('referred_by, referral_code')
      .eq('id', user.id)
      .single();

    if (myProfile?.referred_by) {
      return NextResponse.json({ error: 'Já registrado com um código.' }, { status: 409 });
    }

    // Impede auto-referral
    if (myProfile?.referral_code === code) {
      return NextResponse.json({ error: 'Você não pode usar seu próprio código.' }, { status: 400 });
    }

    // Busca o dono do código
    const { data: referrer } = await supabaseAdmin
      .from('user_profiles')
      .select('id, tier_expiry')
      .eq('referral_code', code)
      .single();

    if (!referrer) {
      return NextResponse.json({ error: 'Código não encontrado.' }, { status: 404 });
    }

    // Registra o referral no novo usuário
    await supabaseAdmin
      .from('user_profiles')
      .update({ referred_by: code })
      .eq('id', user.id);

    // Insere em referral_uses
    await supabaseAdmin.from('referral_uses').insert({
      referral_code: code,
      referrer_id: referrer.id,
      new_user_id: user.id,
    });

    // Estende tier_expiry do referente em +1 mês
    const currentExpiry = referrer.tier_expiry ? new Date(referrer.tier_expiry) : new Date();
    const base = currentExpiry > new Date() ? currentExpiry : new Date();
    base.setMonth(base.getMonth() + 1);

    await supabaseAdmin
      .from('user_profiles')
      .update({ tier: 'paid', tier_expiry: base.toISOString() })
      .eq('id', referrer.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[referral/register] error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
