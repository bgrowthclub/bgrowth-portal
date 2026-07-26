import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { sendEmail } from "../_lib/email/sendEmail.js";
import { buildTrialActivatedEmail } from "../_lib/email/templates/trialActivated.js";

const bodySchema = z.object({
  email: z.string().email(),
  fullName: z.string().nullable(),
  productName: z.string().min(1),
  productSlug: z.string().min(1),
  trialDuration: z.number().int().positive().nullable(),
  trialUnit: z.enum(["days"]),
});

/**
 * Sends the Trial Activated email via Resend (api/_lib/email/sendEmail.ts).
 * A future notification type (purchase completed, marketing sends, etc.)
 * follows the same shape: a template in api/_lib/email/templates/, a route
 * here that validates its payload and calls sendEmail() — the client-side
 * notificationService never needs to change.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ ok: false, error: "Invalid request", issues: parsed.error.issues });
    }
    const payload = parsed.data;

    const { subject, html } = buildTrialActivatedEmail({
      fullName: payload.fullName,
      productName: payload.productName,
      productSlug: payload.productSlug,
      trialDuration: payload.trialDuration,
      trialUnit: payload.trialUnit,
    });

    const result = await sendEmail({ to: payload.email, subject, html });

    if (!result.ok) {
      // Not the caller's fault (this whole call is fire-and-forget from the
      // client) — log server-side so a misconfigured/rejected send is
      // visible in Vercel's function logs, but still respond 200: a failed
      // notification must never look like a failed trial activation.
      console.error(`[notifications/trial-activated] send failed: ${result.error}`);
      return res.status(200).json({ ok: true, sent: false, error: result.error });
    }

    return res.status(200).json({ ok: true, sent: true, id: result.id });
  } catch (err) {
    console.error("[notifications/trial-activated] unhandled error:", err);
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
