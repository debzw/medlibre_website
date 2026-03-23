import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { evaluateReport } from '@/lib/vertexAI';
import { sendAdminReportEmail } from '@/lib/reportEmails';
import type { Report, Question } from '@/integrations/supabase/types';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Supabase Database Webhook payload shape
interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
}

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = (await request.json()) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const report = payload.record as Report | null;
  if (!report?.id) {
    return NextResponse.json({ ok: true, skipped: 'no record' });
  }

  // ── Only process question reports ────────────────────────────────────────
  if (report.type !== 'question') {
    return NextResponse.json({ ok: true, skipped: 'non-question report' });
  }

  console.log('[reports/process] Processing report:', report.id);

  // Mark as processing
  await supabaseAdmin
    .from('reports')
    .update({ status: 'processing' })
    .eq('id', report.id);

  // ── Fetch question ────────────────────────────────────────────────────────
  const { data: question, error: qErr } = await supabaseAdmin
    .from('questions')
    .select('*')
    .eq('id', report.target_id)
    .single();

  if (qErr || !question) {
    console.warn('[reports/process] Question not found for report:', report.id);
    await supabaseAdmin
      .from('reports')
      .update({ status: 'dismissed' })
      .eq('id', report.id);
    return NextResponse.json({ ok: true, skipped: 'question not found' });
  }

  // ── Fetch reporter profile (nullable) ────────────────────────────────────
  let reporterEmail: string | null = null;
  let reporterName: string | null = null;

  if (report.user_id) {
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('email, full_name')
      .eq('id', report.user_id)
      .single();

    reporterEmail = profile?.email ?? null;
    reporterName  = profile?.full_name ?? null;
  }

  // ── Evaluate with Vertex AI ───────────────────────────────────────────────
  let evaluation;
  try {
    evaluation = await evaluateReport(question as Question, report);
  } catch (err) {
    console.error('[reports/process] Vertex AI error:', err);
    await supabaseAdmin
      .from('reports')
      .update({ status: 'processing_failed' })
      .eq('id', report.id);
    // Still send admin email to alert about the failure
    evaluation = {
      is_valid_error: false,
      ai_analysis: `Erro ao processar com IA: ${err instanceof Error ? err.message : String(err)}`,
      proposed_fix: null,
    };
  }

  // ── Store approval record ─────────────────────────────────────────────────
  const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS).toISOString();

  const { data: approval, error: approvalErr } = await supabaseAdmin
    .from('report_approvals')
    .insert({
      report_id:     report.id,
      is_valid_error: evaluation.is_valid_error,
      ai_analysis:   evaluation.ai_analysis,
      proposed_fix:  evaluation.proposed_fix ?? null,
      expires_at:    expiresAt,
      // store reporter info alongside so approve route can use it without extra joins
      ...(reporterEmail ? { reporter_email: reporterEmail } : {}),
      ...(reporterName  ? { reporter_name:  reporterName  } : {}),
    })
    .select('token')
    .single();

  if (approvalErr || !approval) {
    console.error('[reports/process] Failed to insert approval:', approvalErr);
    return NextResponse.json({ error: 'DB insert failed' }, { status: 500 });
  }

  // ── Send admin email ──────────────────────────────────────────────────────
  try {
    await sendAdminReportEmail(report, question as Question, evaluation, approval.token as string);
  } catch (err) {
    console.error('[reports/process] Failed to send admin email:', err);
    // Non-fatal: approval row exists; don't fail the webhook
  }

  console.log('[reports/process] Done. Approval token created:', approval.token);
  return NextResponse.json({ ok: true });
}
