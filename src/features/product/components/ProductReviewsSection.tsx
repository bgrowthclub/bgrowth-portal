import { ReviewSummary } from "@/features/reviews/components/ReviewSummary";
import { ReviewList } from "@/features/reviews/components/ReviewList";

interface ProductReviewsSectionProps {
  productId: string;
}

/**
 * ReviewSummary/ReviewList (src/features/reviews/components/) were already
 * built and documented as "ready to drop into the future dedicated Product
 * Page unchanged" — this is that page; neither component needed a change.
 */
export function ProductReviewsSection({ productId }: ProductReviewsSectionProps) {
  return (
    <section className="bg-navy-50/50 py-16 dark:bg-white/[0.02]">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">Reviews</span>
          <h2 className="mt-3 text-3xl font-bold text-navy-900 dark:text-white sm:text-4xl">What members say</h2>
          <div className="mt-4 flex justify-center">
            <ReviewSummary productId={productId} />
          </div>
        </div>
        <div className="mt-10">
          <ReviewList productId={productId} />
        </div>
      </div>
    </section>
  );
}
