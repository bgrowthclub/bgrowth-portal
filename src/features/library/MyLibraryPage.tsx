import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { productService } from "@/services/productService";
import { licenseService } from "@/services/licenseService";
import { workspaceInstanceService } from "@/services/workspaceInstanceService";
import { catalogService } from "@/services/catalogService";
import { attachAccessState } from "@/lib/workspaceAccess";
import type { WorkspaceWithAccess } from "@/types/workspace";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { FetchErrorState } from "@/components/ui/FetchErrorState";
import { LibraryWorkspaceCard } from "./components/LibraryWorkspaceCard";
import { SavedChecklistsPanel } from "./components/SavedChecklistsPanel";
import {
  LibraryFilterBar,
  type LibraryAccessFilter,
  type LibraryProgressFilter,
  type LibrarySortOption,
} from "./components/LibraryFilterBar";

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

  const categoryIdBySlug = useMemo(
    () => new Map((facets?.categories ?? []).map((category) => [category.slug, category.id])),
    [facets],
  );

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

      {!isLoading && !error && workspaces && workspaces.length > 1 && (
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
      )}

      {!isLoading && !error && visibleWorkspaces && visibleWorkspaces.length === 0 && (
        <p className="mt-12 text-center text-sm text-navy-400 dark:text-white/40">
          No Workspaces match these filters — try broadening your search.
        </p>
      )}

      {!isLoading && !error && visibleWorkspaces && visibleWorkspaces.length > 0 && user && (
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
                  displayName={(user.user_metadata?.full_name as string | undefined) ?? user.email ?? "A member"}
                  onToggleFavorite={() => handleToggleFavorite(workspace)}
                  isTogglingFavorite={togglingFavoriteId === workspace.license?.id}
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
