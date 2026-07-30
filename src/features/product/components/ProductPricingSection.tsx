import { Link } from "react-router-dom";
import type { ProductRow } from "@/types/database";
import type { WorkspaceAccessState } from "@/types/workspace";
import { Button } from "@/components/ui/Button";
import { BuyNowButton } from "@/components/ui/BuyNowButton";
import { formatTrialSentence } from "@/lib/trial";
import { formatPrice } from "@/lib/pricing";
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
 * in-flow section) so it's reachable at any scroll position, matching a
 * standard product-page "sticky purchase" pattern. Same CTA branching this
 * page has always used (signed-in vs. signed-out pendingRedirect, so a
 * fresh signup/sign-in lands back on the intended action — see
 * SignInPage.tsx/VerifyEmailPage.tsx), plus three additional states this
 * bar is the one place that needs to account for: already owned (Open
 * Workspace), trial already used elsewhere (disabled with a message), and
 * an expired trial for this specific product (Buy Now only).
 */
export function ProductPricingSection({ product, isAuthenticated, accessState, hasUsedTrial }: ProductPricingSectionProps) {
  const trialSentence =
    product.is_trial_eligible && product.trial_duration != null
      ? formatTrialSentence(product.trial_duration, product.trial_unit)
      : null;
  const priceLabel = product.is_free ? "Free" : formatPrice(product.price_cents, product.currency);

  const isOwned = accessState === "trial" || accessState === "purchased";
  const isExpired = accessState === "expired";
  // Signed out: can't know platform-wide trial history without a session,
  // so Start Free Trial always renders normally and sends them to sign up
  // first — activateTrial() itself still enforces "one trial ever" on the
  // backend if it turns out they'd already used it under an existing account.
  const trialAlreadyUsed = isAuthenticated && hasUsedTrial;
  const showTrialButton = product.is_trial_eligible && !isOwned && !isExpired;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-navy-100/60 bg-white/95 shadow-soft-lg backdrop-blur dark:border-white/10 dark:bg-navy-900/95">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {isOwned ? (
            <p className="text-sm font-semibold text-navy-900 dark:text-white">
              You own this Workspace
            </p>
          ) : (
            <>
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
            </>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {isOwned ? (
            <Link to={`/workspace/${product.slug}`}>
              <Button size="lg">Open Workspace</Button>
            </Link>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
