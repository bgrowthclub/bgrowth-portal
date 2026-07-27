-- Critical fix found during the Publishing Engine's final end-to-end
-- audit: portal.products' only SELECT policy was `status = 'published'`,
-- full stop. Once a product is archived, that RLS policy makes the row
-- invisible to EVERY client query, regardless of whether the querying
-- member holds an active license for it — directly breaking the explicit
-- "existing customers keep full access after archive" requirement
-- (portal.archive_product() itself, added in 0015_asset_lifecycle.sql,
-- never touches licenses/reviews and its own comment claims access is
-- preserved — that claim was wrong specifically because it never
-- accounted for the products row itself becoming RLS-invisible).
--
-- Concretely, before this fix: WorkspaceViewerPage's productService.
-- fetchBySlug() would silently return null for an archived product (RLS
-- filtering it out, indistinguishable from "doesn't exist"), bouncing an
-- existing customer to /library as if their Workspace vanished; and
-- licenseService.fetchForUserWithProduct()'s embedded products join
-- (used by ProfilePage) would silently omit the product details for the
-- same reason.
--
-- Fix: a member can read a product row if it's published (the existing,
-- public case) OR if they hold ANY license for it, regardless of status.
-- This is additive, not a loosening of what anon/unauthenticated visitors
-- can see — the license check requires auth.uid() to match a real,
-- authenticated license row, so an anonymous visitor's visibility is
-- unchanged.
drop policy if exists "Anyone can read published products" on portal.products;
create policy "Anyone can read published products or their own licensed products"
  on portal.products for select
  using (
    status = 'published'
    or exists (
      select 1 from portal.licenses l
      where l.product_id = products.id and l.user_id = auth.uid()
    )
  );
