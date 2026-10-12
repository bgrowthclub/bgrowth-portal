import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";
import { requirePublishingEngineAuth } from "../_lib/requirePublishingEngineAuth.js";
import { uploadAssetToStorage } from "../_lib/uploadAsset.js";
import { generateWelcomePdf } from "../_lib/generateWelcomePdf.js";
import { pruneOldAssets } from "../_lib/pruneOldAssets.js";
import { workspaceContentSchema } from "../../src/schemas/workspaceContent.schema.js";
import type { AssetType, ContentType, PublicationDestinationKey, PublicationStatus } from "../../src/types/database";

export const config = {
  api: {
    bodyParser: { sizeLimit: "20mb" }, // cover images arrive as base64
  },
  // Publishing now does real work beyond the database write — uploading a
  // cover image, generating the Welcome PDF (font embedding, a cover-image
  // fetch, QR generation), and uploading that — which can add up past
  // Vercel's default function timeout under cold start or slow network
  // conditions. 60s is the maximum Hobby-tier serverless functions
  // support; Pro/Enterprise projects get the same ceiling here but could
  // raise it further if ever needed.
  maxDuration: 60,
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
 * "workspace" has the full schema (src/schemas/workspaceContent.schema.ts);
 * "calculator" (Studio's Calculator Engine, sold on the Website and here) checks
 * the parts the calculator screen runs on and keeps the rest as sent.
 * Any other content_type is rejected with a clear error rather than
 * silently accepted as opaque JSON.
 */
const calculatorContentSchema = z
  .object({
    productId: z.string().min(1),
    name: z.string().min(1),
    sections: z
      .array(
        z
          .object({
            id: z.string().min(1),
            title: z.string(),
            fields: z.array(z.object({ id: z.string().min(1), label: z.string(), type: z.string() }).passthrough()),
          })
          .passthrough(),
      )
      .min(1),
    formulas: z.array(z.object({ id: z.string().min(1), expression: z.string(), variables: z.array(z.string()) }).passthrough()),
    results: z.array(z.object({ id: z.string().min(1), label: z.string(), formulaId: z.string().min(1) }).passthrough()).min(1),
  })
  .passthrough();

const contentSchemasByType: Partial<Record<ContentType, z.ZodTypeAny>> = {
  workspace: workspaceContentSchema,
  calculator: calculatorContentSchema,
};

const publishRequestSchema = z.object({
  studioProductId: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  shortDescription: z.string().min(1),
  contentType: z.enum(CONTENT_TYPES as [ContentType, ...ContentType[]]).default("workspace"),
  contentVersion: z.number().int().positive().default(1),
  categorySlug: z.string().nullable().optional(),
  // The product's tags (migration 0048). Omitted = leave its tags as they
  // are (e.g. set in the Website's Admin); [] = no tags.
  tags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  // Product page gallery (migration 0050). Omitted = keep the current one.
  gallery: z
    .object({
      images: z.array(z.string().url().startsWith("https://")).max(6),
      video: z.object({ kind: z.enum(["link", "file"]), url: z.string().url().startsWith("https://") }).nullable(),
    })
    .optional(),
  metadata: z.record(z.unknown()).default({}),
  content: z.unknown(),
  status: z.enum(STATUSES as [PublicationStatus, ...PublicationStatus[]]),
  destinationKey: z.enum(DESTINATIONS as [PublicationDestinationKey, ...PublicationDestinationKey[]]).default("portal"),
  publishedBy: z.string().min(1),
  changeNotes: z.string().nullable().optional(),
  isTrialEligible: z.boolean().default(true),
  // Per-Workspace trial length — not a Portal-wide constant. null/omitted
  // means "not configured yet"; the Portal falls back to hiding trial
  // messaging for this product rather than assuming a duration.
  trialDuration: z.number().int().positive().nullable().optional(),
  trialUnit: z.enum(["days"]).default("days"),
  coverImage: imageInputSchema.optional(),
  assets: z.array(assetInputSchema).default([]),
  isFree: z.boolean().default(false),
  // Required whenever isFree is false — checked explicitly below rather
  // than left to the RPC's own guard, so a bad payload gets a clear 422
  // instead of a raw Postgres exception surfacing as a 500.
  priceCents: z.number().int().nonnegative().nullable().optional(),
  currency: z.string().default("usd"),
  // Nullable — Studio doesn't create real Stripe Price objects yet; the
  // checkout endpoint falls back to dynamic price_data from priceCents/currency.
  stripePriceId: z.string().nullable().optional(),
});

// Same rule as portal.tag_slug() (migration 0048) and the Website's
// api/admin.ts: lower case, no accents, words joined by "-".
function tagSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Replace a product's tags with these names, reusing tags from the list.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncProductTags(supabase: any, productId: string, names: string[]) {
  const wanted = new Map<string, string>();
  for (const name of names) {
    const slug = tagSlug(name);
    if (slug && !wanted.has(slug)) wanted.set(slug, name.trim());
  }
  const slugs = [...wanted.keys()];
  if (slugs.length) {
    const { error: upsertError } = await supabase
      .from("tags")
      .upsert(slugs.map((slug) => ({ slug, name: wanted.get(slug), source: "studio" })), { onConflict: "slug", ignoreDuplicates: true });
    if (upsertError) throw upsertError;
  }
  const { data: rows, error: readError } = slugs.length
    ? await supabase.from("tags").select("id").in("slug", slugs)
    : { data: [], error: null };
  if (readError) throw readError;
  const { error: clearError } = await supabase.from("product_tags").delete().eq("product_id", productId);
  if (clearError) throw clearError;
  if (rows?.length) {
    const { error: linkError } = await supabase
      .from("product_tags")
      .insert(rows.map((r: { id: string }) => ({ product_id: productId, tag_id: r.id })));
    if (linkError) throw linkError;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-publishing-engine-secret");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  // Everything from here down is wrapped in one try/catch — including
  // getSupabaseAdmin() below, which throws a plain Error if
  // SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY aren't configured on this
  // deployment. That throw used to sit outside this block, which crashed
  // the whole function invocation (Vercel's FUNCTION_INVOCATION_FAILED)
  // instead of returning a normal JSON error response.
  try {
    if (!requirePublishingEngineAuth(req, res)) return;

    const parsed = publishRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ ok: false, error: "Invalid publish payload", issues: parsed.error.issues });
    }
    const payload = parsed.data;

    if (!payload.isFree && payload.priceCents == null) {
      return res.status(422).json({ ok: false, error: "priceCents is required when isFree is false" });
    }

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

    let coverImageUrl: string | null = null;
    let coverImageStoragePath: string | null = null;
    let coverImageSizeBytes: number | null = null;
    if (payload.coverImage) {
      if ("url" in payload.coverImage) {
        coverImageUrl = payload.coverImage.url;
      } else {
        const uploaded = await uploadAssetToStorage(supabase, {
          studioProductId: payload.studioProductId,
          pathPrefix: "covers",
          base64: payload.coverImage.base64,
          mimeType: payload.coverImage.mimeType,
          fileExtension: payload.coverImage.fileExtension,
        });
        coverImageUrl = uploaded.url;
        coverImageStoragePath = uploaded.path;
        coverImageSizeBytes = uploaded.sizeBytes;
      }
    }

    // Generating the Welcome Guide is best-effort, not part of the
    // critical path: a bad cover image, a slow/unreachable fetch, or any
    // other hiccup in PDF generation must never fail the whole publish —
    // a Workspace with no Welcome PDF is a minor gap; a Workspace that
    // fails to publish at all is not. Everything in this block is
    // isolated in its own try/catch specifically so a failure here can't
    // surface as an unhandled crash in the handler's outer catch either.
    let welcomePdfUrl: string | null = null;
    let welcomePdfStoragePath: string | null = null;
    let welcomePdfSizeBytes: number | null = null;
    // The Welcome Guide is a Workspace thing — a calculator has none.
    if (payload.contentType === "workspace") try {
      // Mirrors publish_product()'s own version computation exactly (see
      // supabase/migrations/0010_welcome_pdf.sql: `current_version + 1`,
      // or 1 for a first-ever publish) so the Welcome PDF's version stamp
      // matches what the RPC call below is about to write — computed
      // here, ahead of that call, since PDF generation needs to happen
      // before we have the asset URL to pass into it.
      const { data: existingProduct, error: existingProductError } = await supabase
        .from("products")
        .select("current_version")
        .eq("studio_product_id", payload.studioProductId)
        .maybeSingle();
      if (existingProductError) throw existingProductError;
      const workspaceVersion = (existingProduct?.current_version ?? 0) + 1;

      // Only "workspace" reaches this point (guarded above), so
      // contentResult.data is safe to treat as WorkspaceContent here.
      const welcomePdfBytes = await generateWelcomePdf({
        productName: payload.name,
        productSlug: payload.slug,
        shortDescription: payload.shortDescription,
        metadata: payload.metadata,
        content: contentResult.data as z.infer<typeof workspaceContentSchema>,
        coverImageUrl,
        trialDuration: payload.trialDuration ?? null,
        trialUnit: payload.trialUnit,
        workspaceVersion,
        publishedAt: new Date(),
      });
      const uploaded = await uploadAssetToStorage(supabase, {
        studioProductId: payload.studioProductId,
        pathPrefix: "welcome_pdf",
        base64: Buffer.from(welcomePdfBytes).toString("base64"),
        mimeType: "application/pdf",
        fileExtension: "pdf",
      });
      welcomePdfUrl = uploaded.url;
      welcomePdfStoragePath = uploaded.path;
      welcomePdfSizeBytes = uploaded.sizeBytes;
    } catch (welcomePdfError) {
      console.error("[publishing-engine/publish] Welcome PDF generation failed, publishing without it:", welcomePdfError);
      welcomePdfUrl = null;
      welcomePdfStoragePath = null;
      welcomePdfSizeBytes = null;
    }

    const resolvedAssets = await Promise.all(
      payload.assets.map(async (asset) => {
        if (asset.url) return { assetType: asset.assetType, url: asset.url, mimeType: asset.mimeType, metadata: asset.metadata };
        if (asset.base64) {
          const uploaded = await uploadAssetToStorage(supabase, {
            studioProductId: payload.studioProductId,
            pathPrefix: asset.assetType,
            base64: asset.base64,
            mimeType: asset.mimeType ?? "application/octet-stream",
            fileExtension: asset.fileExtension ?? "bin",
          });
          return {
            assetType: asset.assetType,
            url: uploaded.url,
            storagePath: uploaded.path,
            sizeBytes: uploaded.sizeBytes,
            mimeType: asset.mimeType,
            metadata: asset.metadata,
          };
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
      p_trial_duration: payload.trialDuration ?? null,
      p_trial_unit: payload.trialUnit,
      p_welcome_pdf_url: welcomePdfUrl,
      p_is_free: payload.isFree,
      p_price_cents: payload.priceCents ?? null,
      p_currency: payload.currency,
      p_stripe_price_id: payload.stripePriceId ?? null,
      p_cover_image_storage_path: coverImageStoragePath,
      p_cover_image_size_bytes: coverImageSizeBytes,
      p_welcome_pdf_storage_path: welcomePdfStoragePath,
      p_welcome_pdf_size_bytes: welcomePdfSizeBytes,
    });

    if (error) throw error;

    // Tags (migration 0048): the same list the Website's Admin manages — a
    // name that already exists (same key: case/accents/spaces ignored) is
    // reused, a new one joins the list. Best-effort: the publish above
    // already succeeded.
    if (payload.tags) {
      try {
        await syncProductTags(supabase, product.id, payload.tags);
      } catch (tagError) {
        console.error("[publishing-engine/publish] tags not saved:", tagError);
      }
    }

    // Gallery (migration 0050) — same best-effort rule as the tags.
    if (payload.gallery) {
      const { error: galleryError } = await supabase
        .from("products")
        .update({ gallery: payload.gallery })
        .eq("id", product.id);
      if (galleryError) console.error("[publishing-engine/publish] gallery not saved:", galleryError);
    }

    // The BGrowth Website (bgrowth.app) reads the same `portal` schema as the
    // Portal, so a Portal publish is live on the Website too. Record that in
    // the per-destination ledger as its own 'website' row, so the ledger
    // matches reality and the Website keeps its record once the Portal is
    // retired. Best-effort: the publish above already succeeded.
    if (payload.destinationKey === "portal") {
      const { data: website, error: websiteError } = await supabase
        .from("publication_destinations")
        .select("id")
        .eq("key", "website")
        .maybeSingle();
      const { error: ledgerError } = website
        ? await supabase.from("product_destinations").upsert(
            {
              product_id: product.id,
              destination_id: website.id,
              status: payload.status,
              published_version: product.current_version,
              last_published_at: product.last_published_at,
              last_published_by: payload.publishedBy,
            },
            { onConflict: "product_id,destination_id" },
          )
        : { error: websiteError };
      if (ledgerError) console.error("[publishing-engine/publish] website ledger row failed:", ledgerError);
    }

    // Retention-window cleanup — only ever runs AFTER the new version above
    // has already committed successfully, so the previous assets are never
    // removed until their replacement genuinely exists. Best-effort: logs
    // and continues on failure rather than failing a publish that already
    // succeeded (see api/_lib/pruneOldAssets.ts).
    await pruneOldAssets(supabase, product.id);

    return res.status(200).json({
      ok: true,
      product: {
        id: product.id,
        slug: product.slug,
        status: product.status,
        version: product.current_version,
        coverImageUrl: product.cover_image_url,
        welcomePdfUrl: product.welcome_pdf_url,
        isFree: product.is_free,
        priceCents: product.price_cents,
        currency: product.currency,
        // Authoritative publish timestamp — Studio records this as its own
        // PublishingMetadata.publishedAt instead of a client-side Date.now(),
        // so it matches what the Portal actually stored.
        publishedAt: product.last_published_at,
      },
    });
  } catch (err) {
    // Logged server-side unconditionally (visible in Vercel's function logs)
    // regardless of what the response body includes.
    console.error("[publishing-engine/publish] unhandled error:", err);

    const isDev = process.env.NODE_ENV !== "production";
    const message = err instanceof Error ? err.message : String(err);

    return res.status(500).json({
      ok: false,
      error: message,
      ...(isDev && err instanceof Error && err.stack ? { stack: err.stack } : {}),
    });
  }
}
