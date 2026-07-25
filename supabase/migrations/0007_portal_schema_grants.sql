-- Supabase automatically wires up schema-level grants for the built-in
-- `public` schema at project creation, but NOT for any additional schema a
-- project creates itself. Every migration so far (0001-0006) created
-- `portal` and its tables/policies/function, but never granted `anon`,
-- `authenticated`, or `service_role` USAGE on the schema itself — so every
-- request failed with "permission denied for schema portal" (Postgres
-- error 42501) regardless of which API key was used. This is a distinct
-- permission layer from Row Level Security: RLS governs which ROWS a
-- query can see; GRANT governs whether the role can query the
-- table/schema/function AT ALL, evaluated first. service_role bypasses
-- RLS but was never exempt from this — it still needs the same schema
-- USAGE and table grants as anon/authenticated to reach anything in
-- `portal`.
--
-- Grants below are scoped to match each table's existing RLS policies
-- exactly (see 0001_init.sql, 0003_publishing_engine.sql) — anon/
-- authenticated only get what their RLS policies already allow;
-- service_role gets full access on every table, since the
-- Publishing Engine's service-role client is the only writer for most of
-- these and RLS doesn't apply to it anyway.

grant usage on schema portal to anon, authenticated, service_role;

-- workspace_categories: public read-only (RLS: "Anyone can read workspace categories")
grant select on portal.workspace_categories to anon, authenticated;
grant select, insert, update, delete on portal.workspace_categories to service_role;

-- products: public read-only where published (RLS: "Anyone can read published products")
grant select on portal.products to anon, authenticated;
grant select, insert, update, delete on portal.products to service_role;

-- users: each member reads/updates only their own row (RLS: "Users can read/update their own profile")
grant select, update on portal.users to authenticated;
grant select, insert, update, delete on portal.users to service_role;

-- licenses: members read their own, and self-service insert a trial license only
-- (RLS: "Users can read their own licenses", "Users can activate their own trial license")
grant select, insert on portal.licenses to authenticated;
grant select, insert, update, delete on portal.licenses to service_role;

-- No anon/authenticated RLS policy at all on these four — service_role only,
-- matching 0003_publishing_engine.sql's comments on each table.
grant select, insert, update, delete on portal.product_versions to service_role;
grant select, insert, update, delete on portal.publication_destinations to service_role;
grant select, insert, update, delete on portal.product_destinations to service_role;
grant select, insert, update, delete on portal.published_assets to service_role;

-- catalog_index: public read-only, by construction only ever holds published rows
-- (RLS: "Anyone can read the catalog index")
grant select on portal.catalog_index to anon, authenticated;
grant select, insert, update, delete on portal.catalog_index to service_role;

-- publish_product(): PostgreSQL grants EXECUTE on new functions to PUBLIC by
-- default (unlike tables) — that would let anyone holding the anon key call
-- this function directly from the browser, bypassing the Publishing
-- Engine's secret-header check entirely, once schema USAGE (above) makes
-- the function reachable at all. Revoke that default explicitly and grant
-- execute only to service_role, the sole intended caller.
revoke all on all functions in schema portal from public;
grant execute on all functions in schema portal to service_role;

-- Applies the same "no public execute by default" rule to any function a
-- future migration adds to this schema, without needing another grants
-- migration just for that. Table grants are deliberately NOT defaulted the
-- same way — each new table's exposure should be a deliberate choice made
-- alongside its own RLS policy, the same way every table above already is.
alter default privileges in schema portal revoke execute on functions from public;
alter default privileges in schema portal grant execute on functions to service_role;
