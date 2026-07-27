import type { ProductRow } from "@/types/database";
import { getProductLongDescription } from "@/lib/productMarketing";

interface ProductLongDescriptionProps {
  product: Pick<ProductRow, "metadata">;
}

/** Omitted entirely until Studio publishes metadata.longDescription — no auto-derived fallback. */
export function ProductLongDescription({ product }: ProductLongDescriptionProps) {
  const longDescription = getProductLongDescription(product);
  if (!longDescription) return null;

  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <p className="whitespace-pre-wrap text-lg leading-relaxed text-navy-600 dark:text-white/70">
        {longDescription}
      </p>
    </section>
  );
}
