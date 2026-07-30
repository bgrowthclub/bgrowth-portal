import { Link } from "react-router-dom";
import type { CatalogIndexRow } from "@/types/database";
import { StarRating } from "@/components/ui/StarRating";
import { formatContentType } from "@/lib/contentType";
import { NEW_WINDOW_DAYS } from "@/services/catalogService";

interface CatalogProductCardProps {
  item: CatalogIndexRow;
  /** Looked up once by the caller (catalogService.getFacets().categories) rather than fetched per card. */
  categoryName?: string;
}

/**
 * The catalog_index-driven card shared by Browse, Home's curated rails, and
 * Collection pages — a sibling to MarketplaceWorkspaceCard/PublicWorkspaceCard/
 * LibraryWorkspaceCard (see the Component Evolution pattern those three
 * already follow), not a shared "mode" bolted onto any of them. Those three
 * keep reading straight off ProductRow at their existing call sites; this
 * one is the only card that reads a CatalogIndexRow.
 *
 * Pure discovery — no purchase/trial action lives here. The whole card (and
 * its "View Details" button) is a single link to the Product Details page
 * (/product/:slug); Start Free Trial and Buy Now only ever happen from
 * there (see ProductPricingSection), never from a card.
 */
export function CatalogProductCard({ item, categoryName }: CatalogProductCardProps) {
  const isNew = item.published_at != null && Date.now() - new Date(item.published_at).getTime() < NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  return (
    <Link to={`/product/${item.slug}`} className="card group flex h-full flex-col overflow-hidden">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-navy-100 dark:bg-navy-700">
        {item.cover_image_url ? (
          <img
            src={item.cover_image_url}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-primary/40">
            <span className="text-4xl font-bold">{item.name.charAt(0)}</span>
          </div>
        )}
        {(item.is_featured || isNew) && (
          <span className="badge absolute left-3 top-3 bg-primary text-white">
            {item.is_featured ? "Featured" : "New"}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap items-center gap-1.5">
          {categoryName && <span className="badge bg-navy-50 text-navy-500 dark:bg-white/5 dark:text-white/50">{categoryName}</span>}
          <span className="badge bg-navy-50 text-navy-500 dark:bg-white/5 dark:text-white/50">{formatContentType(item.content_type)}</span>
        </div>

        <h3 className="mt-3 text-lg font-semibold text-navy-900 dark:text-white">{item.name}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-navy-500 dark:text-white/60">{item.short_description}</p>

        {item.review_count > 0 && item.avg_rating != null && (
          <div className="mt-3 flex items-center gap-2">
            <StarRating rating={item.avg_rating} />
            <span className="text-xs font-semibold text-navy-900 dark:text-white">{item.avg_rating.toFixed(1)}</span>
            <span className="text-xs text-navy-400 dark:text-white/40">
              · {item.review_count} {item.review_count === 1 ? "Review" : "Reviews"}
            </span>
          </div>
        )}

        <div className="mt-5">
          {/*
            A styled span, not the Button component — this whole card is
            already a single <Link>, and nesting a real <button> inside an
            <a> is invalid HTML (and confuses keyboard/screen-reader focus
            order). This is the visual "View Details" affordance the whole
            card already acts on; group-hover mirrors Button's own hover state.
          */}
          <span className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-navy-100 bg-white px-4 py-2 text-xs font-semibold text-navy-900 shadow-soft transition-all duration-200 group-hover:border-primary/40 group-hover:text-primary dark:border-white/10 dark:bg-navy-800 dark:text-white">
            View Details
          </span>
        </div>
      </div>
    </Link>
  );
}
