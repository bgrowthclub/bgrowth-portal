import type { WorkspaceWithAccess } from "@/types/workspace";
import type { CatalogIndexRow } from "@/types/database";
import type { WorkspaceBadge } from "@/lib/workspaceBadges";
import { Carousel, CarouselItem } from "@/components/ui/Carousel";
import { CatalogProductCard } from "@/components/catalog/CatalogProductCard";
import { LibraryWorkspaceCard } from "./LibraryWorkspaceCard";
import { ContinueWorkingCard } from "./ContinueWorkingCard";

interface LibraryDashboardSectionsProps {
  /** Always rendered first, per its top-priority requirement — see MyLibraryPage, which computes every list below and is the one place section order is decided. */
  continueWorking: WorkspaceWithAccess[];
  /** Not-yet-owned candidates (catalog_index-shaped) — see src/lib/recommendations.ts for how these were ranked and excluded from what's already shown elsewhere on this page. */
  recommended: CatalogIndexRow[];
  recentlyUpdated: WorkspaceWithAccess[];
  favorites: WorkspaceWithAccess[];
  recentPurchases: WorkspaceWithAccess[];
  badgesByProductId: Map<string, WorkspaceBadge[]>;
  categoryNameById: Map<string, string>;
  userId: string;
  displayName: string;
  onToggleFavorite: (workspace: WorkspaceWithAccess) => void;
  togglingFavoriteId: string | null;
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
 */
export function LibraryDashboardSections({
  continueWorking,
  recommended,
  recentlyUpdated,
  favorites,
  recentPurchases,
  badgesByProductId,
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
          <h2 className="mb-4 text-lg font-bold text-navy-900 dark:text-white">Continue Working</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {continueWorking.map((workspace) => (
              <ContinueWorkingCard key={workspace.id} workspace={workspace} badges={badgesByProductId.get(workspace.id)} />
            ))}
          </div>
        </div>
      )}

      {recommended.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-bold text-navy-900 dark:text-white">Recommended For You</h2>
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
          <h2 className="mb-4 text-lg font-bold text-navy-900 dark:text-white">Recently Updated</h2>
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
                />
              </CarouselItem>
            ))}
          </Carousel>
        </div>
      )}

      {favorites.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-bold text-navy-900 dark:text-white">Favorites</h2>
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
                />
              </CarouselItem>
            ))}
          </Carousel>
        </div>
      )}

      {recentPurchases.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-bold text-navy-900 dark:text-white">Recent Purchases</h2>
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
                />
              </CarouselItem>
            ))}
          </Carousel>
        </div>
      )}
    </div>
  );
}
