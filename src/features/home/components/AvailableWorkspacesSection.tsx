import { useAsync } from "@/hooks/useAsync";
import { productService } from "@/services/productService";
import { Spinner } from "@/components/ui/Spinner";
import { PublicWorkspaceCard } from "./PublicWorkspaceCard";

export function AvailableWorkspacesSection() {
  const { data: products, isLoading, error } = useAsync(() => productService.fetchPublished(), []);

  return (
    <section id="workspaces" className="mx-auto max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-sm font-semibold uppercase tracking-wider text-primary">Available Workspaces</span>
        <h2 className="mt-3 text-3xl font-bold text-navy-900 dark:text-white sm:text-4xl">
          Every BGrowth Workspace, one free trial
        </h2>
      </div>

      <div className="mt-14">
        {isLoading && (
          <div className="flex justify-center py-12">
            <Spinner className="h-8 w-8" />
          </div>
        )}
        {error && (
          <p className="text-center text-sm text-red-500">
            Couldn&apos;t load Workspaces right now — please refresh the page.
          </p>
        )}
        {products && products.length === 0 && (
          <p className="text-center text-sm text-navy-400 dark:text-white/40">
            New Workspaces are on the way — check back soon.
          </p>
        )}
        {products && products.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <PublicWorkspaceCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
