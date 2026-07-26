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

  async saveData(instanceId: string, data: Record<string, unknown>): Promise<void> {
    const { error } = await supabase
      .from("workspace_instances")
      .update({ data, updated_at: new Date().toISOString() })
      .eq("id", instanceId);
    if (error) throw error;
  },
};
