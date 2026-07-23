import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { productService } from "@/services/productService";
import { licenseService } from "@/services/licenseService";
import { deriveAccessState } from "@/lib/workspaceAccess";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { WorkspaceViewerLayout } from "./components/WorkspaceViewerLayout";
import { WorkspaceRenderer } from "./components/WorkspaceRenderer";

export function WorkspaceViewerPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const { data: product, isLoading: isLoadingProduct } = useAsync(
    () => (slug ? productService.fetchBySlug(slug) : Promise.resolve(null)),
    [slug],
  );
  const { data: licenses, isLoading: isLoadingLicenses } = useAsync(
    () => (user ? licenseService.fetchForUser(user.id) : Promise.resolve([])),
    [user?.id],
  );

  if (isLoadingProduct || isLoadingLicenses) return <FullPageSpinner />;

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
