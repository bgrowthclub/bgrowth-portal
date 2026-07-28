import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";
import { notifyPurchaseConfirmed } from "../_lib/notifyPurchaseConfirmed.js";

// Signature verification needs the exact raw request bytes — Vercel's
// default JSON body parser would re-serialize the body and break the
// signature check, so it's disabled here (same reasoning any Stripe
// webhook handler needs, not Portal-specific).
export const config = {
  api: { bodyParser: false },
};

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * The one place a purchase turns into a license — see
 * portal.grant_purchased_license() (supabase/migrations/0012_purchase_licenses.sql).
 * Nothing else is allowed to create a 'purchased' license (licenses' RLS
 * has no client-facing insert policy for anything but 'trial'). Not
 * reachable yet in practice — Stripe isn't configured with a live webhook
 * on this deployment (see DEPLOYMENT.md) — but the full path is real code,
 * not a stub, so wiring in real keys later is configuration, not development.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    return res.status(500).json({ ok: false, error: "STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET are not configured on this deployment." });
  }

  const signature = req.headers["stripe-signature"];
  if (!signature || Array.isArray(signature)) {
    return res.status(400).json({ ok: false, error: "Missing stripe-signature header." });
  }

  const stripe = new Stripe(secretKey);
  let event: Stripe.Event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[webhooks/stripe] signature verification failed:", err);
    return res.status(400).json({ ok: false, error: "Invalid signature." });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId ?? session.client_reference_id;
      const productId = session.metadata?.productId;

      if (!userId || !productId) {
        console.error("[webhooks/stripe] checkout.session.completed missing userId/productId metadata", session.id);
        return res.status(200).json({ ok: true, handled: false });
      }

      const supabase = getSupabaseAdmin();
      const { error } = await supabase.rpc("grant_purchased_license", {
        p_user_id: userId,
        p_product_id: productId,
      });
      if (error) throw error;

      // Not deduplicated against Stripe's own rare at-least-once redelivery
      // of the same event (grant_purchased_license itself is a safe upsert
      // either way — see 0012_purchase_licenses.sql) — a duplicate send on
      // that edge case is a minor annoyance, not a correctness bug. Worth
      // an event-id dedupe if it's ever observed in practice.
      await notifyPurchaseConfirmed(supabase, { userId, productId });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[webhooks/stripe] unhandled error:", err);
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
