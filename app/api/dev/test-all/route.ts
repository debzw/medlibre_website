import { NextResponse } from 'next/server';

// Rota de conveniência: chama todos os endpoints de dev em sequência
// Acesse: http://localhost:3000/api/dev/test-all?email=deborabitzum@gmail.com
export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const base = new URL(request.url).origin;
  const email = new URL(request.url).searchParams.get('email') ?? 'deborabitzum@gmail.com';
  const results: Record<string, unknown> = {};

  // 1. Gerar referral codes
  const r1 = await fetch(`${base}/api/admin/generate-referral-codes`, {
    method: 'POST',
    headers: { 'x-admin-secret': process.env.ADMIN_EMAIL_SECRET! },
  });
  results.generate_referral_codes = await r1.json();

  // 2. Gerar token de feedback para o usuário
  const r2 = await fetch(`${base}/api/dev/feedback-token?email=${encodeURIComponent(email)}`);
  const tokenData = await r2.json();
  results.feedback_token = tokenData;

  // 3. Dry-run do batch de email
  const r3 = await fetch(`${base}/api/emails/beta-ending`, {
    method: 'POST',
    headers: {
      'x-cron-secret': process.env.CRON_SECRET!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ dry_run: true }),
  });
  results.email_dry_run = await r3.json();

  return NextResponse.json(results, { status: 200 });
}
