import type { ProductFaqItem } from "@/types/productMarketing";

/**
 * Shared, product-agnostic FAQ — used as-is on the homepage (FaqSection)
 * and as the fallback for any product that hasn't published its own
 * metadata.faq yet (see src/lib/productMarketing.ts's getProductFaq).
 * One array, imported everywhere it's needed — never copy these questions
 * into a second file.
 */
export const FAQS: ProductFaqItem[] = [
  {
    question: "Is the free trial really free?",
    answer:
      "Yes — no card required. You get full access to one Workspace of your choice for its full trial period. Trial length varies by Workspace, and is always shown before you activate.",
  },
  {
    question: "Can I switch to a different Workspace during my trial?",
    answer:
      "No — once you activate a trial Workspace, that choice is locked in for the trial period. You can purchase additional Workspaces at any time.",
  },
  {
    question: "What happens when my trial ends?",
    answer:
      "Your Workspace moves to a locked state. You can purchase it to keep full access, or explore other BGrowth Workspaces.",
  },
  {
    question: "Can I use BGrowth on mobile?",
    answer: "Yes — the BGrowth Portal and every Workspace are fully responsive across desktop, tablet, and mobile.",
  },
];
