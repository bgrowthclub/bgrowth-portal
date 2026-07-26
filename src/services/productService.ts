import { supabase } from "./supabaseClient";
import type { ProductRow } from "@/types/database";

/**
 * Shared read access to the products catalog — used by the Home preview,
 * Trial Selection, and My Library features alike. Keep catalog reads here
 * rather than re-querying `products` ad hoc inside a feature.
 */
export const productService = {
  // TEMP DIAGNOSTIC — tracing why the browser requests notary-commission-workspace.
  // Logs every published product's identity fields so we can see, straight from
  // the live database via the app's own (RLS-scoped) read, exactly what slug this
  // member's session actually gets back. Remove once confirmed.
  async fetchPublished(): Promise<ProductRow[]> {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("status", "published")
      .order("created_at", { ascending: true });
    if (error) throw error;
    const products = data ?? [];
    console.log(
      "[DIAGNOSTIC fetchPublished] published products:",
      JSON.stringify(
        products.map((p) => ({
          id: p.id,
          studio_product_id: p.studio_product_id,
          slug: p.slug,
          name: p.name,
          current_version: p.current_version,
          status: p.status,
        })),
        null,
        2,
      ),
    );
    const notaryLike = products.filter((p) => /notary/i.test(p.slug) || /notary/i.test(p.name));
    if (notaryLike.length === 0) {
      console.warn("[DIAGNOSTIC fetchPublished] No published product matched /notary/i at all.");
    } else {
      console.log(
        "[DIAGNOSTIC fetchPublished] Notary-like product(s):",
        JSON.stringify(notaryLike.map((p) => ({ id: p.id, slug: p.slug, name: p.name, current_version: p.current_version })), null, 2),
      );
    }
    return products;
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
