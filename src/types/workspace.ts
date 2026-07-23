import type { LicenseRow, ProductRow } from "./database";

export interface LicenseWithProduct extends LicenseRow {
  products: Pick<ProductRow, "name" | "slug" | "cover_image_url"> | null;
}

/** Derived, presentation-level status — not stored directly in the database. */
export type WorkspaceAccessState = "unlocked" | "locked" | "trial" | "purchased" | "expired";

export interface WorkspaceWithAccess extends ProductRow {
  license: LicenseRow | null;
  accessState: WorkspaceAccessState;
}
