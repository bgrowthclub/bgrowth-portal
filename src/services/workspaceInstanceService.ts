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
   * TEMPORARY DIAGNOSTIC INSTRUMENTATION — tracing the "partial saves lost"
   * report. Adds .select() (normally omitted) so we can see how many rows
   * the UPDATE actually touched, since Supabase/PostgREST returns
   * error: null for an UPDATE that matches zero rows (RLS filtering it out,
   * or a bad id) — indistinguishable from success without this. Remove
   * once the root cause is confirmed; this is not the permanent fix.
   */
  async saveData(instanceId: string, data: Record<string, unknown>): Promise<void> {
    console.log("[DIAGNOSTIC saveData] instanceId:", instanceId);
    console.log("[DIAGNOSTIC saveData] data being sent:", JSON.stringify(data));

    const { data: updatedRows, error } = await supabase
      .from("workspace_instances")
      .update({ data, updated_at: new Date().toISOString() })
      .eq("id", instanceId)
      .select();

    console.log("[DIAGNOSTIC saveData] rows returned by UPDATE:", JSON.stringify(updatedRows));

    if (error) {
      console.error("[DIAGNOSTIC saveData] Supabase returned an error:", error);
      throw error;
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.error(
        "[DIAGNOSTIC saveData] UPDATE matched ZERO rows — nothing was saved, despite no Supabase error. " +
          "This means the row with id", instanceId, "either doesn't exist, or the RLS policy's " +
          "auth.uid() = user_id check didn't match for the current session.",
      );
      throw new Error(
        `Save failed silently: no workspace_instances row matched id ${instanceId} (0 rows updated).`,
      );
    }

    console.log("[DIAGNOSTIC saveData] Saved row after update:", JSON.stringify(updatedRows[0]));
  },
};
