import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

async function deleteUnconfirmedUser(userId: string): Promise<void> {
  await supabaseAdmin.from('user_profiles').delete().eq('id', userId);
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) console.error('[confirm] Failed to delete auth user:', userId, error);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(`${SITE_URL}/auth?error=link_expired`);
  }

  // Busca o token na tabela
  const { data: tokenRow, error: tokenError } = await supabaseAdmin
    .from('verification_tokens')
    .select('user_id, expires_at')
    .eq('token', token)
    .single();

  // Token não encontrado: conta já foi deletada pelo cron
  if (tokenError || !tokenRow) {
    return NextResponse.redirect(`${SITE_URL}/auth?error=link_expired`);
  }

  // Verifica expiração: deleta usuário e redireciona para novo cadastro
  if (new Date(tokenRow.expires_at) < new Date()) {
    await deleteUnconfirmedUser(tokenRow.user_id);
    return NextResponse.redirect(`${SITE_URL}/auth?error=link_expired`);
  }

  // Confirma o e-mail do usuário
  const { error: updateError } = await supabaseAdmin
    .from('user_profiles')
    .update({ email_confirmed: true })
    .eq('id', tokenRow.user_id);

  if (updateError) {
    console.error('Erro ao confirmar e-mail:', updateError);
    return NextResponse.redirect(`${SITE_URL}/verify-email?error=expired`);
  }

  // Remove o token usado
  await supabaseAdmin.from('verification_tokens').delete().eq('token', token);

  return new NextResponse(
    `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>E-mail confirmado</title>
  <style>
    body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #0a0a0a; font-family: system-ui, sans-serif; color: #e5e5e5; }
    .card { text-align: center; padding: 2.5rem 2rem; background: #171717; border: 1px solid #262626; border-radius: 1rem; max-width: 360px; width: 90%; }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { margin: 0 0 0.5rem; font-size: 1.25rem; font-weight: 600; }
    p { margin: 0; color: #737373; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>E-mail confirmado!</h1>
    <p>Pode fechar esta aba. A outra página já foi atualizada.</p>
  </div>
  <script>window.close();</script>
</body>
</html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}
