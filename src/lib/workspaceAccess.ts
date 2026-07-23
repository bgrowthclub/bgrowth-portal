import type { LicenseRow, ProductRow } from "@/types/database";
import type { WorkspaceAccessState, WorkspaceWithAccess } from "@/types/workspace";

/**
 * Derives the presentation-level access state for a product + its most
 * relevant license row. "unlocked" is reserved for a future case where a
 * member has access without a license record at all (e.g. an admin grant) —
 * nothing produces it yet, but the state exists so that case doesn't need a
 * schema change later.
 */
export function deriveAccessState(license: LicenseRow | null): WorkspaceAccessState {
  if (!license) return "locked";

  const isExpired = license.status === "expired" || (license.expires_at !== null && new Date(license.expires_at) < new Date());
  if (isExpired) return "expired";

  if (license.status !== "active") return "locked";

  if (license.type === "trial") return "trial";
  return "purchased"; // "purchased" and "lifetime" both read as owned
}

export function attachAccessState(products: ProductRow[], licenses: LicenseRow[]): WorkspaceWithAccess[] {
  const licenseByProductId = new Map(licenses.map((license) => [license.product_id, license]));

  return products.map((product) => {
    const license = licenseByProductId.get(product.id) ?? null;
    return { ...product, license, accessState: deriveAccessState(license) };
  });
}
