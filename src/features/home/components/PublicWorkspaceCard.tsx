import { Link } from "react-router-dom";
import type { ProductRow } from "@/types/database";

export function PublicWorkspaceCard({ product }: { product: ProductRow }) {
  return (
    <div className="card group overflow-hidden">
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
      <div className="p-6">
        <h3 className="text-lg font-semibold text-navy-900 dark:text-white">{product.name}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-navy-500 dark:text-white/60">
          {product.short_description}
        </p>
        <Link
          to="/sign-up"
          className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline"
        >
          Preview Workspace →
        </Link>
      </div>
    </div>
  );
}
