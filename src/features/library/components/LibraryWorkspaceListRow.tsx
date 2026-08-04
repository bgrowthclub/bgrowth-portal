import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import type { WorkspaceWithAccess } from "@/types/workspace";
import type { WorkspaceBadge } from "@/lib/workspaceBadges";
import { AccessStateBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { BuyNowButton } from "@/components/ui/BuyNowButton";
import { WorkspaceBadgeRow } from "@/components/catalog/WorkspaceBadgeRow";

interface LibraryWorkspaceListRowProps {
  workspace: WorkspaceWithAccess;
  categoryName?: string;
  onToggleFavorite: () => void;
  isTogglingFavorite: boolean;
  badges?: WorkspaceBadge[];
}

/**
 * My Library's List View row — a compact alternative to
 * LibraryWorkspaceCard for a member with many Workspaces who wants to scan
 * a dense list rather than a full card per row. Deliberately drops what
 * the card shows (trial-expiry copy, the SavedChecklistsPanel, the Review
 * prompt) in exchange for density — that trade-off is the point of a list
 * view, not an oversight; a member wanting that detail switches to Grid.
 */
export function LibraryWorkspaceListRow({
  workspace,
  categoryName,
  onToggleFavorite,
  isTogglingFavorite,
  badges = [],
}: LibraryWorkspaceListRowProps) {
  const canOpen =
    workspace.accessState === "trial" || workspace.accessState === "purchased" || workspace.accessState === "unlocked";

  return (
    // flex-col at mobile so every piece gets its own full-width row (default
    // align-items: stretch); sm:flex-row restores today's compact single-line
    // row. The order-*/sm:order-* pairs below reposition the favorite control
    // and the title/description/badges block between the two layouts without
    // duplicating any markup — everything else keeps its natural DOM order.
    <div className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-4">
      <Link
        to={canOpen ? `/workspace/${workspace.slug}` : `/product/${workspace.slug}`}
        className="order-1 block sm:shrink-0"
      >
        <div className="aspect-[16/10] w-full overflow-hidden rounded-lg bg-navy-100 sm:aspect-auto sm:h-14 sm:w-14 dark:bg-navy-700">
          {workspace.cover_image_url ? (
            <img src={workspace.cover_image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-primary/40">
              <span className="text-3xl font-bold sm:text-lg">{workspace.name.charAt(0)}</span>
            </div>
          )}
        </div>
      </Link>

      {/* Mobile: own row after the title/description/badges block (order-3).
          Desktop: right after the image, matching today's layout (sm:order-2). */}
      <button
        type="button"
        onClick={onToggleFavorite}
        disabled={isTogglingFavorite}
        aria-pressed={workspace.license?.is_favorite ?? false}
        aria-label={workspace.license?.is_favorite ? "Remove from favorites" : "Add to favorites"}
        className="order-3 flex w-fit shrink-0 items-center text-navy-300 transition hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white/30 sm:order-2"
      >
        <Star className={`h-5 w-5 ${workspace.license?.is_favorite ? "fill-amber-400 text-amber-400" : ""}`} />
      </button>

      {/* Mobile: title, then description, then badges — plain block flow (no
          flex here at this breakpoint), so DOM order below IS the visual
          order. Desktop: becomes a flex-wrap row so title+badges share one
          line like before; description gets sm:w-full so it's forced onto
          its own line beneath them (the standard flex-wrap "full-width item
          forces a line break" technique) instead of duplicating the block. */}
      <div className="order-2 min-w-0 sm:order-3 sm:flex sm:flex-1 sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-1">
        <h3 className="font-semibold text-navy-900 dark:text-white sm:order-1 sm:truncate">{workspace.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-navy-400 dark:text-white/40 sm:order-3 sm:mt-0 sm:w-full sm:truncate sm:text-xs">
          {workspace.short_description}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:order-2 sm:mt-0">
          <AccessStateBadge state={workspace.accessState} />
          {categoryName && (
            <span className="badge shrink-0 bg-navy-50 text-navy-500 dark:bg-white/5 dark:text-white/50">
              {categoryName}
            </span>
          )}
          <WorkspaceBadgeRow badges={badges} />
        </div>
      </div>

      {/* [&_button]:w-full makes both the Open Workspace Button and
          BuyNowButton's internal button full-width on mobile without
          needing a className prop on either — sm: reverts to their
          existing compact/shrink-0 sizing. */}
      <div className="order-4 [&_button]:w-full sm:w-auto sm:shrink-0 sm:[&_button]:w-auto">
        {canOpen ? (
          <Link to={`/workspace/${workspace.slug}`}>
            <Button size="sm">Open Workspace</Button>
          </Link>
        ) : (
          <BuyNowButton product={workspace} size="sm" fullWidth={false} />
        )}
      </div>
    </div>
  );
}
