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
  proposed_fix: ProposedFix | null;
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
// Evaluate a report against the full question using Gemini on Vertex AI
// ---------------------------------------------------------------------------

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

export async function evaluateReport(
  question: Question,
  report: Report,
): Promise<AIEvaluation> {
  const serviceAccountJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const project = process.env.GOOGLE_VERTEX_PROJECT;
  const location = process.env.GOOGLE_VERTEX_LOCATION ?? 'us-central1';
  const model = 'gemini-2.0-flash-001';

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

  const endpoint =
    `https://${location}-aiplatform.googleapis.com/v1/projects/${project}` +
    `/locations/${location}/publishers/google/models/${model}:generateContent`;

  const systemInstruction = `Você é um revisor de qualidade de questões médicas para uma plataforma brasileira de residência médica.
Avalie se o relatório do usuário identifica um erro real no texto da questão.
Se sim, proponha uma correção mínima de texto em UM ÚNICO campo.
Responda APENAS com JSON válido seguindo exatamente o schema fornecido, sem markdown, sem texto adicional.`;

  const userMessage = `SCHEMA DE RESPOSTA:
{
  "is_valid_error": boolean,
  "ai_analysis": "string em pt-BR, 2-3 frases explicando sua avaliação",
  "proposed_fix": {
    "field": "enunciado|output_explicacao|output_gabarito|alternativa_a|alternativa_b|alternativa_c|alternativa_d|alternativa_e|resposta_correta",
    "old_value": "texto atual",
    "new_value": "texto corrigido"
  } | null
}

QUESTÃO:
${JSON.stringify(question, null, 2)}

CATEGORIA DO REPORT: ${report.category}
DESCRIÇÃO DO USUÁRIO: ${report.description ?? '(sem descrição)'}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1024,
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
    throw new Error(`[vertexAI] Gemini request failed (${res.status}): ${text}`);
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  try {
    const parsed = JSON.parse(rawText) as AIEvaluation;
    return {
      is_valid_error: Boolean(parsed.is_valid_error),
      ai_analysis: String(parsed.ai_analysis ?? ''),
      proposed_fix: parsed.is_valid_error && parsed.proposed_fix
        ? parsed.proposed_fix
        : null,
    };
  } catch {
    return {
      is_valid_error: false,
      ai_analysis: 'Erro ao processar resposta da IA. Avaliação manual recomendada.',
      proposed_fix: null,
    };
  }
}
