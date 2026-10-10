import { escapeHtml } from "../escapeHtml.js";
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
  const greeting = fullName ? `Hi ${escapeHtml(fullName.split(" ")[0])},` : "Hi there,";
  const workspaceUrl = PORTAL_URL ? `${PORTAL_URL}/workspace/${productSlug}` : undefined;

  const bodyHtml = `
    <p style="margin:0 0 8px; font-size:14px; line-height:1.6; color:#475569;">${greeting}</p>
    <p style="margin:0 0 24px; font-size:14px; line-height:1.6; color:#475569;">
      <strong>${escapeHtml(productName)}</strong> is unlocked and ready in your Workspace.
    </p>
    ${
      welcomePdfUrl
        ? `<p style="margin:20px 0 0; font-size:13px; line-height:1.6; color:#94a3b8;">
             New here? <a href="${welcomePdfUrl}" style="color:#1061EC; font-weight:600; text-decoration:underline;">Read the Quick Start Guide</a> first.
           </p>`
        : ""
    }
  `;

  const html = renderEmailLayout({
    preheader: `${escapeHtml(productName)} is unlocked and ready in your Workspace.`,
    heading: "You're all set",
    bodyHtml,
    cta: workspaceUrl ? { label: "Open My Workspace", url: workspaceUrl } : undefined,
  });

  return { subject: `${productName} is ready in your Workspace`, html };
}

export interface BundlePurchasedEmailInput {
  fullName: string | null;
  bundleName: string;
  workspaceNames: string[];
}

// Bundles are sold on the Website (Portal migration 0041), so the button
// opens the member's Workspaces there.
const WEBSITE_URL = (process.env.WEBSITE_PUBLIC_URL || "https://bgrowth.app").replace(/\/$/, "");

export function buildBundlePurchasedEmail({
  fullName,
  bundleName,
  workspaceNames,
}: BundlePurchasedEmailInput): { subject: string; html: string } {
  const greeting = fullName ? `Hi ${escapeHtml(fullName.split(" ")[0])},` : "Hi there,";
  const list = workspaceNames.length
    ? `<ul style="margin:0 0 24px; padding-left:20px; font-size:14px; line-height:1.8; color:#475569;">${workspaceNames
        .map((name) => `<li>${escapeHtml(name)}</li>`)
        .join("")}</ul>`
    : "";

  const bodyHtml = `
    <p style="margin:0 0 8px; font-size:14px; line-height:1.6; color:#475569;">${greeting}</p>
    <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#475569;">
      Thank you for buying <strong>${escapeHtml(bundleName)}</strong>. These Workspaces are now yours, for as long as you want:
    </p>
    ${list}
  `;

  const html = renderEmailLayout({
    preheader: `Your ${escapeHtml(bundleName)} Workspaces are unlocked and ready.`,
    heading: "You're all set",
    bodyHtml,
    cta: { label: "Open My Workspaces", url: `${WEBSITE_URL}/platform/my-systems` },
  });

  return { subject: `${bundleName} is ready in your Workspaces`, html };
}
