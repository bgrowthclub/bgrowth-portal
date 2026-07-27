import type { ProductRow } from "@/types/database";
import { getProductHowItWorks } from "@/lib/productMarketing";

interface ProductHowItWorksProps {
  product: Pick<ProductRow, "metadata">;
}

/** Omitted entirely until Studio publishes metadata.howItWorks — no auto-derived fallback. */
export function ProductHowItWorks({ product }: ProductHowItWorksProps) {
  const steps = getProductHowItWorks(product);
  if (!steps) return null;

  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <div className="text-center">
        <span className="text-sm font-semibold uppercase tracking-wider text-primary">How It Works</span>
        <h2 className="mt-3 text-3xl font-bold text-navy-900 dark:text-white sm:text-4xl">
          Simple to start, easy to keep using
        </h2>
      </div>
      <ol className="mt-12 flex flex-col gap-6">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
              {index + 1}
            </span>
            <div>
              <h3 className="font-semibold text-navy-900 dark:text-white">{step.title}</h3>
              <p className="mt-1 text-sm text-navy-500 dark:text-white/60">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
