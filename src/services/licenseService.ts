import { supabase } from "./supabaseClient";
import type { LicenseRow, ProductRow } from "@/types/database";
import type { LicenseWithProduct } from "@/types/workspace";
import { addTrialDuration } from "@/lib/trial";

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

  /**
   * Reads the immutable-once-true users.has_used_trial flag, set by a
   * database trigger the moment any trial license is ever inserted (see
   * supabase/migrations/0013_trial_usage_tracking.sql) — NOT a count of
   * current type = 'trial' license rows, since a purchase upgrades that
   * same row's type to 'purchased' in place (grant_purchased_license()),
   * which would otherwise make a used trial invisible to this check.
   */
  async hasUsedTrial(userId: string): Promise<boolean> {
    const { data, error } = await supabase.from("users").select("has_used_trial").eq("id", userId).maybeSingle();
    if (error) throw error;
    return data?.has_used_trial ?? false;
  },

  /**
   * Creates the member's one-time trial license. The database also enforces
   * "one trial per user, ever" via a partial unique index — this call still
   * pre-checks so the UI can show a clean error instead of a raw DB conflict.
   *
   * Trial length is read from the Workspace itself (product.trial_duration/
   * trial_unit), not a global constant — two Workspaces can have different
   * trial lengths, or none at all. Callers are expected to only offer trial
   * activation for products where is_trial_eligible is true and
   * trial_duration is set (see productService.fetchTrialEligible).
   */
  async activateTrial(
    userId: string,
    product: Pick<ProductRow, "id" | "name" | "trial_duration" | "trial_unit">,
  ): Promise<LicenseRow> {
    const alreadyUsed = await licenseService.hasUsedTrial(userId);
    if (alreadyUsed) {
      throw new Error("You've already activated your one free trial Workspace.");
    }

    if (product.trial_duration == null) {
      throw new Error(`${product.name} isn't configured for a free trial.`);
    }

    const activatedAt = new Date();
    const expiresAt = addTrialDuration(activatedAt, product.trial_duration, product.trial_unit);

    const { data, error } = await supabase
      .from("licenses")
      .insert({
        user_id: userId,
        product_id: product.id,
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

  /**
   * My Library's Favorites filter. Self-service — RLS + a column-scoped
   * grant (see 0019_library_favorites_and_last_opened.sql) let a member
   * update only this column (and last_opened_at below) on their own
   * license row; every other column stays server-write-only.
   */
  async toggleFavorite(licenseId: string, isFavorite: boolean): Promise<void> {
    const { error } = await supabase.from("licenses").update({ is_favorite: isFavorite }).eq("id", licenseId);
    if (error) throw error;
  },

  /** Called once per successful Workspace open (see WorkspaceViewerPage) — powers My Library's "Recently Opened" sort. */
  async recordOpened(licenseId: string): Promise<void> {
    const { error } = await supabase
      .from("licenses")
      .update({ last_opened_at: new Date().toISOString() })
      .eq("id", licenseId);
    if (error) throw error;
  },
};
