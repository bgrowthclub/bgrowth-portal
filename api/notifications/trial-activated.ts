import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { sendEmail } from "../_lib/email/sendEmail.js";
import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";
import { requireUser } from "../_lib/requireUser.js";
import { buildTrialActivatedEmail } from "../_lib/email/templates/trialActivated.js";

const bodySchema = z.object({
  productSlug: z.string().min(1),
});

// Only for a trial the member really started a moment ago.
const RECENT_MS = 15 * 60 * 1000;

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
    // The member comes from the session, and everything in the e-mail from
    // the database — never from the request body, so this can't be used to
    // send e-mail to anyone else or with injected content.
    const user = await requireUser(req);
    if (!user) return res.status(401).json({ ok: false, error: "Sign in to continue." });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ ok: false, error: "Invalid request" });

    const supabase = getSupabaseAdmin();
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, name, slug, trial_duration, trial_unit")
      .eq("slug", parsed.data.productSlug)
      .maybeSingle();
    if (productError) throw productError;
    if (!product) return res.status(200).json({ ok: true, sent: false });

    const { data: license, error: licenseError } = await supabase
      .from("licenses")
      .select("id, activated_at")
      .eq("user_id", user.id)
      .eq("product_id", product.id)
      .eq("type", "trial")
      .maybeSingle();
    if (licenseError) throw licenseError;
    const recent = license?.activated_at && Date.now() - new Date(license.activated_at).getTime() < RECENT_MS;
    if (!recent) return res.status(200).json({ ok: true, sent: false });

    const { data: profile } = await supabase.from("users").select("full_name").eq("id", user.id).maybeSingle();

    const { subject, html } = buildTrialActivatedEmail({
      fullName: profile?.full_name ?? null,
      productName: product.name,
      productSlug: product.slug,
      trialDuration: product.trial_duration,
      trialUnit: "days",
    });

    const result = await sendEmail({ to: user.email, subject, html });

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
    return res.status(500).json({ ok: false, error: "Something went wrong." });
  }
}
