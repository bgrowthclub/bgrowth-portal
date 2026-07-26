import type { TrialUnit } from "@/types/database";

export interface TrialActivatedNotification {
  email: string;
  fullName: string | null;
  productName: string;
  productSlug: string;
  trialDuration: number | null;
  trialUnit: TrialUnit;
}

export interface TrialReviewRequestNotification {
  userId: string;
  productId: string;
}

/**
 * Provider-agnostic transactional notifications: callers never know or
 * care how (or whether) a notification actually gets delivered. The API
 * route behind this now sends real email via Resend
 * (api/_lib/email/sendEmail.ts) — swapping providers later, or adding a
 * new notification type (purchase completed, marketing sends, etc.),
 * means adding to api/_lib/email/templates/ and possibly a new endpoint;
 * this client-side surface and its call sites never change.
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

  /**
   * Fired lazily whenever the client renders an expired-trial license
   * (LibraryWorkspaceCard) — there's no cron in this codebase, so this is
   * the trigger instead. Safe to call repeatedly: the route behind it only
   * ever sends once per license (see api/notifications/trial-review-request.ts).
   */
  async sendTrialReviewRequestEmail(input: TrialReviewRequestNotification): Promise<void> {
    try {
      await fetch("/api/notifications/trial-review-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    } catch {
      // Best-effort only — see class comment.
    }
  },
};
