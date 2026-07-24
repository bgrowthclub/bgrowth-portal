import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getSupabaseAdmin } from "../_lib/supabaseAdmin";
import { requirePublishingEngineAuth } from "../_lib/requirePublishingEngineAuth";
import { uploadAssetToStorage } from "../_lib/uploadAsset";
import { workspaceContentSchema } from "../../src/schemas/workspaceContent.schema";
import type { AssetType, ContentType, PublicationDestinationKey, PublicationStatus } from "../../src/types/database";

export const config = {
  api: {
    bodyParser: { sizeLimit: "20mb" }, // cover images arrive as base64
  },
};

const CONTENT_TYPES: ContentType[] = [
  "workspace", "template", "document", "pdf", "course", "calculator", "ai_tool", "academy_lesson",
];
const STATUSES: PublicationStatus[] = ["draft", "ready_for_review", "approved", "published", "archived"];
const DESTINATIONS: PublicationDestinationKey[] = ["portal", "website", "etsy", "gumroad", "academy"];
const ASSET_TYPES: AssetType[] = [
  "workspace_json", "cover_image", "thumbnail", "welcome_pdf",
  "product_pdf", "social_image", "marketplace_image", "marketing_material",
];

const imageInputSchema = z.union([
  z.object({ url: z.string().url() }),
  z.object({ base64: z.string(), mimeType: z.string(), fileExtension: z.string().default("png") }),
]);

const assetInputSchema = z.object({
  assetType: z.enum(ASSET_TYPES as [AssetType, ...AssetType[]]),
  url: z.string().url().optional(),
  base64: z.string().optional(),
  mimeType: z.string().optional(),
  fileExtension: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Only "workspace" has a real content schema today (see
 * src/schemas/workspaceContent.schema.ts). Publishing any other content_type
 * is rejected with a clear error rather than silently accepted as opaque
 * JSON — the moment a second engine (e.g. Planner) has a real schema, add
 * its branch here.
 */
const contentSchemasByType: Partial<Record<ContentType, z.ZodTypeAny>> = {
  workspace: workspaceContentSchema,
};

const publishRequestSchema = z.object({
  studioProductId: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  shortDescription: z.string().min(1),
  contentType: z.enum(CONTENT_TYPES as [ContentType, ...ContentType[]]).default("workspace"),
  contentVersion: z.number().int().positive().default(1),
  categorySlug: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
  content: z.unknown(),
  status: z.enum(STATUSES as [PublicationStatus, ...PublicationStatus[]]),
  destinationKey: z.enum(DESTINATIONS as [PublicationDestinationKey, ...PublicationDestinationKey[]]).default("portal"),
  publishedBy: z.string().min(1),
  changeNotes: z.string().nullable().optional(),
  isTrialEligible: z.boolean().default(true),
  coverImage: imageInputSchema.optional(),
  assets: z.array(assetInputSchema).default([]),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-publishing-engine-secret");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  if (!requirePublishingEngineAuth(req, res)) return;

  const parsed = publishRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ ok: false, error: "Invalid publish payload", issues: parsed.error.issues });
  }
  const payload = parsed.data;

  const contentSchema = contentSchemasByType[payload.contentType];
  if (!contentSchema) {
    return res.status(501).json({
      ok: false,
      error: `content_type "${payload.contentType}" is not yet supported by the Publishing Engine — no validation schema exists for it.`,
    });
  }

  const contentResult = contentSchema.safeParse(payload.content);
  if (!contentResult.success) {
    return res.status(422).json({ ok: false, error: "Invalid content for contentType", issues: contentResult.error.issues });
  }

  const supabase = getSupabaseAdmin();

  try {
    let coverImageUrl: string | null = null;
    if (payload.coverImage) {
      coverImageUrl =
        "url" in payload.coverImage
          ? payload.coverImage.url
          : await uploadAssetToStorage(supabase, {
              studioProductId: payload.studioProductId,
              pathPrefix: "covers",
              base64: payload.coverImage.base64,
              mimeType: payload.coverImage.mimeType,
              fileExtension: payload.coverImage.fileExtension,
            });
    }

    const resolvedAssets = await Promise.all(
      payload.assets.map(async (asset) => {
        if (asset.url) return { assetType: asset.assetType, url: asset.url, mimeType: asset.mimeType, metadata: asset.metadata };
        if (asset.base64) {
          const url = await uploadAssetToStorage(supabase, {
            studioProductId: payload.studioProductId,
            pathPrefix: asset.assetType,
            base64: asset.base64,
            mimeType: asset.mimeType ?? "application/octet-stream",
            fileExtension: asset.fileExtension ?? "bin",
          });
          return { assetType: asset.assetType, url, mimeType: asset.mimeType, metadata: asset.metadata };
        }
        return { assetType: asset.assetType, metadata: asset.metadata };
      }),
    );

    const { data: product, error } = await supabase.rpc("publish_product", {
      p_studio_product_id: payload.studioProductId,
      p_slug: payload.slug,
      p_name: payload.name,
      p_short_description: payload.shortDescription,
      p_content: contentResult.data,
      p_status: payload.status,
      p_content_type: payload.contentType,
      p_content_version: payload.contentVersion,
      p_category_slug: payload.categorySlug ?? null,
      p_metadata: payload.metadata,
      p_cover_image_url: coverImageUrl,
      p_destination_key: payload.destinationKey,
      p_published_by: payload.publishedBy,
      p_change_notes: payload.changeNotes ?? null,
      p_is_trial_eligible: payload.isTrialEligible,
      p_assets: resolvedAssets,
    });

    if (error) throw error;

    return res.status(200).json({
      ok: true,
      product: {
        id: product.id,
        slug: product.slug,
        status: product.status,
        version: product.current_version,
        coverImageUrl: product.cover_image_url,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
