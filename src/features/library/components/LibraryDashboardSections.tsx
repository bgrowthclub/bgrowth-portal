import type { WorkspaceWithAccess } from "@/types/workspace";
import type { ReviewRow } from "@/types/database";
import type { WorkspaceBadge } from "@/lib/workspaceBadges";
import { Carousel, CarouselItem } from "@/components/ui/Carousel";
import { LibraryWorkspaceCard } from "./LibraryWorkspaceCard";
import { ContinueWorkingCard } from "./ContinueWorkingCard";

interface LibraryDashboardSectionsProps {
  /** Always rendered first, per its top-priority requirement — see MyLibraryPage, which computes both lists below and is the one place section order is decided. Every list here already arrives capped to its display limit — this component never slices. */
  continueWorking: WorkspaceWithAccess[];
  continueWorkingHasMore: boolean;
  onViewAllContinueWorking: () => void;
  favorites: WorkspaceWithAccess[];
  favoritesHasMore: boolean;
  onViewAllFavorites: () => void;
  badgesByProductId: Map<string, WorkspaceBadge[]>;
  /** Undefined while the batched lookup is still loading — see reviewService.getForUserBatch. */
  reviewByProductId: Map<string, ReviewRow> | undefined;
  userId: string;
  displayName: string;
  onToggleFavorite: (workspace: WorkspaceWithAccess) => void;
  togglingFavoriteId: string | null;
}

function SectionHeading({
  title,
  hasMore,
  onViewAll,
  viewAllLabel = "View All",
}: {
  title: string;
  hasMore: boolean;
  onViewAll?: () => void;
  viewAllLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold text-navy-900 dark:text-white">{title}</h2>
      {hasMore && (
        <button type="button" onClick={onViewAll} className="text-sm font-semibold text-primary hover:underline">
          {viewAllLabel} →
        </button>
      )}
    </div>
  );
}

/**
 * The "quick access" strip at the top of My Library, above My Workspaces —
 * a pure rendering component, no data derivation of its own. Continue
 * Working (recency of the member's own activity) and Favorites (a
 * deliberate manual action) are each a genuinely distinct signal from
 * "everything the member owns," which is why they're kept as their own
 * rails even though the complete, unified list lives in My Workspaces
 * immediately below. Recent Purchases, Recommended For You, and Recently
 * Updated were retired from here: Recent Purchases and Recommended For You
 * duplicated pools now covered by My Workspaces and Explore More
 * Workspaces respectively, and Recently Updated's signal already surfaces
 * via the "Updated" badge on every card in the complete list. Every
 * section hides independently when its own list is empty.
 */
export function LibraryDashboardSections({
  continueWorking,
  continueWorkingHasMore,
  onViewAllContinueWorking,
  favorites,
  favoritesHasMore,
  onViewAllFavorites,
  badgesByProductId,
  reviewByProductId,
  userId,
  displayName,
  onToggleFavorite,
  togglingFavoriteId,
}: LibraryDashboardSectionsProps) {
  const hasAnyContent = continueWorking.length > 0 || favorites.length > 0;
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
    </div>
  );
}
