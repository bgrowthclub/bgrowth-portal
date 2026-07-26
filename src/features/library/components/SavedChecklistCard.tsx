import { Link } from "react-router-dom";
import { MoreVertical } from "lucide-react";
import type { WorkspaceInstanceRow } from "@/types/database";
import type { WorkspaceContent, WorkspaceData } from "@/types/workspaceContent";
import { useWorkspaceProgress } from "@/features/workspace-viewer/hooks/useWorkspaceProgress";
import { Button } from "@/components/ui/Button";

// Stable module-level fallback (never recreated per render) so the progress
// hook below always has something to call — a Workspace with no published
// content yet just naturally computes to 0/0/0%, and the progress bar is
// hidden entirely in that case (see the `content &&` guard below).
const EMPTY_CONTENT: WorkspaceContent = {
  productId: "",
  brand: { name: "", companyLabel: "", primaryColor: "#1061EC" },
  footer: { proTip: "", helpText: "" },
  sections: [],
};

interface SavedChecklistCardProps {
  instance: WorkspaceInstanceRow;
  workspaceSlug: string;
  /** Null when Studio hasn't published content for this Workspace yet — the progress bar is simply omitted then ("if available"). */
  content: WorkspaceContent | null;
}

function formatUpdatedDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * One saved, named, filled-in record of an owned Workspace. Progress is
 * computed with the exact same useWorkspaceProgress hook the live Workspace
 * Viewer uses (see CLAUDE-equivalent reuse policy for this codebase's
 * Progress Engine) — never a second, parallel percentage calculation.
 */
export function SavedChecklistCard({ instance, workspaceSlug, content }: SavedChecklistCardProps) {
  const progress = useWorkspaceProgress(content ?? EMPTY_CONTENT, (instance.data as WorkspaceData) ?? {});

  return (
    <div className="card flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <h4 className="min-w-0 truncate font-semibold text-navy-900 dark:text-white">{instance.label}</h4>
        {/* Reserved for future actions (rename, archive, delete, ...) — intentionally non-functional today. */}
        <button
          type="button"
          disabled
          title="More actions (coming soon)"
          className="shrink-0 rounded-lg p-1.5 text-navy-300 disabled:cursor-not-allowed dark:text-white/20"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>

      {content && (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-navy-100 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-semibold text-navy-500 dark:text-white/60">{progress.percent}%</span>
        </div>
      )}

      <p className="text-xs text-navy-400 dark:text-white/40">Last updated {formatUpdatedDate(instance.updated_at)}</p>

      <Link to={`/workspace/${workspaceSlug}?instance=${instance.id}`} className="mt-1">
        <Button size="sm" variant="secondary" className="w-full">
          Continue
        </Button>
      </Link>
    </div>
  );
}
