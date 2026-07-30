import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import type { WorkspaceWithAccess } from "@/types/workspace";
import { AccessStateBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { BuyNowButton } from "@/components/ui/BuyNowButton";

interface LibraryWorkspaceListRowProps {
  workspace: WorkspaceWithAccess;
  categoryName?: string;
  onToggleFavorite: () => void;
  isTogglingFavorite: boolean;
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
}: LibraryWorkspaceListRowProps) {
  const canOpen = workspace.accessState === "trial" || workspace.accessState === "purchased";

  return (
    <div className="card flex items-center gap-4 p-4">
      <Link to={canOpen ? `/workspace/${workspace.slug}` : `/product/${workspace.slug}`} className="shrink-0">
        <div className="h-14 w-14 overflow-hidden rounded-lg bg-navy-100 dark:bg-navy-700">
          {workspace.cover_image_url ? (
            <img src={workspace.cover_image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-primary/40">
              <span className="text-lg font-bold">{workspace.name.charAt(0)}</span>
            </div>
          )}
        </div>
      </Link>

      <button
        type="button"
        onClick={onToggleFavorite}
        disabled={isTogglingFavorite}
        aria-pressed={workspace.license?.is_favorite ?? false}
        aria-label={workspace.license?.is_favorite ? "Remove from favorites" : "Add to favorites"}
        className="shrink-0 text-navy-300 transition hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white/30"
      >
        <Star className={`h-5 w-5 ${workspace.license?.is_favorite ? "fill-amber-400 text-amber-400" : ""}`} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-semibold text-navy-900 dark:text-white">{workspace.name}</h3>
          <AccessStateBadge state={workspace.accessState} />
          {categoryName && (
            <span className="badge shrink-0 bg-navy-50 text-navy-500 dark:bg-white/5 dark:text-white/50">
              {categoryName}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-navy-400 dark:text-white/40">{workspace.short_description}</p>
      </div>

      <div className="shrink-0">
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
