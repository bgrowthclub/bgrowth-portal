import { useAsync } from "@/hooks/useAsync";
import { productService } from "@/services/productService";
import { Spinner } from "@/components/ui/Spinner";
import { PublicWorkspaceCard } from "@/features/home/components/PublicWorkspaceCard";

interface ProductRelatedWorkspacesProps {
  currentProductId: string;
  categoryId: string | null;
}

/** Reuses the exact same public card as the homepage — no second "workspace card" component for this. */
export function ProductRelatedWorkspaces({ currentProductId, categoryId }: ProductRelatedWorkspacesProps) {
  const { data: products, isLoading } = useAsync(() => productService.fetchPublished(), []);

  const related = (products ?? [])
    .filter((product) => product.id !== currentProductId)
    .sort((a, b) => {
      const aMatches = a.category_id === categoryId ? 1 : 0;
      const bMatches = b.category_id === categoryId ? 1 : 0;
      return bMatches - aMatches;
    })
    .slice(0, 3);

  if (!isLoading && related.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-sm font-semibold uppercase tracking-wider text-primary">More Workspaces</span>
        <h2 className="mt-3 text-3xl font-bold text-navy-900 dark:text-white sm:text-4xl">
          You might also like
        </h2>
      </div>
      <div className="mt-12">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner className="h-8 w-8" />
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((product) => (
              <PublicWorkspaceCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
