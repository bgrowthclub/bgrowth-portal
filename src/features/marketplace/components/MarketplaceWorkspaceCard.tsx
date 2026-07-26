import { Link } from "react-router-dom";
import type { WorkspaceWithAccess } from "@/types/workspace";
import { AccessStateBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getCheckoutUrl } from "@/lib/checkout";

interface MarketplaceWorkspaceCardProps {
  workspace: WorkspaceWithAccess;
  /** Whether this member has ever activated a trial (any Workspace) — gates whether a not-yet-owned, trial-eligible Workspace still offers "Start Free Trial" here. */
  hasUsedTrial: boolean;
}

export function MarketplaceWorkspaceCard({ workspace, hasUsedTrial }: MarketplaceWorkspaceCardProps) {
  const isOwned = workspace.accessState === "trial" || workspace.accessState === "purchased";
  const canStartTrial = !isOwned && workspace.is_trial_eligible && !hasUsedTrial;
  const checkoutUrl = getCheckoutUrl(workspace.slug);

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
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-navy-900 dark:text-white">{workspace.name}</h3>
          <AccessStateBadge state={workspace.accessState} />
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-navy-500 dark:text-white/60">
          {workspace.short_description}
        </p>
        <div className="mt-5">
          {isOwned ? (
            <Link to={`/workspace/${workspace.slug}`}>
              <Button size="sm" className="w-full">
                Open Workspace
              </Button>
            </Link>
          ) : canStartTrial ? (
            <Link to="/trial-selection">
              <Button size="sm" className="w-full">
                Start Free Trial
              </Button>
            </Link>
          ) : checkoutUrl ? (
            <a href={checkoutUrl} className="block">
              <Button size="sm" variant="secondary" className="w-full">
                Buy
              </Button>
            </a>
          ) : (
            <Button size="sm" variant="secondary" className="w-full" disabled title="Checkout isn't set up yet">
              Buy
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
