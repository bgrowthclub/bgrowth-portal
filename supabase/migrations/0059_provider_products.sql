-- 0059 — Each product's own id at the payment provider (Website Sprint 124)
--
-- So a coupon can be limited to some Workspaces, calculators, downloads or
-- bundles, each one needs a fixed product at the payment provider (Stripe
-- coupons apply to products). The Website's checkout (api/studio-checkout.ts)
-- and Admin → Coupons create it the first time it's needed and keep its id
-- here, one row per product and provider, so another provider can be added
-- later. Kept apart from portal.products so publishing from the Studio never
-- touches it. Service role only. Additive only.

create table if not exists portal.provider_products (
  product_id uuid not null references portal.products(id) on delete cascade,
  provider text not null,
  external_id text not null,
  name text,
  updated_at timestamptz not null default now(),
  primary key (product_id, provider)
);

alter table portal.provider_products enable row level security;
grant select, insert, update, delete on portal.provider_products to service_role;
