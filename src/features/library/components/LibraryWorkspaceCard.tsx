import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { WorkspaceWithAccess } from "@/types/workspace";
import type { WorkspaceInstanceRow } from "@/types/database";
import { AccessStateBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { BuyNowButton } from "@/components/ui/BuyNowButton";
import { PromptDialog } from "@/components/ui/PromptDialog";
import { workspaceInstanceService } from "@/services/workspaceInstanceService";
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
  /** This Workspace's saved checklist instances only — MyLibraryPage groups the full list by product before passing it down. */
  instances: WorkspaceInstanceRow[];
}

/**
 * Only ever renders trial/purchased/expired Workspaces — MyLibraryPage
 * filters out "locked" (never activated/bought) ones, those live in Browse
 * Workspaces instead. A Workspace never disappears from here just because
 * its trial expired — it stays visible with a Buy Now prompt instead.
 */
export function LibraryWorkspaceCard({ workspace, userId, displayName, instances }: LibraryWorkspaceCardProps) {
  const navigate = useNavigate();
  const canOpen = workspace.accessState === "trial" || workspace.accessState === "purchased";
  const isExpired = workspace.accessState === "expired";
  const isPurchased = workspace.accessState === "purchased";
  const expiry = workspace.accessState === "trial" ? formatExpiry(workspace.license?.expires_at ?? null) : null;

  const [isNaming, setIsNaming] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Lazy trigger for the one-time "trial expired, how was it?" email —
  // there's no cron in this codebase, so the client fires this whenever it
  // renders an expired trial with no request sent yet; the route itself
  // enforces "only ever once" (see api/notifications/trial-review-request.ts).
  useEffect(() => {
    if (isExpired && workspace.license && !workspace.license.review_requested_at) {
      void notificationService.sendTrialReviewRequestEmail({ userId, productId: workspace.id });
    }
  }, [isExpired, workspace.license, userId, workspace.id]);

  // TEMP DIAGNOSTIC — tracing notary-commission-workspace. Logs exactly what
  // this card was handed for this Workspace, straight from the live query
  // MyLibraryPage ran. Remove once confirmed.
  useEffect(() => {
    console.log("[DIAGNOSTIC LibraryWorkspaceCard] workspace:", JSON.stringify(workspace));
    console.log("[DIAGNOSTIC LibraryWorkspaceCard] key identity fields:", {
      slug: workspace.slug,
      id: workspace.id,
      studio_product_id: workspace.studio_product_id,
      current_version: workspace.current_version,
      name: workspace.name,
      accessState: workspace.accessState,
    });
  }, [workspace]);

  async function handleCreateInstance(label: string) {
    setIsCreating(true);
    setCreateError(null);
    try {
      const instance = await workspaceInstanceService.create(userId, workspace.id, label);
      setIsNaming(false);
      navigate(`/workspace/${workspace.slug}?instance=${instance.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Couldn't create that checklist. Please try again.");
    } finally {
      setIsCreating(false);
    }
  }

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

        {canOpen && (
          <div className="mt-5 border-t border-navy-100/60 pt-4 dark:border-white/10">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-400 dark:text-white/40">
              Saved Checklists
            </p>
            {instances.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1.5">
                {instances.map((instance) => (
                  <li key={instance.id}>
                    <Link
                      to={`/workspace/${workspace.slug}?instance=${instance.id}`}
                      className="text-sm text-navy-700 hover:text-primary hover:underline dark:text-white/80"
                    >
                      • {instance.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-navy-400 dark:text-white/40">No saved checklists yet.</p>
            )}
            {createError && (
              <p role="alert" className="mt-2 text-xs text-red-500">
                {createError}
              </p>
            )}
            <button
              type="button"
              onClick={() => setIsNaming(true)}
              className="mt-3 text-sm font-semibold text-primary hover:underline"
            >
              + New Checklist
            </button>
          </div>
        )}
      </div>

      <PromptDialog
        isOpen={isNaming}
        title="Name this checklist"
        label="Client or job name"
        placeholder="e.g. John Smith"
        confirmLabel="Create"
        isSubmitting={isCreating}
        onSubmit={handleCreateInstance}
        onCancel={() => setIsNaming(false)}
      />
    </div>
  );
}
