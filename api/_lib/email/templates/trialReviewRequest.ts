export interface TrialReviewRequestEmailInput {
  fullName: string | null;
  productName: string;
}

const PORTAL_URL = process.env.PORTAL_PUBLIC_URL;

/**
 * Sent exactly once per license, when a trial has expired and the member
 * hasn't been asked yet (see api/notifications/trial-review-request.ts for
 * the idempotency check). No reminders — this is the only send. Same
 * visual language as buildTrialActivatedEmail.
 */
export function buildTrialReviewRequestEmail({ fullName, productName }: TrialReviewRequestEmailInput): {
  subject: string;
  html: string;
} {
  const greeting = fullName ? `Hi ${fullName.split(" ")[0]},` : "Hi there,";
  const libraryUrl = PORTAL_URL ? `${PORTAL_URL}/library` : undefined;
  const logoImg = PORTAL_URL
    ? `<img src="${PORTAL_URL}/logo.png" alt="BGrowth" width="40" height="40" style="display:block; margin:0 auto 8px;" />`
    : "";

  const html = `
<div style="background-color:#f4f6fb; padding:32px 16px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" style="max-width:480px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(16,24,40,0.08);">
    <tr>
      <td style="background:#0B1C3B; padding:28px 32px; text-align:center;">
        ${logoImg}
        <span style="color:#ffffff; font-size:16px; font-weight:700; letter-spacing:0.02em;">BGrowth Portal</span>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <h1 style="margin:0 0 12px; font-size:22px; font-weight:700; color:#0B1C3B;">How was your trial?</h1>
        <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#475569;">${greeting}</p>
        <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#475569;">
          Your free trial of <strong>${productName}</strong> has ended. We'd love to hear what you thought —
          it only takes a minute, and it helps other members decide if it's right for them.
        </p>
        ${
          libraryUrl
            ? `<a href="${libraryUrl}" style="display:inline-block; background:#1061EC; color:#ffffff; font-weight:600; font-size:15px; text-decoration:none; padding:14px 28px; border-radius:999px;">Leave a Review</a>`
            : ""
        }
        <p style="margin:24px 0 0; font-size:13px; line-height:1.6; color:#94a3b8;">
          Questions? Just reply to this email.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px; background:#f8fafc; text-align:center;">
        <p style="margin:0; font-size:12px; color:#94a3b8;">BGrowth Club · bgrowthclub.com</p>
      </td>
    </tr>
  </table>
</div>`.trim();

  return { subject: `How was your ${productName} trial?`, html };
}
