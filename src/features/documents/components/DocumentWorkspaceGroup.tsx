import type { ProductRow, WorkspaceInstanceRow } from "@/types/database";
import { SavedChecklistCard } from "@/features/library/components/SavedChecklistCard";

interface DocumentWorkspaceGroupProps {
  workspace: Pick<ProductRow, "name" | "slug" | "content">;
  /** Already sorted by the caller (see DocumentsPage) — this component never re-sorts or caps the list. */
  instances: WorkspaceInstanceRow[];
}

/**
 * One Workspace's group of documents on the dedicated /documents page —
 * a header (Workspace name + document count) followed by that Workspace's
 * SavedChecklistCards. Phase 1 deliberately renders every matching
 * document with no per-group cap/"Show all" and no collapse/expand —
 * search, the Workspace filter, and sort are the escape valves for a
 * large library; revisit only if real usage shows it's not enough.
 */
export function DocumentWorkspaceGroup({ workspace, instances }: DocumentWorkspaceGroupProps) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 className="text-lg font-bold text-navy-900 dark:text-white">{workspace.name}</h2>
        <span className="text-sm text-navy-400 dark:text-white/40">
          {instances.length} {instances.length === 1 ? "document" : "documents"}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {instances.map((instance) => (
          <SavedChecklistCard
            key={instance.id}
            instance={instance}
            workspaceSlug={workspace.slug}
            workspaceName={workspace.name}
            showWorkspaceLabel={false}
            content={workspace.content}
          />
        ))}
      </div>
    </div>
  );
}
