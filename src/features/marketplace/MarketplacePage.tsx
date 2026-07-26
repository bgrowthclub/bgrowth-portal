import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { productService } from "@/services/productService";
import { licenseService } from "@/services/licenseService";
import { attachAccessState } from "@/lib/workspaceAccess";
import { Spinner } from "@/components/ui/Spinner";
import { FetchErrorState } from "@/components/ui/FetchErrorState";
import { MarketplaceWorkspaceCard } from "./components/MarketplaceWorkspaceCard";

export function MarketplacePage() {
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
    data: hasUsedTrial,
    isLoading: isCheckingTrial,
    error: trialCheckError,
    refetch: refetchTrialCheck,
  } = useAsync(() => (user ? licenseService.hasUsedTrial(user.id) : Promise.resolve(false)), [user?.id]);

  const isLoading = isLoadingProducts || isLoadingLicenses || isCheckingTrial;
  const error = productsError ?? licensesError ?? trialCheckError;
  const workspaces = products && licenses ? attachAccessState(products, licenses) : null;

  function handleRetry() {
    refetchProducts();
    refetchLicenses();
    refetchTrialCheck();
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div>
        <h1 className="text-2xl font-bold text-navy-900 dark:text-white">Browse Workspaces</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-white/60">
          Every BGrowth Workspace — open what you own, start your one free trial, or buy the rest.
        </p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      )}

      {!isLoading && error && (
        <div className="mt-8">
          <FetchErrorState message="Couldn't load Workspaces right now." onRetry={handleRetry} />
        </div>
      )}

      {!isLoading && !error && workspaces && workspaces.length === 0 && (
        <p className="mt-12 text-center text-sm text-navy-400 dark:text-white/40">
          New Workspaces are on the way — check back soon.
        </p>
      )}

      {!isLoading && !error && workspaces && workspaces.length > 0 && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => (
            <MarketplaceWorkspaceCard key={workspace.id} workspace={workspace} hasUsedTrial={hasUsedTrial ?? false} />
          ))}
        </div>
      )}
    </div>
  );
}
