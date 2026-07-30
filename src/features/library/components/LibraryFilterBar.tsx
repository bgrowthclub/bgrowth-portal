import { Search, Star } from "lucide-react";
import type { WorkspaceCategoryRow } from "@/types/database";

export type LibraryAccessFilter = "all" | "trial" | "purchased";
export type LibraryProgressFilter = "all" | "in_progress" | "completed" | "not_started";
export type LibrarySortOption = "recently_opened" | "recently_purchased" | "alphabetical" | "newest";

interface LibraryFilterBarProps {
  q: string;
  onQChange: (value: string) => void;
  categorySlug: string | undefined;
  onCategoryChange: (value: string | undefined) => void;
  categories: Pick<WorkspaceCategoryRow, "id" | "name" | "slug">[];
  accessFilter: LibraryAccessFilter;
  onAccessFilterChange: (value: LibraryAccessFilter) => void;
  progressFilter: LibraryProgressFilter;
  onProgressFilterChange: (value: LibraryProgressFilter) => void;
  sort: LibrarySortOption;
  onSortChange: (value: LibrarySortOption) => void;
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (value: boolean) => void;
}

const ACCESS_OPTIONS: { value: LibraryAccessFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "trial", label: "Trial" },
  { value: "purchased", label: "Purchased" },
];

const PROGRESS_OPTIONS: { value: LibraryProgressFilter; label: string }[] = [
  { value: "all", label: "Any Progress" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "not_started", label: "Not Started" },
];

const SORT_OPTIONS: { value: LibrarySortOption; label: string }[] = [
  { value: "recently_opened", label: "Recently Opened" },
  { value: "recently_purchased", label: "Recently Purchased" },
  { value: "alphabetical", label: "Alphabetical" },
  { value: "newest", label: "Newest" },
];

/**
 * My Library's search/filter/sort bar — same pattern as Browse's
 * BrowseFilterBar, but over the member's own (already fully-fetched, small)
 * owned-Workspace list, not the whole catalog: access (Trial/Purchased,
 * from license.type) and progress (In Progress/Completed/Not Started, from
 * workspace_instances.status) are two independent filters, combined with
 * search/category/favorites — not one flattened five-way single-select,
 * since a Workspace can be e.g. both Trial and In Progress at once.
 */
export function LibraryFilterBar({
  q,
  onQChange,
  categorySlug,
  onCategoryChange,
  categories,
  accessFilter,
  onAccessFilterChange,
  progressFilter,
  onProgressFilterChange,
  sort,
  onSortChange,
  favoritesOnly,
  onFavoritesOnlyChange,
}: LibraryFilterBarProps) {
  return (
    <div className="mt-6 border-b border-navy-100/60 pb-4 dark:border-white/10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <label htmlFor="library-search" className="sr-only">
            Search your Workspaces
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400 dark:text-white/40" />
          <input
            id="library-search"
            type="search"
            value={q}
            onChange={(event) => onQChange(event.target.value)}
            placeholder="Search your Workspaces..."
            className="input-field pl-9"
          />
        </div>

        {categories.length > 1 && (
          <select
            value={categorySlug ?? ""}
            onChange={(event) => onCategoryChange(event.target.value || undefined)}
            className="input-field sm:w-48"
            aria-label="Filter by category"
          >
            <option value="">All Categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        )}

        <select
          value={accessFilter}
          onChange={(event) => onAccessFilterChange(event.target.value as LibraryAccessFilter)}
          className="input-field sm:w-36"
          aria-label="Filter by access"
        >
          {ACCESS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={progressFilter}
          onChange={(event) => onProgressFilterChange(event.target.value as LibraryProgressFilter)}
          className="input-field sm:w-40"
          aria-label="Filter by progress"
        >
          {PROGRESS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(event) => onSortChange(event.target.value as LibrarySortOption)}
          className="input-field sm:w-48"
          aria-label="Sort by"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
          aria-pressed={favoritesOnly}
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${
            favoritesOnly
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-navy-100 text-navy-600 hover:border-primary/40 hover:text-primary dark:border-white/10 dark:text-white/70"
          }`}
        >
          <Star className={`h-4 w-4 ${favoritesOnly ? "fill-primary" : ""}`} />
          Favorites
        </button>
      </div>
    </div>
  );
}
