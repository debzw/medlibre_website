import { render } from '@react-email/render';
import * as React from 'react';
import { WelcomeEmail } from '@/emails/WelcomeEmail';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://medlibre.com.br';
const FROM = 'MedLibre <institucional@medlibre.com.br>';
const RESEND_API_KEY = process.env.RESEND_API_KEY!;

export async function sendWelcomeEmail(params: {
  to: string;
  firstName: string;
}): Promise<void> {
  const { to, firstName } = params;

  const trialEndsAt = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

  const html = await render(
    React.createElement(WelcomeEmail, {
      firstName,
      trialEndsAt,
      appUrl: SITE_URL,
    })
  );

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to,
      subject: 'Bem-vindo ao MedLibre — seu mês Premium grátis começa agora',
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[welcomeEmail] Resend error (${res.status}): ${body}`);
  }
}
