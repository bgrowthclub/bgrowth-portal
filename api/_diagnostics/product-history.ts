import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";

/**
 * TEMP DIAGNOSTIC ONLY — not a permanent route, remove after use.
 *
 * Tracing where "notary-commission-workspace" comes from. product_versions
 * has no client-readable RLS policy at all (service-role only, by design —
 * see README's Database schema section), so the browser session can never
 * see a product's publish history on its own, no matter how the client
 * code is instrumented. This route exists purely to surface that
 * service-role-only data back to the browser for logging, via the same
 * getSupabaseAdmin() pattern already used by the Publishing Engine routes —
 * still "through the application," just server-side.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const supabase = getSupabaseAdmin();

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, studio_product_id, slug, name, status, current_version, last_published_at, created_at")
      .or("slug.ilike.%notary%,name.ilike.%notary%");
    if (productsError) throw productsError;

    const productIds = (products ?? []).map((p) => p.id);

    const { data: versions, error: versionsError } = productIds.length
      ? await supabase
          .from("product_versions")
          .select("id, product_id, version, status, name, short_description, published_by, change_notes, created_at")
          .in("product_id", productIds)
          .order("product_id", { ascending: true })
          .order("version", { ascending: true })
      : { data: [] as unknown[], error: null };
    if (versionsError) throw versionsError;

    const { data: catalogRows, error: catalogError } = productIds.length
      ? await supabase.from("catalog_index").select("*").in("product_id", productIds)
      : { data: [] as unknown[], error: null };
    if (catalogError) throw catalogError;

    const { data: destinations, error: destinationsError } = productIds.length
      ? await supabase
          .from("product_destinations")
          .select("id, product_id, destination_id, status, external_id, published_version, last_published_at")
          .in("product_id", productIds)
      : { data: [] as unknown[], error: null };
    if (destinationsError) throw destinationsError;

    return res.status(200).json({
      ok: true,
      products: products ?? [],
      product_versions: versions ?? [],
      catalog_index: catalogRows ?? [],
      product_destinations: destinations ?? [],
    });
  } catch (err) {
    console.error("[DIAGNOSTIC product-history] error:", err);
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
