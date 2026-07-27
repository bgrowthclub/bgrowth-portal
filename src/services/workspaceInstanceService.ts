import { supabase } from "./supabaseClient";
import type { WorkspaceInstanceRow } from "@/types/database";

/**
 * Shared read/write access for saved Workspace instances (multiple named,
 * filled-in records of one owned Workspace — e.g. one checklist per
 * client). Same plain-client-query shape as licenseService; RLS (see
 * supabase/migrations/0008_workspace_instances.sql) enforces a member can
 * only ever see/create/update their own rows, and only for a Workspace
 * they hold an active license for.
 */
export const workspaceInstanceService = {
  async listForUser(userId: string): Promise<WorkspaceInstanceRow[]> {
    const { data, error } = await supabase
      .from("workspace_instances")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async fetchById(instanceId: string): Promise<WorkspaceInstanceRow | null> {
    const { data, error } = await supabase.from("workspace_instances").select("*").eq("id", instanceId).maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(userId: string, productId: string, label: string): Promise<WorkspaceInstanceRow> {
    const { data, error } = await supabase
      .from("workspace_instances")
      .insert({ user_id: userId, product_id: productId, label })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * `.select()` on the update (not the default) so a zero-row match — RLS
   * silently filtering it out, or a stale/bad id — surfaces as a thrown
   * error instead of a silent no-op; Supabase/PostgREST returns `error: null`
   * for an UPDATE that touches zero rows, indistinguishable from success
   * without checking the returned rows explicitly.
   */
  async saveData(instanceId: string, data: Record<string, unknown>): Promise<void> {
    const { data: updatedRows, error } = await supabase
      .from("workspace_instances")
      .update({ data, updated_at: new Date().toISOString() })
      .eq("id", instanceId)
      .select();

    if (error) throw error;

    if (!updatedRows || updatedRows.length === 0) {
      throw new Error(`Save failed silently: no workspace_instances row matched id ${instanceId} (0 rows updated).`);
    }
  },
};
