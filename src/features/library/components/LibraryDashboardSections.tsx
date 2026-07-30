import type { WorkspaceWithAccess } from "@/types/workspace";
import type { CatalogIndexRow, ReviewRow } from "@/types/database";
import type { WorkspaceBadge } from "@/lib/workspaceBadges";
import { Carousel, CarouselItem } from "@/components/ui/Carousel";
import { CatalogProductCard } from "@/components/catalog/CatalogProductCard";
import { LibraryWorkspaceCard } from "./LibraryWorkspaceCard";
import { ContinueWorkingCard } from "./ContinueWorkingCard";

interface LibraryDashboardSectionsProps {
  /** Always rendered first, per its top-priority requirement — see MyLibraryPage, which computes every list below and is the one place section order is decided. Every list here already arrives capped to its display limit — this component never slices. */
  continueWorking: WorkspaceWithAccess[];
  continueWorkingHasMore: boolean;
  onViewAllContinueWorking: () => void;
  /** Not-yet-owned candidates (catalog_index-shaped) — see src/lib/recommendations.ts for how these were ranked and excluded from what's already shown elsewhere on this page. */
  recommended: CatalogIndexRow[];
  recommendedHasMore: boolean;
  /** Recommended items aren't owned, so "View All" leaves My Library entirely for Browse — the only existing page for not-yet-owned discovery. */
  browseAllHref: string;
  recentlyUpdated: WorkspaceWithAccess[];
  recentlyUpdatedHasMore: boolean;
  onViewAllRecentlyUpdated: () => void;
  favorites: WorkspaceWithAccess[];
  favoritesHasMore: boolean;
  onViewAllFavorites: () => void;
  recentPurchases: WorkspaceWithAccess[];
  recentPurchasesHasMore: boolean;
  onViewAllRecentPurchases: () => void;
  badgesByProductId: Map<string, WorkspaceBadge[]>;
  /** Undefined while the batched lookup is still loading — see reviewService.getForUserBatch. */
  reviewByProductId: Map<string, ReviewRow> | undefined;
  categoryNameById: Map<string, string>;
  userId: string;
  displayName: string;
  onToggleFavorite: (workspace: WorkspaceWithAccess) => void;
  togglingFavoriteId: string | null;
}

function SectionHeading({
  title,
  hasMore,
  onViewAll,
  viewAllHref,
  viewAllLabel = "View All",
}: {
  title: string;
  hasMore: boolean;
  onViewAll?: () => void;
  viewAllHref?: string;
  viewAllLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold text-navy-900 dark:text-white">{title}</h2>
      {hasMore &&
        (viewAllHref ? (
          <a href={viewAllHref} className="text-sm font-semibold text-primary hover:underline">
            {viewAllLabel} →
          </a>
        ) : (
          <button type="button" onClick={onViewAll} className="text-sm font-semibold text-primary hover:underline">
            {viewAllLabel} →
          </button>
        ))}
    </div>
  );
}

/**
 * The "personalized dashboard" strip at the top of My Library, sitting
 * above the full, filterable All Workspaces list (see MyLibraryPage) — a
 * pure rendering component, no data derivation of its own. Section ORDER
 * is fixed here (Continue Working always first, per its top-priority
 * requirement): Continue Working → Recommended For You → Recently Updated
 * → Favorites → Recent Purchases. Every section hides independently when
 * its own list is empty; a Workspace can legitimately appear in more than
 * one owned-item section at once (recently opened AND favorited AND
 * recently purchased) — that's standard dashboard behavior (Netflix's
 * rows work the same way), not a bug to de-duplicate away. Recommended is
 * the one section that's already guaranteed not to overlap the others —
 * see rankRecommendations()'s alreadyShownProductIds exclusion.
 *
 * Every rail is capped by the caller to a fixed display limit (mirroring
 * Home's curated rails) — a power user's full Favorites/Recent Purchases/
 * Recently Updated lists can run into the hundreds, and rendering all of
 * them here would defeat the point of a "quick glance" dashboard. When a
 * rail's underlying list is longer than what's shown, its heading gets a
 * "View All" action that hands off to the one place already built to
 * browse an unbounded list at scale: the paginated All Workspaces section
 * below (or Browse, for not-yet-owned Recommended items).
 */
