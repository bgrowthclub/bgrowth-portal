-- BGrowth Studio — the independent, Studio-wide administrator allowlist.
-- Replaces the never-applied content_engine.admins (0020_content_engine_schema.sql,
-- rolled back before Content Engine's admin gate was finished — see the Access
-- Management architecture audit). Lives in `portal`, not a Content-Engine-owned
-- schema: this is Studio's one admin table, meant to be reused by every
-- Studio module (Access Management now, Content Engine later) rather than
-- each module inventing its own allowlist. A future, genuinely distinct
-- Website Admin population would get its own table (e.g. portal.website_admins)
-- rather than overload this one — deferred until that work actually starts.

create table if not exists portal.studio_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table portal.studio_admins enable row level security;

drop policy if exists "Studio admins can read their own admin row" on portal.studio_admins;
create policy "Studio admins can read their own admin row"
  on portal.studio_admins for select
  using (auth.uid() = user_id);

-- schema usage on `portal` already granted to anon/authenticated/service_role
-- (0007_portal_schema_grants.sql) — table-level grants only, matching the
-- policy above exactly.
grant select on portal.studio_admins to authenticated;
grant select, insert, update, delete on portal.studio_admins to service_role;
