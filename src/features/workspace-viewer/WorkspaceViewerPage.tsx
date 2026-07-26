import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { productService } from "@/services/productService";
import { licenseService } from "@/services/licenseService";
import { workspaceInstanceService } from "@/services/workspaceInstanceService";
import { deriveAccessState } from "@/lib/workspaceAccess";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { FetchErrorState } from "@/components/ui/FetchErrorState";
import { WorkspaceViewerLayout } from "./components/WorkspaceViewerLayout";
import { WorkspaceRenderer } from "./components/WorkspaceRenderer";
import type { WorkspaceData } from "@/types/workspaceContent";

// TEMP DIAGNOSTIC — JSON.stringify comparison doesn't account for key
// order, which Postgres/PostgREST doesn't preserve, so it was flagging
// semantically-identical objects as a MISMATCH. This compares structurally
// instead. Deleted along with the rest of this instrumentation once
// persistence is confirmed end to end.
function deepEqualIgnoringKeyOrder(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const aKeys = Object.keys(a as Record<string, unknown>).sort();
  const bKeys = Object.keys(b as Record<string, unknown>).sort();
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (key, i) =>
      key === bKeys[i] &&
      deepEqualIgnoringKeyOrder((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
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

  if (isLoadingProduct || isLoadingLicenses || isLoadingInstance) return <FullPageSpinner />;

  const fetchError = productError ?? licensesError ?? instanceError;
  if (fetchError) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 px-6 text-center">
        <FetchErrorState
          message="Couldn't load this Workspace right now."
          onRetry={() => {
            refetchProduct();
            refetchLicenses();
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

  const license = licenses?.find((item) => item.product_id === product.id) ?? null;
  const accessState = deriveAccessState(license);
  const hasAccess = accessState === "trial" || accessState === "purchased";

  if (!hasAccess) return <Navigate to="/library" replace />;

  // A stale/foreign/deleted instance id shouldn't silently render someone
  // else's data or a blank Workspace pretending to be that checklist — send
  // back to Library rather than guessing.
  if (instanceId && (!instance || instance.product_id !== product.id)) {
    return <Navigate to="/library" replace />;
  }

  // TEMPORARY DIAGNOSTIC INSTRUMENTATION — tracing the "partial saves lost"
  // report end to end: what WorkspaceRenderer hands us, what saveData does
  // with it, and what a fresh fetchById sees immediately after. Remove once
  // the root cause is confirmed; this is not the permanent fix.
  async function handleSaveInstance(data: WorkspaceData) {
    if (!instance) return;
    console.log("[DIAGNOSTIC handleSaveInstance] instance.id:", instance.id);
    console.log("[DIAGNOSTIC handleSaveInstance] data received from WorkspaceRenderer (before save):", JSON.stringify(data));

    await workspaceInstanceService.saveData(instance.id, data);

    const reloaded = await workspaceInstanceService.fetchById(instance.id);
    console.log("[DIAGNOSTIC handleSaveInstance] data from a fresh fetchById (after save):", JSON.stringify(reloaded?.data));

    if (!deepEqualIgnoringKeyOrder(data, reloaded?.data ?? {})) {
      console.error(
        "[DIAGNOSTIC handleSaveInstance] MISMATCH — the data sent to saveData is not structurally equal to what " +
          "fetchById reads back immediately after. sent:",
        JSON.stringify(data),
        "read back:",
        JSON.stringify(reloaded?.data),
      );
    } else {
      console.log("[DIAGNOSTIC handleSaveInstance] MATCH — sent data and freshly-fetched data are structurally identical.");
    }
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
