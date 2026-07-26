import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MoreVertical } from "lucide-react";
import type { WorkspaceInstanceRow } from "@/types/database";
import type { WorkspaceContent, WorkspaceData } from "@/types/workspaceContent";
import { useWorkspaceProgress } from "@/features/workspace-viewer/hooks/useWorkspaceProgress";

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

const RESERVED_ACTIONS = ["Rename", "Duplicate", "Archive", "Delete"] as const;

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
 * Viewer uses (this codebase's one Progress Engine) — never a second,
 * parallel percentage calculation.
 *
 * The whole card navigates to the instance — implemented as a real <Link>
 * stretched over the card (absolute inset-0, behind the content) rather
 * than an onClick on the card itself, so right-click/open-in-new-tab and
 * keyboard navigation keep working. The ⋮ menu button sits above it in
 * stacking order (and stops its own clicks from reaching the link), which
 * is also why it can't live inside the Link — a button nested inside an
 * anchor is invalid HTML.
 */
export function SavedChecklistCard({ instance, workspaceSlug, content }: SavedChecklistCardProps) {
  const progress = useWorkspaceProgress(content ?? EMPTY_CONTENT, (instance.data as WorkspaceData) ?? {});
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsMenuOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <div className="group relative cursor-pointer rounded-2xl border border-navy-100/60 bg-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft-lg dark:border-white/10 dark:bg-navy-800 dark:shadow-soft-dark">
      <Link
        to={`/workspace/${workspaceSlug}?instance=${instance.id}`}
        aria-label={`Continue ${instance.label}`}
        className="absolute inset-0 z-0 rounded-2xl"
      />

      <div className="pointer-events-none relative z-[1] flex items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-semibold text-navy-900 dark:text-white">{instance.label}</h4>
          {content && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-navy-100 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <span className="shrink-0 text-xs font-semibold text-navy-500 dark:text-white/60">{progress.percent}%</span>
            </div>
          )}
          <p className="mt-1 text-xs text-navy-400 dark:text-white/40">
            Last updated {formatUpdatedDate(instance.updated_at)}
          </p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-navy-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-primary dark:text-white/30" />
      </div>

      <div ref={menuRef} className="absolute right-2 top-2 z-[2]">
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsMenuOpen((open) => !open);
          }}
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          className="rounded-lg p-1.5 text-navy-300 opacity-0 transition-opacity duration-200 hover:bg-navy-50 group-hover:opacity-100 dark:text-white/30 dark:hover:bg-white/5"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {isMenuOpen && (
          <div
            role="menu"
            onClick={(event) => event.stopPropagation()}
            className="absolute right-0 top-full z-10 mt-1 w-44 overflow-hidden rounded-xl border border-navy-100 bg-white py-1 shadow-soft-lg dark:border-white/10 dark:bg-navy-800"
          >
            {/* Reserved for future actions — intentionally disabled today. */}
            {RESERVED_ACTIONS.map((action) => (
              <button
                key={action}
                type="button"
                role="menuitem"
                disabled
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-navy-300 disabled:cursor-not-allowed dark:text-white/20"
              >
                {action}
                <span className="text-[10px] uppercase tracking-wide">Coming Soon</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
