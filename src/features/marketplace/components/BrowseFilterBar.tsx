import { Search } from "lucide-react";
import type { ContentType, WorkspaceCategoryRow } from "@/types/database";
import type { CatalogSortOption } from "@/services/catalogService";
import { formatContentType } from "@/lib/contentType";

interface BrowseFilterBarProps {
  q: string;
  onQChange: (value: string) => void;
  categorySlug: string | undefined;
  onCategoryChange: (value: string | undefined) => void;
  categories: Pick<WorkspaceCategoryRow, "id" | "name" | "slug">[];
  contentType: ContentType | undefined;
  onContentTypeChange: (value: ContentType | undefined) => void;
  contentTypes: ContentType[];
  tags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  freeOnly: boolean;
  onFreeOnlyChange: (value: boolean) => void;
  sort: CatalogSortOption;
  onSortChange: (value: CatalogSortOption) => void;
  isSearching: boolean;
}

const SORT_OPTIONS: { value: CatalogSortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "recently_updated", label: "Recently Updated" },
  { value: "popular", label: "Most Popular" },
  { value: "top_rated", label: "Top Rated" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
];

/** Sticky search/filter/sort bar for Browse — a plain wrapping bar rather than a slide-out sheet; every control stays reachable and keyboard-operable at any width without the added complexity of a modal overlay. */
export function BrowseFilterBar({
  q,
  onQChange,
  categorySlug,
  onCategoryChange,
  categories,
  contentType,
  onContentTypeChange,
  contentTypes,
  tags,
  selectedTags,
  onToggleTag,
  freeOnly,
  onFreeOnlyChange,
  sort,
  onSortChange,
  isSearching,
}: BrowseFilterBarProps) {
  return (
    <div className="sticky top-0 z-10 -mx-6 border-b border-navy-100/60 bg-white/90 px-6 py-4 backdrop-blur dark:border-white/10 dark:bg-navy-900/90">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <label htmlFor="browse-search" className="sr-only">
            Search Workspaces
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400 dark:text-white/40" />
          <input
            id="browse-search"
            type="search"
            value={q}
            onChange={(event) => onQChange(event.target.value)}
            placeholder="Search Workspaces..."
            className="input-field pl-9"
          />
        </div>

        <select
          value={categorySlug ?? ""}
          onChange={(event) => onCategoryChange(event.target.value || undefined)}
          className="input-field sm:w-48"
          aria-label="Filter by Industry"
        >
          <option value="">All Industries</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>

        <select
          value={contentType ?? ""}
          onChange={(event) => onContentTypeChange((event.target.value || undefined) as ContentType | undefined)}
          className="input-field sm:w-44"
          aria-label="Filter by Product Type"
        >
          <option value="">All Product Types</option>
          {contentTypes.map((type) => (
            <option key={type} value={type}>
              {formatContentType(type)}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(event) => onSortChange(event.target.value as CatalogSortOption)}
          className="input-field sm:w-52"
          aria-label="Sort by"
        >
          {isSearching && <option value="relevance">Relevance</option>}
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 whitespace-nowrap text-sm text-navy-600 dark:text-white/70">
          <input
            type="checkbox"
            checked={freeOnly}
            onChange={(event) => onFreeOnlyChange(event.target.checked)}
            className="h-4 w-4 rounded border-navy-200 text-primary focus:ring-primary/40"
          />
          Free only
        </label>
      </div>

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onToggleTag(tag)}
              className={`badge transition ${
                selectedTags.includes(tag)
                  ? "bg-primary text-white"
                  : "bg-navy-50 text-navy-500 hover:bg-navy-100 dark:bg-white/5 dark:text-white/50"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
