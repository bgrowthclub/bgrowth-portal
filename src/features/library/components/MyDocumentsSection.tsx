import type { WorkspaceInstanceRow } from "@/types/database";
import type { WorkspaceWithAccess } from "@/types/workspace";
import { SavedChecklistCard } from "./SavedChecklistCard";

interface MyDocumentsSectionProps {
  /** Already sorted most-recently-updated first by the caller (see MyLibraryPage) — this component never re-sorts. */
  documents: WorkspaceInstanceRow[];
  /** Looked up once by the caller from the same owned-Workspace list My Workspaces already derives — no separate fetch. */
  workspaceById: Map<string, WorkspaceWithAccess>;
}

/**
 * My Library's unified documents view — every saved Workspace instance the
 * member has created, across every Workspace, in one flat, chronological
 * collection (no more "Workspace A's documents, then Workspace B's
 * documents"). Each card carries its own Workspace name (see
 * SavedChecklistCard) so the source is always clear without grouping.
 * Hides entirely when the member has no saved documents yet, matching this
 * page's existing "hide when empty" convention for every section.
 */
export function MyDocumentsSection({ documents, workspaceById }: MyDocumentsSectionProps) {
  const entries = documents
    .map((instance) => ({ instance, workspace: workspaceById.get(instance.product_id) }))
    .filter((entry): entry is { instance: WorkspaceInstanceRow; workspace: WorkspaceWithAccess } => Boolean(entry.workspace));

  if (entries.length === 0) return null;

  return (
    <div className="mt-12">
      <h2 className="mb-4 text-lg font-bold text-navy-900 dark:text-white">My Documents</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(({ instance, workspace }) => (
          <SavedChecklistCard
            key={instance.id}
            instance={instance}
            workspaceSlug={workspace.slug}
            workspaceName={workspace.name}
            content={workspace.content}
          />
        ))}
      </div>
    </div>
  );
}
