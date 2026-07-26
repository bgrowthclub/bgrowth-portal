import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { productService } from "@/services/productService";
import { licenseService } from "@/services/licenseService";
import { workspaceInstanceService } from "@/services/workspaceInstanceService";
import { attachAccessState } from "@/lib/workspaceAccess";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { FetchErrorState } from "@/components/ui/FetchErrorState";
import { LibraryWorkspaceCard } from "./components/LibraryWorkspaceCard";

export function MyLibraryPage() {
  const { user } = useAuth();

  const {
    data: products,
    isLoading: isLoadingProducts,
    error: productsError,
    refetch: refetchProducts,
  } = useAsync(() => productService.fetchPublished(), []);
  const {
    data: licenses,
    isLoading: isLoadingLicenses,
    error: licensesError,
    refetch: refetchLicenses,
  } = useAsync(() => (user ? licenseService.fetchForUser(user.id) : Promise.resolve([])), [user?.id]);
  const {
    data: instances,
    isLoading: isLoadingInstances,
    error: instancesError,
    refetch: refetchInstances,
  } = useAsync(() => (user ? workspaceInstanceService.listForUser(user.id) : Promise.resolve([])), [user?.id]);

  const isLoading = isLoadingProducts || isLoadingLicenses || isLoadingInstances;
  const error = productsError ?? licensesError ?? instancesError;
  const hasAnyLicense = (licenses?.length ?? 0) > 0;
  // Only Workspaces the member actually owns — locked (never activated/bought)
  // Workspaces live in Browse Workspaces instead. A Workspace stays here even
  // after its trial expires (see LibraryWorkspaceCard) — it never disappears,
  // it just switches to a Buy Now prompt.
  const workspaces = products && licenses
    ? attachAccessState(products, licenses).filter((w) => w.accessState !== "locked")
    : null;

  function handleRetry() {
    refetchProducts();
    refetchLicenses();
    refetchInstances();
  }

  if (!isLoading && !error && !hasAnyLicense) {
    // Before a trial is chosen, Library is nothing but this welcome state —
    // not a banner sitting above an already-empty grid.
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-6 py-12 text-center">
        <span className="text-sm font-semibold uppercase tracking-wider text-primary">Welcome to BGrowth</span>
        <h1 className="mt-3 text-3xl font-bold text-navy-900 dark:text-white sm:text-4xl">
          Choose Your Free Trial
        </h1>
        <p className="mt-4 text-navy-500 dark:text-white/60">
          Pick one Workspace to try, completely free. Once you activate it, it'll live right here in
          your Library.
        </p>
        <Link to="/trial-selection" className="mt-8">
          <Button size="lg">Choose Your Free Trial</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 dark:text-white">My Library</h1>
          <p className="mt-1 text-sm text-navy-500 dark:text-white/60">
            The Workspaces you're trialing or have purchased.
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
          <FetchErrorState message="Couldn't load your Library right now." onRetry={handleRetry} />
        </div>
      )}

      {!isLoading && !error && workspaces && user && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => (
            <LibraryWorkspaceCard
              key={workspace.id}
              workspace={workspace}
              userId={user.id}
              instances={(instances ?? []).filter((instance) => instance.product_id === workspace.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
