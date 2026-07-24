/**
 * Mirrors the Supabase schema defined in supabase/migrations/*.sql. Keep in
 * sync whenever the schema changes — this is the single source of truth for
 * row shapes used throughout the app.
 */

import type { WorkspaceContent } from "./workspaceContent";

export type LicenseType = "trial" | "purchased" | "lifetime";
export type LicenseStatus = "active" | "expired" | "revoked";

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
  is_trial_eligible: boolean;
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
  published_at: string | null;
  search_vector: unknown;
  updated_at: string;
};

export type LicenseRow = {
  id: string;
  user_id: string;
  product_id: string;
  type: LicenseType;
  status: LicenseStatus;
  activated_at: string;
  expires_at: string | null;
  created_at: string;
};

export type UserProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  has_used_trial: boolean;
  created_at: string;
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
  p_assets?: Array<{ assetType: AssetType; url?: string; mimeType?: string; sizeBytes?: number; metadata?: Record<string, unknown> }>;
};

export interface Database {
  public: {
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
    };
    Views: Record<string, never>;
    Functions: {
      publish_product: {
        Args: PublishProductArgs;
        Returns: ProductRow;
      };
    };
  };
}
