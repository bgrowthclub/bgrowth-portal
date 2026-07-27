import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { productService } from "@/services/productService";
import { licenseService } from "@/services/licenseService";
import { deriveAccessState } from "@/lib/workspaceAccess";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { FetchErrorState } from "@/components/ui/FetchErrorState";
import { ProductHero } from "./components/ProductHero";
import { ProductLongDescription } from "./components/ProductLongDescription";
import { ProductFeatures } from "./components/ProductFeatures";
import { ProductIncluded } from "./components/ProductIncluded";
import { ProductHowItWorks } from "./components/ProductHowItWorks";
import { ProductRelatedWorkspaces } from "./components/ProductRelatedWorkspaces";
import { ProductFaqSection } from "./components/ProductFaqSection";

/**
 * The single source of truth for every published Workspace, generated
 * entirely from the published products row — no hand-authored marketing
 * pages, no content duplicated from anywhere else in the Portal. Every
 * section below either reads a field that's always populated (name,
 * short_description, cover image, trial config) or an accessor from
 * src/lib/productMarketing.ts that gracefully omits itself when Studio
 * hasn't published that piece of metadata yet — adding a new
 * Studio-authorable section later never requires changing this file's
 * data-fetching, only adding one new accessor + one new leaf component.
 */
export function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, isLoading: isLoadingAuth } = useAuth();

  const {
    data: product,
    isLoading: isLoadingProduct,
    error: productError,
    refetch: refetchProduct,
  } = useAsync(() => (slug ? productService.fetchBySlug(slug) : Promise.resolve(null)), [slug]);

  // Only relevant once a session exists — resolves to [] otherwise, so a
  // logged-out visitor never waits on this.
  const {
    data: licenses,
    isLoading: isLoadingLicenses,
    error: licensesError,
    refetch: refetchLicenses,
  } = useAsync(() => (user ? licenseService.fetchForUser(user.id) : Promise.resolve([])), [user?.id]);

  useDocumentHead(
    product ? `${product.name} — BGrowth` : "BGrowth Workspace",
    product?.short_description,
  );

  const isLoading = isLoadingAuth || isLoadingProduct || (Boolean(user) && isLoadingLicenses);
  const fetchError = productError ?? (user ? licensesError : null);

  if (isLoading) return <FullPageSpinner />;

  if (fetchError) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg items-center justify-center px-6">
        <FetchErrorState
          message="Couldn't load this Workspace right now."
          onRetry={() => {
            refetchProduct();
            refetchLicenses();
          }}
        />
      </div>
    );
  }

  // No product, or not actually published (a draft/archived row can still
  // be fetched by id elsewhere, but this page is public-facing) — a
  // distinct case from a fetch error, so send to the homepage rather than
  // render nothing.
  if (!product || product.status !== "published") {
    return <Navigate to="/" replace />;
  }

  // Auto-detect ownership and skip the marketing pitch entirely for a
  // visitor who can actually open this Workspace right now. An expired
  // trial deliberately still sees this page — Buy Now here is more useful
  // to them than a Workspace route that would just redirect them straight
  // back out (see WorkspaceViewerPage's own access gate).
  if (user && licenses) {
    const license = licenses.find((item) => item.product_id === product.id) ?? null;
    const accessState = deriveAccessState(license);
    if (accessState === "trial" || accessState === "purchased") {
      return <Navigate to={`/workspace/${product.slug}`} replace />;
    }
  }

  return (
    <div>
      <ProductHero product={product} isAuthenticated={Boolean(user)} />
      <ProductLongDescription product={product} />
      <ProductFeatures product={product} />
      <ProductIncluded product={product} />
      <ProductHowItWorks product={product} />
      <ProductRelatedWorkspaces currentProductId={product.id} categoryId={product.category_id} />
      <ProductFaqSection product={product} />
    </div>
  );
}
