import { renderEmailLayout } from "../layout.js";

export interface TrialReviewRequestEmailInput {
  fullName: string | null;
  productName: string;
}

const PORTAL_URL = process.env.PORTAL_PUBLIC_URL;

/**
 * Sent exactly once per license, when a trial has expired and the member
 * hasn't been asked yet (see api/notifications/trial-review-request.ts for
 * the idempotency check). No reminders — this is the only send.
 */
export function buildTrialReviewRequestEmail({ fullName, productName }: TrialReviewRequestEmailInput): {
  subject: string;
  html: string;
} {
  const greeting = fullName ? `Hi ${fullName.split(" ")[0]},` : "Hi there,";
  const libraryUrl = PORTAL_URL ? `${PORTAL_URL}/library` : undefined;

  const bodyHtml = `
    <p style="margin:0 0 8px; font-size:14px; line-height:1.6; color:#475569;">${greeting}</p>
    <p style="margin:0 0 24px; font-size:14px; line-height:1.6; color:#475569;">
      Your free trial of <strong>${productName}</strong> has ended. We'd love your feedback — it only takes a minute.
    </p>
  `;

  const html = renderEmailLayout({
    preheader: `Your free trial of ${productName} has ended — tell us what you thought.`,
    heading: "How was your trial?",
    bodyHtml,
    cta: libraryUrl ? { label: "Leave a Review", url: libraryUrl } : undefined,
  });

  return { subject: `How was your ${productName} trial?`, html };
}
