-- Rollback for migrations/0067_member_pages_closed_site.sql.
-- Kept outside migrations/ so no tool runs it by itself. Run by hand only.
--
-- Restores 0062's public read rule exactly and removes the three helpers.
-- The settings rows are left as they are: 'open_pages' is the website's
-- (Admin → Pages), and 'always_open_pages' is harmless without the rule
-- (the website only reads it to list addresses). Delete it by hand if wanted:
--   delete from portal.site_settings where key = 'always_open_pages';

drop policy if exists "Anyone can read published member pages" on portal.member_pages;
create policy "Anyone can read published member pages"
  on portal.member_pages for select
  to anon, authenticated
  using (
    status = 'published'
    and (not owner_managed or portal.member_page_level(user_id) is not null)
  );

drop function if exists portal.is_website_team();
drop function if exists portal.member_page_open_before_launch(uuid);
drop function if exists portal.site_is_open();
