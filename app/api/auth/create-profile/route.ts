import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId, email, full_name, avatar_url, locale, provider } = await request.json();

    if (!userId || !email) {
      return NextResponse.json({ error: 'userId e email são obrigatórios.' }, { status: 400 });
    }

    // Verifica se o perfil já existe (evita duplicatas em race conditions)
    const { data: existing } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (existing) {
      // Backfill personal info if the DB trigger ran before GoTrue populated metadata
      const needsUpdate =
        (!existing.full_name && full_name) ||
        (!existing.avatar_url && avatar_url) ||
        (!existing.email && email) ||
        (!existing.locale && locale);

      if (needsUpdate) {
        const updates: Record<string, string | null> = {};
        if (!existing.full_name && full_name) updates.full_name = full_name;
        if (!existing.avatar_url && avatar_url) updates.avatar_url = avatar_url;
        if (!existing.email && email) updates.email = email;
        if (!existing.locale && locale) updates.locale = locale;

        const { data: updated, error: updateError } = await supabaseAdmin
          .from('user_profiles')
          .update(updates)
          .eq('id', userId)
          .select('*')
          .single();

        if (updateError) {
          console.error('[create-profile] erro ao atualizar perfil existente:', updateError);
          return NextResponse.json({ profile: existing, created: false });
        }

        return NextResponse.json({ profile: updated, created: false });
      }

      return NextResponse.json({ profile: existing, created: false });
    }

    // Todos os usuários devem confirmar o e-mail, independente do provider
    const email_confirmed = false;

    const { data: newProfile, error } = await supabaseAdmin
      .from('user_profiles')
      .insert([{
        id: userId,
        email,
        full_name: full_name || null,
        avatar_url: avatar_url || null,
        locale: locale || null,
        tier: 'paid',
        tier_expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        questions_answered_today: 0,
        last_reset_date: new Date().toISOString().split('T')[0],
        theme_preference: 'dark',
        email_confirmed,
      }])
      .select()
      .single();

    if (error) {
      console.error('[create-profile] erro ao criar perfil:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Se não for OAuth social, dispara e-mail de verificação
    if (!email_confirmed) {
      fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/send-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, email }),
      }).catch(err => console.error('[create-profile] erro ao enviar verificação:', err));
    }

    return NextResponse.json({ profile: newProfile, created: true });
  } catch (err) {
    console.error('[create-profile] erro inesperado:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
