import { Link } from "react-router-dom";
import type { ProductRow } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { BuyNowButton } from "@/components/ui/BuyNowButton";
import { formatTrialSentence } from "@/lib/trial";
import { formatPrice } from "@/lib/pricing";
import { setPendingAuthRedirect } from "@/lib/pendingRedirect";

interface ProductPricingSectionProps {
  product: ProductRow;
  isAuthenticated: boolean;
}

/**
 * The only place Start Free Trial / Buy Now live on the Product Page — this
 * is what the redesigned flow (cards → Product Details → here) is for.
 * Same CTA branching ProductHero used to carry (signed-in vs. signed-out
 * pendingRedirect, so a fresh signup lands back on the intended action),
 * just relocated to the bottom of the page instead of the hero.
 */
export function ProductPricingSection({ product, isAuthenticated }: ProductPricingSectionProps) {
  const trialSentence =
    product.is_trial_eligible && product.trial_duration != null
      ? formatTrialSentence(product.trial_duration, product.trial_unit)
      : null;
  const priceLabel = product.is_free ? "Free" : formatPrice(product.price_cents, product.currency);

  return (
    <section className="mx-auto max-w-3xl px-6 py-20 text-center">
      <h2 className="text-2xl font-bold text-navy-900 dark:text-white sm:text-3xl">Ready to get started?</h2>
      {trialSentence && (
        <p className="mt-3 text-sm font-medium text-primary">Try it free for {trialSentence} — no card required.</p>
      )}

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        {product.is_trial_eligible &&
          (isAuthenticated ? (
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
          // api/checkout/create-session — send a logged-out visitor to sign
          // up first (returning to this page) instead of a dead-end
          // "Sign in to purchase" error, matching Start Free Trial's own
          // signed-out handling above.
          <div>
            <Link to="/sign-up" onClick={() => setPendingAuthRedirect(`/product/${product.slug}`)}>
              <Button size="lg" variant="secondary">
                {product.is_free ? "Get Started Free" : "Buy Now"}
              </Button>
            </Link>
            {priceLabel && <p className="mt-1 text-xs text-navy-400 dark:text-white/40">{priceLabel}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
