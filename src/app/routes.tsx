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
import { MyLibraryPage } from "@/features/library/MyLibraryPage";
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

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [{ path: "/", element: <HomePage /> }],
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
          { path: "/library", element: <MyLibraryPage /> },
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
