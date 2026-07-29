import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { licenseService } from "@/services/licenseService";
import { catalogService, type CatalogCursor, type CatalogSortOption } from "@/services/catalogService";
import type { CatalogIndexRow, ContentType } from "@/types/database";
import { Spinner } from "@/components/ui/Spinner";
import { FetchErrorState } from "@/components/ui/FetchErrorState";
import { Button } from "@/components/ui/Button";
import { CatalogProductCard } from "@/components/catalog/CatalogProductCard";
import { BrowseFilterBar } from "./components/BrowseFilterBar";

/**
 * Search/filter/sort/paginated storefront over portal.catalog_index — see
 * catalogService.browseCatalog() for the query it drives and
 * supabase/migrations/0018_catalog_discovery.sql for the indexes that keep
 * it index-backed at any catalog size. Public (see src/app/routes.tsx) —
 * anyone can browse; only the Buy/Trial CTA on each card is gated (see
 * CatalogProductCard's own signed-out handling).
 */
export function MarketplacePage() {
  const { user, isLoading: isLoadingAuth } = useAuth();

  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);
  const [categorySlug, setCategorySlug] = useState<string | undefined>(undefined);
  const [contentType, setContentType] = useState<ContentType | undefined>(undefined);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [freeOnly, setFreeOnly] = useState(false);
  const [sort, setSort] = useState<CatalogSortOption>("newest");

  const [items, setItems] = useState<CatalogIndexRow[]>([]);
  const [cursor, setCursor] = useState<CatalogCursor | null>(null);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const { data: facets, isLoading: isLoadingFacets, error: facetsError, refetch: refetchFacets } = useAsync(
    () => catalogService.getFacets(),
    [],
  );
  // Only relevant once a session exists (excludes owned Workspaces from
  // discovery — My Library is the owned-items view) — resolves to [] for a
  // signed-out visitor, so browsing never waits on auth.
  const { data: licenses, isLoading: isLoadingLicenses } = useAsync(
    () => (user ? licenseService.fetchForUser(user.id) : Promise.resolve([])),
    [user?.id],
  );
  const { data: hasUsedTrial } = useAsync(
    () => (user ? licenseService.hasUsedTrial(user.id) : Promise.resolve(false)),
    [user?.id],
  );

  const excludeProductIds = useMemo(() => (licenses ?? []).map((license) => license.product_id), [licenses]);
  const categoryNameById = useMemo(
    () => new Map((facets?.categories ?? []).map((category) => [category.id, category.name])),
    [facets],
  );

  const isReady = !isLoadingAuth && !isLoadingLicenses;

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    setIsLoadingInitial(true);
    setLoadError(null);

    catalogService
      .browseCatalog({
        q: debouncedQ,
        categorySlug,
        contentType,
        tags: selectedTags,
        freeOnly,
        sort,
        excludeProductIds,
        cursor: null,
      })
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setCursor(result.nextCursor);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Couldn't load Workspaces right now.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingInitial(false);
      });

    return () => {
      cancelled = true;
    };
    // excludeProductIds is a derived array (stable reference unless
    // `licenses` itself changes) — safe as a dependency without looping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, debouncedQ, categorySlug, contentType, selectedTags, freeOnly, sort, excludeProductIds, reloadToken]);

  async function handleLoadMore() {
    if (!cursor) return;
    setIsLoadingMore(true);
    try {
      const result = await catalogService.browseCatalog({
        q: debouncedQ,
        categorySlug,
        contentType,
        tags: selectedTags,
        freeOnly,
        sort,
        excludeProductIds,
        cursor,
      });
      setItems((prev) => [...prev, ...result.items]);
      setCursor(result.nextCursor);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load more Workspaces right now.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function handleRetry() {
    refetchFacets();
    setReloadToken((token) => token + 1);
  }

  const isLoading = !isReady || isLoadingFacets;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div>
        <h1 className="text-2xl font-bold text-navy-900 dark:text-white">Browse Workspaces</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-white/60">
          Discover every BGrowth Workspace — search, filter, and find what fits your business.
        </p>
      </div>

      {!isLoading && facets && (
        <div className="mt-8">
          <BrowseFilterBar
            q={q}
            onQChange={setQ}
            categorySlug={categorySlug}
            onCategoryChange={setCategorySlug}
            categories={facets.categories}
            contentType={contentType}
            onContentTypeChange={setContentType}
            contentTypes={facets.contentTypes}
            tags={facets.tags}
            selectedTags={selectedTags}
            onToggleTag={toggleTag}
            freeOnly={freeOnly}
            onFreeOnlyChange={setFreeOnly}
            sort={sort}
            onSortChange={setSort}
            isSearching={debouncedQ.trim().length > 0}
          />
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      )}

      {!isLoading && (facetsError || loadError) && items.length === 0 && (
        <div className="mt-8">
          <FetchErrorState message={facetsError ?? loadError ?? undefined} onRetry={handleRetry} />
        </div>
      )}

      {!isLoading && !facetsError && isLoadingInitial && (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      )}

      {!isLoading && !facetsError && !isLoadingInitial && items.length === 0 && (
        <p className="mt-12 text-center text-sm text-navy-400 dark:text-white/40">
          {q.trim().length > 0 || categorySlug || contentType || selectedTags.length > 0 || freeOnly
            ? "No Workspaces match these filters yet — try broadening your search."
            : "You're already trialing or own every Workspace we offer today — new ones are on the way."}
        </p>
      )}

      {!isLoading && !facetsError && !isLoadingInitial && items.length > 0 && (
        <>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <CatalogProductCard
                key={item.product_id}
                item={item}
                hasUsedTrial={hasUsedTrial ?? false}
                categoryName={item.category_id ? categoryNameById.get(item.category_id) : undefined}
              />
            ))}
          </div>

          {cursor && (
            <div className="mt-10 flex justify-center">
              <Button variant="secondary" onClick={handleLoadMore} isLoading={isLoadingMore}>
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
