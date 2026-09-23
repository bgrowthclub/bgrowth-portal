import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import { PublicLayout } from "@/layouts/PublicLayout";
import { AppLayout } from "@/layouts/AppLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { GuestRoute } from "@/components/layout/GuestRoute";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { HomePage } from "@/features/home/HomePage";
import { SignInPage } from "@/features/auth/SignInPage";
import { SignUpPage } from "@/features/auth/SignUpPage";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { VerifyEmailPage } from "@/features/auth/VerifyEmailPage";
import { TrialSelectionPage } from "@/features/trial/TrialSelectionPage";
import { TrialWelcomePage } from "@/features/trial/TrialWelcomePage";
import { MyLibraryPage } from "@/features/library/MyLibraryPage";
import { DocumentsPage } from "@/features/documents/DocumentsPage";
import { MarketplacePage } from "@/features/marketplace/MarketplacePage";
import { ProfilePage } from "@/features/profile/ProfilePage";
import { NotFoundPage } from "./NotFoundPage";

// Lazy-loaded: WorkspaceRenderer resolves lucide-react icons dynamically by
// name (see src/lib/workspaceIcons.ts), which pulls in the full icon library
// so any future Studio-published icon name works with zero Portal code
// changes. That trade-off is only worth paying on the route that needs it —
// code-splitting keeps it out of the storefront's initial bundle.
const WorkspaceViewerPage = lazy(() =>
  import("@/features/workspace-viewer/WorkspaceViewerPage").then((m) => ({ default: m.WorkspaceViewerPage })),
);

// Lazy-loaded for the same reason: ProductFeatures resolves lucide-react
// icons dynamically (see src/lib/workspaceIcons.ts), so this public,
// unauthenticated route shouldn't pay for the full icon library up front.
const ProductPage = lazy(() =>
  import("@/features/product/ProductPage").then((m) => ({ default: m.ProductPage })),
);

// Document V1 (see src/features/workspace-viewer/document-v1/) — an isolated,
// unfinished renderer with no production wiring anywhere else. The route
// entry below only exists when `import.meta.env.DEV` is true, so the
// production route table never contains "/dev/document-v1-preview" (verified
// against a real `npm run build` output — the path string does not appear
// anywhere in dist/assets/*.js) and it cannot be reached by navigating a
// production build. Vite's code-splitting still emits this component's lazy
// chunk as a standalone file in dist/ (nothing references it, so it's
// unreachable, just not physically deleted from the build output).
const DocumentV1PreviewPage = lazy(() =>
  import("@/features/workspace-viewer/document-v1/DocumentV1PreviewPage").then((m) => ({
    default: m.DocumentV1PreviewPage,
  })),
);

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: "/", element: <HomePage /> },
      {
        path: "/product/:slug",
        element: (
          <Suspense fallback={<FullPageSpinner />}>
            <ProductPage />
          </Suspense>
        ),
      },
      // Public — Browse matches every app-store precedent this redesign is
      // modeled on (Apple/Shopify/Notion all let you browse signed out).
      // Only the Buy/Trial action on each card is still gated (see
      // CatalogProductCard's own signed-out pendingRedirect handling), not
      // the page itself.
      { path: "/browse", element: <MarketplacePage /> },
      // Dev-only: Document V1 isolated preview (see comment above this
      // route's lazy import). `import.meta.env.DEV` is false in a
      // production build, so this route entry doesn't exist at all once
      // built — not just hidden, genuinely absent from the router.
      ...(import.meta.env.DEV
        ? [
            {
              path: "/dev/document-v1-preview",
              element: (
                <Suspense fallback={<FullPageSpinner />}>
                  <DocumentV1PreviewPage />
                </Suspense>
              ),
            },
          ]
        : []),
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      {
        element: <GuestRoute />,
        children: [
          { path: "/sign-in", element: <SignInPage /> },
          { path: "/sign-up", element: <SignUpPage /> },
          { path: "/forgot-password", element: <ForgotPasswordPage /> },
        ],
      },
      // Reachable whether or not a session already exists — Supabase's own
      // recovery/verification links establish the session that gets you here.
      { path: "/reset-password", element: <ResetPasswordPage /> },
      { path: "/verify-email", element: <VerifyEmailPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/trial-selection", element: <TrialSelectionPage /> },
          { path: "/trial-selection/welcome", element: <TrialWelcomePage /> },
          { path: "/library", element: <MyLibraryPage /> },
          { path: "/documents", element: <DocumentsPage /> },
          { path: "/profile", element: <ProfilePage /> },
        ],
      },
      // Its own layout (no AppHeader) so the Workspace content has full-bleed room.
      {
        path: "/workspace/:slug",
        element: (
          <Suspense fallback={<FullPageSpinner />}>
            <WorkspaceViewerPage />
          </Suspense>
        ),
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
