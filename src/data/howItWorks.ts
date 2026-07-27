import type { ProductHowItWorksStep } from "@/types/productMarketing";

/**
 * The Product Page's default "How It Works" narrative — shown for every
 * Workspace until Studio publishes a per-product override via
 * metadata.howItWorks (no authoring UI for that exists yet). Mirrors how
 * src/data/faqs.ts backs getProductFaq(): a shared, product-agnostic
 * default that keeps the section metadata-driven and real today, while
 * staying fully overridable later with zero Product Page changes.
 */
export const DEFAULT_HOW_IT_WORKS: ProductHowItWorksStep[] = [
  {
    title: "Start Your Free Trial",
    description: "Create your account and get instant access — no card required.",
  },
  {
    title: "Work Through Your Workspace",
    description: "Fill in each guided section at your own pace. Your progress saves automatically.",
  },
  {
    title: "Track Your Progress",
    description: "Pick up exactly where you left off, on any device, any time.",
  },
  {
    title: "Grow With Ongoing Access",
    description: "Revisit and update your Workspace whenever your business or plans change.",
  },
];
