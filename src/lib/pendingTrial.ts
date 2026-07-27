const STORAGE_KEY = "bgrowth.pendingTrialProductSlug";

/**
 * Carries "which product they wanted a trial for" across the one gap
 * router state can't survive: a brand-new signup with email confirmation
 * required is an async round-trip (they may click the confirmation link
 * later, possibly on a different device), so this is set in localStorage
 * at the moment an unauthenticated visitor clicks "Start Free Trial" on a
 * Product Page, and read back by VerifyEmailPage once a session exists.
 * The already-signed-in case (Sign In) doesn't need this — that flow
 * carries the product slug through router state instead (see
 * ProtectedRoute/SignInPage).
 */
export function setPendingTrialProduct(slug: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, slug);
  } catch {
    // Best-effort — a blocked/full localStorage just means the fallback
    // "browse to My Library" path is used instead, not a fatal error.
  }
}

export function getPendingTrialProduct(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearPendingTrialProduct(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage isn't available in the first place.
  }
}
