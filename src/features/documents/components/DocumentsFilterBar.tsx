import { Search, X } from "lucide-react";

export type DocumentSortOption = "last_updated" | "newest" | "oldest" | "name_asc";

const SORT_OPTIONS: { value: DocumentSortOption; label: string }[] = [
  { value: "last_updated", label: "Last Updated" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name_asc", label: "Name A–Z" },
];

interface DocumentsFilterBarProps {
  q: string;
  onQChange: (value: string) => void;
  workspaceId: string | undefined;
  onWorkspaceChange: (value: string | undefined) => void;
  /** Every Workspace referenced by the member's own documents — derived client-side, never a separate fetch (see DocumentsPage). */
  workspaces: { id: string; name: string }[];
  sort: DocumentSortOption;
  onSortChange: (value: DocumentSortOption) => void;
}

/**
 * /documents' search/filter/sort bar — same visual pattern as My Library's
 * own LibraryFilterBar, but over a different, smaller set of controls (no
 * access/progress/favorites dimensions here), so it's a sibling component
 * rather than a modification of that one.
 */
export function DocumentsFilterBar({
  q,
  onQChange,
  workspaceId,
  onWorkspaceChange,
  workspaces,
  sort,
  onSortChange,
}: DocumentsFilterBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <label htmlFor="documents-search" className="sr-only">
          Search documents
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400 dark:text-white/40" />
        <input
          id="documents-search"
          type="search"
          value={q}
          onChange={(event) => onQChange(event.target.value)}
          placeholder="Search documents..."
          className="input-field pl-9 pr-9"
        />
        {q && (
          <button
            type="button"
            onClick={() => onQChange("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-300 hover:text-navy-500 dark:text-white/30 dark:hover:text-white/60"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <select
        value={workspaceId ?? ""}
        onChange={(event) => onWorkspaceChange(event.target.value || undefined)}
        className="input-field sm:w-56"
        aria-label="Filter by Workspace"
      >
        <option value="">All Workspaces</option>
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>

      <select
        value={sort}
        onChange={(event) => onSortChange(event.target.value as DocumentSortOption)}
        className="input-field sm:w-48"
        aria-label="Sort by"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
