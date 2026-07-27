import { Check } from "lucide-react";
import type { ProductRow } from "@/types/database";
import { getProductIncluded } from "@/lib/productMarketing";

interface ProductIncludedProps {
  product: Pick<ProductRow, "metadata">;
}

/** Omitted entirely until Studio publishes metadata.included — no auto-derived fallback (Features already covers that role). */
export function ProductIncluded({ product }: ProductIncludedProps) {
  const included = getProductIncluded(product);
  if (!included) return null;

  return (
    <section className="bg-navy-50/50 py-16 dark:bg-white/[0.02]">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">Included</span>
          <h2 className="mt-3 text-3xl font-bold text-navy-900 dark:text-white sm:text-4xl">
            Included in this Workspace
          </h2>
        </div>
        <ul className="mx-auto mt-10 grid max-w-2xl gap-3 sm:grid-cols-2">
          {included.map((item, index) => (
            <li key={`${item}-${index}`} className="flex items-start gap-2.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm text-navy-700 dark:text-white/80">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
