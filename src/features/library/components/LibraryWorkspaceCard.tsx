import { Link } from "react-router-dom";
import type { WorkspaceWithAccess } from "@/types/workspace";
import { AccessStateBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

function formatExpiry(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  return new Date(expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function LibraryWorkspaceCard({ workspace }: { workspace: WorkspaceWithAccess }) {
  const canOpen = workspace.accessState === "trial" || workspace.accessState === "purchased";
  const expiry = workspace.accessState === "trial" ? formatExpiry(workspace.license?.expires_at ?? null) : null;

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
        <div className="mt-5">
          {canOpen ? (
            <Link to={`/workspace/${workspace.slug}`}>
              <Button size="sm" className="w-full">
                Open Workspace
              </Button>
            </Link>
          ) : (
            <Button size="sm" variant="secondary" className="w-full">
              Buy
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
