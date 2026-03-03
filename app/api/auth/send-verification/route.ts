import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const TOKEN_TTL_MINUTES = 15;

export async function POST(request: NextRequest) {
  try {
    const { userId, email } = await request.json();

    if (!userId || !email) {
      return NextResponse.json({ error: 'userId e email são obrigatórios.' }, { status: 400 });
    }

    // Se já existe um token e ele expirou, o prazo acabou: deleta o usuário
    const { data: existingToken } = await supabaseAdmin
      .from('verification_tokens')
      .select('expires_at')
      .eq('user_id', userId)
      .single();

    if (existingToken && new Date(existingToken.expires_at) < new Date()) {
      await supabaseAdmin.from('user_profiles').delete().eq('id', userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: 'account_expired' }, { status: 410 });
    }

    // Gera token único
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

    // Upsert: substitui token anterior se já existir para este usuário
    const { error: dbError } = await supabaseAdmin
      .from('verification_tokens')
      .upsert(
        { user_id: userId, token, expires_at: expiresAt },
        { onConflict: 'user_id' }
      );

    if (dbError) {
      console.error('Erro ao salvar token:', dbError);
      return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
    }

    const confirmUrl = `${SITE_URL}/auth/confirm?token=${token}`;

    // Envia e-mail via Resend HTTP API (sem pacote npm adicional)
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'MedLibre <institucional@medlibre.com.br>',
        to: email,
        subject: 'Confirme seu e-mail — MedLibre',
        html: `
       <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Lexend+Deca:wght@400;600&display=swap" rel="stylesheet">
            <style>
                body { margin: 0; padding: 0; background-color: #F6F5F4; }
                img { border: 0; line-height: 100%; outline: none; text-decoration: none; display: block; }
                .font-title { font-family: 'Archivo Black', 'Arial Black', sans-serif; }
                .font-body { font-family: 'Lexend Deca', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
                
                /* Ajuste para mobile */
                @media screen and (max-width: 600px) {
                    .container { width: 100% !important; padding: 20px !important; }
                    .content-block { padding: 30px 20px !important; }
                }
            </style>
        </head>
        <body style="background-color: #F6F5F4; color: #212329; -webkit-font-smoothing: antialiased;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F6F5F4;">
                <tr>
                    <td align="center" style="padding: 40px 20px;">
                        
                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
                            <tr>
                                <td align="left" style="padding-bottom: 30px;">
                                    <a href="${SITE_URL}" target="_blank">
                                        <img src="https://medlibre.com.br/logo_withname_black.png" alt="medlibre" style="width: 160px; height: auto;">
                                    </a>
                                </td>
                            </tr>

                            <tr>
                                <td class="content-block" style="background-color: #ffffff; border-radius: 16px; padding: 50px; border: 1px solid #eef0f2;">
                                    
                                    <h1 class="font-title" style="font-size: 28px; font-weight: 400; line-height: 1.2; margin: 0 0 24px 0; color: #212329; letter-spacing: -0.02em;">
                                        Confirme seu acesso
                                    </h1>
                                    
                                    <p class="font-body" style="font-size: 16px; line-height: 1.6; color: #293452; margin: 0 0 40px 0;">
                                        Bem-vindo à medlibre. Sua jornada para a residência médica começa aqui. Para validar sua conta e liberar seu acesso, clique no botão abaixo:
                                    </p>

                                    <table border="0" cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td align="center" bgcolor="#EDB92E" style="border-radius: 12px;">
                                                <a href="${confirmUrl}" class="font-body" style="font-size: 16px; font-weight: 600; color: #212329; text-decoration: none; padding: 18px 35px; display: inline-block;">
                                                    Validar minha conta
                                                </a>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>

                            <tr>
                                <td align="center" style="padding-top: 40px;">
                                    <p class="font-body" style="font-size: 12px; color: #9ca3af; line-height: 1.6; margin: 0;">
                                        Link de segurança (copie e cole):<br>
                                        <span style="color: #293452; font-family: monospace; word-break: break-all;">${confirmUrl}</span>
                                    </p>
                                    <p class="font-body" style="font-size: 11px; color: #9ca3af; margin-top: 30px; text-transform: lowercase;">
                                        &copy; 2026 medlibre tecnologias ltda.<br>
                                        <a href="${SITE_URL}/privacy" style="color: #9ca3af; text-decoration: underline;">privacidade</a> &nbsp;&bull;&nbsp; 
                                        <a href="${SITE_URL}/support" style="color: #9ca3af; text-decoration: underline;">suporte</a>
                                    </p>
                                </td>
                            </tr>

                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        `,
      }),
    });

    if (!emailRes.ok) {
      const body = await emailRes.text();
      console.error('Erro Resend:', body);
      return NextResponse.json({ error: 'Falha ao enviar e-mail.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('send-verification error:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
