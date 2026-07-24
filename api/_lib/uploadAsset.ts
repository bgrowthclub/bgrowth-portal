import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database";

const BUCKET = "product-assets";

interface UploadInput {
  studioProductId: string;
  pathPrefix: string; // e.g. "covers", "pdfs", "social"
  base64: string; // may include a data: URL prefix
  mimeType: string;
  fileExtension: string;
}

/** Uploads a base64-encoded asset to Supabase Storage and returns its public URL. */
export async function uploadAssetToStorage(
  supabase: SupabaseClient<Database>,
  { studioProductId, pathPrefix, base64, mimeType, fileExtension }: UploadInput,
): Promise<string> {
  const raw = base64.includes(",") ? base64.split(",")[1] : base64;
  const buffer = Buffer.from(raw, "base64");
  const path = `${pathPrefix}/${studioProductId}/${Date.now()}.${fileExtension}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
