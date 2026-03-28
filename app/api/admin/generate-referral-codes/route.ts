import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/I/1 para legibilidade
  let code = 'MED-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== process.env.ADMIN_EMAIL_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Busca todos os usuários sem referral_code
  const { data: profiles, error } = await supabaseAdmin
    .from('user_profiles')
    .select('id')
    .is('referral_code', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ message: 'Todos os usuários já têm código.', updated: 0 });
  }

  let updated = 0;
  const errors: string[] = [];

  for (const profile of profiles) {
    // Tenta até 5 vezes para evitar colisão de código único
    let attempts = 0;
    let saved = false;
    while (attempts < 5 && !saved) {
      const code = generateCode();
      const { error: updateError } = await supabaseAdmin
        .from('user_profiles')
        .update({ referral_code: code })
        .eq('id', profile.id)
        .is('referral_code', null); // só atualiza se ainda null (evita race)

      if (!updateError) {
        saved = true;
        updated++;
      } else if (updateError.code === '23505') {
        // colisão de unique, tenta novo código
        attempts++;
      } else {
        errors.push(`${profile.id}: ${updateError.message}`);
        break;
      }
    }
  }

  return NextResponse.json({ updated, total: profiles.length, errors });
}
