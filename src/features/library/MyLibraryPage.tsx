import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutGrid, List as ListIcon } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { productService } from "@/services/productService";
import { licenseService } from "@/services/licenseService";
import { workspaceInstanceService } from "@/services/workspaceInstanceService";
import { catalogService } from "@/services/catalogService";
import { attachAccessState } from "@/lib/workspaceAccess";
import { getLibraryViewPreference, setLibraryViewPreference, type LibraryViewMode } from "@/lib/libraryViewPreference";
import { getWorkspaceBadges, isRecentlyUpdated } from "@/lib/workspaceBadges";
import { rankRecommendations } from "@/lib/recommendations";
import type { WorkspaceWithAccess } from "@/types/workspace";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { FetchErrorState } from "@/components/ui/FetchErrorState";
import { LibraryWorkspaceCard } from "./components/LibraryWorkspaceCard";
import { LibraryWorkspaceListRow } from "./components/LibraryWorkspaceListRow";
import { LibraryDashboardSections } from "./components/LibraryDashboardSections";
import { CategoryChips } from "./components/CategoryChips";
import { SavedChecklistsPanel } from "./components/SavedChecklistsPanel";
import {
  LibraryFilterBar,
  type LibraryAccessFilter,
  type LibraryProgressFilter,
  type LibrarySortOption,
} from "./components/LibraryFilterBar";

const CONTINUE_WORKING_LIMIT = 5;
const RECOMMENDED_CANDIDATE_POOL = 24;
const RECOMMENDED_DISPLAY_LIMIT = 10;

/** Most-recent activity signal for a single owned Workspace — opened wins over merely purchased, matching "Recently Opened"'s own tie-break elsewhere on this page. */
function lastActivityTime(workspace: WorkspaceWithAccess): number {
  return new Date(workspace.license?.last_opened_at ?? workspace.license?.activated_at ?? 0).getTime();
}

