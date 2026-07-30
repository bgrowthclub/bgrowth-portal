import { supabase } from "./supabaseClient";
import type { ProductRow } from "@/types/database";

/**
 * Shared read access to the products catalog — used by the Home preview,
 * Trial Selection, and My Library features alike. Keep catalog reads here
 * rather than re-querying `products` ad hoc inside a feature.
 */
export const productService = {
  async fetchPublished(): Promise<ProductRow[]> {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("status", "published")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  /**
   * Trial-eligible AND actually configured with a length — a product can be
   * marked is_trial_eligible = true by a Studio publish that omitted
   * trialDuration (not yet possible from Studio's UI as of this writing),
   * and offering that product here would let a member pick a trial
   * licenseService.activateTrial() can't actually compute an expiry for.
   */
  async fetchTrialEligible(): Promise<ProductRow[]> {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("status", "published")
      .eq("is_trial_eligible", true)
      .not("trial_duration", "is", null)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async fetchBySlug(slug: string): Promise<ProductRow | null> {
    const { data, error } = await supabase.from("products").select("*").eq("slug", slug).maybeSingle();
    if (error) throw error;
    return data;
  },

  /** Home's "Continue Learning" rail: looks up the handful of products behind a member's in-progress workspace_instances. */
  async fetchByIds(ids: string[]): Promise<ProductRow[]> {
    if (ids.length === 0) return [];
    const { data, error } = await supabase.from("products").select("*").in("id", ids);
    if (error) throw error;
    return data ?? [];
  },

  /**
   * My Library's product list: every published Workspace, PLUS any
   * Workspace the member holds a license for regardless of its current
   * status — an archived Workspace a member already owns must keep
   * showing up here (see supabase/migrations/0016_products_owner_visibility.sql
   * for the matching RLS change this depends on; without both, an
   * archived-but-owned Workspace silently disappears from My Library).
   * `fetchPublished()` alone can't do this — its explicit
   * `status = 'published'` filter excludes an owned-but-archived row
   * regardless of what RLS additionally allows the session to see.
   */
  async fetchForLibrary(licensedProductIds: string[]): Promise<ProductRow[]> {
    let query = supabase.from("products").select("*");
    query =
      licensedProductIds.length > 0
        ? query.or(`status.eq.published,id.in.(${licensedProductIds.join(",")})`)
        : query.eq("status", "published");
    const { data, error } = await query.order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
};
