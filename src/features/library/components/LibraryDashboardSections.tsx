import { useMemo } from "react";
import type { WorkspaceWithAccess } from "@/types/workspace";
import { Carousel, CarouselItem } from "@/components/ui/Carousel";
import { LibraryWorkspaceCard } from "./LibraryWorkspaceCard";
import { ContinueWorkingCard } from "./ContinueWorkingCard";

const CONTINUE_WORKING_LIMIT = 5;

interface LibraryDashboardSectionsProps {
  workspaces: WorkspaceWithAccess[];
  userId: string;
  displayName: string;
  onToggleFavorite: (workspace: WorkspaceWithAccess) => void;
  togglingFavoriteId: string | null;
}

/**
 * The "personalized dashboard" strip at the top of My Library — Continue
 * Working, Favorites, Recent Purchases — sitting above the full,
 * filterable list (see MyLibraryPage). All three read straight off the
 * same WorkspaceWithAccess data the full list already uses; nothing here
 * is a separate fetch or a new data shape. A Workspace can legitimately
 * appear in more than one section at once (recently opened AND favorited
 * AND recently purchased) — same as any real dashboard's "Continue
 * Watching"/"Favorites"/"New" rows, not a bug to de-duplicate away.
 */
export function LibraryDashboardSections({
  workspaces,
  userId,
  displayName,
  onToggleFavorite,
  togglingFavoriteId,
}: LibraryDashboardSectionsProps) {
  const continueWorking = useMemo(
    () =>
      workspaces
        .filter((w) => (w.accessState === "trial" || w.accessState === "purchased") && w.license?.last_opened_at)
        .sort((a, b) => new Date(b.license!.last_opened_at!).getTime() - new Date(a.license!.last_opened_at!).getTime())
        .slice(0, CONTINUE_WORKING_LIMIT),
    [workspaces],
  );

  const favorites = useMemo(
    () =>
      workspaces
        .filter((w) => w.license?.is_favorite)
        .sort((a, b) => new Date(b.license?.activated_at ?? 0).getTime() - new Date(a.license?.activated_at ?? 0).getTime()),
    [workspaces],
  );

  const recentPurchases = useMemo(
    () =>
      [...workspaces].sort(
        (a, b) => new Date(b.license?.activated_at ?? 0).getTime() - new Date(a.license?.activated_at ?? 0).getTime(),
      ),
    [workspaces],
  );

  if (continueWorking.length === 0 && favorites.length === 0 && recentPurchases.length === 0) return null;

  return (
    <div className="mt-8 flex flex-col gap-12">
      {continueWorking.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-bold text-navy-900 dark:text-white">Continue Working</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {continueWorking.map((workspace) => (
              <ContinueWorkingCard key={workspace.id} workspace={workspace} />
            ))}
          </div>
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
                />
              </CarouselItem>
            ))}
          </Carousel>
        </div>
      )}
    </div>
  );
}
