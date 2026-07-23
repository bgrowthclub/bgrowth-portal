/**
 * Mirrors the Supabase schema defined in supabase/migrations/0001_init.sql.
 * Keep in sync whenever the schema changes — this is the single source of
 * truth for row shapes used throughout the app.
 */

export type LicenseType = "trial" | "purchased" | "lifetime";
export type LicenseStatus = "active" | "expired" | "revoked";

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
  slug: string;
  name: string;
  short_description: string;
  cover_image_url: string | null;
  category_id: string | null;
  app_url: string | null;
  is_trial_eligible: boolean;
  is_published: boolean;
  created_at: string;
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
    Functions: Record<string, never>;
  };
}
