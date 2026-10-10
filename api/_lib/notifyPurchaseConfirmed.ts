import type { SupabaseClient } from "@supabase/supabase-js";
import type { getSupabaseAdmin } from "./supabaseAdmin.js";
import { sendEmail } from "./email/sendEmail.js";
import { buildBundlePurchasedEmail, buildPurchaseConfirmedEmail } from "./email/templates/purchaseConfirmed.js";

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
      supabase.from("products").select("name, slug, welcome_pdf_url, content_type").eq("id", productId).maybeSingle(),
    ]);
    if (userError) throw userError;
    if (productError) throw productError;
    if (!user || !product) {
      console.error("[notifyPurchaseConfirmed] user or product not found", { userId, productId });
      return;
    }

    // A bundle (0041, sold on the Website): list the Workspaces it unlocked.
    if ((product.content_type as string) === "bundle") {
      // bundle_items isn't in the generated types (Website-owned table).
      const untyped = supabase as unknown as SupabaseClient;
      const { data: items, error: itemsError } = await untyped
        .from("bundle_items")
        .select("sort_order, products:product_id(name)")
        .eq("bundle_id", productId)
        .order("sort_order");
      if (itemsError) throw itemsError;
      const names = ((items ?? []) as { products: { name: string } | { name: string }[] | null }[])
        .map((i) => (Array.isArray(i.products) ? i.products[0]?.name : i.products?.name))
        .filter((n): n is string => Boolean(n));
      const bundleEmail = buildBundlePurchasedEmail({ fullName: user.full_name, bundleName: product.name, workspaceNames: names });
      const sent = await sendEmail({ to: user.email, subject: bundleEmail.subject, html: bundleEmail.html });
      if (!sent.ok) console.error(`[notifyPurchaseConfirmed] send failed: ${sent.error}`);
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
