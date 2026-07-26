import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";

const bodySchema = z.object({
  email: z.string().email(),
  fullName: z.string().nullable(),
  productName: z.string().min(1),
});

/**
 * Not connected to a real email provider yet — logs server-side and
 * responds { ok: true, sent: false } so the difference is visible if this
 * is ever inspected directly. Wire up Resend/Postmark/SendGrid here once
 * one is chosen (DEPLOYMENT.md already discusses these for auth email
 * deliverability) — notificationService.sendTrialActivatedEmail() on the
 * client never needs to change when that happens.
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

    console.log(
      `[notifications] Trial Activated email not sent (no provider configured yet) — would notify ${parsed.data.email} about "${parsed.data.productName}"`,
    );

    return res.status(200).json({ ok: true, sent: false });
  } catch (err) {
    console.error("[notifications/trial-activated] unhandled error:", err);
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
