import { Link } from "react-router-dom";
import type { WorkspaceWithAccess } from "@/types/workspace";
import { Button } from "@/components/ui/Button";
import { BuyNowButton } from "@/components/ui/BuyNowButton";

interface MarketplaceWorkspaceCardProps {
  workspace: WorkspaceWithAccess;
  /** Whether this member has ever activated a trial (any Workspace) — gates whether this Workspace still offers "Start Free Trial" here. */
  hasUsedTrial: boolean;
}

/** Only ever renders "locked" Workspaces — MarketplacePage filters to discovery only; anything owned lives in My Library instead. */
export function MarketplaceWorkspaceCard({ workspace, hasUsedTrial }: MarketplaceWorkspaceCardProps) {
  const canStartTrial = workspace.is_trial_eligible && !hasUsedTrial;

  return (
    <div className="card overflow-hidden">
      <div className="aspect-[16/10] w-full overflow-hidden bg-navy-100 dark:bg-navy-700">
        {workspace.cover_image_url ? (
          <img src={workspace.cover_image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-primary/40">
            <span className="text-4xl font-bold">{workspace.name.charAt(0)}</span>
          </div>
        )}
      </div>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-navy-900 dark:text-white">{workspace.name}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-navy-500 dark:text-white/60">
          {workspace.short_description}
        </p>
        <div className="mt-5">
          {canStartTrial ? (
            <Link to="/trial-selection">
              <Button size="sm" className="w-full">
                Start Free Trial
              </Button>
            </Link>
          ) : (
            <BuyNowButton product={workspace} />
          )}
        </div>
      </div>
    </div>
  );
}
