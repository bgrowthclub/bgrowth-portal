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
 * Grants access for a Checkout Session already confirmed paid — called
 * from checkout.session.completed (only once its own payment_status check
 * passes, see below) and from checkout.session.async_payment_succeeded
 * (a delayed confirmation for a payment method that doesn't settle
 * synchronously; by the time this event fires, payment_status is 'paid').
 * Never call this for a session that isn't actually paid.
 *
 * Not deduplicated against Stripe's own rare at-least-once redelivery of
 * the same event — grant_purchased_license() itself is a safe upsert
 * either way (see 0012_purchase_licenses.sql), so a duplicate call here is
 * a minor annoyance (at most a duplicate confirmation email), not a
 * correctness bug. Worth an event-id dedupe if it's ever observed in
 * practice.
 */
async function grantAccessForSession(
  session: Stripe.Checkout.Session,
  supabase: ReturnType<typeof getSupabaseAdmin>,
  eventType: string,
): Promise<void> {
  const userId = session.metadata?.userId ?? session.client_reference_id;
  const productId = session.metadata?.productId;

  if (!userId || !productId) {
    console.error(`[webhooks/stripe] ${eventType} missing userId/productId metadata`, session.id);
    return;
  }

  const { error } = await supabase.rpc("grant_purchased_license", {
    p_user_id: userId,
    p_product_id: productId,
  });
  if (error) throw error;

  await notifyPurchaseConfirmed(supabase, { userId, productId });
}

/**
 * The one place a purchase turns into a license — see
 * portal.grant_purchased_license() (supabase/migrations/0012_purchase_licenses.sql).
 * Nothing else is allowed to create a 'purchased' license (licenses' RLS
 * has no client-facing insert policy for anything but 'trial').
 *
 * Access is only ever granted for a Checkout Session Stripe has actually
 * confirmed as paid:
 * - checkout.session.completed fires for every completed Checkout flow,
 *   but its payment_status is only reliably 'paid' for payment methods
 *   that settle synchronously (cards, the only path this app has used so
 *   far). A payment method that settles asynchronously can complete the
 *   Checkout Session (redirecting the customer back) while payment_status
 *   is still 'unpaid' — granting access on completion alone would let
 *   someone in before payment is actually confirmed.
 * - checkout.session.async_payment_succeeded is the delayed confirmation
 *   for that case — access is granted here instead, once payment_status
 *   has actually flipped to 'paid'.
 * - checkout.session.async_payment_failed is the counterpart: the
 *   payment never settled, so access is never granted (there's nothing to
 *   revoke — checkout.session.completed already declined to grant it).
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
    const supabase = getSupabaseAdmin();

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Card payments (the only path this app has used so far) settle
      // synchronously, so payment_status is already 'paid' by the time
      // this event fires — the common case, handled immediately below.
      // A payment method that settles asynchronously instead completes
      // the session (payment_status 'unpaid' here) and confirms later via
      // checkout.session.async_payment_succeeded, handled further down.
      if (session.payment_status !== "paid") {
        console.log(
          `[webhooks/stripe] checkout.session.completed with payment_status="${session.payment_status}" — not granting access yet, awaiting async confirmation`,
          session.id,
        );
        return res.status(200).json({ ok: true, handled: false });
      }

      await grantAccessForSession(session, supabase, event.type);
    } else if (event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      await grantAccessForSession(session, supabase, event.type);
    } else if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      console.error("[webhooks/stripe] checkout.session.async_payment_failed — payment did not settle, access not granted", {
        sessionId: session.id,
        userId: session.metadata?.userId ?? session.client_reference_id,
        productId: session.metadata?.productId,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[webhooks/stripe] unhandled error:", err);
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
