import { supabase } from "./supabaseClient";
import type { AccessGrantRow } from "@/types/database";

/**
 * Reads manual Access Grants — completely separate from licenseService
 * (Stripe purchases/trials). There is no self-service write path here by
 * design: grants are administered directly in Supabase (Phase 1) or, later,
 * through a Studio admin API backed by the service role — never by the
 * client. See portal.access_grants (supabase/migrations/0021_access_grants.sql).
 */
export const accessGrantService = {
  async fetchForUser(userId: string): Promise<AccessGrantRow[]> {
    const { data, error } = await supabase.from("access_grants").select("*").eq("user_id", userId);
    if (error) throw error;
    return data ?? [];
  },
};
