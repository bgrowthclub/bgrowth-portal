import { useAsync } from "@/hooks/useAsync";
import { reviewService } from "@/services/reviewService";
import { StarRating } from "@/components/ui/StarRating";
import { Spinner } from "@/components/ui/Spinner";

interface ReviewSummaryProps {
  productId: string;
}

/**
 * Self-contained "★★★★★ 4.9 · 127 Reviews" line — fetches its own data via
 * productId alone, no props threaded in from a parent card. Deliberately
 * not wired into MarketplaceWorkspaceCard/LibraryWorkspaceCard today so it
 * drops into the future dedicated Product Page unchanged.
 */
export function ReviewSummary({ productId }: ReviewSummaryProps) {
  const { data: summary, isLoading } = useAsync(() => reviewService.getSummary(productId), [productId]);

  if (isLoading) return <Spinner className="h-4 w-4" />;
  if (!summary || summary.reviewCount === 0) {
    return <p className="text-sm text-navy-400 dark:text-white/40">No reviews yet.</p>;
  }

  return (
    <div className="flex items-center gap-2">
      <StarRating rating={summary.averageRating} />
      <span className="text-sm font-semibold text-navy-900 dark:text-white">{summary.averageRating.toFixed(1)}</span>
      <span className="text-sm text-navy-400 dark:text-white/40">
        · {summary.reviewCount} {summary.reviewCount === 1 ? "Review" : "Reviews"}
      </span>
    </div>
  );
}
