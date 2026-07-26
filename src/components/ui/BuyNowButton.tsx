import { useState } from "react";
import { Button } from "./Button";
import { checkoutService } from "@/services/checkoutService";
import type { ProductRow } from "@/types/database";

interface BuyNowButtonProps {
  product: Pick<ProductRow, "slug" | "name">;
  label?: string;
}

export function BuyNowButton({ product, label = "Buy Now" }: BuyNowButtonProps) {
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

  return (
    <div>
      <Button size="sm" variant="secondary" className="w-full" onClick={handleClick} isLoading={isStarting}>
        {label}
      </Button>
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}
