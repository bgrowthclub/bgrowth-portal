export interface TrialActivatedNotification {
  email: string;
  fullName: string | null;
  productName: string;
}

/**
 * Provider-agnostic transactional notifications, same shape as
 * checkoutService: callers never know or care how (or whether) a
 * notification actually gets delivered. Today's implementation just calls
 * a stub API route with no email provider wired up yet (see
 * api/notifications/trial-activated.ts) — connecting a real one (Resend/
 * Postmark/SendGrid) later means changing that route only, not any caller.
 *
 * Deliberately fire-and-forget: a failed or unconfigured notification must
 * never block the trial activation it's reporting on.
 */
export const notificationService = {
  async sendTrialActivatedEmail(input: TrialActivatedNotification): Promise<void> {
    try {
      await fetch("/api/notifications/trial-activated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    } catch {
      // Best-effort only — see class comment.
    }
  },
};
