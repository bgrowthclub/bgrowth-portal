import type { WorkspaceCategoryRow } from "@/types/database";

interface CategoryChipsProps {
  categories: Pick<WorkspaceCategoryRow, "id" | "name" | "slug">[];
  selected: string | undefined;
  onSelect: (slug: string | undefined) => void;
}

/**
 * "Browse by Category" — same chip pattern as Home's Categories section
 * (AvailableWorkspacesSection.tsx), but selecting one here doesn't
 * navigate anywhere: it sets the exact same `categorySlug` state
 * LibraryFilterBar's own category <select> already drives (see
 * MyLibraryPage), just as a faster, more visual way to reach it. No new
 * filter logic — this is a second control over one existing piece of state.
 */
export function CategoryChips({ categories, selected, onSelect }: CategoryChipsProps) {
  if (categories.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-4">
      <button
        type="button"
        onClick={() => onSelect(undefined)}
        className={`card px-6 py-4 text-sm font-semibold transition hover:border-primary/40 hover:text-primary ${
          !selected ? "border-primary/40 text-primary" : "text-navy-900 dark:text-white"
        }`}
      >
        All Categories
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onSelect(category.slug)}
          className={`card px-6 py-4 text-sm font-semibold transition hover:border-primary/40 hover:text-primary ${
            selected === category.slug ? "border-primary/40 text-primary" : "text-navy-900 dark:text-white"
          }`}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
