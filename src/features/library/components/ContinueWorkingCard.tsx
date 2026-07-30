import { Link } from "react-router-dom";
import type { WorkspaceWithAccess } from "@/types/workspace";

interface ContinueWorkingCardProps {
  workspace: WorkspaceWithAccess;
}

/**
 * My Library's "Continue Working" section — large-format card for quick
 * re-entry into a Workspace the member has actually opened before (sourced
 * from license.last_opened_at, see WorkspaceViewerPage's recordOpened()
 * call). A sibling to LibraryWorkspaceCard/CatalogProductCard/
 * ContinueLearningCard, not a mode on any of them — this one is
 * specifically the large "jump back in" tile, always linking straight to
 * the Workspace itself (never the Product Details page — a member
 * revisiting something they already opened doesn't need the marketing
 * pitch again).
 */
export function ContinueWorkingCard({ workspace }: ContinueWorkingCardProps) {
  return (
    <Link to={`/workspace/${workspace.slug}`} className="card group flex overflow-hidden">
      <div className="aspect-square w-32 shrink-0 overflow-hidden bg-navy-100 sm:w-40 dark:bg-navy-700">
        {workspace.cover_image_url ? (
          <img
            src={workspace.cover_image_url}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-primary/40">
            <span className="text-3xl font-bold">{workspace.name.charAt(0)}</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-center gap-1 p-5">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">Continue Working</span>
        <h3 className="text-lg font-bold text-navy-900 dark:text-white">{workspace.name}</h3>
        <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary">
          Jump back in →
        </span>
      </div>
    </Link>
  );
}
