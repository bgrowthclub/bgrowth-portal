import { Link } from "react-router-dom";
import type { CatalogIndexRow } from "@/types/database";
import { useAuth } from "@/features/auth/AuthContext";
import { Button } from "@/components/ui/Button";
import { BuyNowButton } from "@/components/ui/BuyNowButton";
import { StarRating } from "@/components/ui/StarRating";
import { formatContentType } from "@/lib/contentType";
import { setPendingAuthRedirect } from "@/lib/pendingRedirect";
import { NEW_WINDOW_DAYS } from "@/services/catalogService";

interface CatalogProductCardProps {
  item: CatalogIndexRow;
  /** Whether this member has ever activated a trial (any Workspace) — gates whether this card still offers "Start Free Trial." */
  hasUsedTrial: boolean;
  /** Looked up once by the caller (catalogService.getFacets().categories) rather than fetched per card. */
  categoryName?: string;
}

/**
 * The catalog_index-driven card shared by Browse, Home's curated rails, and
 * Collection pages — a sibling to MarketplaceWorkspaceCard/PublicWorkspaceCard/
 * LibraryWorkspaceCard (see the Component Evolution pattern those three
 * already follow), not a shared "mode" bolted onto any of them. Those three
 * keep reading straight off ProductRow at their existing call sites; this
 * one is the only card that reads a CatalogIndexRow.
 */
export function CatalogProductCard({ item, hasUsedTrial, categoryName }: CatalogProductCardProps) {
  const { user } = useAuth();
  const isAuthenticated = Boolean(user);
  const canStartTrial = item.is_trial_eligible && !hasUsedTrial;
  const isNew = item.published_at != null && Date.now() - new Date(item.published_at).getTime() < NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  return (
    <div className="card flex h-full flex-col overflow-hidden">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-navy-100 dark:bg-navy-700">
        {item.cover_image_url ? (
          <img src={item.cover_image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-primary/40">
            <span className="text-4xl font-bold">{item.name.charAt(0)}</span>
          </div>
        )}
        {(item.is_featured || isNew) && (
          <span className="badge absolute left-3 top-3 bg-primary text-white">
            {item.is_featured ? "Featured" : "New"}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap items-center gap-1.5">
          {categoryName && <span className="badge bg-navy-50 text-navy-500 dark:bg-white/5 dark:text-white/50">{categoryName}</span>}
          <span className="badge bg-navy-50 text-navy-500 dark:bg-white/5 dark:text-white/50">{formatContentType(item.content_type)}</span>
        </div>

        <h3 className="mt-3 text-lg font-semibold text-navy-900 dark:text-white">{item.name}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-navy-500 dark:text-white/60">{item.short_description}</p>

        {item.review_count > 0 && item.avg_rating != null && (
          <div className="mt-3 flex items-center gap-2">
            <StarRating rating={item.avg_rating} />
            <span className="text-xs font-semibold text-navy-900 dark:text-white">{item.avg_rating.toFixed(1)}</span>
            <span className="text-xs text-navy-400 dark:text-white/40">
              · {item.review_count} {item.review_count === 1 ? "Review" : "Reviews"}
            </span>
          </div>
        )}

        <div className="mt-5">
          {isAuthenticated ? (
            canStartTrial ? (
              <Link to={`/trial-selection?product=${item.slug}`}>
                <Button size="sm" className="w-full">
                  Start Free Trial
                </Button>
              </Link>
            ) : (
              <BuyNowButton product={item} />
            )
          ) : canStartTrial ? (
            // Signed-out intent-carrying CTA — same pendingRedirect pattern
            // ProductHero.tsx already uses for a public page's Start Free
            // Trial/Buy Now, so a fresh signup lands back on the intended
            // action instead of a dead-end sign-in.
            <Link to="/sign-up" onClick={() => setPendingAuthRedirect(`/trial-selection?product=${item.slug}`)}>
              <Button size="sm" className="w-full">
                Start Free Trial
              </Button>
            </Link>
          ) : (
            <Link to="/sign-up" onClick={() => setPendingAuthRedirect(`/product/${item.slug}`)}>
              <Button size="sm" variant="secondary" className="w-full">
                {item.is_free ? "Get Started Free" : "Buy Now"}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
