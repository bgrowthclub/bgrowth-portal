/**
 * Mirrors the Supabase schema defined in supabase/migrations/*.sql. Keep in
 * sync whenever the schema changes — this is the single source of truth for
 * row shapes used throughout the app.
 */

import type { WorkspaceContent } from "./workspaceContent";

/**
 * The commercial model a license represents — deliberately separate from
 * AccessPolicy (below), which answers a different question: does this
 * license expire. "subscription"/"enterprise" are reserved for later, not
 * created anywhere yet.
 */
export type LicenseType = "trial" | "purchased" | "subscription" | "enterprise";
export type LicenseStatus = "active" | "expired" | "revoked";
/** Whether a license's access expires by date at all — see deriveAccessState(). */
export type AccessPolicy = "expiring" | "lifetime";

/** Only "days" is supported today — adding a unit is a type + check-constraint change, nothing else. */
export type TrialUnit = "days";

/** Content types the BGrowth Publishing Engine can publish. Only "workspace" is real today. */
export type ContentType =
  | "workspace"
  | "template"
  | "document"
  | "pdf"
  | "course"
  | "calculator"
  | "ai_tool"
  | "academy_lesson";

/** Publishing workflow states. Only "draft"/"published" are driven today. */
export type PublicationStatus = "draft" | "ready_for_review" | "approved" | "published" | "archived";

export type PublicationDestinationKey = "portal" | "website" | "etsy" | "gumroad" | "academy";

export type AssetType =
  | "workspace_json"
  | "cover_image"
  | "thumbnail"
  | "welcome_pdf"
  | "product_pdf"
  | "social_image"
  | "marketplace_image"
  | "marketing_material";

// These are `type` aliases rather than `interface`s deliberately: Supabase's
// generic constraint chain checks each Row/Insert/Update shape against
// `Record<string, unknown>`, and TypeScript only grants the implicit index
// signature that check relies on to object type literals/aliases, not to
// named interfaces — using `interface` here silently degrades every query
// built on this Database type to `never`.
export type WorkspaceCategoryRow = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  created_at: string;
};

export type ProductRow = {
  id: string;
  /** Stable id from BGrowth Studio — the Publishing Engine's upsert key. Null for non-Studio products. */
  studio_product_id: string | null;
  slug: string;
  name: string;
  short_description: string;
  cover_image_url: string | null;
  category_id: string | null;
  app_url: string | null;
  /** Whether this Workspace offers a trial at all — "trialEnabled" in product terms. */
  is_trial_eligible: boolean;
  /** Null when is_trial_eligible is false (no trial offered) or not yet configured by Studio. */
  trial_duration: number | null;
  trial_unit: TrialUnit;
  content_type: ContentType;
  /** Schema version of THIS content_type's JSON shape — distinct from current_version (publish history). */
  content_version: number;
  metadata: Record<string, unknown>;
  status: PublicationStatus;
  /** Publish/edit history counter, bumped by publish_product() on every publish. */
  current_version: number;
  last_published_at: string | null;
  last_published_by: string | null;
  /**
   * The full Workspace JSON published from BGrowth Studio (see
   * src/types/workspaceContent.ts). Null until Studio has published content
   * for this product — the Viewer falls back to a "coming soon" state.
   */
  content: WorkspaceContent | null;
  /** Auto-generated on every publish (see api/_lib/generateWelcomePdf.ts) — never Studio-authored, never "sticky" the way cover_image_url is. Null until the first publish completes. */
  welcome_pdf_url: string | null;
  /** Whether this Workspace costs nothing at all — distinct from is_trial_eligible (a free trial of a paid product). */
  is_free: boolean;
  /** Null when is_free is true, or not yet configured by Studio for a non-free product. */
  price_cents: number | null;
  currency: string;
  /** Nullable — set once Studio/Commerce creates a real Stripe Price object; the checkout endpoint falls back to dynamic price_data using price_cents/currency until then. */
  stripe_price_id: string | null;
  created_at: string;
};

export type ProductVersionRow = {
  id: string;
  product_id: string;
  version: number;
  status: PublicationStatus;
  name: string;
  short_description: string;
  cover_image_url: string | null;
  content: WorkspaceContent | Record<string, unknown>;
  published_by: string;
  change_notes: string | null;
  created_at: string;
};

