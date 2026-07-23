import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AuthCard } from "./components/AuthCard";
import { FormError } from "./components/FormError";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { authService } from "./services/authService";

/**
 * Reached via the emailRedirectTo link from requestPasswordReset — Supabase
 * exchanges the recovery token in the URL for a session automatically
 * (detectSessionInUrl: true on the client), so this page only needs to call
 * updateUser with the new password.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.updatePassword(password);
      navigate("/library", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update your password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard title="Set a new password" subtitle="Choose a strong password for your account.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormError message={error} />
        <TextField
          label="New password"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Update Password
        </Button>
      </form>
    </AuthCard>
  );
}
