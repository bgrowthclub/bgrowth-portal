-- 0035 — Workspace content access, step 2 of 2.
--
-- Run ONLY after 0034 has run AND the Portal and Website versions that read
-- content through portal.get_workspace_content() are live. From here on
-- the browser (anon / authenticated) can select every products column
-- except `content`; the service role (Studio publishing, API endpoints)
-- keeps full access.
--
-- Note for future migrations: a column added to portal.products later is
-- NOT readable by anon/authenticated until it is granted explicitly
-- (`grant select (new_column) on portal.products to anon, authenticated;`).

revoke select on portal.products from anon, authenticated;

do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
  from information_schema.columns
  where table_schema = 'portal' and table_name = 'products' and column_name <> 'content';
  execute format('grant select (%s) on portal.products to anon, authenticated', cols);
end $$;

-- To undo (content readable again): grant select on portal.products to anon, authenticated;
