import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { workspaceInstanceService } from "@/services/workspaceInstanceService";
import { productService } from "@/services/productService";
import type { ProductRow, WorkspaceInstanceRow } from "@/types/database";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { FetchErrorState } from "@/components/ui/FetchErrorState";
import { DocumentsFilterBar, type DocumentSortOption } from "./components/DocumentsFilterBar";
import { DocumentWorkspaceGroup } from "./components/DocumentWorkspaceGroup";

function compareInstances(a: WorkspaceInstanceRow, b: WorkspaceInstanceRow, sort: DocumentSortOption): number {
  switch (sort) {
    case "newest":
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    case "oldest":
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    case "name_asc":
      return a.label.localeCompare(b.label);
    case "last_updated":
    default:
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  }
}

interface DocumentGroup {
  workspace: ProductRow;
  instances: WorkspaceInstanceRow[];
}

/**
 * The member's dedicated place for finding and reopening documents/New
 * Fills they've created — a sibling destination to My Library ("what
 * Workspaces do I have access to") and Browse ("what else is available").
 * Deliberately does not fetch licenses/grants or run attachAccessState:
 * this page never shows an access badge or a Buy Now button, it only needs
 * each referenced Workspace's name/slug/content, which
 * productService.fetchByIds already provides (the same method Home's
 * Continue Learning rail uses for the identical "resolve the Workspaces
 * behind a member's instances" problem).
 */
export function DocumentsPage() {
  const { user } = useAuth();

  const {
    data: instances,
    isLoading: isLoadingInstances,
    error: instancesError,
    refetch: refetchInstances,
  } = useAsync(() => (user ? workspaceInstanceService.listForUser(user.id) : Promise.resolve([])), [user?.id]);

  // Depends on `instances` so the ids are known — runs once with an empty
  // list while instances are still loading (fetchByIds returns [] for
  // that), then re-runs with the real ids, matching the same harmless
  // dependent-fetch pattern MyLibraryPage already uses for its own
  // products query.
  const productIds = useMemo(
    () => Array.from(new Set((instances ?? []).map((instance) => instance.product_id))),
    [instances],
  );
  const {
    data: products,
    isLoading: isLoadingProducts,
    error: productsError,
    refetch: refetchProducts,
  } = useAsync(() => productService.fetchByIds(productIds), [productIds.join(",")]);

  const productById = useMemo(() => new Map((products ?? []).map((product) => [product.id, product])), [products]);

  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);
  const [workspaceId, setWorkspaceId] = useState<string | undefined>(undefined);
  const [sort, setSort] = useState<DocumentSortOption>("last_updated");

  const isLoading = isLoadingInstances || isLoadingProducts;
  const error = instancesError ?? productsError;
  const hasAnyDocuments = (instances?.length ?? 0) > 0;

  // Every Workspace referenced by the member's own documents — independent
  // of the current search/filter, so the dropdown's option list never
  // shrinks as the member narrows their results.
  const workspaceOptions = useMemo(() => {
    const ids = Array.from(new Set((instances ?? []).map((instance) => instance.product_id)));
    return ids
      .map((id) => productById.get(id))
      .filter((product): product is ProductRow => Boolean(product))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [instances, productById]);

  const groups = useMemo<DocumentGroup[] | null>(() => {
    if (!instances) return null;

    const query = debouncedQ.trim().toLowerCase();
    const filtered = instances.filter((instance) => {
      if (query && !instance.label.toLowerCase().includes(query)) return false;
      if (workspaceId && instance.product_id !== workspaceId) return false;
      return true;
    });

    const byProduct = new Map<string, WorkspaceInstanceRow[]>();
    for (const instance of filtered) {
      const list = byProduct.get(instance.product_id) ?? [];
      list.push(instance);
      byProduct.set(instance.product_id, list);
    }

    const built = Array.from(byProduct.entries())
      .map(([productId, groupInstances]) => ({
        workspace: productById.get(productId),
        instances: [...groupInstances].sort((a, b) => compareInstances(a, b, sort)),
      }))
      .filter((group): group is DocumentGroup => Boolean(group.workspace));

    // Groups themselves follow the same active sort, via each group's own
    // top (most relevant) document — one ordering rule, not two.
    built.sort((a, b) => compareInstances(a.instances[0], b.instances[0], sort));

    return built;
  }, [instances, productById, debouncedQ, workspaceId, sort]);

  function handleClearFilters() {
    setQ("");
    setWorkspaceId(undefined);
  }

  function handleRetry() {
    refetchInstances();
    refetchProducts();
  }

  const isFiltering = debouncedQ.trim().length > 0 || Boolean(workspaceId);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 dark:text-white">My Documents</h1>
          <p className="mt-1 text-sm text-navy-500 dark:text-white/60">
            Everything you&apos;ve created using your Workspaces.
          </p>
        </div>
        <Link to="/browse" className="text-sm font-semibold text-primary hover:underline">
          Browse Workspaces →
        </Link>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      )}

      {!isLoading && error && (
        <div className="mt-8">
          <FetchErrorState message="Couldn't load your documents right now." onRetry={handleRetry} />
        </div>
      )}

      {!isLoading && !error && !hasAnyDocuments && (
        <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-6 py-12 text-center">
          <h2 className="text-xl font-bold text-navy-900 dark:text-white">No documents yet.</h2>
          <p className="mt-3 text-sm text-navy-500 dark:text-white/60">
            Open one of your Workspaces and select New Fill to create your first document.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/library">
              <Button size="md">Go to My Workspaces</Button>
            </Link>
            <Link to="/browse">
              <Button variant="secondary" size="md">
                Browse Workspaces
              </Button>
            </Link>
          </div>
        </div>
      )}

      {!isLoading && !error && hasAnyDocuments && (
        <>
          <div className="mt-8">
            <DocumentsFilterBar
              q={q}
              onQChange={setQ}
              workspaceId={workspaceId}
              onWorkspaceChange={setWorkspaceId}
              workspaces={workspaceOptions}
              sort={sort}
              onSortChange={setSort}
            />
          </div>

          {groups && groups.length === 0 && (
            <div className="mt-16 flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-navy-400 dark:text-white/40">
                No documents match your current search or filters.
              </p>
              {isFiltering && (
                <Button variant="secondary" size="sm" onClick={handleClearFilters}>
                  Clear search and filters
                </Button>
              )}
            </div>
          )}

          {groups && groups.length > 0 && (
            <div className="mt-10 flex flex-col gap-12">
              {groups.map((group) => (
                <DocumentWorkspaceGroup key={group.workspace.id} workspace={group.workspace} instances={group.instances} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
