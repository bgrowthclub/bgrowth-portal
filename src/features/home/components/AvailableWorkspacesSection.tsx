import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { licenseService } from "@/services/licenseService";
import { catalogService } from "@/services/catalogService";
import { Spinner } from "@/components/ui/Spinner";
import { Carousel, CarouselItem } from "@/components/ui/Carousel";
import { CatalogProductCard } from "@/components/catalog/CatalogProductCard";

type RailKind = "featured" | "new" | "popular" | "recommended";
const RAILS: { kind: RailKind; title: string; eyebrow: string }[] = [
  { kind: "featured", title: "Featured Workspaces", eyebrow: "Featured" },
  { kind: "new", title: "New This Month", eyebrow: "New" },
  { kind: "popular", title: "Most Popular", eyebrow: "Popular" },
  { kind: "recommended", title: "Recommended For You", eyebrow: "Recommended" },
];

/**
 * Home's product-discovery surface — curated horizontal rails over
 * portal.catalog_index (catalogService.getCuratedRail(), see
 * supabase/migrations/0018_catalog_discovery.sql for how each rail is
 * defined) instead of a single unfiltered grid of every published Workspace.
 * Each rail hides itself gracefully when empty, same convention this
 * section already used for its loading/error/empty states.
 */
export function AvailableWorkspacesSection() {
  const { user } = useAuth();

  const { data: facets, isLoading: isLoadingFacets, error: facetsError } = useAsync(
    () => catalogService.getFacets(),
    [],
  );
  const { data: hasUsedTrial } = useAsync(
    () => (user ? licenseService.hasUsedTrial(user.id) : Promise.resolve(false)),
    [user?.id],
  );
  const { data: featured, isLoading: isLoadingFeatured } = useAsync(() => catalogService.getCuratedRail("featured"), []);
  const { data: newest, isLoading: isLoadingNew } = useAsync(() => catalogService.getCuratedRail("new"), []);
  const { data: popular, isLoading: isLoadingPopular } = useAsync(() => catalogService.getCuratedRail("popular"), []);
  const { data: recommended, isLoading: isLoadingRecommended } = useAsync(
    () => catalogService.getCuratedRail("recommended"),
    [],
  );

  const railData: Record<RailKind, typeof featured> = { featured, new: newest, popular, recommended };
  const isLoading =
    isLoadingFacets || isLoadingFeatured || isLoadingNew || isLoadingPopular || isLoadingRecommended;

  const categoryNameById = new Map((facets?.categories ?? []).map((category) => [category.id, category.name]));
  const hasAnyRailContent = Object.values(railData).some((items) => (items?.length ?? 0) > 0);

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

        {!isLoading && !facetsError && !hasAnyRailContent && (
          <p className="text-center text-sm text-navy-400 dark:text-white/40">
            New Workspaces are on the way — check back soon.
          </p>
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
                        hasUsedTrial={hasUsedTrial ?? false}
                        categoryName={item.category_id ? categoryNameById.get(item.category_id) : undefined}
                      />
                    </CarouselItem>
                  ))}
                </Carousel>
              </div>
            );
          })}
      </div>
    </section>
  );
}
