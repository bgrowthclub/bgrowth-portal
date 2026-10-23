-- 0067 — Member pages follow the website's "Coming soon" switch (Website
-- Layer B, approved for local testing 23/10/2026).
--
-- Numbering: 0066 is reserved by the Journeys work (local branch
-- feature/journeys, not on main yet). This migration does not depend on it
-- and touches none of its objects, so it may be applied before or after
-- 0066.
--
-- Before: any published member page was readable by anyone with the public
-- (anon) key, even while bgrowth.app showed "Coming soon".
-- After: while the site is closed (portal.site_settings key 'site_open' is
-- not true), a published page is readable through the public/member keys
-- only when it is
--   • always public — key 'always_open_pages' (Bruno's and Gika's pages,
--     seeded below). Changed only on purpose, in SQL: the website's
--     "Remove public access" button never touches this list; or
--   • released by the team — key 'open_pages' (Admin → Pages → "Make page
--     public", Website Sprint 145); or
--   • read by someone on the website team (portal.website_admins, any role).
-- Unchanged: the owner still reads their own page ("Owners read their own
-- page", 0045); the service role (api/*.ts on the website, Studio and Portal
-- servers, the course through api/ingles.ts) bypasses RLS; once the site is
-- open the rule is exactly 0062's.
--
-- Scope: portal.member_pages only — not products, catalog, articles or site
-- texts (the Portal sells products publicly).
-- Rollback: supabase/rollbacks/0067_member_pages_closed_site.rollback.sql

-- 1. Helpers. SECURITY DEFINER: anon/authenticated can't read site_settings
--    or website_admins; each answers one yes/no and nothing else. Anything
--    unexpected (no row, a non-boolean value, ids that aren't a list) = no.
create or replace function portal.site_is_open()
returns boolean
language sql
stable
security definer
set search_path = portal, pg_temp
as $$
  select coalesce((select s.value = 'true'::jsonb from portal.site_settings s where s.key = 'site_open'), false)
$$;

create or replace function portal.member_page_open_before_launch(p_page uuid)
returns boolean
language sql
stable
security definer
set search_path = portal, pg_temp
as $$
  select exists (
    select 1
      from portal.site_settings s
     where s.key in ('always_open_pages', 'open_pages')
       and jsonb_typeof(s.value -> 'ids') = 'array'
       and (s.value -> 'ids') ? p_page::text
  )
$$;

create or replace function portal.is_website_team()
returns boolean
language sql
stable
security definer
set search_path = portal, pg_temp
as $$
  select auth.uid() is not null
     and exists (select 1 from portal.website_admins a where a.user_id = auth.uid())
$$;

revoke all on function portal.site_is_open() from public;
revoke all on function portal.member_page_open_before_launch(uuid) from public;
revoke all on function portal.is_website_team() from public;
grant execute on function portal.site_is_open() to anon, authenticated, service_role;
grant execute on function portal.member_page_open_before_launch(uuid) to anon, authenticated, service_role;
grant execute on function portal.is_website_team() to anon, authenticated, service_role;

-- 2. Always-public pages: Bruno's (growwithbruno, also at /p/bruno, where
--    his course lives) and Gika's (dicasdagigika) — the same pages the
--    website's code keeps open (src/lib/siteAccess.ts). Stored by id, so a
--    later address change keeps them public. Ids already on the list stay;
--    running this again adds nothing twice.
with wanted as (
  select jsonb_array_elements_text(s.value -> 'ids') as id
    from portal.site_settings s
   where s.key = 'always_open_pages' and jsonb_typeof(s.value -> 'ids') = 'array'
  union
  select p.id::text
    from portal.member_pages p
   where p.slug in ('growwithbruno', 'dicasdagigika')
      or p.previous_slugs && array['bruno', 'growwithbruno', 'dicasdagigika']
)
insert into portal.site_settings (key, value, updated_at, updated_by)
select 'always_open_pages',
       jsonb_build_object('ids', coalesce((select jsonb_agg(w.id order by w.id) from wanted w), '[]'::jsonb)),
       now(),
       'migration 0067'
on conflict (key) do update
  set value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by;

-- 3. The public read rule: 0062's, plus the site's state.
drop policy if exists "Anyone can read published member pages" on portal.member_pages;
create policy "Anyone can read published member pages"
  on portal.member_pages for select
  to anon, authenticated
  using (
    status = 'published'
    and (not owner_managed or portal.member_page_level(user_id) is not null)
    and (portal.site_is_open() or portal.member_page_open_before_launch(id) or portal.is_website_team())
  );
