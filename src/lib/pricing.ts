import type { ProductRow } from "@/types/database";
import { formatTrialLength } from "./trial";

/**
 * Single place that turns (price_cents, currency) into copy — every surface
 * that shows a Workspace's price reads through here instead of formatting
 * cents inline. Mirrors src/lib/trial.ts's role for trial-length copy.
 */

function formatCurrencyAmount(priceCents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(
    priceCents / 100,
  );
}

/** Null when price_cents is null (a non-free Workspace Studio hasn't priced yet) — callers omit the price line entirely rather than show "$NaN". */
export function formatPrice(priceCents: number | null, currency: string): string | null {
  if (priceCents == null) return null;
  return `${formatCurrencyAmount(priceCents, currency)} · one-time`;
}

/**
 * The compact "collapsed accordion" summary for ProductPricingSection —
 * Free / $XX One-time / X-day Free Trial • $XX One-time — derived entirely
 * from this product's own configuration (is_free, price_cents, currency,
 * is_trial_eligible, trial_duration, trial_unit), the same fields every
 * other pricing/trial surface on this page reads. Nothing here is a
 * hardcoded price or duration — Studio changing any of these fields changes
 * this summary automatically, with no code change, the same guarantee
 * formatPrice/formatTrialLength already give their own callers.
 *
 * Null only when a non-free Workspace has no price yet (Studio hasn't
 * configured pricing) — the caller falls back to the plain header in that
 * case rather than show a broken summary.
 */
export function formatPricingSummary(
  product: Pick<ProductRow, "is_free" | "price_cents" | "currency" | "is_trial_eligible" | "trial_duration" | "trial_unit">,
): string | null {
  if (product.is_free) return "Free";
  if (product.price_cents == null) return null;

  const priceLabel = `${formatCurrencyAmount(product.price_cents, product.currency)} One-time`;
  if (product.is_trial_eligible && product.trial_duration != null) {
    return `${formatTrialLength(product.trial_duration, product.trial_unit)} Free Trial • ${priceLabel}`;
  }
  return priceLabel;
}
