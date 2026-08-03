import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import Stripe from "stripe";
import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";
import { deriveAccessState } from "../../src/lib/workspaceAccess.js";
import { notifyPurchaseConfirmed } from "../_lib/notifyPurchaseConfirmed.js";

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
 *
 * TEMP DIAGNOSTIC INSTRUMENTATION — tracing a 500 that returns a non-JSON
 * body (Vercel's own platform error page, not this handler's catch block —
 * see the "Unexpected token 'A'" report). A `[DIAGNOSTIC create-session]`
 * log after every major step pins down exactly which statement never
 * completes. Remove once the root cause is confirmed; this is not the
 * permanent fix.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    console.log("[DIAGNOSTIC create-session] handler entered:", { method: req.method });

    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
    if (!accessToken) {
      console.log("[DIAGNOSTIC create-session] no bearer token on request — returning 401");
      return res.status(401).json({ ok: false, error: "Sign in required." });
    }

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      console.log("[DIAGNOSTIC create-session] request body failed validation:", JSON.stringify(parsed.error.issues));
      return res.status(422).json({ ok: false, error: "Invalid request", issues: parsed.error.issues });
    }
    console.log("[DIAGNOSTIC create-session] request parsed:", { productSlug: parsed.data.productSlug });

    const supabase = getSupabaseAdmin();
    console.log("[DIAGNOSTIC create-session] supabase admin client created");

    const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError) {
      console.log("[DIAGNOSTIC create-session] auth.getUser() returned an error:", JSON.stringify(userError));
    }
    if (userError || !userResult.user) {
      console.log("[DIAGNOSTIC create-session] authentication failed — returning 401");
      return res.status(401).json({ ok: false, error: "Sign in required." });
    }
    const user = userResult.user;
    console.log("[DIAGNOSTIC create-session] authentication succeeded:", { userId: user.id, email: user.email });

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("*")
      .eq("slug", parsed.data.productSlug)
      .eq("status", "published")
      .maybeSingle();
    if (productError) {
      console.log("[DIAGNOSTIC create-session] product lookup returned an error:", JSON.stringify(productError));
      throw productError;
    }
    if (!product) {
      console.log("[DIAGNOSTIC create-session] product lookup found no row — returning 404");
      return res.status(404).json({ ok: false, error: "This Workspace isn't available." });
    }
    console.log("[DIAGNOSTIC create-session] product lookup succeeded:", { productId: product.id, slug: product.slug });
    console.log("[DIAGNOSTIC create-session] pricing lookup (same row):", {
      isFree: product.is_free,
      priceCents: product.price_cents,
      currency: product.currency,
      stripePriceId: product.stripe_price_id,
    });

    // Ownership check — the Product Page/Library UI already hide Buy Now
    // once a member owns a Workspace, but that's client-side only. Without
    // this, a stale tab or a direct call here could create a second paid
    // Stripe session (or a redundant free grant) for something already
    // owned. Redirect straight into the Workspace instead of erroring —
    // reuses the exact success shape the free-Workspace grant below
    // already returns, so no client changes are needed.
    const { data: existingLicense, error: existingLicenseError } = await supabase
      .from("licenses")
      .select("*")
      .eq("user_id", user.id)
      .eq("product_id", product.id)
      .maybeSingle();
    if (existingLicenseError) {
      console.log("[DIAGNOSTIC create-session] license lookup returned an error:", JSON.stringify(existingLicenseError));
      throw existingLicenseError;
    }
    console.log("[DIAGNOSTIC create-session] license lookup succeeded:", { found: Boolean(existingLicense) });

    const existingAccessState = deriveAccessState(existingLicense);
    console.log("[DIAGNOSTIC create-session] derived access state:", existingAccessState);
    if (existingAccessState === "trial" || existingAccessState === "purchased") {
      console.log("[DIAGNOSTIC create-session] already owned — redirecting to Workspace instead of Stripe");
      return res.status(200).json({ ok: true, redirectUrl: `/workspace/${product.slug}` });
    }

    // Free Workspaces skip Stripe entirely — nothing to charge, so grant
    // access immediately the same way a purchase webhook would.
    if (product.is_free) {
      console.log("[DIAGNOSTIC create-session] product is free — calling grant_purchased_license()");
      const { error: grantError } = await supabase.rpc("grant_purchased_license", {
        p_user_id: user.id,
        p_product_id: product.id,
      });
      if (grantError) {
        console.log("[DIAGNOSTIC create-session] grant_purchased_license() returned an error:", JSON.stringify(grantError));
        throw grantError;
      }
      console.log("[DIAGNOSTIC create-session] grant_purchased_license() succeeded — sending Purchase Confirmation email");
      // Free Workspaces never reach api/webhooks/stripe.ts (there's no
      // Stripe session at all), so this instant-grant branch is the only
      // place that can fire the Purchase Confirmation email for one — this
      // is the "including free instant grants" case, same email either way.
      await notifyPurchaseConfirmed(supabase, { userId: user.id, productId: product.id });
      return res.status(200).json({ ok: true, redirectUrl: `/workspace/${product.slug}` });
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      console.log("[DIAGNOSTIC create-session] STRIPE_SECRET_KEY is not set — returning 500");
      return res.status(500).json({ ok: false, error: "Checkout isn't set up yet — Stripe isn't configured on this deployment." });
    }
    if (product.price_cents == null) {
      console.log("[DIAGNOSTIC create-session] product has no price_cents — returning 500");
      return res.status(500).json({ ok: false, error: `"${product.name}" has no price configured yet.` });
    }

    const portalUrl = process.env.PORTAL_PUBLIC_URL;
    if (!portalUrl) {
      console.log("[DIAGNOSTIC create-session] PORTAL_PUBLIC_URL is not set — returning 500");
      return res.status(500).json({ ok: false, error: "PORTAL_PUBLIC_URL isn't configured on this deployment." });
    }

    console.log("[DIAGNOSTIC create-session] initializing Stripe client", {
      secretKeyLength: secretKey.length,
      secretKeyPrefix: secretKey.slice(0, 7), // "sk_test" / "sk_live" — never logs the full key
    });
    const stripe = new Stripe(secretKey);
    console.log("[DIAGNOSTIC create-session] Stripe client initialized");

    console.log("[DIAGNOSTIC create-session] creating Stripe Checkout Session", {
      usingStripePriceId: Boolean(product.stripe_price_id),
      currency: product.currency,
      priceCents: product.price_cents,
      successUrl: `${portalUrl}/product/${product.slug}?checkout=success`,
    });
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
                product_data: {
                  name: product.name,
                  ...(product.short_description ? { description: product.short_description } : {}),
                  ...(product.cover_image_url ? { images: [product.cover_image_url] } : {}),
                },
              },
              quantity: 1,
            },
      ],
      success_url: `${portalUrl}/product/${product.slug}?checkout=success`,
      cancel_url: `${portalUrl}/product/${product.slug}?checkout=cancelled`,
      metadata: { userId: user.id, productId: product.id, productSlug: product.slug },
    });
    console.log("[DIAGNOSTIC create-session] Stripe Checkout Session created:", { sessionId: session.id, hasUrl: Boolean(session.url) });

    if (!session.url) {
      console.log("[DIAGNOSTIC create-session] Stripe session has no url — throwing");
      throw new Error("Stripe did not return a Checkout Session URL.");
    }

    const responseBody = { ok: true, checkoutUrl: session.url };
    console.log("[DIAGNOSTIC create-session] serializing success response:", responseBody);
    return res.status(200).json(responseBody);
  } catch (err) {
    // Logged unconditionally, with the full stack trace explicitly pulled
    // out (not just relying on console.error's default Error formatting,
    // which Vercel's log viewer can truncate/reformat unpredictably).
    console.error("[checkout/create-session] unhandled error:", err);
    console.error(
      "[DIAGNOSTIC create-session] full stack trace:",
      err instanceof Error ? err.stack : `(not an Error instance) ${String(err)}`,
    );

    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}
