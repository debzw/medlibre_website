import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://medlibre.com.br';

function htmlPage(title: string, message: string): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — MedLibre</title>
  <link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Lexend+Deca:wght@400;600&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; padding: 0; background: #F6F5F4; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: 'Lexend Deca', sans-serif; }
    .card { background: #fff; border-radius: 16px; padding: 48px 56px; max-width: 480px; width: 90%; border: 1px solid #eef0f2; text-align: center; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-family: 'Archivo Black', sans-serif; font-size: 22px; color: #212329; margin: 0 0 12px; }
    p { font-size: 15px; color: #293452; line-height: 1.6; margin: 0 0 24px; }
    a { display: inline-block; padding: 12px 28px; background: #212329; color: #fff; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🗑️</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="${SITE_URL}">Voltar ao MedLibre</a>
  </div>
</body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return htmlPage('Link inválido', 'Token ausente. Verifique o link no e-mail.');
  }

  // ── Fetch approval ────────────────────────────────────────────────────────
  const { data: approval, error } = await supabaseAdmin
    .from('report_approvals')
    .select('id, status, expires_at, report_id')
    .eq('token', token)
    .single();

  if (error || !approval) {
    return htmlPage('Link inválido', 'Este link não existe ou já foi utilizado.');
  }

  if (approval.status !== 'pending') {
    return htmlPage(
      'Link já utilizado',
      `Este link já foi ${approval.status === 'rejected' ? 'rejeitado' : 'processado'}.`,
    );
  }

  // ── Check expiry ──────────────────────────────────────────────────────────
  if (new Date(approval.expires_at as string) < new Date()) {
    await supabaseAdmin
      .from('report_approvals')
      .update({ status: 'expired' })
      .eq('token', token);
    return htmlPage('Link expirado', 'Este link expirou. Os links são válidos por 7 dias.');
  }

  // ── Reject ────────────────────────────────────────────────────────────────
  await Promise.all([
    supabaseAdmin
      .from('report_approvals')
      .update({ status: 'rejected', resolved_at: new Date().toISOString() })
      .eq('token', token),
    supabaseAdmin
      .from('reports')
      .update({ status: 'dismissed' })
      .eq('id', approval.report_id),
  ]);

  console.log('[reports/reject] Report dismissed for token:', token);
  return htmlPage('Relatório rejeitado', 'A correção foi rejeitada. Nenhuma alteração foi feita na questão.');
}
