import type { ProductRow } from "@/types/database";
import { getProductFeatures } from "@/lib/productMarketing";
import { getWorkspaceIcon } from "@/lib/workspaceIcons";

interface ProductFeaturesProps {
  product: Pick<ProductRow, "metadata" | "content">;
}

/**
 * Always renders — getProductFeatures() falls back to the Workspace's own
 * published sections when Studio hasn't authored explicit metadata.features
 * yet, so this is never an empty/omitted section the way
 * ProductIncluded/ProductHowItWorks can be.
 */
export function ProductFeatures({ product }: ProductFeaturesProps) {
  const features = getProductFeatures(product);
  if (features.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-sm font-semibold uppercase tracking-wider text-primary">Features</span>
        <h2 className="mt-3 text-3xl font-bold text-navy-900 dark:text-white sm:text-4xl">
          Everything built in
        </h2>
      </div>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, index) => {
          const Icon = getWorkspaceIcon(feature.icon ?? "sparkles");
          return (
            <div key={`${feature.title}-${index}`} className="card p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold text-navy-900 dark:text-white">{feature.title}</h3>
              <p className="mt-1.5 text-sm text-navy-500 dark:text-white/60">{feature.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
