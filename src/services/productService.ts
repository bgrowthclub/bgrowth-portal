import { supabase } from "./supabaseClient";
import type { ContentType, ProductRow, WorkspaceOutlineSection } from "@/types/database";
import type { WorkspaceContent } from "@/types/workspaceContent";

/**
 * Every products column except `content`. The Workspace JSON is not
 * readable from the browser (supabase/migrations/0034_workspace_content_access.sql):
 * a member with access gets it from portal.get_workspace_content(), and a
 * visitor gets only the outline from portal.get_workspace_outline().
 */
const PRODUCT_COLUMNS =
  "id, studio_product_id, slug, name, short_description, cover_image_url, category_id, app_url, is_trial_eligible, trial_duration, trial_unit, content_type, content_version, metadata, status, current_version, last_published_at, last_published_by, welcome_pdf_url, is_free, price_cents, currency, stripe_price_id, created_at";

type ProductRowWithoutContent = Omit<ProductRow, "content">;

const withoutContent = (rows: ProductRowWithoutContent[] | null): ProductRow[] =>
  (rows ?? []).map((row) => ({ ...row, content: null }));

/** The function isn't there yet (0034 not run) — fall back to the old column read. */
function isMissingFunction(error: { code?: string } | null): boolean {
  return error?.code === "PGRST202" || error?.code === "42883";
}

/** The full Workspace JSON, or null when the signed-in member has no access (or isn't signed in). */
async function fetchContent(productId: string): Promise<WorkspaceContent | null> {
  const { data, error } = await supabase.rpc("get_workspace_content", { p_product_id: productId });
  if (!error) return (data as WorkspaceContent | null) ?? null;
  if (isMissingFunction(error)) {
    const legacy = await supabase.from("products").select("content").eq("id", productId).maybeSingle();
    return ((legacy.data as { content?: WorkspaceContent | null } | null)?.content ?? null) as WorkspaceContent | null;
  }
  return null;
}

async function fetchOutline(slug: string): Promise<WorkspaceOutlineSection[]> {
  const { data, error } = await supabase.rpc("get_workspace_outline", { p_slug: slug });
  if (error) return [];
  return (data as WorkspaceOutlineSection[] | null) ?? [];
}

const withContent = (rows: ProductRow[]): Promise<ProductRow[]> =>
  Promise.all(rows.map(async (row) => ({ ...row, content: await fetchContent(row.id) })));

/**
 * Shared read access to the products catalog — used by the Home preview,
 * Trial Selection, and My Library features alike. Keep catalog reads here
 * rather than re-querying `products` ad hoc inside a feature.
 */
// Bundles (migration 0041) live in products too, but are sold on the
// Website only and aren't one of this app's content types.
const BUNDLE = "bundle" as ContentType;

export const productService = {
  async fetchPublished(): Promise<ProductRow[]> {
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .eq("status", "published")
      // Bundles (0041) are sold on the Website only — never a Workspace here.
      .neq("content_type", BUNDLE)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return withoutContent(data as ProductRowWithoutContent[] | null);
  },

  /**
   * Trial-eligible AND actually configured with a length — a product can be
   * marked is_trial_eligible = true by a Studio publish that omitted
   * trialDuration (not yet possible from Studio's UI as of this writing),
   * and offering that product here would let a member pick a trial
   * licenseService.activateTrial() can't actually compute an expiry for.
   */
  async fetchTrialEligible(): Promise<ProductRow[]> {
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .eq("status", "published")
      .eq("is_trial_eligible", true)
      .not("trial_duration", "is", null)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return withoutContent(data as ProductRowWithoutContent[] | null);
  },

  /**
   * The product with its full content when the member has access; otherwise
   * content is null and `outline` carries the public section list (the
   * product page's Features fallback).
   */
  async fetchBySlug(slug: string): Promise<ProductRow | null> {
    const { data, error } = await supabase.from("products").select(PRODUCT_COLUMNS).eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as unknown as ProductRowWithoutContent;
    const content = await fetchContent(row.id);
    return { ...row, content, outline: content ? null : await fetchOutline(slug) };
  },

  /** Home's "Continue Learning" rail: looks up the handful of products behind a member's in-progress workspace_instances. */
  async fetchByIds(ids: string[]): Promise<ProductRow[]> {
    if (ids.length === 0) return [];
    const { data, error } = await supabase.from("products").select(PRODUCT_COLUMNS).in("id", ids);
    if (error) throw error;
    return withContent(withoutContent(data as ProductRowWithoutContent[] | null));
  },

  /**
   * My Library's product list: every published Workspace, PLUS any
   * Workspace the member holds a license for regardless of its current
   * status — an archived Workspace a member already owns must keep
   * showing up here (see supabase/migrations/0016_products_owner_visibility.sql
   * for the matching RLS change this depends on; without both, an
   * archived-but-owned Workspace silently disappears from My Library).
   * `fetchPublished()` alone can't do this — its explicit
   * `status = 'published'` filter excludes an owned-but-archived row
   * regardless of what RLS additionally allows the session to see.
   */
  async fetchForLibrary(licensedProductIds: string[]): Promise<ProductRow[]> {
    let query = supabase.from("products").select(PRODUCT_COLUMNS);
    query =
      licensedProductIds.length > 0
        ? query.or(`status.eq.published,id.in.(${licensedProductIds.join(",")})`)
        : query.eq("status", "published");
    // Bundles (0041) are sold on the Website only — never a Workspace here.
    const { data, error } = await query.neq("content_type", BUNDLE).order("created_at", { ascending: true });
    if (error) throw error;
    return withoutContent(data as ProductRowWithoutContent[] | null);
  },
};
