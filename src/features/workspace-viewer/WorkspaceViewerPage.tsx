import { useEffect, useRef, type ReactNode } from "react";
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
import { NewFillButton } from "./components/NewFillButton";
import type { WorkspaceInstanceRow } from "@/types/database";
import type { WorkspaceData } from "@/types/workspaceContent";

interface InstanceLoaderProps {
  instanceId: string | null;
  children: (state: {
    instance: WorkspaceInstanceRow | null;
    isLoadingInstance: boolean;
    instanceError: string | null;
    refetchInstance: () => void;
  }) => ReactNode;
}

/**
 * Isolates the instance fetch behind its own component, keyed by
 * instanceId at the call site below. useAsync only resets isLoading/data
 * via its own effect, which runs one render *after* its dependency
 * changes — harmless when a brand-new instanceId arrives via a fresh
 * mount (e.g. clicking a document link from My Library/My Documents,
 * which navigates from a different route), since a fresh mount's initial
 * state is already `isLoading: true`. But WorkspaceViewerPage itself stays
 * mounted across a same-route instance transition (New Fill's own
 * navigate() while already on this page), so without this isolation
 * there'd be one render where instanceId already reflects the new id
 * while instance/isLoadingInstance still reflect the *previous* id's
 * already-resolved result — exactly the window that let the "instance
 * not found" redirect below fire before the real fetch ever started.
 * Keying this component by instanceId forces React to unmount the old
 * instance and mount a genuinely fresh one on every change, giving it the
 * same correct "isLoading: true from the first render" guarantee a
 * cross-route navigation already gets — no ad hoc state/ref tracking
 * needed, and not dependent on how many times React (re-)invokes render
 * in development.
 */
function InstanceLoader({ instanceId, children }: InstanceLoaderProps) {
  const { data, isLoading, error, refetch } = useAsync(
    () => (instanceId ? workspaceInstanceService.fetchById(instanceId) : Promise.resolve(null)),
    [instanceId],
  );
  return <>{children({ instance: data, isLoadingInstance: isLoading, instanceError: error, refetchInstance: refetch })}</>;
}

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

  if (isLoadingProduct || isLoadingLicenses || isLoadingGrants) return <FullPageSpinner />;

  return (
    <InstanceLoader key={instanceId ?? "__base__"} instanceId={instanceId}>
      {({ instance, isLoadingInstance, instanceError, refetchInstance }) => {
        if (isLoadingInstance) return <FullPageSpinner />;

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
          <WorkspaceViewerLayout
            product={product}
            headerActions={
              hasAccess && user ? (
                <NewFillButton userId={user.id} productId={product.id} workspaceSlug={product.slug} />
              ) : undefined
            }
          >
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
      }}
    </InstanceLoader>
  );
}
