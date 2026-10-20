-- 0065 — E-mail list on member pages (Website Sprint 139)
--
-- Decided 20/10/2026: a member page can have a "Get updates" section where
-- visitors leave their e-mail (name and WhatsApp optional, consent required).
-- The list belongs to the page's owner: BGrowth never sends to it. The owner
-- sees and exports it in My Business Page → Contacts (no e-mail per sign-up).
-- Who can use it: plans with the whole page (Enterprise, Business Page Plus),
-- team-made pages, or a page the team switched on individually
-- (member_pages.signup_granted — promotions, giveaways).
-- Rows are written and read only by the site's server (service role).
-- Requires 0044, 0045. Additive.

alter table portal.member_pages add column if not exists signup_granted boolean not null default false;

create table if not exists portal.member_page_signups (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references portal.member_pages(id) on delete cascade,
  email text not null,
  name text,
  whatsapp text,
  created_at timestamptz not null default now()
);

create unique index if not exists member_page_signups_page_email_idx
  on portal.member_page_signups (page_id, lower(email));
create index if not exists member_page_signups_page_created_idx
  on portal.member_page_signups (page_id, created_at desc);

alter table portal.member_page_signups enable row level security;
-- No policies: only the service role (the site's server) reads and writes.

-- Page numbers count sign-ups per day too.
alter table portal.member_page_stats drop constraint if exists member_page_stats_kind;
alter table portal.member_page_stats add constraint member_page_stats_kind
  check (kind in ('view', 'click', 'course_view', 'course_lead', 'signup'));

create or replace function portal.track_member_page(p_slug text, p_kind text, p_target text default '')
returns void
language plpgsql
security definer
set search_path = portal, public
as $$
declare
  v_page uuid;
begin
  if p_kind not in ('view', 'click', 'course_view', 'course_lead', 'signup') then
    return;
  end if;
  select id into v_page from portal.member_pages where slug = p_slug and status = 'published';
  if v_page is null then
    return;
  end if;
  insert into portal.member_page_stats (page_id, day, kind, target, count)
  values (v_page, (now() at time zone 'America/New_York')::date, p_kind, left(coalesce(p_target, ''), 120), 1)
  on conflict (page_id, day, kind, target)
  do update set count = portal.member_page_stats.count + 1;
end;
$$;

revoke all on function portal.track_member_page(text, text, text) from public, anon, authenticated;
grant execute on function portal.track_member_page(text, text, text) to service_role;
