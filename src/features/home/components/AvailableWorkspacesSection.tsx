import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { productService } from "@/services/productService";
import { workspaceInstanceService } from "@/services/workspaceInstanceService";
import { catalogService } from "@/services/catalogService";
import type { ProductRow, WorkspaceInstanceRow } from "@/types/database";
import { Spinner } from "@/components/ui/Spinner";
import { Carousel, CarouselItem } from "@/components/ui/Carousel";
import { CatalogProductCard } from "@/components/catalog/CatalogProductCard";
import { ContinueLearningCard } from "@/components/catalog/ContinueLearningCard";

type RailKind = "featured" | "new" | "popular";
const RAILS: { kind: RailKind; title: string; eyebrow: string }[] = [
  { kind: "featured", title: "Featured Products", eyebrow: "Featured" },
  { kind: "new", title: "New Releases", eyebrow: "New" },
  { kind: "popular", title: "Popular Products", eyebrow: "Popular" },
];

interface ContinueLearningEntry {
  instance: WorkspaceInstanceRow;
  product: ProductRow;
}

/** One card per distinct owned Workspace with an in-progress instance — the most recently updated instance if a member has several for the same Workspace — most-recently-updated first. */
async function loadContinueLearning(userId: string): Promise<ContinueLearningEntry[]> {
  const instances = await workspaceInstanceService.listForUser(userId);
  const latestByProduct = new Map<string, WorkspaceInstanceRow>();
  for (const instance of instances) {
    if (instance.status !== "in_progress") continue;
    const existing = latestByProduct.get(instance.product_id);
    if (!existing || new Date(instance.updated_at) > new Date(existing.updated_at)) {
      latestByProduct.set(instance.product_id, instance);
    }
  }
  const sorted = Array.from(latestByProduct.values()).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
  if (sorted.length === 0) return [];

  const products = await productService.fetchByIds(sorted.map((instance) => instance.product_id));
  const productById = new Map(products.map((product) => [product.id, product]));

  return sorted
    .map((instance) => ({ instance, product: productById.get(instance.product_id) }))
    .filter((entry): entry is ContinueLearningEntry => Boolean(entry.product));
}

/**
 * Home's product-discovery surface — curated horizontal rails over
 * portal.catalog_index (catalogService.getCuratedRail(), see
 * supabase/migrations/0018_catalog_discovery.sql for how each rail is
 * defined), a Categories strip, and (signed-in only) Continue Learning.
 * Every rail/section hides itself gracefully when empty.
 */
export function AvailableWorkspacesSection() {
  const { user } = useAuth();

  const { data: facets, isLoading: isLoadingFacets, error: facetsError } = useAsync(
    () => catalogService.getFacets(),
    [],
  );
  const { data: featured, isLoading: isLoadingFeatured } = useAsync(() => catalogService.getCuratedRail("featured"), []);
  const { data: newest, isLoading: isLoadingNew } = useAsync(() => catalogService.getCuratedRail("new"), []);
  const { data: popular, isLoading: isLoadingPopular } = useAsync(() => catalogService.getCuratedRail("popular"), []);
  const { data: continueLearning, isLoading: isLoadingContinueLearning } = useAsync(
    () => (user ? loadContinueLearning(user.id) : Promise.resolve([])),
    [user?.id],
  );

  const railData: Record<RailKind, typeof featured> = { featured, new: newest, popular };
  const isLoading =
    isLoadingFacets || isLoadingFeatured || isLoadingNew || isLoadingPopular || isLoadingContinueLearning;

  const categoryNameById = new Map((facets?.categories ?? []).map((category) => [category.id, category.name]));
  const categories = facets?.categories ?? [];
  const hasAnyContent =
    Object.values(railData).some((items) => (items?.length ?? 0) > 0) ||
    categories.length > 1 ||
    (continueLearning?.length ?? 0) > 0;

  return (
    <section id="workspaces" className="mx-auto max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-sm font-semibold uppercase tracking-wider text-primary">Available Workspaces</span>
        <h2 className="mt-3 text-3xl font-bold text-navy-900 dark:text-white sm:text-4xl">
          Every BGrowth Workspace, one free trial
        </h2>
      </div>

      <div className="mt-14 space-y-14">
        {isLoading && (
          <div className="flex justify-center py-12">
            <Spinner className="h-8 w-8" />
          </div>
        )}

        {!isLoading && facetsError && (
          <p className="text-center text-sm text-red-500">
            Couldn&apos;t load Workspaces right now — please refresh the page.
          </p>
        )}

        {!isLoading && !facetsError && !hasAnyContent && (
          <p className="text-center text-sm text-navy-400 dark:text-white/40">
            New Workspaces are on the way — check back soon.
          </p>
        )}

        {!isLoading && !facetsError && continueLearning && continueLearning.length > 0 && (
          <div>
            <div className="mb-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">Continue Learning</span>
              <h3 className="mt-1 text-xl font-bold text-navy-900 dark:text-white">Pick up where you left off</h3>
            </div>
            <Carousel ariaLabel="Continue Learning">
              {continueLearning.map(({ instance, product }) => (
                <CarouselItem key={instance.id}>
                  <ContinueLearningCard instance={instance} product={product} />
                </CarouselItem>
              ))}
            </Carousel>
          </div>
        )}

        {!isLoading &&
          !facetsError &&
          RAILS.map(({ kind, title, eyebrow }) => {
            const items = railData[kind];
            if (!items || items.length === 0) return null;
            return (
              <div key={kind}>
                <div className="mb-5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</span>
                  <h3 className="mt-1 text-xl font-bold text-navy-900 dark:text-white">{title}</h3>
                </div>
                <Carousel ariaLabel={title}>
                  {items.map((item) => (
                    <CarouselItem key={item.product_id}>
                      <CatalogProductCard
                        item={item}
                        categoryName={item.category_id ? categoryNameById.get(item.category_id) : undefined}
                      />
                    </CarouselItem>
                  ))}
                </Carousel>
              </div>
            );
          })}

        {/* Hidden with only one category — nothing to browse "between" yet (see workspace_categories, currently a single seeded row). */}
        {!isLoading && !facetsError && categories.length > 1 && (
          <div>
            <div className="mb-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">Categories</span>
              <h3 className="mt-1 text-xl font-bold text-navy-900 dark:text-white">Browse by category</h3>
            </div>
            <div className="flex flex-wrap gap-4">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  to={`/browse?category=${category.slug}`}
                  className="card px-6 py-4 text-sm font-semibold text-navy-900 transition hover:border-primary/40 hover:text-primary dark:text-white"
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
