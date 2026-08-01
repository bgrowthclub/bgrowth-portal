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

export interface PricingSummaryParts {
  /** e.g. "14-day Free Trial" — null when this product isn't trial-eligible, has no configured duration, or is free (a free product has no separate trial to advertise). */
  trialLabel: string | null;
  /** "Free", or e.g. "$59.00 One-time" — null only when a non-free Workspace has no price configured yet. */
  priceLabel: string | null;
}

/**
 * The compact "collapsed accordion" summary for ProductPricingSection —
 * split into parts (rather than one joined string) so the caller can give
 * the trial portion and the price portion distinct colors without ever
 * parsing/splitting a display string. Derived entirely from this product's
 * own configuration (is_free, price_cents, currency, is_trial_eligible,
 * trial_duration, trial_unit), the same fields every other pricing/trial
 * surface on this page reads. Nothing here is a hardcoded price or
 * duration — Studio changing any of these fields changes this summary
 * automatically, with no code change, the same guarantee formatPrice/
 * formatTrialLength already give their own callers.
 *
 * priceLabel is null only when a non-free Workspace has no price yet
 * (Studio hasn't configured pricing) — the caller falls back to the plain
 * header in that case rather than show a broken summary.
 */
export function formatPricingSummaryParts(
  product: Pick<ProductRow, "is_free" | "price_cents" | "currency" | "is_trial_eligible" | "trial_duration" | "trial_unit">,
): PricingSummaryParts {
  if (product.is_free) return { trialLabel: null, priceLabel: "Free" };
  if (product.price_cents == null) return { trialLabel: null, priceLabel: null };

  const priceLabel = `${formatCurrencyAmount(product.price_cents, product.currency)} One-time`;
  const trialLabel =
    product.is_trial_eligible && product.trial_duration != null
      ? `${formatTrialLength(product.trial_duration, product.trial_unit)} Free Trial`
      : null;
  return { trialLabel, priceLabel };
}
