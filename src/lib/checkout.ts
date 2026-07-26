const CHECKOUT_BASE_URL = import.meta.env.VITE_CHECKOUT_URL as string | undefined;

/**
 * Builds a per-Workspace checkout link on the BGrowth Website. Returns null
 * when VITE_CHECKOUT_URL isn't configured yet, so callers can render a
 * disabled/"coming soon" state instead of a dead link — see
 * VITE_CHECKOUT_URL in .env.example.
 */
export function getCheckoutUrl(slug: string): string | null {
  if (!CHECKOUT_BASE_URL) return null;
  const url = new URL(CHECKOUT_BASE_URL);
  url.searchParams.set("product", slug);
  return url.toString();
}
