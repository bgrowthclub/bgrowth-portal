import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PromptDialog } from "@/components/ui/PromptDialog";
import { useCreateWorkspaceInstance } from "@/hooks/useCreateWorkspaceInstance";

interface NewFillButtonProps {
  userId: string;
  productId: string;
  workspaceSlug: string;
}

/**
 * The Workspace Viewer's own New Fill entry point — same creation flow
 * SavedChecklistsPanel (My Library) originally owned, via
 * useCreateWorkspaceInstance, so there's exactly one implementation.
 * WorkspaceViewerPage only renders this when the member already has real
 * access to this Workspace (see its own hasAccess) — no access logic lives
 * here. Rendering this button never creates an instance by itself; creation
 * only happens once the member names it and submits the dialog below.
 */
export function NewFillButton({ userId, productId, workspaceSlug }: NewFillButtonProps) {
  const { isNaming, setIsNaming, isCreating, createError, handleCreateInstance } = useCreateWorkspaceInstance({
    userId,
    productId,
    workspaceSlug,
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" onClick={() => setIsNaming(true)}>
        <Plus className="h-4 w-4" />
        New Fill
      </Button>
      {createError && (
        <p role="alert" className="text-xs text-red-500">
          {createError}
        </p>
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
