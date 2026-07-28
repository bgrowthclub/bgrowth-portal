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
 * Requires RESEND_API_KEY. RESEND_FROM_EMAIL must be an address on a
 * domain verified in the Resend dashboard — Resend rejects sends from an
 * unverified domain, and its own sandbox address (onboarding@resend.dev)
 * can only send to the account owner's own email, not real members.
 */
export async function sendEmail({ to, subject, html, replyTo }: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  // Every send's reply path is the real, monitored BGrowth support inbox by
  // default — RESEND_FROM_EMAIL (e.g. notifications@bgrowthclub.com) is
  // often a no-reply-style sending address, so without this a customer who
  // hits "reply" on any transactional email gets nothing back. A caller can
  // still override it for a specific email by passing its own `replyTo`.
  const effectiveReplyTo = replyTo ?? process.env.SUPPORT_EMAIL;

  if (!apiKey || !from) {
    return { ok: false, error: "RESEND_API_KEY or RESEND_FROM_EMAIL is not configured." };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
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
