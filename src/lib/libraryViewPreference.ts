const STORAGE_KEY = "bgrowth.libraryViewPreference";

export type LibraryViewMode = "grid" | "list";

/**
 * My Library's Grid/List toggle — a per-browser display preference, not
 * account data, so plain localStorage (same pattern as
 * src/lib/pendingRedirect.ts) rather than a new column: nothing else reads
 * or needs this across devices, and the request explicitly asks to avoid
 * unnecessary backend surface for it.
 */
export function getLibraryViewPreference(): LibraryViewMode {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

export function setLibraryViewPreference(mode: LibraryViewMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Best-effort — a blocked/full localStorage just means the preference
    // doesn't persist across visits, not a fatal error.
  }
}
