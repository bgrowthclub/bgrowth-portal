import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { productService } from "@/services/productService";
import { licenseService } from "@/services/licenseService";
import { deriveAccessState } from "@/lib/workspaceAccess";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { FetchErrorState } from "@/components/ui/FetchErrorState";
import { WorkspaceViewerLayout } from "./components/WorkspaceViewerLayout";
import { WorkspaceRenderer } from "./components/WorkspaceRenderer";

export function WorkspaceViewerPage() {
  const { slug } = useParams<{ slug: string }>();
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

  if (isLoadingProduct || isLoadingLicenses) return <FullPageSpinner />;

  const fetchError = productError ?? licensesError;
  if (fetchError) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 px-6 text-center">
        <FetchErrorState
          message="Couldn't load this Workspace right now."
          onRetry={() => {
            refetchProduct();
            refetchLicenses();
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

  return (
    <WorkspaceViewerLayout product={product}>
      {product.content ? (
        <WorkspaceRenderer content={product.content} />
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
