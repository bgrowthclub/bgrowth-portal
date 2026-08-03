import { Link } from "react-router-dom";
import type { ProductRow } from "@/types/database";

interface ExploreWorkspaceCardProps {
  product: Pick<ProductRow, "slug" | "name" | "short_description" | "cover_image_url">;
}

/**
 * My Library's "Explore More Workspaces" card — pure discovery, same
 * philosophy as CatalogProductCard (Browse/Home): the whole card is a
 * single link to the Product Details page, never a direct Buy/Trial action,
 * never a Workspace-content preview. Built directly off the ProductRow
 * fields My Library already has in memory (no catalog_index lookup, no
 * ratings/badges) — deliberately simpler than Browse's card, since this is
 * a small discovery nudge, not a second marketplace.
 */
export function ExploreWorkspaceCard({ product }: ExploreWorkspaceCardProps) {
  return (
    <Link to={`/product/${product.slug}`} className="card group flex h-full flex-col overflow-hidden">
      <div className="aspect-[16/10] w-full overflow-hidden bg-navy-100 dark:bg-navy-700">
        {product.cover_image_url ? (
          <img
            src={product.cover_image_url}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-primary/40">
            <span className="text-4xl font-bold">{product.name.charAt(0)}</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-lg font-semibold text-navy-900 dark:text-white">{product.name}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-navy-500 dark:text-white/60">{product.short_description}</p>
        <div className="mt-5">
          <span className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-navy-100 bg-white px-4 py-2 text-xs font-semibold text-navy-900 shadow-soft transition-all duration-200 group-hover:border-primary/40 group-hover:text-primary dark:border-white/10 dark:bg-navy-800 dark:text-white">
            View Details
          </span>
        </div>
      </div>
    </Link>
  );
}
