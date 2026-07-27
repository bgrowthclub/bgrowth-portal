import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";
import { requirePublishingEngineAuth } from "../_lib/requirePublishingEngineAuth.js";
import { pruneOldAssets } from "../_lib/pruneOldAssets.js";

const archiveRequestSchema = z.object({
  studioProductId: z.string().min(1),
  publishedBy: z.string().min(1),
});

/**
 * Archive (Unpublish) — the Publishing Engine's other write path besides
 * publish. Deliberately a separate, narrow endpoint rather than "call
 * /publish with status: 'archived'": archiving only ever needs the
 * product's stable id, never its full content/pricing/trial payload (see
 * portal.archive_product() in supabase/migrations/0015_asset_lifecycle.sql
 * for why reusing the general publish path here would be unsafe). Same
 * shared-secret auth as /publish.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-publishing-engine-secret");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    if (!requirePublishingEngineAuth(req, res)) return;

    const parsed = archiveRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ ok: false, error: "Invalid archive payload", issues: parsed.error.issues });
    }
    const payload = parsed.data;

    const supabase = getSupabaseAdmin();

    const { data: product, error } = await supabase.rpc("archive_product", {
      p_studio_product_id: payload.studioProductId,
      p_published_by: payload.publishedBy,
    });

    if (error) throw error;

    // Same retention-window cleanup as a normal publish — only runs after
    // the archive itself has already committed. See api/_lib/pruneOldAssets.ts.
    await pruneOldAssets(supabase, product.id);

    return res.status(200).json({
      ok: true,
      product: {
        id: product.id,
        slug: product.slug,
        status: product.status,
        version: product.current_version,
      },
    });
  } catch (err) {
    console.error("[publishing-engine/archive] unhandled error:", err);
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
