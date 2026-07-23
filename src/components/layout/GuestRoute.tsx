import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { FullPageSpinner } from "@/components/ui/Spinner";

/**
 * Gates guest-only routes (sign in / sign up). This is the single authority
 * for where an already-authenticated visitor of a guest-only route goes —
 * pages rendered inside it must not add a second redirect decision.
 */
export function GuestRoute() {
  const { session, isLoading } = useAuth();

  if (isLoading) return <FullPageSpinner />;

  if (session) {
    return <Navigate to="/library" replace />;
  }

  return <Outlet />;
}
