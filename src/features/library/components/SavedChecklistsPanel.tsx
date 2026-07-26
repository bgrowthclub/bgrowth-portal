import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Plus } from "lucide-react";
import type { WorkspaceWithAccess } from "@/types/workspace";
import type { WorkspaceInstanceRow } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { PromptDialog } from "@/components/ui/PromptDialog";
import { workspaceInstanceService } from "@/services/workspaceInstanceService";
import { SavedChecklistCard } from "./SavedChecklistCard";

interface SavedChecklistsPanelProps {
  workspace: WorkspaceWithAccess;
  userId: string;
  /** This Workspace's saved checklist instances only — MyLibraryPage groups the full list by product before passing it down. */
  instances: WorkspaceInstanceRow[];
}

/**
 * The right-hand column of a Library row — every saved, named record of
 * this specific owned Workspace, each as its own card, plus starting a new
 * one. Only ever rendered for Workspaces the member can actually open
 * (see MyLibraryPage) — an expired trial can't start a new instance
 * (mirrors the RLS insert policy's active-license check).
 */
export function SavedChecklistsPanel({ workspace, userId, instances }: SavedChecklistsPanelProps) {
  const navigate = useNavigate();
  const [isNaming, setIsNaming] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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
    <div className="card flex h-full flex-col gap-5 p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
          Saved Checklists
          <span className="ml-1.5 font-normal text-navy-400 dark:text-white/40">({instances.length})</span>
        </h3>
        <Button size="sm" onClick={() => setIsNaming(true)}>
          <Plus className="h-4 w-4" />
          New Checklist
        </Button>
      </div>

      {createError && (
        <p role="alert" className="text-xs text-red-500">
          {createError}
        </p>
      )}

      {instances.length > 0 ? (
        <div className="flex flex-col gap-3">
          {instances.map((instance) => (
            <SavedChecklistCard
              key={instance.id}
              instance={instance}
              workspaceSlug={workspace.slug}
              content={workspace.content}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-navy-200 px-6 py-12 text-center dark:border-white/15">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ClipboardList className="h-6 w-6" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium text-navy-500 dark:text-white/60">No saved checklists yet.</p>
            <p className="text-xs text-navy-400 dark:text-white/40">
              Create your first checklist to start tracking your progress.
            </p>
          </div>
          <Button size="sm" onClick={() => setIsNaming(true)}>
            <Plus className="h-4 w-4" />
            New Checklist
          </Button>
        </div>
      )}

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
