import { Link } from "react-router-dom";
import type { ProductRow } from "@/types/database";
import { ExploreWorkspaceCard } from "./ExploreWorkspaceCard";

interface ExploreWorkspacesSectionProps {
  /** Already capped to a small selection and sorted by the caller (see MyLibraryPage) — this component never slices or sorts. */
  products: ProductRow[];
}

/**
 * My Library's product-discovery section — a small, capped selection of
 * published Workspaces the member doesn't have access to yet (see
 * MyLibraryPage's exploreWorkspaces, derived from the same attachAccessState
 * call My Workspaces uses, filtered to "locked"). Deliberately not a second
 * Browse: no search/filters/pagination here, just a nudge plus a link to
 * the real thing. Hides entirely when nothing qualifies.
 */
export function ExploreWorkspacesSection({ products }: ExploreWorkspacesSectionProps) {
  if (products.length === 0) return null;

  return (
    <div className="mt-12">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-navy-900 dark:text-white">Explore More Workspaces</h2>
          <p className="mt-1 text-sm text-navy-500 dark:text-white/60">Workspaces you don&apos;t have access to yet.</p>
        </div>
        <Link to="/browse" className="text-sm font-semibold text-primary hover:underline">
          Browse All Workspaces →
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ExploreWorkspaceCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
