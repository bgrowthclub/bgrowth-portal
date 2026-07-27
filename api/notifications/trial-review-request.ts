import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";
import { sendEmail } from "../_lib/email/sendEmail.js";
import { buildTrialReviewRequestEmail } from "../_lib/email/templates/trialReviewRequest.js";
import { deriveAccessState } from "../../src/lib/workspaceAccess.js";

const bodySchema = z.object({
  userId: z.string().uuid(),
  productId: z.string().uuid(),
});

/**
 * Fires the one-time "your trial expired, how was it?" email. There's no
 * cron in this codebase, so this route is itself the idempotency check:
 * it's called lazily by the client (LibraryWorkspaceCard, via
 * notificationService) whenever it renders an expired-trial license, and
 * no-ops unless the license is genuinely expired and
 * licenses.review_requested_at is still null — then stamps that column so
 * it can never fire twice, however many times the client calls this.
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
    const { userId, productId } = parsed.data;
    const supabase = getSupabaseAdmin();

    const { data: license, error: licenseError } = await supabase
      .from("licenses")
      .select("*")
      .eq("user_id", userId)
      .eq("product_id", productId)
      .maybeSingle();
    if (licenseError) throw licenseError;

    // Same access-state derivation the rest of the app reads through
    // (src/lib/workspaceAccess.ts) — a purchased/lifetime license can never
    // read as "expired" here either, matching everywhere else this
    // distinction matters.
    const isExpired = deriveAccessState(license) === "expired";

    if (!license || !isExpired || license.review_requested_at) {
      return res.status(200).json({ ok: true, sent: false });
    }

    const [{ data: user, error: userError }, { data: product, error: productError }] = await Promise.all([
      supabase.from("users").select("email, full_name").eq("id", userId).maybeSingle(),
      supabase.from("products").select("name").eq("id", productId).maybeSingle(),
    ]);
    if (userError) throw userError;
    if (productError) throw productError;
    if (!user || !product) {
      return res.status(200).json({ ok: true, sent: false });
    }

    const { subject, html } = buildTrialReviewRequestEmail({ fullName: user.full_name, productName: product.name });
    const result = await sendEmail({ to: user.email, subject, html });

    if (!result.ok) {
      // Same reasoning as trial-activated.ts: this call is fire-and-forget
      // from the client, so a failed send must never surface as an error
      // there — just log it server-side and leave review_requested_at
      // unset so a later retry can still send it.
      console.error(`[notifications/trial-review-request] send failed: ${result.error}`);
      return res.status(200).json({ ok: true, sent: false, error: result.error });
    }

    const { error: updateError } = await supabase
      .from("licenses")
      .update({ review_requested_at: new Date().toISOString() })
      .eq("id", license.id);
    if (updateError) throw updateError;

    return res.status(200).json({ ok: true, sent: true, id: result.id });
  } catch (err) {
    console.error("[notifications/trial-review-request] unhandled error:", err);
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
