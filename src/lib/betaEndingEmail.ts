const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://medlibre.com.br';
const FROM = 'MedLibre <institucional@medlibre.com.br>';
const RESEND_API_KEY = process.env.RESEND_API_KEY!;

// ─── Token HMAC (stateless, sem tabela adicional) ────────────────────────────
// Formato: base64url(userId:expiry) + '.' + hex(hmac-sha256)
export async function signFeedbackToken(userId: string): Promise<string> {
  const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 dias
  const payload = `${userId}:${expiry}`;
  const secret = process.env.ADMIN_EMAIL_SECRET!;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const payloadB64 = Buffer.from(payload).toString('base64url');
  return `${payloadB64}.${sigHex}`;
}

export async function verifyFeedbackToken(token: string): Promise<string | null> {
  try {
    const [payloadB64, sigHex] = token.split('.');
    if (!payloadB64 || !sigHex) return null;

    const payload = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    const [userId, expiryStr] = payload.split(':');
    if (!userId || !expiryStr) return null;

    if (Date.now() > parseInt(expiryStr, 10)) return null; // expirado

    const secret = process.env.ADMIN_EMAIL_SECRET!;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const expectedSig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    const expectedHex = Array.from(new Uint8Array(expectedSig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Comparação em tempo constante
    if (sigHex.length !== expectedHex.length) return null;
    let diff = 0;
    for (let i = 0; i < sigHex.length; i++) {
      diff |= sigHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
    }
    if (diff !== 0) return null;

    return userId;
  } catch {
    return null;
  }
}

// ─── Template de email ───────────────────────────────────────────────────────
export function buildBetaEndingEmail(params: {
  firstName: string;
  referralCode: string;
  feedbackToken: string;
}): string {
  const { firstName, referralCode, feedbackToken } = params;
  const feedbackUrl = `${SITE_URL}/feedback?token=${feedbackToken}`;
  const signupUrl = `${SITE_URL}/auth`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Lexend+Deca:wght@400;600&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; padding: 0; background-color: #F6F5F4; }
    .font-title { font-family: 'Archivo Black', 'Arial Black', sans-serif; }
    .font-body  { font-family: 'Lexend Deca', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    @media screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 20px !important; }
      .content-block { padding: 32px 20px !important; }
    }
  </style>
</head>
<body style="background-color:#F6F5F4;color:#212329;-webkit-font-smoothing:antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F6F5F4;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;">

          <!-- Logo -->
          <tr>
            <td align="left" style="padding-bottom:28px;">
              <a href="${SITE_URL}" target="_blank">
                <img src="https://medlibre.com.br/logo_withname_black.png" alt="MedLibre" style="width:148px;height:auto;">
              </a>
            </td>
          </tr>

          <!-- Card principal -->
          <tr>
            <td class="content-block" style="background-color:#ffffff;border-radius:12px;padding:48px;box-shadow:0 1px 3px rgba(0,0,0,0.04),0 6px 16px rgba(0,0,0,0.04);border:1px solid #eef0f2;">

              <!-- Eyebrow -->
              <p class="font-body" style="font-size:11px;color:#EDB92E;margin:0 0 12px 0;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;">
                Beta Premium · encerra em 07 de abril
              </p>

              <h1 class="font-title" style="font-size:28px;line-height:1.15;margin:0 0 24px 0;color:#212329;letter-spacing:-0.02em;">
                Você acreditou antes de todo mundo.<br>Isso tem valor real.
              </h1>

              <p class="font-body" style="font-size:15px;line-height:1.75;color:#293452;margin:0 0 16px 0;">
                ${escapeHtml(firstName)}, você entrou quando o MedLibre ainda era uma aposta.
                Estudou, reportou bugs, tolerou imperfeições — e ajudou a moldar o que isso se tornou.
              </p>
              <p class="font-body" style="font-size:15px;line-height:1.75;color:#293452;margin:0 0 36px 0;">
                Em <strong>07 de abril de 2026</strong>, o Beta Premium encerra.
                Mas antes disso, queremos recompensar quem esteve aqui desde o início — com tempo premium real.
              </p>

              <!-- Divisor com acento dourado -->
              <table width="100%" style="border-collapse:collapse;margin-bottom:36px;">
                <tr>
                  <td style="border-top:2px solid #EDB92E;width:40px;">&nbsp;</td>
                  <td style="border-top:1px solid #eef0f2;">&nbsp;</td>
                </tr>
              </table>

              <!-- Bloco 1: Feedback → +3 meses -->
              <table width="100%" style="border-collapse:collapse;margin-bottom:28px;">
                <tr>
                  <td style="background:#212329;border-radius:12px;padding:28px 32px;">
                    <p class="font-title" style="font-size:11px;color:#EDB92E;margin:0 0 8px 0;letter-spacing:0.1em;text-transform:uppercase;">
                      Ação 1 de 2 · Maior recompensa
                    </p>
                    <p class="font-title" style="font-size:20px;color:#F6F5F4;margin:0 0 12px 0;line-height:1.25;">
                      Dê seu feedback honesto.<br>Ganhe 3 meses Premium grátis.
                    </p>
                    <p class="font-body" style="font-size:14px;line-height:1.7;color:#9ca3af;margin:0 0 24px 0;">
                      Seu olhar de beta tester vale mais do que qualquer pesquisa de mercado.
                      Preencha o formulário detalhado — são 5 minutos que moldam o futuro do produto —
                      e receba <strong style="color:#F6F5F4;">3 meses de Premium sem cobrar nada</strong>
                      (válido até 07 de julho de 2026).
                    </p>
                    <table border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" bgcolor="#EDB92E" style="border-radius:10px;">
                          <a href="${feedbackUrl}" class="font-body"
                            style="font-size:15px;font-weight:600;color:#212329;text-decoration:none;padding:14px 32px;display:inline-block;letter-spacing:-0.01em;">
                            Enviar feedback e garantir 3 meses →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Bloco 2: Referral → +1 mês por amigo -->
              <table width="100%" style="border-collapse:collapse;margin-bottom:36px;">
                <tr>
                  <td style="background:#F6F5F4;border-radius:12px;padding:28px 32px;border:1px solid #eef0f2;">
                    <p class="font-title" style="font-size:11px;color:#293452;margin:0 0 8px 0;letter-spacing:0.1em;text-transform:uppercase;">
                      Ação 2 de 2 · Ilimitado
                    </p>
                    <p class="font-title" style="font-size:20px;color:#212329;margin:0 0 12px 0;line-height:1.25;">
                      Indique um colega.<br>+1 mês grátis por cada um.
                    </p>
                    <p class="font-body" style="font-size:14px;line-height:1.7;color:#293452;margin:0 0 20px 0;">
                      Todo colega que criar conta com o seu código entra direto no Premium.
                      E você acumula <strong>+1 mês por indicação</strong>, sem teto máximo.
                      Dois amigos = dois meses. Dez amigos = dez meses.
                    </p>
                    <!-- Código de referral em destaque -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:12px;">
                      <tr>
                        <td style="background:#ffffff;border-radius:8px;padding:16px 20px;border:2px dashed #EDB92E;">
                          <p class="font-body" style="font-size:10px;color:#9ca3af;margin:0 0 6px 0;letter-spacing:0.1em;text-transform:uppercase;">
                            Seu código de convite
                          </p>
                          <p class="font-title" style="font-size:28px;color:#293452;margin:0;letter-spacing:0.12em;">
                            ${escapeHtml(referralCode)}
                          </p>
                        </td>
                      </tr>
                    </table>
                    <p class="font-body" style="font-size:12px;color:#9ca3af;margin:0;">
                      Link direto:
                      <a href="${signupUrl}?ref=${encodeURIComponent(referralCode)}"
                        style="color:#293452;word-break:break-all;">
                        ${signupUrl}?ref=${encodeURIComponent(referralCode)}
                      </a>
                    </p>
                  </td>
                </tr>
              </table>

              <hr style="border:none;border-top:1px solid #eef0f2;margin:0 0 24px 0;">

              <p class="font-body" style="font-size:13px;line-height:1.7;color:#9ca3af;margin:0;">
                Dúvidas? Responda este e-mail ou acesse
                <a href="${SITE_URL}/support" style="color:#293452;text-decoration:none;font-weight:600;">medlibre.com.br/support</a>.
                A residência é difícil demais para estudar com método errado — e você sabe disso melhor do que ninguém.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:36px;">
              <p class="font-body" style="font-size:11px;color:#9ca3af;margin:0;text-transform:lowercase;">
                &copy; 2026 medlibre treinamento ltda.<br>
                <a href="${SITE_URL}/privacy" style="color:#9ca3af;text-decoration:underline;">privacidade</a>
                &nbsp;&bull;&nbsp;
                <a href="${SITE_URL}/support" style="color:#9ca3af;text-decoration:underline;">suporte</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Envio em batch via Resend ───────────────────────────────────────────────
export async function sendBetaEndingEmail(params: {
  to: string;
  firstName: string;
  referralCode: string;
  feedbackToken: string;
}): Promise<void> {
  const html = buildBetaEndingEmail(params);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: params.to,
      subject: 'Você acreditou antes de todo mundo — aqui está sua recompensa',
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[betaEndingEmail] Resend error (${res.status}): ${body}`);
  }
}
