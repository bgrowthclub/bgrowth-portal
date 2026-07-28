import type { getSupabaseAdmin } from "./supabaseAdmin.js";
import { sendEmail } from "./email/sendEmail.js";
import { buildPurchaseConfirmedEmail } from "./email/templates/purchaseConfirmed.js";

/**
 * Fires the Purchase Confirmation email — the primary onboarding email
 * once a license is granted, whether via a real Stripe purchase
 * (api/webhooks/stripe.ts) or a free Workspace's instant grant
 * (api/checkout/create-session.ts, which never reaches the webhook at
 * all). Both callers already hold a service-role client plus the
 * userId/productId they just granted a license for; this is the one place
 * that turns those into "look up who + what, build the email, send it" so
 * the lookup isn't duplicated across both routes.
 *
 * Best-effort only, matching every other notification in this codebase:
 * logs and swallows any failure rather than throwing — a failed
 * confirmation email must never undo or fail the purchase it's reporting
 * on.
 */
export async function notifyPurchaseConfirmed(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  { userId, productId }: { userId: string; productId: string },
): Promise<void> {
  try {
    const [{ data: user, error: userError }, { data: product, error: productError }] = await Promise.all([
      supabase.from("users").select("email, full_name").eq("id", userId).maybeSingle(),
      supabase.from("products").select("name, slug, welcome_pdf_url").eq("id", productId).maybeSingle(),
    ]);
    if (userError) throw userError;
    if (productError) throw productError;
    if (!user || !product) {
      console.error("[notifyPurchaseConfirmed] user or product not found", { userId, productId });
      return;
    }

    const { subject, html } = buildPurchaseConfirmedEmail({
      fullName: user.full_name,
      productName: product.name,
      productSlug: product.slug,
      welcomePdfUrl: product.welcome_pdf_url,
    });

    const result = await sendEmail({ to: user.email, subject, html });
    if (!result.ok) {
      console.error(`[notifyPurchaseConfirmed] send failed: ${result.error}`);
    }
  } catch (err) {
    console.error("[notifyPurchaseConfirmed] unhandled error:", err);
  }
}