export function MyLibraryPage() {
  const { user } = useAuth();

  const {
    data: licenses,
    isLoading: isLoadingLicenses,
    error: licensesError,
    refetch: refetchLicenses,
  } = useAsync(() => (user ? licenseService.fetchForUser(user.id) : Promise.resolve([])), [user?.id]);
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
  // Saved Checklists is an optional, secondary feature of My Library, not a
  // reason to block it — a failure here (e.g. a not-yet-applied migration)
  // must never stop a member from seeing/opening the Workspaces they own.
  // Deliberately excluded from `isLoading`/`error` below; on failure,
  // `instances` just stays null and every card's "Saved Checklists" section
  // renders as empty instead of the whole page failing.
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

  function handleViewModeChange(mode: LibraryViewMode) {
    setViewMode(mode);
    setLibraryViewPreference(mode);
  }

  const isLoading = isLoadingProducts || isLoadingLicenses;
  const error = productsError ?? licensesError;
  const hasAnyLicense = (licenses?.length ?? 0) > 0;
  // Only Workspaces the member actually owns — locked (never activated/bought)
  // Workspaces live in Browse Workspaces instead. A Workspace stays here even
  // after its trial expires (see LibraryWorkspaceCard) — it never disappears,
  // it just switches to a Buy Now prompt.
  const workspaces = products && licenses
    ? attachAccessState(products, licenses).filter((w) => w.accessState !== "locked")
    : null;
  const ownedProductIds = useMemo(() => (workspaces ?? []).map((w) => w.id), [workspaces]);

  // catalog_index rows for the member's own owned products — the one place
  // Library reads this table, feeding badges (New/Updated/Best Seller/Free/
  // Trial Available) and Recently Updated. An owned-but-archived Workspace
  // has no row here (archive_product() removes it) — it just shows no
  // badges and never qualifies for Recently Updated, the same "missing
  // metadata, hide it" handling every other optional field already gets.
  const { data: catalogRows } = useAsync(() => catalogService.getByProductIds(ownedProductIds), [ownedProductIds.join(",")]);
  const catalogRowByProductId = useMemo(
    () => new Map((catalogRows ?? []).map((row) => [row.product_id, row])),
    [catalogRows],
  );
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

  // --- Dashboard section derivations (section ORDER itself lives in
  // LibraryDashboardSections — Continue Working is always passed first and
  // rendered first, per its top-priority requirement) ---

  const continueWorking = useMemo(() => {
    if (!workspaces) return [];
    return workspaces
      .filter((w) => (w.accessState === "trial" || w.accessState === "purchased") && w.license?.last_opened_at)
      .sort((a, b) => new Date(b.license!.last_opened_at!).getTime() - new Date(a.license!.last_opened_at!).getTime())
      .slice(0, CONTINUE_WORKING_LIMIT);
  }, [workspaces]);

  const favoriteWorkspaces = useMemo(() => {
    if (!workspaces) return [];
    return workspaces
      .filter((w) => w.license?.is_favorite)
      .sort((a, b) => new Date(b.license?.activated_at ?? 0).getTime() - new Date(a.license?.activated_at ?? 0).getTime());
  }, [workspaces]);

  const recentPurchaseWorkspaces = useMemo(() => {
    if (!workspaces) return [];
    return [...workspaces].sort(
      (a, b) => new Date(b.license?.activated_at ?? 0).getTime() - new Date(a.license?.activated_at ?? 0).getTime(),
    );
  }, [workspaces]);

  const recentlyUpdatedWorkspaces = useMemo(() => {
    if (!workspaces) return [];
    return workspaces
      .filter((w) => {
        const catalogRow = catalogRowByProductId.get(w.id);
        return catalogRow ? isRecentlyUpdated(catalogRow) : false;
      })
      .sort(
        (a, b) =>
          new Date(catalogRowByProductId.get(b.id)!.updated_at).getTime() -
          new Date(catalogRowByProductId.get(a.id)!.updated_at).getTime(),
      );
  }, [workspaces, catalogRowByProductId]);

  // Explicit union, not just "everything owned" — expresses "don't repeat
  // Continue Working/Favorites/Recent Purchases" as its own guarantee
  // rather than relying on the coincidence that Recommended already
  // excludes every owned product at the SQL level (see
  // rankRecommendations()'s own doc comment on why this stays independent).
  const alreadyShownProductIds = useMemo(
    () =>
      new Set([
        ...continueWorking.map((w) => w.id),
        ...favoriteWorkspaces.map((w) => w.id),
        ...recentPurchaseWorkspaces.map((w) => w.id),
      ]),
    [continueWorking, favoriteWorkspaces, recentPurchaseWorkspaces],
  );

  // "Recent activity" for Recommended For You: owned categories ordered by
  // which one the member was most recently active in (opened, else
  // purchased), most recent first — see src/lib/recommendations.ts.
  const ownedCategoryIdsByRecency = useMemo(() => {
    if (!workspaces) return [];
    const sorted = [...workspaces].sort((a, b) => lastActivityTime(b) - lastActivityTime(a));
    const seen: string[] = [];
    for (const workspace of sorted) {
      if (workspace.category_id && !seen.includes(workspace.category_id)) seen.push(workspace.category_id);
    }
    return seen;
  }, [workspaces]);

  const { data: recommendedCandidates } = useAsync(
    () =>
      ownedCategoryIdsByRecency.length > 0
        ? catalogService.getRecommendedForCategories({
            categoryIds: ownedCategoryIdsByRecency,
            excludeProductIds: ownedProductIds,
            limit: RECOMMENDED_CANDIDATE_POOL,
          })
        : Promise.resolve([]),
    [ownedCategoryIdsByRecency.join(","), ownedProductIds.join(",")],
  );

  const recommended = useMemo(() => {
    if (!recommendedCandidates) return [];
    return rankRecommendations(recommendedCandidates, {
      ownedCategoryIdsByRecency,
      alreadyShownProductIds,
    }).slice(0, RECOMMENDED_DISPLAY_LIMIT);
  }, [recommendedCandidates, ownedCategoryIdsByRecency, alreadyShownProductIds]);

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
    refetchInstances();
  }

  if (!isLoading && !error && !hasAnyLicense) {
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
          recommended={recommended}
          recentlyUpdated={recentlyUpdatedWorkspaces}
          favorites={favoriteWorkspaces}
          recentPurchases={recentPurchaseWorkspaces}
          badgesByProductId={badgesByProductId}
          categoryNameById={categoryNameById}
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

          <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold text-navy-900 dark:text-white">All Workspaces</h2>
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

      {!isLoading && !error && visibleWorkspaces && visibleWorkspaces.length > 0 && user && viewMode === "list" && (
        <div className="mt-8 flex flex-col gap-3">
          {visibleWorkspaces.map((workspace) => (
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

      {!isLoading && !error && visibleWorkspaces && visibleWorkspaces.length > 0 && user && viewMode === "grid" && (
        <div className="mt-8 flex flex-col gap-8">
          {visibleWorkspaces.map((workspace) => {
            const canOpen = workspace.accessState === "trial" || workspace.accessState === "purchased";
            return (
              // 40/60 on desktop, 45/55 on tablet, stacked (card first) on
              // mobile. When the Workspace can't be opened (expired trial,
              // no active license), there's no Saved Checklists panel to
              // pair it with — the card alone occupies just the first
              // column's width via grid auto-placement, rather than
              // stretching to the full row.
              <div key={workspace.id} className="grid grid-cols-1 gap-6 md:grid-cols-[45%_55%] lg:grid-cols-[40%_60%]">
                <LibraryWorkspaceCard
                  workspace={workspace}
                  userId={user.id}
                  displayName={displayName}
                  onToggleFavorite={() => handleToggleFavorite(workspace)}
                  isTogglingFavorite={togglingFavoriteId === workspace.license?.id}
                  badges={badgesByProductId.get(workspace.id)}
                />
                {canOpen && (
                  <SavedChecklistsPanel
                    workspace={workspace}
                    userId={user.id}
                    instances={(instances ?? []).filter((instance) => instance.product_id === workspace.id)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
