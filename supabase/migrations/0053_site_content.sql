-- 0053 — Site texts edited in Admin → Site (Website Sprint 100)
--
-- One row per piece of the public site the team edits on bgrowth.app
-- (first the legal pages: key 'legal:privacy', 'legal:terms',
-- 'legal:refund-policy'; later SEO, menu/footer and page texts). No row =
-- the site shows its built-in text. `locale` is 'en' for now — other
-- languages later, without changing the table.
--
-- Everyone may read (it is what the public site shows); only the Website's
-- server (service role, api/admin.ts) writes. Additive only.

create table if not exists portal.site_content (
  key text not null,
  locale text not null default 'en',
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (key, locale),
  constraint site_content_key_length check (char_length(key) between 2 and 100)
);

alter table portal.site_content enable row level security;

drop policy if exists site_content_public_read on portal.site_content;
create policy site_content_public_read on portal.site_content
  for select to anon, authenticated using (true);

grant select on portal.site_content to anon, authenticated;
grant select, insert, update, delete on portal.site_content to service_role;
