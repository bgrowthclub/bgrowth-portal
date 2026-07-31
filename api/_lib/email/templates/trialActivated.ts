import { formatTrialSentence } from "../../../../src/lib/trial.js";
import type { TrialUnit } from "../../../../src/types/database.js";
import { renderEmailLayout } from "../layout.js";

export interface TrialActivatedEmailInput {
  fullName: string | null;
  productName: string;
  productSlug: string;
  trialDuration: number | null;
  trialUnit: TrialUnit;
}

const PORTAL_URL = process.env.PORTAL_PUBLIC_URL;

export function buildTrialActivatedEmail({ fullName, productName, productSlug, trialDuration, trialUnit }: TrialActivatedEmailInput): { subject: string; html: string } {
  const greeting = fullName ? `Hi ${fullName.split(" ")[0]},` : "Hi there,";
  const durationSentence =
    trialDuration != null ? `You have full access for the next ${formatTrialSentence(trialDuration, trialUnit)}.` : "Your trial is active.";
  const openUrl = PORTAL_URL ? `${PORTAL_URL}/workspace/${productSlug}` : undefined;

  const bodyHtml = `
    <p style="margin:0 0 6px; font-size:14px; line-height:1.6; color:#475569;">${greeting}</p>
    <p style="margin:0 0 20px; font-size:14px; line-height:1.6; color:#475569;">
      <strong>${productName}</strong> is ready to go. ${durationSentence}
    </p>
  `;

  const html = renderEmailLayout({
    preheader: `${productName} is ready — ${durationSentence}`,
    heading: "Your trial is active",
    bodyHtml,
    cta: openUrl ? { label: "Open Workspace", url: openUrl } : undefined,
  });

  return { subject: `Your ${productName} trial is active`, html };
}
