-- 0044 — Public pages for members ("página do assinante").
--
-- Each subscriber gets a page on the Website to promote their own work
-- (bgrowth.app/p/<slug>): photo, what they do, area served, services and
-- prices, featured work, contact buttons. Together they will form the
-- BGrowth Find™ directory. Subscribers only (Plans & Subscriptions); until
-- then the team creates and edits pages in the Website's Admin → Pages —
-- the first one is a test page.
--
-- Visitors read published pages only. Every write goes through the
-- Website's server (api/admin.ts, service role).

create table if not exists portal.member_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  headline text,
  bio text,
  photo_url text,
  location text,
  -- [{ "title": "...", "description": "...", "price": "..." }]
  services jsonb not null default '[]'::jsonb,
  -- [{ "title": "...", "description": "...", "url": "...", "image": "..." }]
  highlights jsonb not null default '[]'::jsonb,
  -- [{ "type": "whatsapp|email|instagram|tiktok|youtube|website|other", "label": "...", "url": "..." }]
  links jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_pages_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 40),
  constraint member_pages_status check (status in ('draft', 'published')),
  constraint member_pages_name_length check (length(display_name) between 1 and 80)
);

create index if not exists member_pages_user_idx on portal.member_pages (user_id);

alter table portal.member_pages enable row level security;

drop policy if exists "Anyone can read published member pages" on portal.member_pages;
create policy "Anyone can read published member pages"
  on portal.member_pages for select
  to anon, authenticated
  using (status = 'published');

revoke all on portal.member_pages from anon, authenticated;
grant select on portal.member_pages to anon, authenticated;
grant select, insert, update, delete on portal.member_pages to service_role;