export type PublicationDestinationRow = {
  id: string;
  key: PublicationDestinationKey;
  name: string;
  is_active: boolean;
  config: Record<string, unknown>;
  created_at: string;
};

export type ProductDestinationRow = {
  id: string;
  product_id: string;
  destination_id: string;
  status: PublicationStatus;
  external_id: string | null;
  external_url: string | null;
  published_version: number | null;
  last_published_at: string | null;
  last_published_by: string | null;
  created_at: string;
};

export type PublishedAssetRow = {
  id: string;
  product_id: string;
  product_version: number;
  asset_type: AssetType;
  destination_id: string;
  storage_path: string | null;
  url: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  /** Set once the underlying Storage object has been pruned (retention window or archive cleanup) — the row itself is never deleted, so this is the one field that distinguishes "still downloadable" from "audit-trail only." Null until then. */
  deleted_from_storage_at: string | null;
};

export type CatalogIndexRow = {
  product_id: string;
  slug: string;
  name: string;
  short_description: string;
  content_type: ContentType;
  category_id: string | null;
  cover_image_url: string | null;
  is_featured: boolean;
  is_best_seller: boolean;
  /** Curated flag ("Recommended" rail) — not personalized/ML-based, same manual-curation precedent as is_featured/is_best_seller (see supabase/migrations/0018_catalog_discovery.sql). */
  is_recommended: boolean;
  /** Populated from products.metadata->'tags' at publish time — empty until Studio sends tags. */
  tags: string[];
  /** Denormalized from portal.product_review_summary by a trigger (see 0018) — null until the product has at least one review. */
  avg_rating: number | null;
  review_count: number;
  /** Distinct members who ever held a license (trial or purchase) for this product — the real "Popular" signal, maintained by a trigger on portal.licenses. */
  license_count: number;
  /** Denormalized straight off products (same values) so Browse's price/trial filters and sorts stay a single-table scan. */
  is_free: boolean;
  price_cents: number | null;
  currency: string;
  is_trial_eligible: boolean;
  published_at: string | null;
  search_vector: unknown;
  updated_at: string;
};

/** A curated group of products ("Featured", "New Arrivals", "Under $50") — populated by direct SQL, no authoring UI yet. See supabase/migrations/0018_catalog_discovery.sql. */
export type CollectionRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  sort_order: number;
  created_at: string;
};

export type ProductCollectionRow = {
  collection_id: string;
  product_id: string;
  sort_order: number;
};

export type LicenseRow = {
  id: string;
  user_id: string;
  product_id: string;
  type: LicenseType;
  status: LicenseStatus;
  /** Whether expires_at is ever checked at all — see deriveAccessState(). A trial is always 'expiring'; a purchase is always 'lifetime' today. */
  access_policy: AccessPolicy;
  activated_at: string;
  expires_at: string | null;
  created_at: string;
  /** Set once the one-time "trial expired, how was it?" review-request email has been sent — never re-sent after. Null until then. */
  review_requested_at: string | null;
  /** My Library "Favorites" filter — a UI preference, not a licensing concept. Self-service updatable (see supabase/migrations/0019_library_favorites_and_last_opened.sql's column-scoped grant). */
  is_favorite: boolean;
  /** Set by WorkspaceViewerPage on every successful open — powers My Library's "Recently Opened" sort. Null until the member has ever opened this Workspace. */
  last_opened_at: string | null;
};

export type UserProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  has_used_trial: boolean;
  created_at: string;
};

/** Whether a review was submitted after a Trial or after a purchase — kept for future analytics, not read/branched on anywhere today. */
export type ReviewCreatedFrom = "trial" | "purchase";

/**
 * A member's review of a product — belongs to the product itself, never to
 * a saved checklist instance (see WorkspaceInstanceRow). One row per
 * (user_id, product_id), enforced by a unique constraint. `display_name`
 * is a snapshot at submission time (not a live join to `users`), so a
 * review's byline stays stable even if the member later renames their
 * profile.
 */
export type ReviewRow = {
  id: string;
  user_id: string;
  product_id: string;
  rating: number;
  title: string;
  comment: string;
  display_name: string;
  created_from: ReviewCreatedFrom;
  created_at: string;
  updated_at: string;
};

/**
 * Aggregate rating/count for one product, read from the
 * `product_review_summary` view — kept separate from ReviewRow so a
 * summary display never requires fetching every review row (see
 * reviewService.getSummary).
 */
