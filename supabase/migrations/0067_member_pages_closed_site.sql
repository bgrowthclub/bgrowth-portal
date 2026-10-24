-- 0067 — Member pages follow the website's "Coming soon" switch, and pages
-- can be marked as BGrowth Demos (Website Layer B, approved for local
-- testing 23/10/2026).
--
-- Numbering: 0066 is reserved by the Journeys work (local branch
-- feature/journeys, not on main yet). This migration does not depend on it
-- and touches none of its objects, so it may be applied before or after
-- 0066.
--
-- Before: any published member page was readable by anyone with the public
-- (anon) key, even while bgrowth.app showed "Coming soon".
-- After: while the site is closed (portal.site_settings key 'site_open' is
-- not true), a page that passes 0062's rule (published; a subscriber's page
-- only while their plan includes a page) is readable through the public or
-- member keys only when it is also
--   • a BGrowth Demo — member_pages.is_demo, set by a website admin in
--     Admin → Pages ("Mark as BGrowth Demo"). The "Remove public access"
--     button never touches it; or
--   • released by the team — site_settings 'open_pages' (Admin → Pages →
--     "Make page public", Website Sprint 145); or
--   • read by someone on the website team (portal.website_admins, any role).
-- The demo flag never skips publication or plan checks: a demo draft, or a
-- demo subscriber page whose plan has no page, stays hidden.
-- Unchanged: the owner still reads their own page ("Owners read their own
-- page", 0045); the service role (api/*.ts on the website, Studio and Portal
-- servers, the course through api/ingles.ts) bypasses RLS; once the site is
-- open the rule is exactly 0062's. Only the service role writes member_pages
-- (0044), so is_demo is changed only through the website's api/admin.ts.
--
-- Scope: portal.member_pages only — not products, catalog, articles or site
-- texts (the Portal sells products publicly).
-- Rollback: supabase/rollbacks/0067_member_pages_closed_site.rollback.sql

-- 1. The BGrowth Demo flag. Bruno's page (growwithbruno, also at /p/bruno,
--    where his course lives) and Gika's (dicasdagigika) start as demos —
--    the pages the website kept open in code until now. Only when the
--    column is first created: running this again (or after the rollback,
--    which keeps the column) never re-marks a page an admin unmarked.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'portal' and table_name = 'member_pages' and column_name = 'is_demo'
  ) then
    alter table portal.member_pages add column is_demo boolean not null default false;
    update portal.member_pages
       set is_demo = true
     where slug in ('growwithbruno', 'dicasdagigika')
        or previous_slugs && array['bruno', 'growwithbruno', 'dicasdagigika'];
  end if;
end
$$;

-- 2. Helpers. SECURITY DEFINER: anon/authenticated can't read site_settings
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

create or replace function portal.member_page_released(p_page uuid)
returns boolean
language sql
stable
security definer
set search_path = portal, pg_temp
as $$
  select exists (
    select 1
      from portal.site_settings s
     where s.key = 'open_pages'
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
revoke all on function portal.member_page_released(uuid) from public;
revoke all on function portal.is_website_team() from public;
grant execute on function portal.site_is_open() to anon, authenticated, service_role;
grant execute on function portal.member_page_released(uuid) to anon, authenticated, service_role;
grant execute on function portal.is_website_team() to anon, authenticated, service_role;

-- 3. The public read rule: 0062's, plus the site's state.
drop policy if exists "Anyone can read published member pages" on portal.member_pages;
create policy "Anyone can read published member pages"
  on portal.member_pages for select
  to anon, authenticated
  using (
    status = 'published'
    and (not owner_managed or portal.member_page_level(user_id) is not null)
    and (portal.site_is_open() or is_demo or portal.member_page_released(id) or portal.is_website_team())
  );
