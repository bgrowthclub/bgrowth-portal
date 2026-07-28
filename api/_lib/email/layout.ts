const PORTAL_URL = process.env.PORTAL_PUBLIC_URL;
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL;

export interface EmailLayoutInput {
  /** Hidden inbox-preview text (most clients show this next to the subject line) — always write one, never leave it to fall back to the email's own first line of visible text. */
  preheader: string;
  heading: string;
  /** Pre-escaped/trusted HTML for the body paragraphs — every caller in templates/ builds this from server-controlled strings (product names, formatted durations), never raw user input. */
  bodyHtml: string;
  cta?: { label: string; url: string };
}

/**
 * The one shared HTML shell every transactional email renders through —
 * every template in ./templates/ calls this instead of hand-rolling its own
 * header/footer table markup. `supabase/email-templates/*.html` (Confirm
 * Signup, Reset Password) mirror this same structure by hand, since
 * Supabase's Auth Email Templates dashboard only accepts pasted static
 * HTML, not a function call — keep both in sync on any visual change here.
 *
 * Gracefully degrades rather than emitting a broken link/image: no
 * PORTAL_PUBLIC_URL means no logo and no Privacy/Terms footer links; no
 * SUPPORT_EMAIL means no Support footer link. Same pattern already used
 * for the logo image before this file existed.
 */
export function renderEmailLayout({ preheader, heading, bodyHtml, cta }: EmailLayoutInput): string {
  const logoImg = PORTAL_URL
    ? `<img src="${PORTAL_URL}/logo.png" alt="BGrowth" width="40" height="40" style="display:block; margin:0 auto 8px;" />`
    : "";

  const ctaHtml = cta
    ? `<div style="margin-top:8px;"><a href="${cta.url}" style="display:inline-block; background:#1061EC; color:#ffffff; font-weight:600; font-size:15px; text-decoration:none; padding:14px 28px; border-radius:999px;">${cta.label}</a></div>`
    : "";

  const footerLinks = [
    SUPPORT_EMAIL
      ? `<a href="mailto:${SUPPORT_EMAIL}" style="color:#64748b; text-decoration:underline;">Support</a>`
      : null,
    PORTAL_URL ? `<a href="${PORTAL_URL}/privacy" style="color:#64748b; text-decoration:underline;">Privacy Policy</a>` : null,
    PORTAL_URL ? `<a href="${PORTAL_URL}/terms" style="color:#64748b; text-decoration:underline;">Terms of Service</a>` : null,
  ]
    .filter((link): link is string => link !== null)
    .join(" &nbsp;·&nbsp; ");

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <style>
      @media (max-width: 480px) {
        .bg-email-header { padding: 20px 24px !important; }
        .bg-email-content { padding: 24px !important; }
        .bg-email-footer { padding: 16px 24px !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; background-color:#f4f6fb;">
    <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; opacity:0;">${preheader}</div>
    <div style="background-color:#f4f6fb; padding:32px 16px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      <table role="presentation" width="100%" style="max-width:480px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(16,24,40,0.08);">
        <tr>
          <td class="bg-email-header" style="background:#0B1C3B; padding:28px 32px; text-align:center;">
            ${logoImg}
            <span style="color:#ffffff; font-size:16px; font-weight:700; letter-spacing:0.02em;">BGrowth Portal</span>
          </td>
        </tr>
        <tr>
          <td class="bg-email-content" style="padding:32px;">
            <h1 style="margin:0 0 12px; font-size:22px; font-weight:700; color:#0B1C3B;">${heading}</h1>
            ${bodyHtml}
            ${ctaHtml}
          </td>
        </tr>
        <tr>
          <td class="bg-email-footer" style="padding:20px 32px; background:#f8fafc; text-align:center;">
            ${footerLinks ? `<p style="margin:0 0 8px; font-size:12px; color:#94a3b8;">${footerLinks}</p>` : ""}
            <p style="margin:0; font-size:12px; color:#94a3b8;">BGrowth Club · bgrowthclub.com</p>
          </td>
        </tr>
      </table>
    </div>
  </body>
</html>`.trim();
}
