import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database";
import { PRODUCT_ASSETS_BUCKET } from "./uploadAsset.js";

/**
 * Retention-window cleanup: after a publish or archive has already
 * succeeded, deletes the Storage objects for any asset older than the
 * current version minus one (i.e. keeps only the current and previous
 * version's assets downloadable) — never anything from the version that
 * was just created. The portal.published_assets ROWS are never deleted,
 * only the underlying Storage object; see
 * supabase/migrations/0015_asset_lifecycle.sql for why (they remain the
 * audit trail that the asset existed, even once its url 404s).
 *
 * Deliberately never throws — this always runs after the thing that
 * actually matters (the publish/archive itself) has already committed.
 * A failure here is logged and otherwise ignored; the next successful
 * publish/archive for this product will retry the same prune (anything
 * not yet deleted stays eligible), so a transient failure here is never
 * permanent data loss, just a delayed cleanup.
 */
export async function pruneOldAssets(supabase: SupabaseClient<Database>, productId: string): Promise<void> {
  try {
    const { data: prunable, error: selectError } = await supabase.rpc("get_prunable_assets", {
      p_product_id: productId,
    });
    if (selectError) throw selectError;
    if (!prunable || prunable.length === 0) return;

    const paths = prunable.map((asset) => asset.storage_path).filter((path): path is string => Boolean(path));
    if (paths.length === 0) return;

    const { error: removeError } = await supabase.storage.from(PRODUCT_ASSETS_BUCKET).remove(paths);
    if (removeError) throw removeError;

    const ids = prunable.map((asset) => asset.id);
    const { error: markError } = await supabase.rpc("mark_assets_deleted", { p_asset_ids: ids });
    if (markError) throw markError;

    console.log(`[pruneOldAssets] removed ${paths.length} superseded asset(s) for product ${productId}:`, paths);
  } catch (err) {
    console.error(`[pruneOldAssets] cleanup failed for product ${productId} (publish/archive itself is unaffected):`, err);
  }
}
