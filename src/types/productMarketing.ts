/**
 * The shape of everything Studio can *optionally* publish into
 * `products.metadata` for the Product Page and Welcome PDF — every field
 * here is optional and additive on purpose: Studio doesn't author any of
 * these today (there's no builder UI for them yet), so every accessor in
 * src/lib/productMarketing.ts treats an absent field as "omit this
 * section," never as a reason to fabricate placeholder copy. Adding a new
 * key here, plus one new accessor and one new section component, is the
 * whole cost of a future marketing section — nothing about ProductPage's
 * own data-fetching ever needs to change.
 */
export interface ProductFeatureItem {
  icon?: string;
  title: string;
  description: string;
}

export interface ProductHowItWorksStep {
  title: string;
  description: string;
}

export interface ProductFaqItem {
  question: string;
  answer: string;
}

export interface ProductMarketingMetadata {
  /** Long-form marketing copy for the Product Page — distinct from short_description. */
  longDescription?: string;
  /**
   * Explicit, Studio-authored feature list. Takes priority over the
   * auto-derived-from-sections fallback in getProductFeatures() — Studio
   * can start publishing real marketing copy here later with zero Product
   * Page changes.
   */
  features?: ProductFeatureItem[];
  /** Plain bullet list for the "Included in this Workspace" section — no fallback; omitted until Studio authors it. */
  included?: string[];
  /** Ordered steps for the "How It Works" section — no fallback; omitted until Studio authors it. */
  howItWorks?: ProductHowItWorksStep[];
  /** Per-product FAQ override — falls back to the shared, product-agnostic FAQS (src/data/faqs.ts) when absent. */
  faq?: ProductFaqItem[];
  /**
   * "What You'll Accomplish" — Welcome PDF only (see api/_lib/generateWelcomePdf.ts).
   * Deliberately never derived from a section's whyItMatters copy, which
   * exists to explain a functional step, not to sell the outcome — omitted
   * entirely from the PDF until Studio authors this directly.
   */
  outcomes?: string[];
}
