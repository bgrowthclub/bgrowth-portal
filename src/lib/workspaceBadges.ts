import type { CatalogIndexRow } from "@/types/database";
import { NEW_WINDOW_DAYS } from "@/services/catalogService";

export type WorkspaceBadgeKind =
  | "new"
  | "updated"
  | "best_seller"
  | "free"
  | "membership"
  | "trial_available";

export interface WorkspaceBadge {
  kind: WorkspaceBadgeKind;
  label: string;
}

/** Same fields catalog_index already denormalizes — Browse/Home/Library all compute badges from this one shape. */
export type WorkspaceBadgeInput = Pick<
  CatalogIndexRow,
  "is_best_seller" | "is_free" | "is_trial_eligible" | "published_at" | "updated_at"
>;

function withinWindow(isoDate: string | null): boolean {
  if (!isoDate) return false;
  return Date.now() - new Date(isoDate).getTime() < NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export function isRecentlyPublished(row: Pick<CatalogIndexRow, "published_at">): boolean {
  return withinWindow(row.published_at);
}

/** "Updated" excludes anything also "New" — a just-published item isn't ALSO recently updated. Used both by getWorkspaceBadges() and by My Library's Recently Updated section (same rule, one definition). */
export function isRecentlyUpdated(row: Pick<CatalogIndexRow, "published_at" | "updated_at">): boolean {
  return !isRecentlyPublished(row) && withinWindow(row.updated_at);
}

/**
 * Single source of truth for every "badge chip" a Workspace card shows —
 * Browse/Home's CatalogProductCard and every My Library card (grid, list,
 * Continue Working, and the dashboard rails) all compute from this one
 * function instead of each re-deriving "is this new" independently.
 *
 * "Included in Membership" is always omitted today — this repo has no
 * membership/subscription concept anywhere in its data model yet (checked
 * across supabase/migrations and src/types). Rather than fabricate one,
 * this stays a defined-but-always-false kind: the day a real membership
 * concept exists, this is the one function that changes.
 */
export function getWorkspaceBadges(row: WorkspaceBadgeInput): WorkspaceBadge[] {
  const badges: WorkspaceBadge[] = [];
  if (isRecentlyPublished(row)) badges.push({ kind: "new", label: "New" });
  if (isRecentlyUpdated(row)) badges.push({ kind: "updated", label: "Updated" });
  if (row.is_best_seller) badges.push({ kind: "best_seller", label: "Best Seller" });
  if (row.is_free) badges.push({ kind: "free", label: "Free" });
  if (row.is_trial_eligible) badges.push({ kind: "trial_available", label: "Trial Available" });
  return badges;
}
