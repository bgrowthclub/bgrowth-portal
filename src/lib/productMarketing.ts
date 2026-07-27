// Relative imports (not the "@/" alias) — this file is reachable from
// api/publishing-engine/publish.ts via generateWelcomePdf.ts, and Vercel's
// serverless function runtime resolves modules through Node's native ESM
// loader, which has no knowledge of the "@/" TypeScript path alias (that's
// resolved only by Vite's dev/build server and by tsc for type-checking).
// A "@/" import here compiles fine and passes tsc, but crashes at runtime
// with ERR_MODULE_NOT_FOUND the moment any api/* route imports this file,
// directly or transitively — see DEPLOYMENT.md.
import type { ProductRow } from "../types/database.js";
import type { ProductFaqItem, ProductFeatureItem, ProductHowItWorksStep, ProductMarketingMetadata } from "../types/productMarketing.js";
import { FAQS } from "../data/faqs.js";
import { DEFAULT_HOW_IT_WORKS } from "../data/howItWorks.js";

function readMetadata(product: Pick<ProductRow, "metadata">): ProductMarketingMetadata {
  return (product.metadata ?? {}) as ProductMarketingMetadata;
}

/**
 * Explicit, Studio-authored features win. Falling back to the Workspace's
 * own published sections is deliberate — a section's title/icon *is* a
 * real feature of the product, not a fabrication — and needs zero new
 * authoring UI to exist today. The moment Studio starts publishing
 * metadata.features, this function (and nothing else) is what changes
 * behavior; ProductPage/ProductFeatures never need to know which case
 * they're in.
 */
export function getProductFeatures(product: Pick<ProductRow, "metadata" | "content">): ProductFeatureItem[] {
  const metadata = readMetadata(product);
  if (metadata.features && metadata.features.length > 0) return metadata.features;
  if (!product.content) return [];
  return product.content.sections.map((section) => ({
    icon: section.icon,
    title: section.title,
    description: section.description,
  }));
}

/** No fallback — omitted from the page entirely until Studio publishes this. */
export function getProductIncluded(product: Pick<ProductRow, "metadata">): string[] | null {
  const metadata = readMetadata(product);
  return metadata.included && metadata.included.length > 0 ? metadata.included : null;
}

/** Falls back to the shared, product-agnostic DEFAULT_HOW_IT_WORKS — metadata-driven from day one, so a per-product override needs zero Product Page changes once Studio can author one. */
export function getProductHowItWorks(product: Pick<ProductRow, "metadata">): ProductHowItWorksStep[] {
  const metadata = readMetadata(product);
  return metadata.howItWorks && metadata.howItWorks.length > 0 ? metadata.howItWorks : DEFAULT_HOW_IT_WORKS;
}

/** No fallback — omitted from the page entirely until Studio publishes this. */
export function getProductLongDescription(product: Pick<ProductRow, "metadata">): string | null {
  const metadata = readMetadata(product);
  const value = metadata.longDescription?.trim();
  return value ? value : null;
}

/** Falls back to the shared, product-agnostic FAQS — never a second copy of the same questions. */
export function getProductFaq(product: Pick<ProductRow, "metadata">): ProductFaqItem[] {
  const metadata = readMetadata(product);
  return metadata.faq && metadata.faq.length > 0 ? metadata.faq : FAQS;
}

/**
 * Welcome PDF only (see api/_lib/generateWelcomePdf.ts). Deliberately never
 * derived from a section's whyItMatters copy — that exists to explain a
 * functional step, not to sell an outcome — so this has no fallback at
 * all: omit the "What You'll Accomplish" section until Studio authors it
 * directly.
 */
export function getProductOutcomes(product: Pick<ProductRow, "metadata">): string[] | null {
  const metadata = readMetadata(product);
  return metadata.outcomes && metadata.outcomes.length > 0 ? metadata.outcomes : null;
}
