import { useState } from "react";
import { Button } from "./Button";
import { checkoutService } from "@/services/checkoutService";
import { formatPrice } from "@/lib/pricing";
import type { ProductRow } from "@/types/database";

interface BuyNowButtonProps {
  product: Pick<ProductRow, "slug" | "name" | "is_free" | "price_cents" | "currency">;
  /** Overrides the free/paid-derived default ("Get Started Free" / "Buy Now"). */
  label?: string;
  /** Override for callers on a non-default-theme background (e.g. ProductHero's dark section). */
  priceClassName?: string;
}

export function BuyNowButton({ product, label, priceClassName = "text-navy-400 dark:text-white/40" }: BuyNowButtonProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setIsStarting(true);
    try {
      const session = await checkoutService.startCheckout(product);
      window.location.href = session.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout isn't available yet.");
      setIsStarting(false);
    }
  }

  const effectiveLabel = label ?? (product.is_free ? "Get Started Free" : "Buy Now");
  const priceLabel = product.is_free ? "Free" : formatPrice(product.price_cents, product.currency);

  return (
    <div>
      <Button size="sm" variant="secondary" className="w-full" onClick={handleClick} isLoading={isStarting}>
        {effectiveLabel}
      </Button>
      {priceLabel && <p className={`mt-1 text-center text-xs ${priceClassName}`}>{priceLabel}</p>}
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}
