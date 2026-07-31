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
 * Signup, Reset Password, Magic Link, Invite User, Change Email Address,
 * Reauthentication) mirror this same visual language by hand, since
 * Supabase's Auth Email Templates dashboard only accepts pasted static
 * HTML, not a function call — keep both in sync on any visual change here.
 *
 * Design system: a minimal, Stripe/Linear-style transactional shell — a
 * dark navy header bar carrying the BGrowth wordmark as text (no logo
 * image anywhere), a plain white content card with restrained padding, and
 * a rectangular (not pill) accent-blue button. Every spacing/color value
 * below is the single source of truth other than the six static HTML
 * files, which restate it by hand for the reason above.
 *
 * Gracefully degrades rather than emitting a broken link: no
 * PORTAL_PUBLIC_URL means no Privacy/Terms footer links; no SUPPORT_EMAIL
 * means no Support footer link.
 */
export function renderEmailLayout({ preheader, heading, bodyHtml, cta }: EmailLayoutInput): string {
  const ctaHtml = cta
    ? `<div style="margin-top:4px;"><a href="${cta.url}" style="display:inline-block; background:#1061EC; color:#ffffff; font-weight:600; font-size:14px; text-decoration:none; padding:12px 22px; border-radius:8px;">${cta.label}</a></div>`
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
        .bg-email-header { padding: 16px 20px !important; }
        .bg-email-content { padding: 20px !important; }
        .bg-email-footer { padding: 14px 20px !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; background-color:#f5f6f8;">
    <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; opacity:0;">${preheader}</div>
    <div style="background-color:#f5f6f8; padding:24px 16px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
      <table role="presentation" width="100%" style="max-width:480px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 2px rgba(16,24,40,0.06);">
        <tr>
          <td class="bg-email-header" style="background:#0B1C3B; padding:20px 28px;">
            <span style="color:#ffffff; font-size:15px; font-weight:700; letter-spacing:0.02em;">BGrowth</span>
          </td>
        </tr>
        <tr>
          <td class="bg-email-content" style="padding:28px;">
            <h1 style="margin:0 0 8px; font-size:20px; font-weight:700; color:#0B1C3B; line-height:1.3;">${heading}</h1>
            ${bodyHtml}
            ${ctaHtml}
          </td>
        </tr>
        <tr>
          <td class="bg-email-footer" style="padding:18px 28px; border-top:1px solid #eef0f3; text-align:center;">
            ${footerLinks ? `<p style="margin:0 0 6px; font-size:12px; color:#94a3b8;">${footerLinks}</p>` : ""}
            <p style="margin:0; font-size:12px; color:#94a3b8;">BGrowth Club · bgrowthclub.com</p>
          </td>
        </tr>
      </table>
    </div>
  </body>
</html>`.trim();
}
