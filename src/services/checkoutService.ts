import { supabase } from "./supabaseClient";
import type { ProductRow } from "@/types/database";

export interface CheckoutSession {
  url: string;
}

/**
 * Provider-agnostic checkout. Every caller only ever calls startCheckout()
 * and redirects the browser to the returned URL — nothing in the UI knows
 * or cares how that URL was produced. This calls api/checkout/create-session
 * (server-side, holds the Stripe secret key), which creates a real Stripe
 * Checkout Session for a paid Workspace or grants instant access for a free
 * one — see BGrowth Commerce's "never import a payment provider SDK outside
 * its own adapter" rule. Swapping providers later means replacing that
 * endpoint's body only; nothing that calls startCheckout() changes.
 */
export const checkoutService = {
  async startCheckout(product: Pick<ProductRow, "slug" | "name">): Promise<CheckoutSession> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw new Error("Sign in to purchase this Workspace.");
    }

    const response = await fetch("/api/checkout/create-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ productSlug: product.slug }),
    });

    const json = (await response.json()) as { ok: boolean; checkoutUrl?: string; redirectUrl?: string; error?: string };
    if (!response.ok || !json.ok) {
      throw new Error(json.error ?? `Checkout isn't set up yet for "${product.name}".`);
    }

    const url = json.checkoutUrl ?? json.redirectUrl;
    if (!url) {
      throw new Error(`Checkout isn't set up yet for "${product.name}".`);
    }
    return { url };
  },
};
