import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import type { WorkspaceWithAccess } from "@/types/workspace";
import type { WorkspaceBadge } from "@/lib/workspaceBadges";
import { AccessStateBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { BuyNowButton } from "@/components/ui/BuyNowButton";
import { WorkspaceBadgeRow } from "@/components/catalog/WorkspaceBadgeRow";
import { notificationService } from "@/services/notificationService";
import { ReviewPromptCard } from "@/features/reviews/components/ReviewPromptCard";

function formatExpiry(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  return new Date(expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

interface LibraryWorkspaceCardProps {
  workspace: WorkspaceWithAccess;
  userId: string;
  /** Snapshotted onto a review at submission time — see reviewService.create. */
  displayName: string;
  /** My Library's Favorites filter — owned by MyLibraryPage (it holds the license list the filter itself reads), this card is just the toggle affordance. */
  onToggleFavorite: () => void;
  isTogglingFavorite: boolean;
  /** Computed by the caller from catalog_index (see catalogService.getByProductIds) — absent entirely for an owned-but-archived Workspace, which simply shows no badges. */
  badges?: WorkspaceBadge[];
}

/**
 * Only ever renders trial/purchased/expired Workspaces — MyLibraryPage
 * filters out "locked" (never activated/bought) ones, those live in Browse
 * Workspaces instead. A Workspace never disappears from here just because
 * its trial expired — it stays visible with a Buy Now prompt instead.
 *
 * This is the left-hand column of a Library row — the right-hand
 * SavedChecklistsPanel (a sibling, not a section of this card) covers
 * this Workspace's saved checklist instances; see MyLibraryPage.
 */
export function LibraryWorkspaceCard({
  workspace,
  userId,
  displayName,
  onToggleFavorite,
  isTogglingFavorite,
  badges = [],
}: LibraryWorkspaceCardProps) {
  const canOpen = workspace.accessState === "trial" || workspace.accessState === "purchased";
  const isExpired = workspace.accessState === "expired";
  const isPurchased = workspace.accessState === "purchased";
  const expiry = workspace.accessState === "trial" ? formatExpiry(workspace.license?.expires_at ?? null) : null;

  // Lazy trigger for the one-time "trial expired, how was it?" email —
  // there's no cron in this codebase, so the client fires this whenever it
  // renders an expired trial with no request sent yet; the route itself
  // enforces "only ever once" (see api/notifications/trial-review-request.ts).
  useEffect(() => {
    if (isExpired && workspace.license && !workspace.license.review_requested_at) {
      void notificationService.sendTrialReviewRequestEmail({ userId, productId: workspace.id });
    }
  }, [isExpired, workspace.license, userId, workspace.id]);

  return (
    <div className="card flex h-full flex-col overflow-hidden">
      <div className="aspect-[16/10] w-full overflow-hidden bg-navy-100 dark:bg-navy-700">
        {workspace.cover_image_url ? (
          <img src={workspace.cover_image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-primary/40">
            <span className="text-4xl font-bold">{workspace.name.charAt(0)}</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-navy-900 dark:text-white">{workspace.name}</h3>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onToggleFavorite}
              disabled={isTogglingFavorite}
              aria-pressed={workspace.license?.is_favorite ?? false}
              aria-label={workspace.license?.is_favorite ? "Remove from favorites" : "Add to favorites"}
              className="text-navy-300 transition hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white/30"
            >
              <Star className={`h-5 w-5 ${workspace.license?.is_favorite ? "fill-amber-400 text-amber-400" : ""}`} />
            </button>
            <AccessStateBadge state={workspace.accessState} />
          </div>
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-navy-500 dark:text-white/60">
          {workspace.short_description}
        </p>
        <WorkspaceBadgeRow badges={badges} className="mt-2" />
        {expiry && (
          <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-300">
            Trial ends {expiry}
          </p>
        )}
        {isExpired && (
          <p className="mt-2 text-xs text-navy-500 dark:text-white/60">
            Your trial has ended. Purchase this Workspace to keep using it.
          </p>
        )}
        <div className="mt-5">
          {canOpen ? (
            <Link to={`/workspace/${workspace.slug}`}>
              <Button size="sm" className="w-full">
                Open Workspace
              </Button>
            </Link>
          ) : (
            <BuyNowButton product={workspace} />
          )}
        </div>

        {(isExpired || isPurchased) && (
          <div className="mt-4">
            <ReviewPromptCard
              userId={userId}
              productId={workspace.id}
              displayName={displayName}
              createdFrom={isPurchased ? "purchase" : "trial"}
            />
          </div>
        )}
      </div>
    </div>
  );
}
