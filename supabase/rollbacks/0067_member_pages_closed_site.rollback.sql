-- Rollback for migrations/0067_member_pages_closed_site.sql.
-- Kept outside migrations/ so no tool runs it by itself. Run by hand only.
--
-- Restores 0062's public read rule exactly and removes the three helpers.
-- Left in place on purpose:
--   • member_pages.is_demo — harmless without the rule, and keeps which
--     pages are BGrowth Demos if 0067 is applied again. The website (Sprint
--     150+) reads it, so drop it only after the website stops using it:
--       alter table portal.member_pages drop column if exists is_demo;
--   • site_settings 'open_pages' — the website's own list (Admin → Pages).

drop policy if exists "Anyone can read published member pages" on portal.member_pages;
create policy "Anyone can read published member pages"
  on portal.member_pages for select
  to anon, authenticated
  using (
    status = 'published'
    and (not owner_managed or portal.member_page_level(user_id) is not null)
  );

drop function if exists portal.is_website_team();
drop function if exists portal.member_page_released(uuid);
drop function if exists portal.site_is_open();
-- From the first draft of 0067 (never applied anywhere); harmless if absent.
drop function if exists portal.member_page_open_before_launch(uuid);
