/**
 * Single place that turns (price_cents, currency) into copy — every surface
 * that shows a Workspace's price reads through here instead of formatting
 * cents inline. Mirrors src/lib/trial.ts's role for trial-length copy.
 */

/** Null when price_cents is null (a non-free Workspace Studio hasn't priced yet) — callers omit the price line entirely rather than show "$NaN". */
export function formatPrice(priceCents: number | null, currency: string): string | null {
  if (priceCents == null) return null;
  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(
    priceCents / 100,
  );
  return `${amount} · one-time`;
}
