import { useAsync } from "@/hooks/useAsync";
import { reviewService } from "@/services/reviewService";
import { StarRating } from "@/components/ui/StarRating";
import { Spinner } from "@/components/ui/Spinner";
import { FetchErrorState } from "@/components/ui/FetchErrorState";

interface ReviewListProps {
  productId: string;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Self-contained individual-reviews list — fetches its own data via
 * productId alone, same reasoning as ReviewSummary: no coupling to any
 * card, ready to drop into the future dedicated Product Page unchanged.
 */
export function ReviewList({ productId }: ReviewListProps) {
  const {
    data: reviews,
    isLoading,
    error,
    refetch,
  } = useAsync(() => reviewService.listForProduct(productId), [productId]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (error) return <FetchErrorState message="Couldn't load reviews right now." onRetry={refetch} />;

  if (!reviews || reviews.length === 0) {
    return <p className="text-sm text-navy-400 dark:text-white/40">No reviews yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-5">
      {reviews.map((review) => (
        <li key={review.id} className="border-b border-navy-100/60 pb-5 last:border-0 last:pb-0 dark:border-white/10">
          <div className="flex items-center justify-between gap-3">
            <StarRating rating={review.rating} />
            <span className="text-xs text-navy-400 dark:text-white/40">{formatDate(review.created_at)}</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-navy-900 dark:text-white">{review.title}</p>
          <p className="mt-1 text-sm text-navy-500 dark:text-white/60">{review.comment}</p>
          <p className="mt-2 text-xs font-medium text-navy-400 dark:text-white/40">{review.display_name}</p>
        </li>
      ))}
    </ul>
  );
}
