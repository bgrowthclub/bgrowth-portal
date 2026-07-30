import { Link } from "react-router-dom";
import type { ProductRow, WorkspaceInstanceRow } from "@/types/database";

interface ContinueLearningCardProps {
  instance: WorkspaceInstanceRow;
  product: Pick<ProductRow, "name" | "slug" | "cover_image_url">;
}

/**
 * Home's "Continue Learning" rail item — a sibling to CatalogProductCard,
 * not a mode bolted onto it: this reads a WorkspaceInstanceRow (an owned,
 * in-progress Workspace), not a CatalogIndexRow, and resumes the exact
 * instance (`/workspace/:slug?instance=<id>`, the same deep-link
 * WorkspaceViewerPage already supports) instead of going to the Product
 * Details page — a member who's already working through this Workspace
 * doesn't need the marketing pitch again.
 */
export function ContinueLearningCard({ instance, product }: ContinueLearningCardProps) {
  return (
    <Link
      to={`/workspace/${product.slug}?instance=${instance.id}`}
      className="card group flex h-full flex-col overflow-hidden"
    >
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
        <p className="mt-2 line-clamp-1 text-sm text-navy-500 dark:text-white/60">{instance.label}</p>
        <span className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-soft transition-all duration-200 group-hover:bg-primary-600">
          Continue
        </span>
      </div>
    </Link>
  );
}
