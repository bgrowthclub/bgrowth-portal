import { useEffect } from "react";
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
import { SavedChecklistsPanel } from "./components/SavedChecklistsPanel";

export function MyLibraryPage() {
  const { user } = useAuth();

  // TEMP DIAGNOSTIC — tracing notary-commission-workspace. product_versions
  // has no client-readable RLS policy (service-role only by design), so the
  // browser can never see a product's publish history on its own, no matter
  // how the client code is instrumented. This calls a temporary
  // service-role-backed route (api/_diagnostics/product-history.ts) to
  // surface that history back here for logging — still "through the
  // application," just via a server hop. Remove both once confirmed.
  useEffect(() => {
    fetch("/api/_diagnostics/product-history")
      .then((r) => r.json())
      .then((json) => {
        console.log("[DIAGNOSTIC product-history] full response:", JSON.stringify(json, null, 2));
        if (json.ok && json.products?.length === 0) {
          console.warn("[DIAGNOSTIC product-history] No product in portal.products matches /notary/i at all — service-role search included.");
        }
      })
      .catch((err) => console.error("[DIAGNOSTIC product-history] fetch failed:", err));
  }, []);

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
  // Saved Checklists is an optional, secondary feature of My Library, not a
  // reason to block it — a failure here (e.g. a not-yet-applied migration)
  // must never stop a member from seeing/opening the Workspaces they own.
  // Deliberately excluded from `isLoading`/`error` below; on failure,
  // `instances` just stays null and every card's "Saved Checklists" section
  // renders as empty instead of the whole page failing.
  const { data: instances, refetch: refetchInstances } = useAsync(
    () => (user ? workspaceInstanceService.listForUser(user.id) : Promise.resolve([])),
    [user?.id],
  );

  const isLoading = isLoadingProducts || isLoadingLicenses;
  const error = productsError ?? licensesError;
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
        <div className="mt-8 flex flex-col gap-8">
          {workspaces.map((workspace) => {
            const canOpen = workspace.accessState === "trial" || workspace.accessState === "purchased";
            return (
              // 40/60 on desktop, 45/55 on tablet, stacked (card first) on
              // mobile. When the Workspace can't be opened (expired trial,
              // no active license), there's no Saved Checklists panel to
              // pair it with — the card alone occupies just the first
              // column's width via grid auto-placement, rather than
              // stretching to the full row.
              <div key={workspace.id} className="grid grid-cols-1 gap-6 md:grid-cols-[45%_55%] lg:grid-cols-[40%_60%]">
                <LibraryWorkspaceCard
                  workspace={workspace}
                  userId={user.id}
                  displayName={(user.user_metadata?.full_name as string | undefined) ?? user.email ?? "A member"}
                />
                {canOpen && (
                  <SavedChecklistsPanel
                    workspace={workspace}
                    userId={user.id}
                    instances={(instances ?? []).filter((instance) => instance.product_id === workspace.id)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
