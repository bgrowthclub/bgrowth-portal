import { supabase } from "./supabaseClient";
import type { CatalogIndexRow, CollectionRow, ContentType, WorkspaceCategoryRow } from "@/types/database";
import { CONTENT_TYPE_LABELS } from "@/lib/contentType";

export type CatalogSortOption =
  | "relevance"
  | "newest"
  | "recently_updated"
  | "popular"
  | "top_rated"
  | "price_low"
  | "price_high";

/** Opaque to callers — just round-trip whatever browseCatalog() returns as nextCursor back in as cursor. */
export interface CatalogCursor {
  sortValue: string | number | null;
  productId: string;
}

export interface BrowseCatalogParams {
  q?: string;
  categorySlug?: string;
  contentType?: ContentType;
  tags?: string[];
  freeOnly?: boolean;
  sort?: CatalogSortOption;
  cursor?: CatalogCursor | null;
  pageSize?: number;
  /** Products to leave out entirely — used by Browse to exclude what the signed-in visitor already owns (My Library is the owned-items view, see MarketplacePage.tsx's existing "discovery only" framing). */
  excludeProductIds?: string[];
}

export interface BrowseCatalogResult {
  items: CatalogIndexRow[];
  nextCursor: CatalogCursor | null;
}

type KeysetSortColumn = "published_at" | "updated_at" | "license_count" | "avg_rating" | "price_cents";

/**
 * Every column here is indexed (see supabase/migrations/0018_catalog_discovery.sql)
 * and used as a keyset-pagination cursor — "Load More" stays index-backed
 * (O(log n)) at any depth instead of degrading like OFFSET does at scale.
 * published_at/updated_at/license_count are never null on a catalog_index
 * row; avg_rating/price_cents can be (no reviews yet / a free product), so
 * those two sort options carry an explicit "nulls sort last" tie-break
 * below rather than relying on ascending/descending alone.
 */
const KEYSET_SORTS: Record<Exclude<CatalogSortOption, "relevance">, { column: KeysetSortColumn; ascending: boolean; nullable: boolean }> = {
  newest: { column: "published_at", ascending: false, nullable: false },
  recently_updated: { column: "updated_at", ascending: false, nullable: false },
  popular: { column: "license_count", ascending: false, nullable: false },
  top_rated: { column: "avg_rating", ascending: false, nullable: true },
  price_low: { column: "price_cents", ascending: true, nullable: true },
  price_high: { column: "price_cents", ascending: false, nullable: true },
};

const DEFAULT_PAGE_SIZE = 24;

function baseSelect() {
  return supabase.from("catalog_index").select("*");
}

type CatalogQuery = ReturnType<typeof baseSelect>;

function applyCommonFilters(
  query: CatalogQuery,
  { categorySlug, contentType, tags, freeOnly, excludeProductIds }: BrowseCatalogParams,
  categoryIdBySlug: Map<string, string>,
): CatalogQuery {
  let q = query;
  if (categorySlug) {
    const categoryId = categoryIdBySlug.get(categorySlug);
    // An unknown slug should return zero rows, not "no filter at all".
    q = q.eq("category_id", categoryId ?? "00000000-0000-0000-0000-000000000000");
  }
  if (contentType) q = q.eq("content_type", contentType);
  // overlaps (&&), not contains (@>) — checking multiple tag filters means
  // "has at least one of these tags", not "has every one of them".
  if (tags && tags.length > 0) q = q.overlaps("tags", tags);
  if (freeOnly) q = q.eq("is_free", true);
  if (excludeProductIds && excludeProductIds.length > 0) {
    q = q.not("product_id", "in", `(${excludeProductIds.join(",")})`);
  }
  return q;
}

/**
 * Shared read access to the Browse/Home discovery catalog — reads from
 * portal.catalog_index (see 0003_publishing_engine.sql's own comment: built
 * for exactly this, never wired up until now), not portal.products.
 * productService.ts is untouched and keeps backing My Library/checkout/
 * trial eligibility, none of which change here.
 */
