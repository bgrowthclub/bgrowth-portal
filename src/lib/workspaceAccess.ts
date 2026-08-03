import type { AccessGrantRow, LicenseRow, ProductRow } from "../types/database.js";
import type { WorkspaceAccessState, WorkspaceWithAccess } from "../types/workspace.js";

/**
 * Whether a grant is currently in effect — not revoked, and not expired.
 * Mirrors portal.has_workspace_access()'s grant branch exactly
 * (supabase/migrations/0021_access_grants.sql) so the client and the
 * database never disagree about what "active" means.
 */
export function isGrantActive(grant: AccessGrantRow): boolean {
  return grant.revoked_at === null && (grant.expires_at === null || new Date(grant.expires_at) > new Date());
}

/**
 * The grant (if any) that gives access to this specific product — an
 * active "all" grant, or an active "specific" grant for this exact
 * product. Returned for presentation (e.g. a future "why do I have this"
 * detail); the boolean OR-decision itself lives in deriveAccessState.
 */
function findActiveGrantForProduct(grants: AccessGrantRow[], productId: string): AccessGrantRow | null {
  const activeGrants = grants.filter(isGrantActive);
  return (
    activeGrants.find((grant) => grant.scope === "specific" && grant.product_id === productId) ??
    activeGrants.find((grant) => grant.scope === "all") ??
    null
  );
}

/**
 * Derives the presentation-level access state for a product from its most
 * relevant license row AND whether an active Access Grant also applies —
 * completely separate concepts (Stripe purchase/trial vs. a manual admin
 * grant), combined here per the access rule: Purchased License OR Active
 * Trial OR Active Access Grant = access. "unlocked" is produced exactly
 * when a grant is what's providing access — including when a license
 * exists but has expired (the grant still means the member has access),
 * matching the pure OR-rule.
 */
export function deriveAccessState(license: LicenseRow | null, hasActiveGrant: boolean): WorkspaceAccessState {
  if (!license) return hasActiveGrant ? "unlocked" : "locked";

  const isExpired =
    license.status === "expired" ||
    (license.access_policy === "expiring" && license.expires_at !== null && new Date(license.expires_at) < new Date());
  if (isExpired) return hasActiveGrant ? "unlocked" : "expired";

  if (license.status !== "active") return hasActiveGrant ? "unlocked" : "locked";

  if (license.type === "trial") return "trial";
  return "purchased"; // purchased/subscription/enterprise all currently read as owned
}

export function attachAccessState(
  products: ProductRow[],
  licenses: LicenseRow[],
  grants: AccessGrantRow[],
): WorkspaceWithAccess[] {
  const licenseByProductId = new Map(licenses.map((license) => [license.product_id, license]));

  return products.map((product) => {
    const license = licenseByProductId.get(product.id) ?? null;
    const grant = findActiveGrantForProduct(grants, product.id);
    return { ...product, license, grant, accessState: deriveAccessState(license, grant !== null) };
  });
}
