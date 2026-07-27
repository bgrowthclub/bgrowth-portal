import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import Stripe from "stripe";
import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";

const bodySchema = z.object({
  productSlug: z.string().min(1),
});

/**
 * Creates a Stripe Checkout Session for a paid Workspace, or grants
 * instant access for a free one — either way this is the only place
 * Stripe's SDK is ever imported (see BGrowth Commerce's "never hardcode a
 * payment provider outside its own adapter" rule; checkoutService.ts on
 * the client never touches Stripe directly, only this endpoint's response
 * URL). STRIPE_SECRET_KEY isn't configured on this deployment yet — that's
 * expected for now, not a bug (see DEPLOYMENT.md) — so this returns a clear
 * error rather than a raw Stripe SDK exception until a real key is set.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
    if (!accessToken) {
      return res.status(401).json({ ok: false, error: "Sign in required." });
    }

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ ok: false, error: "Invalid request", issues: parsed.error.issues });
    }

    const supabase = getSupabaseAdmin();

    const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userResult.user) {
      return res.status(401).json({ ok: false, error: "Sign in required." });
    }
    const user = userResult.user;

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("*")
      .eq("slug", parsed.data.productSlug)
      .eq("status", "published")
      .maybeSingle();
    if (productError) throw productError;
    if (!product) {
      return res.status(404).json({ ok: false, error: "This Workspace isn't available." });
    }

    // Free Workspaces skip Stripe entirely — nothing to charge, so grant
    // access immediately the same way a purchase webhook would.
    if (product.is_free) {
      const { error: grantError } = await supabase.rpc("grant_purchased_license", {
        p_user_id: user.id,
        p_product_id: product.id,
      });
      if (grantError) throw grantError;
      return res.status(200).json({ ok: true, redirectUrl: `/workspace/${product.slug}` });
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return res.status(500).json({ ok: false, error: "Checkout isn't set up yet — Stripe isn't configured on this deployment." });
    }
    if (product.price_cents == null) {
      return res.status(500).json({ ok: false, error: `"${product.name}" has no price configured yet.` });
    }

    const portalUrl = process.env.PORTAL_PUBLIC_URL;
    if (!portalUrl) {
      return res.status(500).json({ ok: false, error: "PORTAL_PUBLIC_URL isn't configured on this deployment." });
    }

    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      client_reference_id: user.id,
      line_items: [
        product.stripe_price_id
          ? { price: product.stripe_price_id, quantity: 1 }
          : {
              price_data: {
                currency: product.currency,
                unit_amount: product.price_cents,
                product_data: { name: product.name },
              },
              quantity: 1,
            },
      ],
      success_url: `${portalUrl}/product/${product.slug}?checkout=success`,
      cancel_url: `${portalUrl}/product/${product.slug}?checkout=cancelled`,
      metadata: { userId: user.id, productId: product.id, productSlug: product.slug },
    });

    if (!session.url) throw new Error("Stripe did not return a Checkout Session URL.");

    return res.status(200).json({ ok: true, checkoutUrl: session.url });
  } catch (err) {
    console.error("[checkout/create-session] unhandled error:", err);
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
