import { NextResponse } from 'next/server';
import { buildBetaEndingEmail } from '@/lib/betaEndingEmail';

// Apenas em desenvolvimento
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Não disponível em produção' }, { status: 403 });
  }

  const html = buildBetaEndingEmail({
    firstName: 'Débora',
    referralCode: 'MED-AB42',
    feedbackToken: 'preview-token-nao-funcional',
  });

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
