import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutGrid, List as ListIcon } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { productService } from "@/services/productService";
import { licenseService } from "@/services/licenseService";
import { accessGrantService } from "@/services/accessGrantService";
import { workspaceInstanceService } from "@/services/workspaceInstanceService";
import { catalogService } from "@/services/catalogService";
import { reviewService } from "@/services/reviewService";
import { attachAccessState, isGrantActive } from "@/lib/workspaceAccess";
import { getLibraryViewPreference, setLibraryViewPreference, type LibraryViewMode } from "@/lib/libraryViewPreference";
import { getWorkspaceBadges } from "@/lib/workspaceBadges";
import type { WorkspaceWithAccess } from "@/types/workspace";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { FetchErrorState } from "@/components/ui/FetchErrorState";
import { LibraryWorkspaceCard } from "./components/LibraryWorkspaceCard";
import { LibraryWorkspaceListRow } from "./components/LibraryWorkspaceListRow";
import { LibraryDashboardSections } from "./components/LibraryDashboardSections";
import { CategoryChips } from "./components/CategoryChips";
import { MyDocumentsSection } from "./components/MyDocumentsSection";
import { ExploreWorkspacesSection } from "./components/ExploreWorkspacesSection";
import {
  LibraryFilterBar,
  type LibraryAccessFilter,
  type LibraryProgressFilter,
  type LibrarySortOption,
} from "./components/LibraryFilterBar";

const CONTINUE_WORKING_LIMIT = 5;
// Same cap Home's curated rails use (see catalogService.getCuratedRail's
// default `limit`) — keeps every dashboard rail a "quick glance" strip
// rather than an unbounded list, even for a member who owns hundreds of
// Workspaces. Each capped rail gets a "View All" action once its full list
// exceeds this.
const RAIL_DISPLAY_LIMIT = 12;
// Explore More Workspaces is a small discovery nudge, not a second Browse —
// kept noticeably smaller than the owned-item rails above.
const EXPLORE_DISPLAY_LIMIT = 6;
// "My Workspaces" renders incrementally rather than all at once — the
// filtered/sorted list is already fully in memory (client-side filtering
// was the point of that architecture), so this only bounds how much gets
// mounted to the DOM at a time, via a plain "Load More" button matching
// Browse's own keyset-pagination affordance (see MarketplacePage).
const ALL_WORKSPACES_PAGE_SIZE = 24;

