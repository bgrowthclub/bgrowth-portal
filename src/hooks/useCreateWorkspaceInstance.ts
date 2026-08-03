import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { workspaceInstanceService } from "@/services/workspaceInstanceService";

interface UseCreateWorkspaceInstanceArgs {
  userId: string;
  productId: string;
  workspaceSlug: string;
}

/**
 * The one New Fill creation flow in the app — naming dialog state,
 * workspaceInstanceService.create(), then navigate straight into the new
 * instance. Originally owned solely by SavedChecklistsPanel (My Library);
 * extracted here so the Workspace Viewer's own New Fill entry point reuses
 * the exact same behavior instead of a second implementation.
 */
export function useCreateWorkspaceInstance({ userId, productId, workspaceSlug }: UseCreateWorkspaceInstanceArgs) {
  const navigate = useNavigate();
  const [isNaming, setIsNaming] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreateInstance(label: string) {
    setIsCreating(true);
    setCreateError(null);
    try {
      const instance = await workspaceInstanceService.create(userId, productId, label);
      setIsNaming(false);
      navigate(`/workspace/${workspaceSlug}?instance=${instance.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Couldn't create that checklist. Please try again.");
    } finally {
      setIsCreating(false);
    }
  }

  return { isNaming, setIsNaming, isCreating, createError, handleCreateInstance };
}
