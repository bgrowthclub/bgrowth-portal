import type { ProductRow } from "@/types/database";

export interface CheckoutSession {
  url: string;
}

/**
 * Provider-agnostic checkout. Every caller only ever calls startCheckout()
 * and redirects the browser to the returned URL — nothing in the UI knows
 * or cares how that URL was produced. Today it just builds a link to the
 * BGrowth Website's checkout page (no payment provider is integrated yet,
 * and this is deliberately NOT built around Wix). Swapping in a real
 * provider later — e.g. Stripe Checkout Sessions, which are themselves
 * "create a session, redirect to session.url" — means replacing this
 * function's body only; no component that calls startCheckout() changes.
 */
export const checkoutService = {
  async startCheckout(product: Pick<ProductRow, "slug" | "name">): Promise<CheckoutSession> {
    const baseUrl = import.meta.env.VITE_CHECKOUT_URL as string | undefined;
    if (!baseUrl) {
      throw new Error(`Checkout isn't set up yet for "${product.name}".`);
    }
    const url = new URL(baseUrl);
    url.searchParams.set("product", product.slug);
    return { url: url.toString() };
  },
};