export function MyLibraryPage() {
  const { user } = useAuth();

  const {
    data: licenses,
    isLoading: isLoadingLicenses,
    error: licensesError,
    refetch: refetchLicenses,
  } = useAsync(() => (user ? licenseService.fetchForUser(user.id) : Promise.resolve([])), [user?.id]);
  // Access Grants — completely separate from licenses above, resolved
  // together only in attachAccessState. Deliberately NOT folded into
  // licensedProductIds below: a grant on a currently-published Workspace
  // already flows through fetchForLibrary's unconditional "every published
  // product" fetch (see attachAccessState's own doc comment); extending
  // archived-product visibility for a grant holder is out of scope for
  // this phase.
  const {
    data: grants,
    isLoading: isLoadingGrants,
    error: grantsError,
    refetch: refetchGrants,
  } = useAsync(() => (user ? accessGrantService.fetchForUser(user.id) : Promise.resolve([])), [user?.id]);
  // Depends on `licenses` so an archived-but-owned Workspace still resolves:
  // fetchForLibrary() needs the member's licensed product ids to include a
  // non-published row (see productService.fetchForLibrary and
  // supabase/migrations/0016_products_owner_visibility.sql). Runs once with
  // an empty id list while licenses are still loading, then re-runs as soon
  // as the real ids are known — a harmless extra fetch, not a correctness
  // issue, since `isLoading` below stays true until both have settled.
  const licensedProductIds = (licenses ?? []).map((license) => license.product_id);
  const {
    data: products,
    isLoading: isLoadingProducts,
    error: productsError,
    refetch: refetchProducts,
  } = useAsync(() => productService.fetchForLibrary(licensedProductIds), [licensedProductIds.join(",")]);
  // Saved documents are an optional, secondary feature of My Library, not a
  // reason to block it — a failure here (e.g. a not-yet-applied migration)
  // must never stop a member from seeing/opening the Workspaces they own.
  // Deliberately excluded from `isLoading`/`error` below; on failure,
  // `instances` just stays null and My Documents renders as empty instead of
  // the whole page failing.
  const { data: instances, refetch: refetchInstances } = useAsync(
    () => (user ? workspaceInstanceService.listForUser(user.id) : Promise.resolve([])),
    [user?.id],
  );
  // Reused from Browse — the same {id,name,slug} list, just for the
  // category filter's options/labels here.
  const { data: facets } = useAsync(() => catalogService.getFacets(), []);

  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);
  const [categorySlug, setCategorySlug] = useState<string | undefined>(undefined);
  const [accessFilter, setAccessFilter] = useState<LibraryAccessFilter>("all");
  const [progressFilter, setProgressFilter] = useState<LibraryProgressFilter>("all");
  const [sort, setSort] = useState<LibrarySortOption>("recently_opened");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [togglingFavoriteId, setTogglingFavoriteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<LibraryViewMode>(() => getLibraryViewPreference());
  const [visibleCount, setVisibleCount] = useState(ALL_WORKSPACES_PAGE_SIZE);
  const allWorkspacesRef = useRef<HTMLDivElement>(null);

  function handleViewModeChange(mode: LibraryViewMode) {
    setViewMode(mode);
    setLibraryViewPreference(mode);
  }

  // A rail's "View All" hands off to this same section, pre-applying
  // whichever existing filter/sort matches that rail's meaning — it never
  // invents a new filter dimension, just drives the controls already here.
  function scrollToAllWorkspaces() {
    allWorkspacesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function handleViewAllContinueWorking() {
    setSort("recently_opened");
    scrollToAllWorkspaces();
  }
  function handleViewAllFavorites() {
    setFavoritesOnly(true);
    scrollToAllWorkspaces();
  }

  const isLoading = isLoadingProducts || isLoadingLicenses || isLoadingGrants;
  const error = productsError ?? licensesError ?? grantsError;
  // A member with only an Access Grant and zero licenses still has real
  // access — must not fall into the "Choose Your Free Trial" welcome state
  // below as if they own nothing yet.
  const hasAnyAccess = (licenses?.length ?? 0) > 0 || (grants ?? []).some(isGrantActive);

  // Computed once — fetchForLibrary already returns every published product
  // (plus any owned-but-archived extra), so this single attachAccessState
  // call is the source for BOTH My Workspaces (accessState !== "locked")
  // AND Explore More Workspaces (accessState === "locked"); the two can
  // never overlap or drift since they're a strict partition of the same
  // array, not two independently-derived lists.
  const allWithAccess = useMemo(
    () => (products && licenses && grants ? attachAccessState(products, licenses, grants) : null),
    [products, licenses, grants],
  );
  // Only Workspaces the member actually has access to — locked (never
  // activated/bought) Workspaces surface in Explore More instead. A
  // Workspace stays here even after its trial expires (see
  // LibraryWorkspaceCard) — it never disappears, it just switches to a Buy
  // Now prompt.
  const workspaces = useMemo(() => allWithAccess?.filter((w) => w.accessState !== "locked") ?? null, [allWithAccess]);
  const ownedProductIds = useMemo(() => (workspaces ?? []).map((w) => w.id), [workspaces]);
  const workspaceById = useMemo(() => new Map((workspaces ?? []).map((w) => [w.id, w])), [workspaces]);

  // Explore More Workspaces — published products the member has no access
  // to yet. Zero additional Supabase queries: `products` already contains
  // every published product (fetchForLibrary's unconditional fetch), so
  // this is just the other half of the same attachAccessState split above.
  // Deterministic "newest first" order, capped to a small discovery
  // selection — not ranked/personalized (that would need catalog_index
  // data this page doesn't fetch), and not a second Browse.
  const exploreWorkspaces = useMemo(() => {
    if (!allWithAccess) return [];
    return [...allWithAccess]
      .filter((w) => w.accessState === "locked")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, EXPLORE_DISPLAY_LIMIT);
  }, [allWithAccess]);

  // Only Workspaces where a ReviewPromptCard can actually render (see
  // LibraryWorkspaceCard) — narrower than ownedProductIds, so the batched
  // review lookup below never fetches rows for a Workspace that couldn't
  // show a review prompt anyway (e.g. an active, unexpired trial).
  const reviewEligibleProductIds = useMemo(
    () => (workspaces ?? []).filter((w) => w.accessState === "expired" || w.accessState === "purchased").map((w) => w.id),
    [workspaces],
  );
  // One query for every eligible product at once, instead of the N
  // individual lookups ReviewPromptCard used to fire itself (one per
  // rendered card) — see reviewService.getForUserBatch. `undefined` while
  // loading; every LibraryWorkspaceCard below treats that the same as its
  // own review still being fetched.
  const { data: reviewRows } = useAsync(
    () => (user ? reviewService.getForUserBatch(user.id, reviewEligibleProductIds) : Promise.resolve([])),
    [user?.id, reviewEligibleProductIds.join(",")],
  );
  const reviewByProductId = useMemo(
    () => (reviewRows ? new Map(reviewRows.map((review) => [review.product_id, review])) : undefined),
    [reviewRows],
  );

  // catalog_index rows for the member's own owned products — the one place
  // Library reads this table, feeding badges (New/Updated/Best Seller/Free/
  // Trial Available) on every My Workspaces/Continue Working/Favorites
  // card. An owned-but-archived Workspace has no row here (archive_product()
  // removes it) — it just shows no badges, the same "missing metadata, hide
  // it" handling every other optional field already gets.
  const { data: catalogRows } = useAsync(() => catalogService.getByProductIds(ownedProductIds), [ownedProductIds.join(",")]);
  const badgesByProductId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getWorkspaceBadges>>();
    for (const row of catalogRows ?? []) map.set(row.product_id, getWorkspaceBadges(row));
    return map;
  }, [catalogRows]);

  const categoryIdBySlug = useMemo(
    () => new Map((facets?.categories ?? []).map((category) => [category.slug, category.id])),
    [facets],
  );
  const categoryNameById = useMemo(
    () => new Map((facets?.categories ?? []).map((category) => [category.id, category.name])),
    [facets],
  );
  // Only categories the member actually owns something in — a strict
  // subset of the site-wide facet list, so the chip row never advertises a
  // category with nothing to show.
  const ownedCategories = useMemo(() => {
    const ownedIds = new Set((workspaces ?? []).map((w) => w.category_id).filter((id): id is string => Boolean(id)));
    return (facets?.categories ?? []).filter((category) => ownedIds.has(category.id));
  }, [facets, workspaces]);

  // --- Quick-access rail derivations (section ORDER itself lives in
  // LibraryDashboardSections — Continue Working is always passed first and
  // rendered first, per its top-priority requirement) ---

  const continueWorkingAll = useMemo(() => {
    if (!workspaces) return [];
    return workspaces
      .filter((w) => (w.accessState === "trial" || w.accessState === "purchased") && w.license?.last_opened_at)
      .sort((a, b) => new Date(b.license!.last_opened_at!).getTime() - new Date(a.license!.last_opened_at!).getTime());
  }, [workspaces]);
  const continueWorking = useMemo(() => continueWorkingAll.slice(0, CONTINUE_WORKING_LIMIT), [continueWorkingAll]);
  const continueWorkingHasMore = continueWorkingAll.length > CONTINUE_WORKING_LIMIT;

  const favoriteWorkspacesAll = useMemo(() => {
    if (!workspaces) return [];
    return workspaces
      .filter((w) => w.license?.is_favorite)
      .sort((a, b) => new Date(b.license?.activated_at ?? 0).getTime() - new Date(a.license?.activated_at ?? 0).getTime());
  }, [workspaces]);
  const favoriteWorkspaces = useMemo(() => favoriteWorkspacesAll.slice(0, RAIL_DISPLAY_LIMIT), [favoriteWorkspacesAll]);
  const favoritesHasMore = favoriteWorkspacesAll.length > RAIL_DISPLAY_LIMIT;

  // Per-product progress signal from workspace_instances — "Not Started"
  // means a license exists but the member has never created a saved
  // instance for it yet; "In Progress"/"Completed" mean at least one
  // instance currently sits in that status (a product can have both if a
  // member keeps several named instances, e.g. one checklist per client).
  const progressByProductId = useMemo(() => {
    const map = new Map<string, { hasInProgress: boolean; hasCompleted: boolean; hasAny: boolean }>();
    for (const instance of instances ?? []) {
      const entry = map.get(instance.product_id) ?? { hasInProgress: false, hasCompleted: false, hasAny: false };
      entry.hasAny = true;
      if (instance.status === "in_progress") entry.hasInProgress = true;
      if (instance.status === "completed") entry.hasCompleted = true;
      map.set(instance.product_id, entry);
    }
    return map;
  }, [instances]);

  // My Documents — every saved instance across every owned Workspace,
  // flattened into one chronological collection (most recently updated
  // first). Reuses the single instances fetch above; no new query.
  const documents = useMemo(
    () => [...(instances ?? [])].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [instances],
  );

  const visibleWorkspaces = useMemo(() => {
    if (!workspaces) return null;

    const query = debouncedQ.trim().toLowerCase();
    const selectedCategoryId = categorySlug ? categoryIdBySlug.get(categorySlug) : undefined;

    const filtered = workspaces.filter((workspace) => {
      if (query && !workspace.name.toLowerCase().includes(query)) return false;
      if (selectedCategoryId && workspace.category_id !== selectedCategoryId) return false;
      if (accessFilter !== "all" && workspace.license?.type !== accessFilter) return false;
      if (progressFilter !== "all") {
        const progress = progressByProductId.get(workspace.id);
        if (progressFilter === "not_started" && progress?.hasAny) return false;
        if (progressFilter === "in_progress" && !progress?.hasInProgress) return false;
        if (progressFilter === "completed" && !progress?.hasCompleted) return false;
      }
      if (favoritesOnly && !workspace.license?.is_favorite) return false;
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sort) {
        case "alphabetical":
          return a.name.localeCompare(b.name);
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "recently_purchased":
          return new Date(b.license?.activated_at ?? 0).getTime() - new Date(a.license?.activated_at ?? 0).getTime();
        case "recently_opened":
        default: {
          // Never-opened sorts after every opened Workspace, most-recent first.
          const aOpened = a.license?.last_opened_at;
          const bOpened = b.license?.last_opened_at;
          if (!aOpened && !bOpened) return 0;
          if (!aOpened) return 1;
          if (!bOpened) return -1;
          return new Date(bOpened).getTime() - new Date(aOpened).getTime();
        }
      }
    });

    return sorted;
  }, [workspaces, debouncedQ, categorySlug, categoryIdBySlug, accessFilter, progressFilter, favoritesOnly, progressByProductId, sort]);

  // Whenever the filtered/sorted set itself changes, start back at page one
  // — otherwise switching filters could leave visibleCount referencing a
  // position in a completely different list. viewMode is deliberately not a
  // dependency: toggling Grid/List keeps whatever page depth was reached.
  useEffect(() => {
    setVisibleCount(ALL_WORKSPACES_PAGE_SIZE);
  }, [debouncedQ, categorySlug, accessFilter, progressFilter, favoritesOnly, sort]);

  // Render only a bounded slice of the (already fully in-memory) filtered
  // list — the point isn't reducing what's fetched, it's keeping DOM/render
  // cost flat regardless of library size.
  const pagedWorkspaces = useMemo(
    () => (visibleWorkspaces ? visibleWorkspaces.slice(0, visibleCount) : null),
    [visibleWorkspaces, visibleCount],
  );
  const hasMoreWorkspaces = (visibleWorkspaces?.length ?? 0) > visibleCount;

  const displayName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "A member";

  async function handleToggleFavorite(workspace: WorkspaceWithAccess) {
    if (!workspace.license) return;
    setTogglingFavoriteId(workspace.license.id);
    try {
      await licenseService.toggleFavorite(workspace.license.id, !workspace.license.is_favorite);
      await refetchLicenses();
    } finally {
      setTogglingFavoriteId(null);
    }
  }

  function handleRetry() {
    refetchProducts();
    refetchLicenses();
    refetchGrants();
    refetchInstances();
  }

  if (!isLoading && !error && !hasAnyAccess) {
    // Before a trial is chosen, Library is nothing but this welcome state —
    // not a banner sitting above an already-empty grid.
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-6 py-12 text-center">
        <span className="text-sm font-semibold uppercase tracking-wider text-primary">Welcome to BGrowth</span>
        <h1 className="mt-3 text-3xl font-bold text-navy-900 dark:text-white sm:text-4xl">
          Choose Your Free Trial
        </h1>
        <p className="mt-4 text-navy-500 dark:text-white/60">
          Pick one Workspace to try, completely free. Once you activate it, it'll live right here in
          your Library.
        </p>
        <Link to="/trial-selection" className="mt-8">
          <Button size="lg">Choose Your Free Trial</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 dark:text-white">My Library</h1>
          <p className="mt-1 text-sm text-navy-500 dark:text-white/60">
            The Workspaces you're trialing or have purchased.
          </p>
        </div>
        <Link to="/browse" className="text-sm font-semibold text-primary hover:underline">
          Browse Workspaces →
        </Link>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      )}

      {!isLoading && error && (
        <div className="mt-8">
          <FetchErrorState message="Couldn't load your Library right now." onRetry={handleRetry} />
        </div>
      )}

      {!isLoading && !error && workspaces && workspaces.length > 1 && user && (
        <LibraryDashboardSections
          continueWorking={continueWorking}
          continueWorkingHasMore={continueWorkingHasMore}
          onViewAllContinueWorking={handleViewAllContinueWorking}
          favorites={favoriteWorkspaces}
          favoritesHasMore={favoritesHasMore}
          onViewAllFavorites={handleViewAllFavorites}
          badgesByProductId={badgesByProductId}
          reviewByProductId={reviewByProductId}
          userId={user.id}
          displayName={displayName}
          onToggleFavorite={handleToggleFavorite}
          togglingFavoriteId={togglingFavoriteId}
        />
      )}

      {!isLoading && !error && workspaces && workspaces.length > 1 && (
        <>
          {ownedCategories.length > 1 && (
            <div className="mt-12">
              <h2 className="mb-4 text-lg font-bold text-navy-900 dark:text-white">Browse by Category</h2>
              <CategoryChips categories={ownedCategories} selected={categorySlug} onSelect={setCategorySlug} />
            </div>
          )}

          <div ref={allWorkspacesRef} className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold text-navy-900 dark:text-white">My Workspaces</h2>
            <div className="flex items-center gap-1 rounded-full border border-navy-100 p-1 dark:border-white/10">
              <button
                type="button"
                onClick={() => handleViewModeChange("grid")}
                aria-pressed={viewMode === "grid"}
                aria-label="Grid view"
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  viewMode === "grid"
                    ? "bg-primary text-white"
                    : "text-navy-500 hover:text-primary dark:text-white/60"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                Grid
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange("list")}
                aria-pressed={viewMode === "list"}
                aria-label="List view"
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  viewMode === "list"
                    ? "bg-primary text-white"
                    : "text-navy-500 hover:text-primary dark:text-white/60"
                }`}
              >
                <ListIcon className="h-4 w-4" />
                List
              </button>
            </div>
          </div>

          <div className="mt-6">
            <LibraryFilterBar
              q={q}
              onQChange={setQ}
              categorySlug={categorySlug}
              onCategoryChange={setCategorySlug}
              categories={facets?.categories ?? []}
              accessFilter={accessFilter}
              onAccessFilterChange={setAccessFilter}
              progressFilter={progressFilter}
              onProgressFilterChange={setProgressFilter}
              sort={sort}
              onSortChange={setSort}
              favoritesOnly={favoritesOnly}
              onFavoritesOnlyChange={setFavoritesOnly}
            />
          </div>
        </>
      )}

      {!isLoading && !error && visibleWorkspaces && visibleWorkspaces.length === 0 && (
        <p className="mt-12 text-center text-sm text-navy-400 dark:text-white/40">
          No Workspaces match these filters — try broadening your search.
        </p>
      )}

      {!isLoading && !error && pagedWorkspaces && pagedWorkspaces.length > 0 && user && viewMode === "list" && (
        <div className="mt-8 flex flex-col gap-3">
          {pagedWorkspaces.map((workspace) => (
            <LibraryWorkspaceListRow
              key={workspace.id}
              workspace={workspace}
              categoryName={workspace.category_id ? categoryNameById.get(workspace.category_id) : undefined}
              onToggleFavorite={() => handleToggleFavorite(workspace)}
              isTogglingFavorite={togglingFavoriteId === workspace.license?.id}
              badges={badgesByProductId.get(workspace.id)}
            />
          ))}
        </div>
      )}

      {!isLoading && !error && pagedWorkspaces && pagedWorkspaces.length > 0 && user && viewMode === "grid" && (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {pagedWorkspaces.map((workspace) => (
            <LibraryWorkspaceCard
              key={workspace.id}
              workspace={workspace}
              userId={user.id}
              displayName={displayName}
              onToggleFavorite={() => handleToggleFavorite(workspace)}
              isTogglingFavorite={togglingFavoriteId === workspace.license?.id}
              badges={badgesByProductId.get(workspace.id)}
              review={reviewByProductId ? (reviewByProductId.get(workspace.id) ?? null) : undefined}
            />
          ))}
        </div>
      )}

      {!isLoading && !error && hasMoreWorkspaces && (
        <div className="mt-10 flex flex-col items-center gap-2">
          <Button variant="secondary" onClick={() => setVisibleCount((count) => count + ALL_WORKSPACES_PAGE_SIZE)}>
            Load More
          </Button>
          <p className="text-xs text-navy-400 dark:text-white/40">
            Showing {pagedWorkspaces?.length ?? 0} of {visibleWorkspaces?.length ?? 0}
          </p>
        </div>
      )}

      {!isLoading && !error && <MyDocumentsSection documents={documents} workspaceById={workspaceById} />}

      {!isLoading && !error && <ExploreWorkspacesSection products={exploreWorkspaces} />}
    </div>
  );
}
