import { renderEmailLayout } from "../layout.js";

export interface PurchaseConfirmedEmailInput {
  fullName: string | null;
  productName: string;
  productSlug: string;
  welcomePdfUrl: string | null;
}

const PORTAL_URL = process.env.PORTAL_PUBLIC_URL;

/**
 * The primary onboarding email once a license is granted — whether from a
 * real Stripe purchase (api/webhooks/stripe.ts) or a free Workspace's
 * instant grant (api/checkout/create-session.ts, which never touches
 * Stripe or this same webhook at all). Both paths call
 * api/_lib/notifyPurchaseConfirmed.ts, which builds this email.
 *
 * The Workspace is the product: "Open My Workspace" is the one and only
 * primary CTA. The Welcome PDF (if this product has one — see
 * products.welcome_pdf_url) is offered underneath as an optional "Quick
 * Start Guide" plain-text link, deliberately not a second button — it
 * must never visually compete with opening the Workspace itself.
 */
export function buildPurchaseConfirmedEmail({
  fullName,
  productName,
  productSlug,
  welcomePdfUrl,
}: PurchaseConfirmedEmailInput): { subject: string; html: string } {
  const greeting = fullName ? `Hi ${fullName.split(" ")[0]},` : "Hi there,";
  const workspaceUrl = PORTAL_URL ? `${PORTAL_URL}/workspace/${productSlug}` : undefined;

  const bodyHtml = `
    <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#475569;">${greeting}</p>
    <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#475569;">
      <strong>${productName}</strong> is unlocked and ready. Everything you need to get started is waiting for you inside your Workspace.
    </p>
    ${
      welcomePdfUrl
        ? `<p style="margin:20px 0 0; font-size:13px; line-height:1.6; color:#94a3b8;">
             Want a quick overview first? <a href="${welcomePdfUrl}" style="color:#1061EC; font-weight:600; text-decoration:underline;">Read the Quick Start Guide</a>.
           </p>`
        : ""
    }
  `;

  const html = renderEmailLayout({
    preheader: `${productName} is unlocked and ready in your Workspace.`,
    heading: "You're all set 🎉",
    bodyHtml,
    cta: workspaceUrl ? { label: "Open My Workspace", url: workspaceUrl } : undefined,
  });

  return { subject: `${productName} is ready in your Workspace`, html };
}
