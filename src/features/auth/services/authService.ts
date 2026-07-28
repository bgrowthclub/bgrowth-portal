import { isAuthApiError } from "@supabase/supabase-js";
import { supabase } from "@/services/supabaseClient";

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
}

export interface SignUpResult {
  emailSendFailed: boolean;
}

export interface SignInInput {
  email: string;
  password: string;
}

/**
 * emailRedirectTo / redirectTo point at routes that exist in src/app/routes.tsx —
 * update both together if those routes ever move.
 */
export const authService = {
  /**
   * Supabase's signup endpoint creates the auth.users row *first*, then
   * attempts to send the confirmation email as a separate step — if that
   * send fails, signUp() still throws even though the account was already
   * created. The most common trigger on this project today is Supabase's
   * own built-in email sending hitting its low default rate limit
   * (`over_email_send_rate_limit`, see DEPLOYMENT.md's "Production email
   * deliverability" note) — not a real signup failure. Surfacing that as a
   * red "couldn't create your account" error is wrong: the account exists,
   * only the email attempt failed, and VerifyEmailPage's "Resend Email"
   * button is exactly the built-in recovery path for it. Every other error
   * still throws and is treated as a genuine failure.
   */
  async signUp({ email, password, fullName }: SignUpInput): Promise<SignUpResult> {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/verify-email`,
      },
    });
    if (error) {
      if (isAuthApiError(error) && error.code === "over_email_send_rate_limit") {
        return { emailSendFailed: true };
      }
      throw error;
    }
    return { emailSendFailed: false };
  },

  async signIn({ email, password }: SignInInput) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async requestPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  },

  async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  async resendVerificationEmail(email: string) {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/verify-email` },
    });
    if (error) throw error;
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },
};
