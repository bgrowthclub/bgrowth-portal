import type { TrialUnit } from "@/types/database";

/**
 * Single place that turns (trial_duration, trial_unit) into copy. Every
 * surface that mentions a trial's length reads through here instead of
 * assuming a fixed number — a Workspace's trial length is data, not a
 * platform-wide constant (see supabase/migrations/0005_workspace_trial_config.sql).
 */

/** Adjective form for a badge/label, e.g. "14-day". */
export function formatTrialLength(duration: number, unit: TrialUnit): string {
  switch (unit) {
    case "days":
    default:
      return `${duration}-day`;
  }
}

/** Sentence form, e.g. "14 days" / "1 day". */
export function formatTrialSentence(duration: number, unit: TrialUnit): string {
  switch (unit) {
    case "days":
    default:
      return duration === 1 ? "1 day" : `${duration} days`;
  }
}

/** Computes a license's expiry from its Workspace's configured trial length. */
export function addTrialDuration(activatedAt: Date, duration: number, unit: TrialUnit): Date {
  switch (unit) {
    case "days":
    default:
      return new Date(activatedAt.getTime() + duration * 24 * 60 * 60 * 1000);
  }
}
