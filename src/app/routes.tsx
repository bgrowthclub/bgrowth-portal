import { createBrowserRouter } from "react-router-dom";
import { PublicLayout } from "@/layouts/PublicLayout";
import { AppLayout } from "@/layouts/AppLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { GuestRoute } from "@/components/layout/GuestRoute";
import { HomePage } from "@/features/home/HomePage";
import { SignInPage } from "@/features/auth/SignInPage";
import { SignUpPage } from "@/features/auth/SignUpPage";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { VerifyEmailPage } from "@/features/auth/VerifyEmailPage";
import { TrialSelectionPage } from "@/features/trial/TrialSelectionPage";
import { MyLibraryPage } from "@/features/library/MyLibraryPage";
import { WorkspaceViewerPage } from "@/features/workspace-viewer/WorkspaceViewerPage";
import { ProfilePage } from "@/features/profile/ProfilePage";
import { NotFoundPage } from "./NotFoundPage";

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
      { path: "/workspace/:slug", element: <WorkspaceViewerPage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
