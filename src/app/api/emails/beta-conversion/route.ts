import { Resend } from "resend";
import { render } from "@react-email/components";
import { BetaConversion1 } from "@/emails/BetaConversion1";
import { NextRequest, NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export interface BetaConversionPayload {
  /** Single recipient or array for batch sends */
  recipients: Array<{
    email: string;
    firstName?: string;
    questionsAnswered?: number;
    accuracyRate?: number;
    studyDays?: number;
  }>;
  /** ISO 8601 datetime string — omit to send immediately */
  scheduledAt?: string;
  /** Override default sender name */
  fromName?: string;
}

export async function POST(req: NextRequest) {
  // Basic auth check — only allow internal/admin calls
  const authHeader = req.headers.get("authorization");
  const adminSecret = process.env.CRON_SECRET;

  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: BetaConversionPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { recipients, scheduledAt, fromName = "Equipe MedLibre" } = body;

  if (!recipients || recipients.length === 0) {
    return NextResponse.json(
      { error: "recipients array is required and must not be empty" },
      { status: 400 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.medlibre.com.br";

  const results = await Promise.allSettled(
    recipients.map(async (recipient) => {
      const html = await render(
        BetaConversion1({
          firstName: recipient.firstName,
          questionsAnswered: recipient.questionsAnswered,
          accuracyRate: recipient.accuracyRate,
          studyDays: recipient.studyDays,
          appUrl,
        })
      );

      const payload: Parameters<typeof resend.emails.send>[0] = {
        from: `${fromName} <noreply@medlibre.com.br>`,
        to: recipient.email,
        subject: "Você ajudou a construir o MedLibre — obrigado",
        html,
        ...(scheduledAt ? { scheduledAt } : {}),
      };

      return resend.emails.send(payload);
    })
  );

  const sent: string[] = [];
  const failed: Array<{ email: string; error: string }> = [];

  results.forEach((result, index) => {
    const email = recipients[index].email;
    if (result.status === "fulfilled" && !result.value.error) {
      sent.push(email);
    } else {
      const message =
        result.status === "rejected"
          ? String(result.reason)
          : result.value.error?.message ?? "Unknown error";
      failed.push({ email, error: message });
    }
  });

  const status = failed.length === 0 ? 200 : sent.length > 0 ? 207 : 500;

  return NextResponse.json(
    {
      sent: sent.length,
      failed: failed.length,
      scheduledAt: scheduledAt ?? null,
      details: { sent, failed },
    },
    { status }
  );
}
