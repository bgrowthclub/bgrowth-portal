import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import type { ProductRow } from "@/types/database";
import type { WorkspaceAccessState } from "@/types/workspace";
import { Button } from "@/components/ui/Button";
import { BuyNowButton } from "@/components/ui/BuyNowButton";
import { formatTrialSentence } from "@/lib/trial";
import { formatPrice, formatPricingSummary } from "@/lib/pricing";
import { setPendingAuthRedirect } from "@/lib/pendingRedirect";

interface ProductPricingSectionProps {
  product: ProductRow;
  isAuthenticated: boolean;
  /** This product's access state for the current member — "locked" (including every signed-out visitor, since there's no license to look up without a session). */
  accessState: WorkspaceAccessState;
  /** Platform-wide (not scoped to this product) — gates whether Start Free Trial is still offered at all. Only meaningful when isAuthenticated. */
  hasUsedTrial: boolean;
}

/**
 * The only place Start Free Trial / Buy Now / Open Workspace live on the
 * Product Page — a sticky bar fixed to the bottom of the viewport (not an
 * in-flow section) so it's reachable at any scroll position. Collapsed to a
 * single "Pricing & Trial" header row by default — a Notion/Linear-style
 * accordion, not an always-open block — and expands in place (smooth
 * height animation via CSS grid, no JS measuring or new dependency) to
 * reveal price, trial status, and both CTAs. The collapsed header itself
 * stays reachable at every scroll position, so this never hides the
 * ability to buy/trial, only the detail until the visitor asks for it.
 *
 * The collapsed header's summary text (Free / $XX One-time / X-day Free
 * Trial • $XX One-time) is entirely derived from this product's own price/
 * trial fields via formatPricingSummary — never a hardcoded amount or
 * duration, so a future price or trial-length change in Studio is reflected
 * here automatically.
 *
 * Same CTA branching this page has always used (signed-in vs. signed-out
 * pendingRedirect, so a fresh signup/sign-in lands back on the intended
 * action — see SignInPage.tsx/VerifyEmailPage.tsx), plus the three
 * additional states this bar accounts for: trial already used elsewhere
 * (disabled with a message), an expired trial for this specific product
 * (Buy Now only), and — handled as its own short-circuit below, with no
 * accordion at all — already owned (a single "Open Workspace" CTA has
 * nothing left to collapse).
 */
export function ProductPricingSection({ product, isAuthenticated, accessState, hasUsedTrial }: ProductPricingSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const trialSentence =
    product.is_trial_eligible && product.trial_duration != null
      ? formatTrialSentence(product.trial_duration, product.trial_unit)
      : null;
  const priceLabel = product.is_free ? "Free" : formatPrice(product.price_cents, product.currency);
  // Collapsed-header teaser — Free / $XX One-time / X-day Free Trial • $XX
  // One-time — driven entirely by this product's own configuration (see
  // formatPricingSummary), never the viewing member's personal state
  // (trial-already-used, expired, etc.); those nuances only appear once
  // expanded, same as before.
  const collapsedSummary = formatPricingSummary(product);

  const isOwned = accessState === "trial" || accessState === "purchased";
  const isExpired = accessState === "expired";
  // Signed out: can't know platform-wide trial history without a session,
  // so Start Free Trial always renders normally and sends them to sign up
  // first — activateTrial() itself still enforces "one trial ever" on the
  // backend if it turns out they'd already used it under an existing account.
  const trialAlreadyUsed = isAuthenticated && hasUsedTrial;
  const showTrialButton = product.is_trial_eligible && !isOwned && !isExpired;

  if (isOwned) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-navy-100/60 bg-white/95 shadow-soft-lg backdrop-blur dark:border-white/10 dark:bg-navy-900/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <p className="text-sm font-semibold text-navy-900 dark:text-white">You own this Workspace</p>
          <Link to={`/workspace/${product.slug}`}>
            <Button size="lg">Open Workspace</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-navy-100/60 bg-white/95 shadow-soft-lg backdrop-blur dark:border-white/10 dark:bg-navy-900/95">
      <div className="mx-auto max-w-6xl px-6">
        <button
          type="button"
          onClick={() => setIsExpanded((expanded) => !expanded)}
          aria-expanded={isExpanded}
          aria-controls="product-pricing-panel"
          className="flex w-full items-center justify-between gap-4 py-4 text-left"
        >
          <span className="flex flex-col">
            <span className="text-base font-bold text-navy-900 dark:text-white">Pricing &amp; Trial</span>
            {collapsedSummary && (
              <span className="mt-0.5 text-[15px] font-medium text-navy-500 dark:text-white/60">{collapsedSummary}</span>
            )}
          </span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-navy-400 transition-transform duration-300 dark:text-white/50 ${
              isExpanded ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>

        <div
          id="product-pricing-panel"
          className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
            isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-4 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {priceLabel && <p className="text-lg font-bold text-navy-900 dark:text-white">{priceLabel}</p>}
                {isExpired ? (
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-300">Your trial has ended.</p>
                ) : trialAlreadyUsed && product.is_trial_eligible ? (
                  <p className="text-xs text-navy-400 dark:text-white/40">You&apos;ve already used your free trial.</p>
                ) : (
                  trialSentence && (
                    <p className="text-xs font-medium text-primary">Try it free for {trialSentence} — no card required.</p>
                  )
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {showTrialButton &&
                  (trialAlreadyUsed ? (
                    <Button size="lg" disabled title="You've already activated your one free trial Workspace.">
                      Start Free Trial
                    </Button>
                  ) : isAuthenticated ? (
                    <Link to={`/trial-selection?product=${product.slug}`}>
                      <Button size="lg">Start Free Trial</Button>
                    </Link>
                  ) : (
                    <Link to="/sign-up" onClick={() => setPendingAuthRedirect(`/trial-selection?product=${product.slug}`)}>
                      <Button size="lg">Start Free Trial</Button>
                    </Link>
                  ))}
                {isAuthenticated ? (
                  <BuyNowButton product={product} size="lg" fullWidth={false} />
                ) : (
                  // BuyNowButton needs a signed-in session to call
                  // api/checkout/create-session — send a logged-out visitor to
                  // sign up first (returning to this page) instead of a
                  // dead-end "Sign in to purchase" error, matching Start Free
                  // Trial's own signed-out handling above.
                  <Link to="/sign-up" onClick={() => setPendingAuthRedirect(`/product/${product.slug}`)}>
                    <Button size="lg" variant="secondary">
                      {product.is_free ? "Get Started Free" : "Buy Now"}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
