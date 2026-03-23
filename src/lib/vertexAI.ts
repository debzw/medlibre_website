import type { Question } from '@/integrations/supabase/types';
import type { Report } from '@/integrations/supabase/types';

export interface ProposedFix {
  field:
  | 'enunciado'
  | 'output_explicacao'
  | 'output_gabarito'
  | 'alternativa_a'
  | 'alternativa_b'
  | 'alternativa_c'
  | 'alternativa_d'
  | 'alternativa_e'
  | 'resposta_correta';
  old_value: string;
  new_value: string;
}

export interface AIEvaluation {
  is_valid_error: boolean;
  ai_analysis: string;
  proposed_fix: ProposedFix[] | null;
}

// ---------------------------------------------------------------------------
// Google OAuth2: exchange service account JSON → access token (runtime, no fs)
// ---------------------------------------------------------------------------

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  project_id: string;
}

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const key: ServiceAccountKey = JSON.parse(serviceAccountJson);

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  // Build JWT manually using Web Crypto (available in Node 18+ / Edge)
  const header = { alg: 'RS256', typ: 'JWT' };
  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

  const signingInput = `${encode(header)}.${encode(payload)}`;

  // Import the PEM private key
  const pemBody = key.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const keyBuffer = Buffer.from(pemBody, 'base64');

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    Buffer.from(signingInput),
  );

  const jwt = `${signingInput}.${Buffer.from(signature).toString('base64url')}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[vertexAI] Failed to get access token: ${body}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

// ---------------------------------------------------------------------------
// Evaluate a report against the full question using Vertex AI (two-step)
// Step 1 — gemini-2.5-flash-lite: check if the report is a valid error
// Step 2 — gemini-3.0 (o3):       generate the correction if valid
// ---------------------------------------------------------------------------

const CORRECTION_MODEL = 'gemini-2.5-flash';

const FIELD_LABELS: Record<ProposedFix['field'], string> = {
  enunciado: 'Enunciado',
  output_explicacao: 'Explicação',
  output_gabarito: 'Gabarito',
  alternativa_a: 'Alternativa A',
  alternativa_b: 'Alternativa B',
  alternativa_c: 'Alternativa C',
  alternativa_d: 'Alternativa D',
  alternativa_e: 'Alternativa E',
  resposta_correta: 'Resposta correta',
};

export function getFieldLabel(field: ProposedFix['field']): string {
  return FIELD_LABELS[field] ?? field;
}

function buildEndpoint(project: string, location: string, model: string): string {
  return (
    `https://${location}-aiplatform.googleapis.com/v1/projects/${project}` +
    `/locations/${location}/publishers/google/models/${model}:generateContent`
  );
}

async function callGemini(
  endpoint: string,
  accessToken: string,
  systemInstruction: string,
  userMessage: string,
  maxOutputTokens: number,
): Promise<string> {
  const body = {
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens,
      responseMimeType: 'application/json',
    },
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[vertexAI] Request to ${endpoint} failed (${res.status}): ${text}`);
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

export async function evaluateReport(
  question: Question,
  report: Report,
): Promise<AIEvaluation> {
  const serviceAccountJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const project = process.env.GOOGLE_VERTEX_PROJECT;
  const location = process.env.GOOGLE_VERTEX_LOCATION ?? 'us-central1';

  if (!serviceAccountJson || !project) {
    console.error('[vertexAI] Missing env vars:', {
      hasCredentials: !!serviceAccountJson,
      credentialsLength: serviceAccountJson?.length ?? 0,
      hasProject: !!project,
      project,
    });
    throw new Error('[vertexAI] Missing GOOGLE_APPLICATION_CREDENTIALS_JSON or GOOGLE_VERTEX_PROJECT');
  }

  const accessToken = await getAccessToken(serviceAccountJson);

  const questionJson = JSON.stringify(question, null, 2);
  const reportCategory = report.category;
  const reportDescription = report.description ?? '(sem descrição)';

  // ── Single step: propose correction directly (admin reviews and approves/rejects) ──
  const correctionEndpoint = buildEndpoint(project, location, CORRECTION_MODEL);

  const correctionSystem = `Você é um assistente que estrutura correções de questões médicas para revisão administrativa.
Sua tarefa é formatar a correção indicada pelo usuário em JSON. NÃO avalie se a correção médica está certa ou errada — isso é responsabilidade do administrador que aprovará ou rejeitará a sugestão.

Regras obrigatórias:
1. Se o usuário indica que a resposta correta deveria ser outra alternativa, proponha SEMPRE os três campos: resposta_correta (só a letra, ex: "B"), output_gabarito (ex: "B - [texto da alternativa B]"), e output_explicacao (prefixe com "[REVISÃO NECESSÁRIA] " e adapte brevemente a explicação original para indicar a nova alternativa).
2. Se for erro de digitação ou formatação, corrija apenas o campo afetado.
3. NUNCA retorne proposed_fixes vazio. Se não souber o texto exato do novo campo, use o conteúdo da questão disponível e marque com "[REVISÃO NECESSÁRIA]".
Responda APENAS com JSON válido seguindo exatamente o schema fornecido, sem markdown, sem texto adicional.`;

  const correctionMessage = `SCHEMA DE RESPOSTA:
{
  "ai_analysis": "string em pt-BR, 1-2 frases resumindo o que foi reportado e o que está sendo proposto",
  "proposed_fixes": [
    {
      "field": "enunciado|output_explicacao|output_gabarito|alternativa_a|alternativa_b|alternativa_c|alternativa_d|alternativa_e|resposta_correta",
      "old_value": "texto atual exato do campo",
      "new_value": "texto corrigido"
    }
  ]
}

IMPORTANTE: Se a resposta correta mudou, inclua OBRIGATORIAMENTE as três entradas em proposed_fixes: output_gabarito, resposta_correta e output_explicacao.

QUESTÃO:
${questionJson}

CATEGORIA DO REPORT: ${reportCategory}
DESCRIÇÃO DO USUÁRIO: ${reportDescription}`;

  try {
    const rawCorrection = await callGemini(correctionEndpoint, accessToken, correctionSystem, correctionMessage, 2048);
    const parsed = JSON.parse(rawCorrection) as { ai_analysis?: string; proposed_fixes?: ProposedFix[]; proposed_fix?: ProposedFix };
    const fixes: ProposedFix[] | null =
      parsed.proposed_fixes?.length
        ? parsed.proposed_fixes
        : parsed.proposed_fix
          ? [parsed.proposed_fix]
          : null;
    return {
      is_valid_error: true,
      ai_analysis: String(parsed.ai_analysis ?? ''),
      proposed_fix: fixes,
    };
  } catch {
    return {
      is_valid_error: true,
      ai_analysis: 'Erro ao processar correção. Revisão manual necessária.',
      proposed_fix: null,
    };
  }
}
