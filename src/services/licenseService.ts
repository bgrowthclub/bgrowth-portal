import { supabase } from "./supabaseClient";
import type { LicenseRow } from "@/types/database";
import type { LicenseWithProduct } from "@/types/workspace";

const TRIAL_DURATION_DAYS = 14;

/**
 * Shared license read/write access — used by Trial Selection (creates the
 * one-time trial license) and My Library (reads ownership state) alike.
 */
export const licenseService = {
  async fetchForUser(userId: string): Promise<LicenseRow[]> {
    const { data, error } = await supabase
      .from("licenses")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async fetchForUserWithProduct(userId: string): Promise<LicenseWithProduct[]> {
    const { data, error } = await supabase
      .from("licenses")
      .select("*, products(name, slug, cover_image_url)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as LicenseWithProduct[]) ?? [];
  },

  async hasUsedTrial(userId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from("licenses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("type", "trial");
    if (error) throw error;
    return (count ?? 0) > 0;
  },

  /**
   * Creates the member's one-time trial license. The database also enforces
   * "one trial per user, ever" via a partial unique index — this call still
   * pre-checks so the UI can show a clean error instead of a raw DB conflict.
   */
  async activateTrial(userId: string, productId: string): Promise<LicenseRow> {
    const alreadyUsed = await licenseService.hasUsedTrial(userId);
    if (alreadyUsed) {
      throw new Error("You've already activated your one free trial Workspace.");
    }

    const activatedAt = new Date();
    const expiresAt = new Date(activatedAt.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from("licenses")
      .insert({
        user_id: userId,
        product_id: productId,
        type: "trial",
        status: "active",
        activated_at: activatedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
