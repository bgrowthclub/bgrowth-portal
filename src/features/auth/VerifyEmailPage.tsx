import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { AuthCard } from "./components/AuthCard";
import { FormError } from "./components/FormError";
import { Button } from "@/components/ui/Button";
import { authService } from "./services/authService";
import { useAuth } from "./AuthContext";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { getPendingAuthRedirect, clearPendingAuthRedirect } from "@/lib/pendingRedirect";

export function VerifyEmailPage() {
  const location = useLocation();
  const { session, isLoading: isCheckingSession } = useAuth();
  const email = (location.state as { email?: string } | null)?.email;
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [resent, setResent] = useState(false);

  // A session existing here means the member already clicked the email
  // link (in this tab or another) and Supabase established it — nothing
  // left to verify, so don't leave them staring at "check your inbox".
  //
  // Router state can't survive this round trip (the email link may be
  // clicked later, possibly on a different device/tab than the one that
  // signed up), so a pending "here's where they were headed" intent set by
  // ProductPage (Start Free Trial or Buy Now) lives in localStorage instead
  // — see src/lib/pendingRedirect.ts. Absent that, land on Library as before.
  if (isCheckingSession) return <FullPageSpinner />;
  if (session) {
    const pendingRedirect = getPendingAuthRedirect();
    if (pendingRedirect) {
      clearPendingAuthRedirect();
      return <Navigate to={pendingRedirect} replace />;
    }
    return <Navigate to="/library" replace />;
  }

  async function handleResend() {
    if (!email) return;
    setError(null);
    setIsSending(true);
    try {
      await authService.resendVerificationEmail(email);
      setResent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resend the email.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <AuthCard
      title="Verify your email"
      subtitle={
        email
          ? `We sent a verification link to ${email}. Click it to activate your account.`
          : "Check your inbox for a verification link to activate your account."
      }
    >
      <FormError message={error} />
      {resent && (
        <p className="rounded-lg bg-primary/10 px-4 py-2.5 text-sm text-primary">
          Verification email resent.
        </p>
      )}
      {email && (
        <Button variant="secondary" onClick={handleResend} isLoading={isSending} className="w-full">
          Resend Email
        </Button>
      )}
      <Link to="/sign-in" className="text-center text-sm font-semibold text-primary hover:underline">
        Back to Sign In
      </Link>
    </AuthCard>
  );
}
