import { Link } from "react-router-dom";
import type { ProductRow } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { BuyNowButton } from "@/components/ui/BuyNowButton";
import { formatTrialSentence } from "@/lib/trial";
import { formatPrice } from "@/lib/pricing";
import { setPendingAuthRedirect } from "@/lib/pendingRedirect";

interface ProductHeroProps {
  product: ProductRow;
  isAuthenticated: boolean;
}

export function ProductHero({ product, isAuthenticated }: ProductHeroProps) {
  const trialSentence =
    product.is_trial_eligible && product.trial_duration != null
      ? formatTrialSentence(product.trial_duration, product.trial_unit)
      : null;
  const priceLabel = product.is_free ? "Free" : formatPrice(product.price_cents, product.currency);

  return (
    <section className="relative overflow-hidden bg-navy-900 text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,97,236,0.35),transparent_45%),radial-gradient(circle_at_80%_60%,rgba(16,97,236,0.2),transparent_50%)]"
        aria-hidden="true"
      />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="eyebrow inline-block rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary-200">
            Business System
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl">{product.name}</h1>
          <p className="mt-5 max-w-lg text-lg text-white/70">{product.short_description}</p>

          {trialSentence && (
            <p className="mt-4 text-sm font-medium text-primary-200">
              Try it free for {trialSentence} — no card required.
            </p>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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
              <BuyNowButton product={product} priceClassName="text-white/50" />
            ) : (
              // BuyNowButton needs a signed-in session to call
              // api/checkout/create-session — send a logged-out visitor to
              // sign up first (returning to this page) instead of letting
              // them hit a dead-end "Sign in to purchase" error, matching
              // the Start Free Trial CTA's own signed-out handling above.
              <div>
                <Link to="/sign-up" onClick={() => setPendingAuthRedirect(`/product/${product.slug}`)}>
                  <Button size="sm" variant="secondary" className="w-full">
                    {product.is_free ? "Get Started Free" : "Buy Now"}
                  </Button>
                </Link>
                {priceLabel && <p className="mt-1 text-center text-xs text-white/50">{priceLabel}</p>}
              </div>
            )}
          </div>
        </div>

        <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-soft-lg">
          {product.cover_image_url ? (
            <img src={product.cover_image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/20">
              <span className="text-6xl font-bold">{product.name.charAt(0)}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
