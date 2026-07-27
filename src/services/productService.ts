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
};
