import type { Question } from '@/integrations/supabase/types';
import type { Report } from '@/integrations/supabase/types';
import type { AIEvaluation, ProposedFix } from './vertexAI';
import { getFieldLabel } from './vertexAI';

const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://medlibre.com.br';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;
const FROM = 'MedLibre <institucional@medlibre.com.br>';

// ---------------------------------------------------------------------------
// Shared HTML shell (matches existing brand)
// ---------------------------------------------------------------------------

function emailShell(content: string): string {
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
      .content-block { padding: 30px 20px !important; }
    }
  </style>
</head>
<body style="background-color:#F6F5F4;color:#212329;-webkit-font-smoothing:antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F6F5F4;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;">
          <tr>
            <td align="left" style="padding-bottom:30px;">
              <a href="${SITE_URL}" target="_blank">
                <img src="https://medlibre.com.br/logo_withname_black.png" alt="medlibre" style="width:160px;height:auto;">
              </a>
            </td>
          </tr>
          <tr>
            <td class="content-block" style="background-color:#ffffff;border-radius:16px;padding:50px;border:1px solid #eef0f2;">
              ${content}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:40px;">
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

function button(href: string, label: string, bg: string): string {
  return `<table border="0" cellpadding="0" cellspacing="0" style="display:inline-table;margin-right:12px;">
    <tr>
      <td align="center" bgcolor="${bg}" style="border-radius:10px;">
        <a href="${href}" class="font-body" style="font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;padding:14px 28px;display:inline-block;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

function diffRow(label: string, oldVal: string, newVal: string): string {
  return `<table width="100%" style="border-collapse:collapse;margin-bottom:16px;">
    <tr><td style="font-size:12px;font-weight:600;color:#9ca3af;padding-bottom:4px;" class="font-body">${label}</td></tr>
    <tr>
      <td style="background:#fff5f5;border-radius:6px;padding:10px 14px;font-size:13px;color:#b91c1c;font-family:monospace;word-break:break-word;">
        − ${escapeHtml(oldVal)}
      </td>
    </tr>
    <tr><td style="height:6px;"></td></tr>
    <tr>
      <td style="background:#f0fdf4;border-radius:6px;padding:10px 14px;font-size:13px;color:#15803d;font-family:monospace;word-break:break-word;">
        + ${escapeHtml(newVal)}
      </td>
    </tr>
  </table>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Admin notification email
// ---------------------------------------------------------------------------

export async function sendAdminReportEmail(
  report: Report,
  question: Question,
  evaluation: AIEvaluation,
  token: string,
): Promise<void> {
  const approveUrl = `${SITE_URL}/api/reports/approve?token=${token}`;
  const rejectUrl = `${SITE_URL}/api/reports/reject?token=${token}`;

  const questionHeader = `Questão #${question.numero ?? '?'} · ${question.banca} ${question.ano}`;
  const fix = evaluation.proposed_fix as ProposedFix | null;

  const bodyContent = `
    <h1 class="font-title" style="font-size:22px;font-weight:400;line-height:1.2;margin:0 0 6px 0;color:#212329;">
      Relatório de erro — revisão necessária
    </h1>
    <p class="font-body" style="font-size:13px;color:#9ca3af;margin:0 0 28px 0;">${escapeHtml(questionHeader)}</p>

    <p class="font-body" style="font-size:13px;font-weight:600;color:#293452;margin:0 0 4px 0;">Categoria</p>
    <p class="font-body" style="font-size:14px;color:#212329;margin:0 0 16px 0;">${escapeHtml(report.category)}</p>

    <p class="font-body" style="font-size:13px;font-weight:600;color:#293452;margin:0 0 4px 0;">Descrição do usuário</p>
    <p class="font-body" style="font-size:14px;color:#212329;margin:0 0 24px 0;">${escapeHtml(report.description ?? '(sem descrição)')}</p>

    <hr style="border:none;border-top:1px solid #eef0f2;margin:0 0 24px 0;">

    <p class="font-body" style="font-size:13px;font-weight:600;color:#293452;margin:0 0 8px 0;">Análise da IA</p>
    <p class="font-body" style="font-size:14px;color:#212329;line-height:1.6;margin:0 0 24px 0;">${escapeHtml(evaluation.ai_analysis)}</p>

    ${fix ? `
    <hr style="border:none;border-top:1px solid #eef0f2;margin:0 0 24px 0;">
    <p class="font-body" style="font-size:13px;font-weight:600;color:#293452;margin:0 0 16px 0;">Correção proposta</p>
    ${diffRow(getFieldLabel(fix.field), fix.old_value, fix.new_value)}
    <div style="margin-top:28px;">
      ${button(approveUrl, '✅ Aprovar correção', '#16a34a')}
      ${button(rejectUrl, '❌ Rejeitar', '#dc2626')}
    </div>
    <p class="font-body" style="font-size:11px;color:#9ca3af;margin-top:16px;">
      Links expiram em 7 dias. Cada link só pode ser usado uma vez.
    </p>
    ` : `
    <p class="font-body" style="font-size:13px;color:#9ca3af;font-style:italic;">
      Nenhuma correção foi proposta. Nenhuma ação necessária.
    </p>
    `}
  `;

  await sendEmail(
    ADMIN_EMAIL,
    `[MedLibre] Relatório de erro — ${questionHeader}`,
    emailShell(bodyContent),
  );
}

// ---------------------------------------------------------------------------
// Reporter thank-you email
// ---------------------------------------------------------------------------

export async function sendReporterThankYouEmail(
  reporterEmail: string,
  reporterName: string | null,
  question: Question,
  fix: ProposedFix,
): Promise<void> {
  const name = reporterName ?? 'Estudante';
  const questionRef = `#${question.numero ?? '?'} (${question.banca} ${question.ano})`;
  const fieldLabel = getFieldLabel(fix.field);

  const bodyContent = `
    <h1 class="font-title" style="font-size:24px;font-weight:400;line-height:1.2;margin:0 0 24px 0;color:#212329;">
      Obrigado pelo seu relatório!
    </h1>
    <p class="font-body" style="font-size:16px;line-height:1.6;color:#293452;margin:0 0 24px 0;">
      Olá, ${escapeHtml(name)}!
    </p>
    <p class="font-body" style="font-size:15px;line-height:1.6;color:#293452;margin:0 0 24px 0;">
      Identificamos e corrigimos o erro que você reportou na questão ${escapeHtml(questionRef)}.
    </p>

    <hr style="border:none;border-top:1px solid #eef0f2;margin:0 0 24px 0;">

    <p class="font-body" style="font-size:13px;font-weight:600;color:#293452;margin:0 0 16px 0;">O que foi alterado</p>
    ${diffRow(fieldLabel, fix.old_value, fix.new_value)}

    <p class="font-body" style="font-size:15px;line-height:1.6;color:#293452;margin-top:24px;">
      Sua contribuição torna o MedLibre melhor para toda a comunidade médica. Muito obrigado!
    </p>
  `;

  await sendEmail(
    reporterEmail,
    'Obrigado pelo seu relatório — MedLibre',
    emailShell(bodyContent),
  );
}

// ---------------------------------------------------------------------------
// Shared Resend sender
// ---------------------------------------------------------------------------

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[reportEmails] Resend error (${res.status}): ${body}`);
  }
}