export function LibraryDashboardSections({
  continueWorking,
  continueWorkingHasMore,
  onViewAllContinueWorking,
  recommended,
  recommendedHasMore,
  browseAllHref,
  recentlyUpdated,
  recentlyUpdatedHasMore,
  onViewAllRecentlyUpdated,
  favorites,
  favoritesHasMore,
  onViewAllFavorites,
  recentPurchases,
  recentPurchasesHasMore,
  onViewAllRecentPurchases,
  badgesByProductId,
  reviewByProductId,
  categoryNameById,
  userId,
  displayName,
  onToggleFavorite,
  togglingFavoriteId,
}: LibraryDashboardSectionsProps) {
  const hasAnyContent =
    continueWorking.length > 0 ||
    recommended.length > 0 ||
    recentlyUpdated.length > 0 ||
    favorites.length > 0 ||
    recentPurchases.length > 0;
  if (!hasAnyContent) return null;

  return (
    <div className="mt-8 flex flex-col gap-12 animate-fade-in">
      {continueWorking.length > 0 && (
        <div>
          <SectionHeading title="Continue Working" hasMore={continueWorkingHasMore} onViewAll={onViewAllContinueWorking} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {continueWorking.map((workspace) => (
              <ContinueWorkingCard key={workspace.id} workspace={workspace} badges={badgesByProductId.get(workspace.id)} />
            ))}
          </div>
        </div>
      )}

      {recommended.length > 0 && (
        <div>
          <SectionHeading title="Recommended For You" hasMore={recommendedHasMore} viewAllHref={browseAllHref} />
          <Carousel ariaLabel="Recommended Workspaces">
            {recommended.map((item) => (
              <CarouselItem key={item.product_id}>
                <CatalogProductCard item={item} categoryName={item.category_id ? categoryNameById.get(item.category_id) : undefined} />
              </CarouselItem>
            ))}
          </Carousel>
        </div>
      )}

      {recentlyUpdated.length > 0 && (
        <div>
          <SectionHeading title="Recently Updated" hasMore={recentlyUpdatedHasMore} onViewAll={onViewAllRecentlyUpdated} />
          <Carousel ariaLabel="Recently Updated Workspaces">
            {recentlyUpdated.map((workspace) => (
              <CarouselItem key={workspace.id} className="w-[320px] sm:w-[360px]">
                <LibraryWorkspaceCard
                  workspace={workspace}
                  userId={userId}
                  displayName={displayName}
                  onToggleFavorite={() => onToggleFavorite(workspace)}
                  isTogglingFavorite={togglingFavoriteId === workspace.license?.id}
                  badges={badgesByProductId.get(workspace.id)}
                  review={reviewByProductId ? (reviewByProductId.get(workspace.id) ?? null) : undefined}
                />
              </CarouselItem>
            ))}
          </Carousel>
        </div>
      )}

      {favorites.length > 0 && (
        <div>
          <SectionHeading title="Favorites" hasMore={favoritesHasMore} onViewAll={onViewAllFavorites} />
          <Carousel ariaLabel="Favorite Workspaces">
            {favorites.map((workspace) => (
              <CarouselItem key={workspace.id} className="w-[320px] sm:w-[360px]">
                <LibraryWorkspaceCard
                  workspace={workspace}
                  userId={userId}
                  displayName={displayName}
                  onToggleFavorite={() => onToggleFavorite(workspace)}
                  isTogglingFavorite={togglingFavoriteId === workspace.license?.id}
                  badges={badgesByProductId.get(workspace.id)}
                  review={reviewByProductId ? (reviewByProductId.get(workspace.id) ?? null) : undefined}
                />
              </CarouselItem>
            ))}
          </Carousel>
        </div>
      )}

      {recentPurchases.length > 0 && (
        <div>
          <SectionHeading title="Recent Purchases" hasMore={recentPurchasesHasMore} onViewAll={onViewAllRecentPurchases} />
          <Carousel ariaLabel="Recently Purchased Workspaces">
            {recentPurchases.map((workspace) => (
              <CarouselItem key={workspace.id} className="w-[320px] sm:w-[360px]">
                <LibraryWorkspaceCard
                  workspace={workspace}
                  userId={userId}
                  displayName={displayName}
                  onToggleFavorite={() => onToggleFavorite(workspace)}
                  isTogglingFavorite={togglingFavoriteId === workspace.license?.id}
                  badges={badgesByProductId.get(workspace.id)}
                  review={reviewByProductId ? (reviewByProductId.get(workspace.id) ?? null) : undefined}
                />
              </CarouselItem>
            ))}
          </Carousel>
        </div>
      )}
    </div>
  );
}
