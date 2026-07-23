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
      .eq("is_published", true)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async fetchTrialEligible(): Promise<ProductRow[]> {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_published", true)
      .eq("is_trial_eligible", true)
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
