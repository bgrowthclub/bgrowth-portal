import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { productService } from "@/services/productService";
import { licenseService } from "@/services/licenseService";
import { attachAccessState } from "@/lib/workspaceAccess";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { FetchErrorState } from "@/components/ui/FetchErrorState";
import { LibraryWorkspaceCard } from "./components/LibraryWorkspaceCard";

interface TrialActivatedState {
  justActivatedName?: string;
}

export function MyLibraryPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [justActivatedName, setJustActivatedName] = useState(
    () => (location.state as TrialActivatedState | null)?.justActivatedName,
  );

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

  const isLoading = isLoadingProducts || isLoadingLicenses;
  const error = productsError ?? licensesError;
  const hasAnyLicense = (licenses?.length ?? 0) > 0;
  const workspaces = products && licenses ? attachAccessState(products, licenses) : null;

  function handleRetry() {
    refetchProducts();
    refetchLicenses();
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 dark:text-white">My Library</h1>
          <p className="mt-1 text-sm text-navy-500 dark:text-white/60">
            Every BGrowth Workspace — trial, purchased, or available to buy.
          </p>
        </div>
      </div>

      {justActivatedName && (
        <div className="card mt-6 flex items-center justify-between gap-4 border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-400/20 dark:bg-emerald-400/10">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            🎉 {justActivatedName} is now active — your 14-day trial has started.
          </p>
          <button
            type="button"
            onClick={() => setJustActivatedName(undefined)}
            aria-label="Dismiss"
            className="shrink-0 text-emerald-700/60 hover:text-emerald-700 dark:text-emerald-300/60 dark:hover:text-emerald-300"
          >
            ✕
          </button>
        </div>
      )}

      {!isLoading && !error && !hasAnyLicense && (
        <div className="card mt-6 flex flex-col items-center gap-4 p-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h2 className="font-semibold text-navy-900 dark:text-white">
              You haven&apos;t activated your free trial yet
            </h2>
            <p className="mt-1 text-sm text-navy-500 dark:text-white/60">
              Pick one Workspace to try, completely free for 14 days.
            </p>
          </div>
          <Link to="/trial-selection">
            <Button>Choose a Free Trial</Button>
          </Link>
        </div>
      )}

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

      {!isLoading && !error && workspaces && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => (
            <LibraryWorkspaceCard key={workspace.id} workspace={workspace} />
          ))}
        </div>
      )}
    </div>
  );
}
