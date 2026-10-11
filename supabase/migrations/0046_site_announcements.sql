-- 0046 — Site announcements and Home highlights (Website → Admin → Site).
--
-- Announcements: short notices the team writes in the Website's Admin. Each
-- one can show as the bar at the top of the public site, in the bell of the
-- member area, or both, optionally only between two dates. Members get a
-- dot on the bell for notices newer than portal.users.announcements_seen_at
-- (set by the Website's server when they open the bell).
--
-- Home highlights: which products the Website's Home shows, and in which
-- order. Empty = the Home shows the latest products, as before.
--
-- Everyone may read what is live; writes go only through the Website's
-- server (service role), like the other Admin areas.

create table if not exists portal.site_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  link_url text,
  link_label text,
  tone text not null default 'news',
  show_banner boolean not null default true,
  show_bell boolean not null default true,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_announcements_title check (length(title) between 1 and 140),
  constraint site_announcements_body check (length(body) <= 500),
  constraint site_announcements_tone check (tone in ('news', 'promo', 'notice')),
  constraint site_announcements_dates check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create index if not exists site_announcements_live_idx on portal.site_announcements (active, starts_at, ends_at);

alter table portal.site_announcements enable row level security;

drop policy if exists "Anyone can read live announcements" on portal.site_announcements;
create policy "Anyone can read live announcements"
  on portal.site_announcements for select
  to anon, authenticated
  using (
    active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

revoke all on portal.site_announcements from anon, authenticated;
grant select on portal.site_announcements to anon, authenticated;
grant select, insert, update, delete on portal.site_announcements to service_role;

create table if not exists portal.home_featured (
  product_id uuid primary key references portal.products(id) on delete cascade,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table portal.home_featured enable row level security;

drop policy if exists "Anyone can read the Home highlights" on portal.home_featured;
create policy "Anyone can read the Home highlights"
  on portal.home_featured for select
  to anon, authenticated
  using (true);

revoke all on portal.home_featured from anon, authenticated;
grant select on portal.home_featured to anon, authenticated;
grant select, insert, update, delete on portal.home_featured to service_role;

-- When the member last opened the bell (null = never).
alter table portal.users add column if not exists announcements_seen_at timestamptz;
