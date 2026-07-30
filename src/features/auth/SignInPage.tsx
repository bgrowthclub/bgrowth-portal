import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthCard } from "./components/AuthCard";
import { FormError } from "./components/FormError";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { authService } from "./services/authService";
import { getPendingAuthRedirect, clearPendingAuthRedirect } from "@/lib/pendingRedirect";

export function SignInPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await authService.signIn({ email, password });
      // .search is included deliberately — ProtectedRoute passes the full
      // location it redirected from, and a Product Page's "Start Free
      // Trial" click depends on ?product=<slug> surviving this round trip
      // (see TrialSelectionPage) or it silently falls back to the generic
      // "choose any Workspace" picker instead of the specific one clicked.
      //
      // A Product Page's Start Free Trial/Buy Now click sends a signed-out
      // visitor to /sign-up (see ProductPricingSection), but an existing
      // member typically lands here via that page's own "Sign in" link
      // instead — which carries no router state at all. Falling back to
      // the same pendingRedirect localStorage flag VerifyEmailPage already
      // consumes (see src/lib/pendingRedirect.ts) means "authenticate, then
      // continue with the selected action" holds for sign-in too, not just
      // sign-up.
      const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
      const pendingRedirect = !from?.pathname ? getPendingAuthRedirect() : null;
      if (pendingRedirect) clearPendingAuthRedirect();
      const redirectTo = from?.pathname ? `${from.pathname}${from.search ?? ""}` : (pendingRedirect ?? "/library");
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to continue to your BGrowth Portal."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link to="/sign-up" className="font-semibold text-primary hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormError message={error} />
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Sign In
        </Button>
      </form>
    </AuthCard>
  );
}