export const catalogService = {
  /**
   * Search + filter + sort + keyset-paginated Browse results. `q` uses
   * websearch_to_tsquery against the weighted search_vector (name > short
   * description > tags) and is deliberately offset-paginated (see below) —
   * every other sort uses proper keyset pagination.
   */
  async browseCatalog(params: BrowseCatalogParams = {}): Promise<BrowseCatalogResult> {
    const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
    const categoryIdBySlug = await getCategoryIdBySlug();

    if (params.q && params.q.trim().length > 0) {
      // Relevance ranking comes from ts_rank on a computed expression, not a
      // stored/indexed column, so it can't be used as a keyset cursor the
      // way the other sorts are below. Search result sets are materially
      // smaller and shallower than the full catalog, so plain offset
      // pagination here is a deliberate, scoped simplification — not the
      // pattern for browsing the whole catalog (see the non-search branch).
      const offset = typeof params.cursor?.sortValue === "number" ? params.cursor.sortValue : 0;
      let query = baseSelect().textSearch("search_vector", params.q.trim(), {
        type: "websearch",
        config: "english",
      });
      query = applyCommonFilters(query, params, categoryIdBySlug);
      const { data, error } = await query.range(offset, offset + pageSize - 1);
      if (error) throw error;
      const items = data ?? [];
      return {
        items,
        nextCursor: items.length === pageSize ? { sortValue: offset + pageSize, productId: "" } : null,
      };
    }

    const sortKey = params.sort && params.sort !== "relevance" ? params.sort : "newest";
    const { column, ascending, nullable } = KEYSET_SORTS[sortKey];

    let query = baseSelect();
    query = applyCommonFilters(query, params, categoryIdBySlug);

    if (params.cursor) {
      query = applyKeysetCursor(query, column, ascending, nullable, params.cursor);
    }

    // Applied directly in the awaited chain rather than reassigned back into
    // `query` — .order()/.limit() move to a different (no-longer-filterable)
    // builder type, so this keeps `query`'s type as the filter-only CatalogQuery
    // throughout instead of risking a type mismatch on reassignment.
    const { data, error } = await query
      .order(column, { ascending, nullsFirst: false })
      .order("product_id", { ascending })
      .limit(pageSize);
    if (error) throw error;
    const items = data ?? [];
    const last = items[items.length - 1];
    const nextCursor: CatalogCursor | null =
      items.length === pageSize && last
        ? { sortValue: (last[column] as string | number | null) ?? null, productId: last.product_id }
        : null;

    return { items, nextCursor };
  },

  async getFacets(): Promise<{
    categories: Pick<WorkspaceCategoryRow, "id" | "name" | "slug">[];
    contentTypes: ContentType[];
    tags: string[];
  }> {
    const [{ data: categories, error: categoryError }, { data: tagRows, error: tagError }] = await Promise.all([
      supabase.from("workspace_categories").select("id, name, slug").order("sort_order", { ascending: true }),
      // Tags are empty until Studio starts sending metadata.tags (see
      // 0018_catalog_discovery.sql) — deduping client-side over a capped
      // sample is a deliberately small solution for what's an empty column
      // today; a dedicated facet view is a natural follow-up once real tag
      // volume exists, not something worth building against zero data now.
      supabase.from("catalog_index").select("tags").limit(500),
    ]);
    if (categoryError) throw categoryError;
    if (tagError) throw tagError;

    const tagSet = new Set<string>();
    for (const row of tagRows ?? []) {
      for (const tag of row.tags ?? []) tagSet.add(tag);
    }

    return {
      categories: categories ?? [],
      contentTypes: Object.keys(CONTENT_TYPE_LABELS) as ContentType[],
      tags: Array.from(tagSet).sort(),
    };
  },

  async getCollection(slug: string): Promise<{ collection: CollectionRow; items: CatalogIndexRow[] } | null> {
    const { data: collection, error: collectionError } = await supabase
      .from("collections")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (collectionError) throw collectionError;
    if (!collection) return null;

    // Two-step fetch rather than a PostgREST embed: product_collections has
    // no foreign key directly to catalog_index (only to products), so
    // `catalog_index(*)` embedding syntax has nothing to join on. Same
    // plain-query style as getCategoryIdBySlug/productService.fetchForLibrary.
    const { data: membership, error: membershipError } = await supabase
      .from("product_collections")
      .select("product_id, sort_order")
      .eq("collection_id", collection.id)
      .order("sort_order", { ascending: true });
    if (membershipError) throw membershipError;
    if (!membership || membership.length === 0) return { collection, items: [] };

    const { data: rows, error: itemsError } = await supabase
      .from("catalog_index")
      .select("*")
      .in(
        "product_id",
        membership.map((row) => row.product_id),
      );
    if (itemsError) throw itemsError;

    const sortOrderByProductId = new Map(membership.map((row) => [row.product_id, row.sort_order]));
    const items = [...(rows ?? [])].sort(
      (a, b) => (sortOrderByProductId.get(a.product_id) ?? 0) - (sortOrderByProductId.get(b.product_id) ?? 0),
    );

    return { collection, items };
  },

  /**
   * Small, non-paginated rails for Home — each hidden gracefully by the
   * caller if empty, matching this codebase's existing empty-state
   * conventions (see AvailableWorkspacesSection.tsx's own pattern).
   */
  async getCuratedRail(
    kind: "featured" | "new" | "popular" | "recommended" | "recently-updated",
    limit = 12,
  ): Promise<CatalogIndexRow[]> {
    // Filters only here (kept to CatalogQuery's type) — order/limit applied
    // once below, after the switch, so reassigning `query` never crosses
    // into the differently-typed post-.order() builder mid-switch.
    let query = baseSelect();
    let orderColumn: "updated_at" | "license_count" | "published_at" = "updated_at";

    switch (kind) {
      case "featured":
        query = query.eq("is_featured", true);
        orderColumn = "updated_at";
        break;
      case "recommended":
        query = query.eq("is_recommended", true);
        orderColumn = "updated_at";
        break;
      case "popular":
        orderColumn = "license_count";
        break;
      case "new":
        query = query.gte("published_at", thirtyDaysAgoIso());
        orderColumn = "published_at";
        break;
      case "recently-updated":
        // Excludes anything that's also "New" — a just-published item
        // shouldn't double up as both New and Recently Updated.
        query = query.gte("updated_at", thirtyDaysAgoIso()).lt("published_at", thirtyDaysAgoIso());
        orderColumn = "updated_at";
        break;
    }

    const { data, error } = await query.order(orderColumn, { ascending: false }).limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  /**
   * My Library's badges/Recently Updated — catalog_index rows for a
   * member's own owned products, so Library can show the same New/Updated/
   * Best Seller/Free/Trial Available signals Browse/Home already show,
   * without productService/licenseService needing to know about them. An
   * owned-but-archived product has no catalog_index row (archive_product()
   * removes it, see 0015_asset_lifecycle.sql) — simply absent from the
   * result, same "missing metadata, hide the badge" handling every caller
   * already applies.
   */
  async getByProductIds(productIds: string[]): Promise<CatalogIndexRow[]> {
    if (productIds.length === 0) return [];
    const { data, error } = await supabase.from("catalog_index").select("*").in("product_id", productIds);
    if (error) throw error;
    return data ?? [];
  },

  /**
   * My Library's "Recommended For You" — lightweight and client-driven, not
   * a personalization model: published, not-yet-owned Workspaces in the
   * same category(ies) the member already owns something in, ranked by
   * license_count (the same "Popular" signal Browse's own sort uses).
   * "Recent activity" is expressed by the caller through `categoryIds`'
   * order (My Library passes owned categories ordered by which one the
   * member was most recently active in) — this method itself just filters
   * + ranks, it doesn't need to know why the category list is ordered
   * that way.
   */
  async getRecommendedForCategories(params: {
    categoryIds: string[];
    excludeProductIds: string[];
    limit?: number;
  }): Promise<CatalogIndexRow[]> {
    const { categoryIds, excludeProductIds, limit = 12 } = params;
    if (categoryIds.length === 0) return [];

    let query = baseSelect().in("category_id", categoryIds);
    if (excludeProductIds.length > 0) {
      query = query.not("product_id", "in", `(${excludeProductIds.join(",")})`);
    }

    const { data, error } = await query.order("license_count", { ascending: false }).limit(limit);
    if (error) throw error;
    return data ?? [];
  },
};

/** "New"/"Recently Updated" rail window — also read by CatalogProductCard to badge a card the same way the rail itself would qualify it. */
export const NEW_WINDOW_DAYS = 30;

function thirtyDaysAgoIso(): string {
  return new Date(Date.now() - NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

async function getCategoryIdBySlug(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from("workspace_categories").select("id, slug");
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.slug, row.id]));
}

/**
 * Keyset ("Load More") pagination filter: "rows not yet seen, given the
 * last row of the previous page." nullable columns (avg_rating, price_cents)
 * sort last regardless of direction (nullsFirst: false above), so once the
 * cursor itself is a null row, only remaining null rows (tie-broken by
 * product_id) qualify; otherwise the filter also opens the door to the null
 * tail once every non-null row has been exhausted.
 */
function applyKeysetCursor(
  query: CatalogQuery,
  column: KeysetSortColumn,
  ascending: boolean,
  nullable: boolean,
  cursor: CatalogCursor,
): CatalogQuery {
  if (cursor.sortValue === null) {
    return query.is(column, null).lt("product_id", cursor.productId);
  }

  const op = ascending ? "gt" : "lt";
  const value = typeof cursor.sortValue === "string" ? `"${cursor.sortValue}"` : cursor.sortValue;
  const filters = [`${column}.${op}.${value}`, `and(${column}.eq.${value},product_id.${op}.${cursor.productId})`];
  if (nullable) filters.push(`${column}.is.null`);
  return query.or(filters.join(","));
}
