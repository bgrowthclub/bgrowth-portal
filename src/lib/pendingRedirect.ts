const STORAGE_KEY = "bgrowth.pendingAuthRedirect";

/**
 * Carries "where they were trying to go" across the one gap router state
 * can't survive: a brand-new signup with email confirmation required is an
 * async round-trip (they may click the confirmation link later, possibly on
 * a different device/tab), so this is set in localStorage at the moment an
 * unauthenticated visitor clicks an intent-carrying CTA on a public page
 * (Start Free Trial, Buy Now) and read back by VerifyEmailPage once a
 * session exists. The already-signed-in case (Sign In) doesn't need this —
 * that flow carries the target through router state instead (see
 * ProtectedRoute/SignInPage). Stores a full path (e.g.
 * "/trial-selection?product=<slug>" or "/product/<slug>"), not just a
 * product slug, so every intent-carrying CTA can reuse the same pair of
 * functions instead of each inventing its own storage key.
 */
export function setPendingAuthRedirect(path: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, path);
  } catch {
    // Best-effort — a blocked/full localStorage just means the fallback
    // "land on My Library" path is used instead, not a fatal error.
  }
}

export function getPendingAuthRedirect(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearPendingAuthRedirect(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage isn't available in the first place.
  }
}
