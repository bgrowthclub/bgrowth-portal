-- My Library filtering/sort improvements need two small, new signals that
-- don't exist anywhere today: a per-member "favorite" flag and a real
-- "last opened" timestamp (for the Recently Opened sort — proxying it off
-- activated_at/workspace_instances.updated_at would be misleading, since
-- neither actually means "opened").
--
-- Both live on portal.licenses — the existing per-(user, product) row —
-- rather than a new table, per the same "reuse the existing entity"
-- reasoning as everything else in this schema. Neither column has any
-- commercial/access meaning: type/status/access_policy/expires_at/
-- activated_at (the actual licensing/purchase architecture) are completely
-- untouched by this migration.
--
-- Self-service update access follows the exact precedent already set in
-- 0014_grant_hardening.sql for portal.reviews: a blanket `grant update on
-- <table> to authenticated` would let a client rewrite type/status/
-- expires_at directly (undermining "only grant_purchased_license()/
-- activateTrial() ever create or change what a license grants") — so this
-- is a column-scoped grant instead, restricted to exactly the two new,
-- access-irrelevant columns.
alter table portal.licenses
  add column if not exists is_favorite boolean not null default false,
  add column if not exists last_opened_at timestamptz;

drop policy if exists "Users can update favorite/last-opened on their own licenses" on portal.licenses;
create policy "Users can update favorite/last-opened on their own licenses"
  on portal.licenses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant update (is_favorite, last_opened_at) on portal.licenses to authenticated;