export type ProductReviewSummaryRow = {
  product_id: string;
  average_rating: number;
  review_count: number;
};

export type WorkspaceInstanceStatus = "in_progress" | "completed" | "archived";

/**
 * One independently-named, filled-in record of an owned Workspace (e.g. a
 * single client's notary appointment checklist) — a member can hold many
 * per product. `data` mirrors WorkspaceContent's field ids, same shape as
 * WorkspaceRenderer's local field state, just persisted. `status` only
 * ever "in_progress" today — "completed"/"archived" are reserved for the
 * future Workspace Engine (see WORKSPACE_INSTANCES_ARCHITECTURE.md).
 */
export type WorkspaceInstanceRow = {
  id: string;
  user_id: string;
  product_id: string;
  label: string;
  data: Record<string, unknown>;
  status: WorkspaceInstanceStatus;
  created_at: string;
  updated_at: string;
};

/** Args/Returns for the publish_product() RPC — see supabase/migrations/0003_publishing_engine.sql. */
export type PublishProductArgs = {
  p_studio_product_id: string;
  p_slug: string;
  p_name: string;
  p_short_description: string;
  p_content: WorkspaceContent | Record<string, unknown>;
  p_status: PublicationStatus;
  p_content_type?: ContentType;
  p_content_version?: number;
  p_category_slug?: string | null;
  p_metadata?: Record<string, unknown>;
  p_cover_image_url?: string | null;
  p_destination_key?: PublicationDestinationKey;
  p_published_by?: string;
  p_change_notes?: string | null;
  p_is_trial_eligible?: boolean;
  p_assets?: Array<{ assetType: AssetType; url?: string; storagePath?: string; mimeType?: string; sizeBytes?: number; metadata?: Record<string, unknown> }>;
  p_trial_duration?: number | null;
  p_trial_unit?: TrialUnit;
  p_welcome_pdf_url?: string | null;
  p_is_free?: boolean;
  p_price_cents?: number | null;
  p_currency?: string;
  p_stripe_price_id?: string | null;
  p_cover_image_storage_path?: string | null;
  p_cover_image_size_bytes?: number | null;
  p_welcome_pdf_storage_path?: string | null;
  p_welcome_pdf_size_bytes?: number | null;
};

/** Args/Returns for the grant_purchased_license() RPC — see supabase/migrations/0012_purchase_licenses.sql. Service-role only, called from api/webhooks/stripe.ts. */
export type GrantPurchasedLicenseArgs = {
  p_user_id: string;
  p_product_id: string;
};

/** Args/Returns for archive_product() — see supabase/migrations/0015_asset_lifecycle.sql. Service-role only, called from api/publishing-engine/archive.ts. */
export type ArchiveProductArgs = {
  p_studio_product_id: string;
  p_published_by?: string;
};

/** Args/Returns for get_prunable_assets() — see supabase/migrations/0015_asset_lifecycle.sql. Service-role only, called from api/_lib/pruneOldAssets.ts. */
export type GetPrunableAssetsArgs = {
  p_product_id: string;
};

/** Args/Returns for mark_assets_deleted() — see supabase/migrations/0015_asset_lifecycle.sql. Service-role only, called from api/_lib/pruneOldAssets.ts. */
export type MarkAssetsDeletedArgs = {
  p_asset_ids: string[];
};

/** Args/Returns for delete_draft_product() — see supabase/migrations/0015_asset_lifecycle.sql. Guarded to never-published, license-free drafts; no caller exists yet. */
export type DeleteDraftProductArgs = {
  p_studio_product_id: string;
};

