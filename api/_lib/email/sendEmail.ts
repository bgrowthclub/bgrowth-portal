import { EMAIL_FROM, EMAIL_REPLY_TO } from "./senderIdentity.js";

const RESEND_API_URL = "https://api.resend.com/emails";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/**
 * The one place that talks to Resend. Every notification type (trial
 * activated today; purchase completed, marketing sends, etc. later) builds
 * its own subject/html via a template function (see ./templates/) and
 * calls this — nothing else in the codebase should ever import "resend"
 * or call fetch("https://api.resend.com/...") directly. Swapping providers
 * later means changing this one function's body.
 *
 * Requires RESEND_API_KEY. The sending address comes from
 * ./senderIdentity.ts (EMAIL_FROM_ADDRESS), not read here directly — it
 * must be on a domain verified in the Resend dashboard, or Resend rejects
 * the send; its own sandbox address (onboarding@resend.dev) can only send
 * to the account owner's own email, not real members.
 */
export async function sendEmail({ to, subject, html, replyTo }: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  // A caller can still override the reply-to for a specific email by
  // passing its own `replyTo` — otherwise every send replies to the same
  // address it came from (see ./senderIdentity.ts).
  const effectiveReplyTo = replyTo ?? EMAIL_REPLY_TO;

  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured." };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to,
        subject,
        html,
        ...(effectiveReplyTo ? { reply_to: effectiveReplyTo } : {}),
      }),
    });

    const data = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;

    if (!response.ok) {
      return { ok: false, error: data?.message ?? `Resend request failed (${response.status})` };
    }

    return { ok: true, id: data?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
