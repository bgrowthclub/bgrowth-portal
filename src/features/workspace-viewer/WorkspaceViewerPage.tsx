import { useEffect, useRef } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { productService } from "@/services/productService";
import { licenseService } from "@/services/licenseService";
import { accessGrantService } from "@/services/accessGrantService";
import { workspaceInstanceService } from "@/services/workspaceInstanceService";
import { deriveAccessState, isGrantActive } from "@/lib/workspaceAccess";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { FetchErrorState } from "@/components/ui/FetchErrorState";
import { WorkspaceViewerLayout } from "./components/WorkspaceViewerLayout";
import { WorkspaceRenderer } from "./components/WorkspaceRenderer";
import type { WorkspaceData } from "@/types/workspaceContent";

export function WorkspaceViewerPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const instanceId = searchParams.get("instance");
  const { user } = useAuth();

  const {
    data: product,
    isLoading: isLoadingProduct,
    error: productError,
    refetch: refetchProduct,
  } = useAsync(() => (slug ? productService.fetchBySlug(slug) : Promise.resolve(null)), [slug]);
  const {
    data: licenses,
    isLoading: isLoadingLicenses,
    error: licensesError,
    refetch: refetchLicenses,
  } = useAsync(() => (user ? licenseService.fetchForUser(user.id) : Promise.resolve([])), [user?.id]);
  const {
    data: grants,
    isLoading: isLoadingGrants,
    error: grantsError,
    refetch: refetchGrants,
  } = useAsync(() => (user ? accessGrantService.fetchForUser(user.id) : Promise.resolve([])), [user?.id]);
  // Only relevant when opening a saved checklist instance (?instance=<id>) —
  // resolves to null otherwise, so the ordinary "Open Workspace" path
  // (no instance param) is completely unaffected by any of this.
  const {
    data: instance,
    isLoading: isLoadingInstance,
    error: instanceError,
    refetch: refetchInstance,
  } = useAsync(
    () => (instanceId ? workspaceInstanceService.fetchById(instanceId) : Promise.resolve(null)),
    [instanceId],
  );

  // Computed ahead of every early return below (Rules of Hooks — the
  // recordOpened effect right after this needs them unconditionally).
  // Safe when product/licenses/grants are still null/loading: license
  // resolves to null, hasActiveGrant to false, accessState to "locked",
  // hasAccess to false, so the effect below simply doesn't fire until the
  // real values are in.
  const license = licenses?.find((item) => item.product_id === product?.id) ?? null;
  const hasActiveGrant = (grants ?? []).some(
    (grant) => isGrantActive(grant) && (grant.scope === "all" || grant.product_id === product?.id),
  );
  const accessState = deriveAccessState(license, hasActiveGrant);
  const hasAccess = accessState === "trial" || accessState === "purchased" || accessState === "unlocked";

  // Fires once per successful open (not once ever) — every time a member
  // actually reaches this Workspace, last_opened_at updates, powering My
  // Library's "Recently Opened" sort. The ref only guards against
  // re-firing on re-renders within the same mount (StrictMode's double
  // effect invocation, license/product refetches), not "only the first
  // time this Workspace is ever opened."
  const hasRecordedOpenRef = useRef(false);
  useEffect(() => {
    if (hasAccess && license && !hasRecordedOpenRef.current) {
      hasRecordedOpenRef.current = true;
      void licenseService.recordOpened(license.id);
    }
  }, [hasAccess, license]);

  if (isLoadingProduct || isLoadingLicenses || isLoadingGrants || isLoadingInstance) return <FullPageSpinner />;

  const fetchError = productError ?? licensesError ?? grantsError ?? instanceError;
  if (fetchError) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 px-6 text-center">
        <FetchErrorState
          message="Couldn't load this Workspace right now."
          onRetry={() => {
            refetchProduct();
            refetchLicenses();
            refetchGrants();
            refetchInstance();
          }}
        />
        <Link to="/library" className="text-sm font-medium text-primary hover:underline">
          ← Back to My Library
        </Link>
      </div>
    );
  }

  // No fetch error and no product means the slug genuinely doesn't exist — a distinct
  // case from the error above, which is why fetchError is checked first, separately.
  if (!product) return <Navigate to="/library" replace />;

  if (!hasAccess) return <Navigate to="/library" replace />;

  // A stale/foreign/deleted instance id shouldn't silently render someone
  // else's data or a blank Workspace pretending to be that checklist — send
  // back to Library rather than guessing.
  if (instanceId && (!instance || instance.product_id !== product.id)) {
    return <Navigate to="/library" replace />;
  }

  async function handleSaveInstance(data: WorkspaceData) {
    if (!instance) return;
    await workspaceInstanceService.saveData(instance.id, data);
  }

  return (
    <WorkspaceViewerLayout product={product}>
      {product.content ? (
        <WorkspaceRenderer
          content={product.content}
          initialData={instance?.data as WorkspaceData | undefined}
          onSave={instance ? handleSaveInstance : undefined}
          instanceLabel={instance?.label}
        />
      ) : (
        <div className="card flex min-h-[50vh] flex-col items-center justify-center gap-3 p-12 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Workspace Viewer</p>
          <h2 className="text-2xl font-bold text-navy-900 dark:text-white">{product.name} content coming soon</h2>
          <p className="max-w-md text-sm text-navy-500 dark:text-white/60">
            BGrowth Studio hasn&apos;t published content for this Workspace yet.
          </p>
        </div>
      )}
    </WorkspaceViewerLayout>
  );
}