// Everything lives in the `portal` schema, not `public` — this database is
// shared with the existing BGrowth Academy LMS. The schema key here must
// match the `db.schema` option passed to createClient() in
// supabaseClient.ts / api/_lib/supabaseAdmin.ts, or every query silently
// targets the wrong schema.
export interface Database {
  portal: {
    Tables: {
      users: {
        Row: UserProfileRow;
        Insert: Partial<UserProfileRow> & Pick<UserProfileRow, "id" | "email">;
        Update: Partial<UserProfileRow>;
        Relationships: [];
      };
      products: {
        Row: ProductRow;
        Insert: Partial<ProductRow> & Pick<ProductRow, "slug" | "name" | "short_description">;
        Update: Partial<ProductRow>;
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            referencedRelation: "workspace_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      product_versions: {
        Row: ProductVersionRow;
        Insert: Partial<ProductVersionRow> &
          Pick<ProductVersionRow, "product_id" | "version" | "status" | "name" | "short_description" | "content" | "published_by">;
        Update: Partial<ProductVersionRow>;
        Relationships: [
          {
            foreignKeyName: "product_versions_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      publication_destinations: {
        Row: PublicationDestinationRow;
        Insert: Partial<PublicationDestinationRow> & Pick<PublicationDestinationRow, "key" | "name">;
        Update: Partial<PublicationDestinationRow>;
        Relationships: [];
      };
      product_destinations: {
        Row: ProductDestinationRow;
        Insert: Partial<ProductDestinationRow> & Pick<ProductDestinationRow, "product_id" | "destination_id">;
        Update: Partial<ProductDestinationRow>;
        Relationships: [
          {
            foreignKeyName: "product_destinations_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_destinations_destination_id_fkey";
            columns: ["destination_id"];
            referencedRelation: "publication_destinations";
            referencedColumns: ["id"];
          },
        ];
      };
      published_assets: {
        Row: PublishedAssetRow;
        Insert: Partial<PublishedAssetRow> &
          Pick<PublishedAssetRow, "product_id" | "product_version" | "asset_type" | "destination_id">;
        Update: Partial<PublishedAssetRow>;
        Relationships: [
          {
            foreignKeyName: "published_assets_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      catalog_index: {
        Row: CatalogIndexRow;
        Insert: Partial<CatalogIndexRow> & Pick<CatalogIndexRow, "product_id" | "slug" | "name" | "short_description" | "content_type">;
        Update: Partial<CatalogIndexRow>;
        Relationships: [];
      };
      licenses: {
        Row: LicenseRow;
        Insert: Partial<LicenseRow> & Pick<LicenseRow, "user_id" | "product_id" | "type">;
        Update: Partial<LicenseRow>;
        Relationships: [
          {
            foreignKeyName: "licenses_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "licenses_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_categories: {
        Row: WorkspaceCategoryRow;
        Insert: Partial<WorkspaceCategoryRow> & Pick<WorkspaceCategoryRow, "name" | "slug">;
        Update: Partial<WorkspaceCategoryRow>;
        Relationships: [];
      };
      workspace_instances: {
        Row: WorkspaceInstanceRow;
        Insert: Partial<WorkspaceInstanceRow> & Pick<WorkspaceInstanceRow, "user_id" | "product_id" | "label">;
        Update: Partial<WorkspaceInstanceRow>;
        Relationships: [
          {
            foreignKeyName: "workspace_instances_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_instances_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: ReviewRow;
        Insert: Partial<ReviewRow> &
          Pick<ReviewRow, "user_id" | "product_id" | "rating" | "title" | "comment" | "display_name" | "created_from">;
        Update: Partial<ReviewRow>;
        Relationships: [
          {
            foreignKeyName: "reviews_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      collections: {
        Row: CollectionRow;
        Insert: Partial<CollectionRow> & Pick<CollectionRow, "name" | "slug">;
        Update: Partial<CollectionRow>;
        Relationships: [];
      };
      product_collections: {
        Row: ProductCollectionRow;
        Insert: Partial<ProductCollectionRow> & Pick<ProductCollectionRow, "collection_id" | "product_id">;
        Update: Partial<ProductCollectionRow>;
        Relationships: [
          {
            foreignKeyName: "product_collections_collection_id_fkey";
            columns: ["collection_id"];
            referencedRelation: "collections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_collections_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      product_review_summary: {
        Row: ProductReviewSummaryRow;
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      publish_product: {
        Args: PublishProductArgs;
        Returns: ProductRow;
      };
      grant_purchased_license: {
        Args: GrantPurchasedLicenseArgs;
        Returns: LicenseRow;
      };
      archive_product: {
        Args: ArchiveProductArgs;
        Returns: ProductRow;
      };
      get_prunable_assets: {
        Args: GetPrunableAssetsArgs;
        Returns: PublishedAssetRow[];
      };
      mark_assets_deleted: {
        Args: MarkAssetsDeletedArgs;
        Returns: void;
      };
      delete_draft_product: {
        Args: DeleteDraftProductArgs;
        Returns: void;
      };
    };
  };
}
