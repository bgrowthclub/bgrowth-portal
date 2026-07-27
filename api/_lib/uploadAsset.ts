import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database";

// Must match the bucket created in supabase/migrations/0004_publishing_engine_storage.sql —
// renamed to portal-product-assets when this database became shared with the
// BGrowth Academy LMS (bucket ids are a global namespace, not schema-scoped).
// Exported so api/_lib/pruneOldAssets.ts targets the exact same bucket
// rather than re-declaring the string a second place.
export const PRODUCT_ASSETS_BUCKET = "portal-product-assets";

interface UploadInput {
  studioProductId: string;
  pathPrefix: string; // e.g. "covers", "pdfs", "social"
  base64: string; // may include a data: URL prefix
  mimeType: string;
  fileExtension: string;
}

export interface UploadedAsset {
  url: string;
  /** The bucket-relative path — needed later to actually delete the object (a public URL alone doesn't cleanly decompose back into one); see portal.published_assets.storage_path. */
  path: string;
  sizeBytes: number;
}

/** Uploads a base64-encoded asset to Supabase Storage and returns its public URL, storage path, and byte size. */
export async function uploadAssetToStorage(
  supabase: SupabaseClient<Database>,
  { studioProductId, pathPrefix, base64, mimeType, fileExtension }: UploadInput,
): Promise<UploadedAsset> {
  const raw = base64.includes(",") ? base64.split(",")[1] : base64;
  const buffer = Buffer.from(raw, "base64");
  const path = `${pathPrefix}/${studioProductId}/${Date.now()}.${fileExtension}`;

  const { error } = await supabase.storage.from(PRODUCT_ASSETS_BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(PRODUCT_ASSETS_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path, sizeBytes: buffer.byteLength };
}
