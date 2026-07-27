import { AccordionItem } from "@/components/ui/Accordion";
import type { ProductRow } from "@/types/database";
import { getProductFaq } from "@/lib/productMarketing";

interface ProductFaqSectionProps {
  product: Pick<ProductRow, "metadata">;
}

/** Always renders — getProductFaq() falls back to the shared, product-agnostic FAQS when Studio hasn't published a per-product override. */
export function ProductFaqSection({ product }: ProductFaqSectionProps) {
  const faqs = getProductFaq(product);

  return (
    <section className="bg-navy-50/50 py-16 dark:bg-white/[0.02]">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">FAQ</span>
          <h2 className="mt-3 text-3xl font-bold text-navy-900 dark:text-white sm:text-4xl">
            Questions, answered
          </h2>
        </div>
        <div className="mt-10 flex flex-col gap-3">
          {faqs.map((faq) => (
            <AccordionItem key={faq.question} question={faq.question}>
              {faq.answer}
            </AccordionItem>
          ))}
        </div>
      </div>
    </section>
  );
}
