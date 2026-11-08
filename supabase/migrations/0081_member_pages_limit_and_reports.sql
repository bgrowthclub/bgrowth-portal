-- 0081 — Which pages stay when a plan drops, and reporting a page (08/11/2026)
--
-- Two things the owner asked for to finish member pages before launch.
--
-- 1. THE ALLOWANCE HAS TO BIND. Until now a member could have three pages
--    on Enterprise, fall back to one plan, and keep all three online: the
--    public policy asks whether they may have A page, never how many. The
--    allowance was checked when creating one and nowhere afterwards.
--
--    The owner's decision: the member chooses which ones stay. Until they
--    choose, the OLDEST stay — the newest are the likeliest to be the
--    extras, and an arbitrary rule that hides someone's first page would be
--    the cruel one.
--
-- 2. A VISITOR FINDS THE BAD PAGE FIRST. Whatever the team reviews, the
--    person who spots a scam page is the one who lands on it. A report
--    costs us one table and gives the team a way in before a complaint
--    arrives somewhere worse.
--
-- Requires 0067, 0077, 0078. The policy is REPLACED here — read the new one
-- against the old before applying.

-- --------------------------------------------------------------- 1. limit --

-- Set by the member when they choose which pages stay (higher = kept
-- first). Everything stays 0 until someone chooses, which is why the
-- tie-break below is the page's age.
alter table portal.member_pages add column if not exists priority smallint not null default 0;

comment on column portal.member_pages.priority is
  'Which pages the member keeps online when their plan allows fewer than they have. Higher is kept first; ties go to the oldest page.';

-- Is this page within its owner's allowance? Published pages are ranked
-- (chosen first, then oldest) and the first N survive, N being what the
-- plan plus the team's grant allow.
create or replace function portal.member_page_within_allowance(p_page uuid)
returns boolean
language sql
stable
security definer
set search_path = portal, public
as $$
  with page as (
    select id, user_id, owner_managed from portal.member_pages where id = p_page
  ),
  ranked as (
    select mp.id,
           row_number() over (order by mp.priority desc, mp.created_at) as rn
      from portal.member_pages mp
      join page on page.user_id = mp.user_id
     where mp.status = 'published'
       and mp.owner_managed
  )
  select case
    -- A page the TEAM made is not the member's to run out of: it was never
    -- part of their allowance and is not taken off the air by a downgrade.
    when (select not owner_managed from page) then true
    else coalesce(
      (select r.rn <= portal.member_page_allowance((select user_id from page)) from ranked r where r.id = p_page),
      true
    )
  end;
$$;

grant execute on function portal.member_page_within_allowance(uuid) to anon, authenticated, service_role;

-- The public read policy, with that one condition added. Everything else is
-- exactly as it was in 0067 — compare the two before applying.
drop policy if exists "Anyone can read published member pages" on portal.member_pages;
create policy "Anyone can read published member pages"
  on portal.member_pages for select
  to anon, authenticated
  using (
    status = 'published'
    and (not owner_managed or portal.member_page_level(user_id) is not null)
    and portal.member_page_within_allowance(id)
    and (portal.site_is_open() or is_demo or portal.member_page_released(id) or portal.is_website_team())
  );

-- -------------------------------------------------------------- 2. reports --

create table if not exists portal.member_page_reports (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references portal.member_pages(id) on delete cascade,
  -- Why, in the reporter's words, from a short list the page offers.
  reason text not null,
  detail text,
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid
);

comment on table portal.member_page_reports is
  'Visitors reporting a member page. Nothing about the reporter is stored — not a name, not an address: a report is about the page, and a name would only be a reason not to send one.';

create index if not exists member_page_reports_open_idx
  on portal.member_page_reports (created_at desc)
  where handled_at is null;

alter table portal.member_page_reports enable row level security;

-- Nobody reads or writes this with the public key: reports arrive through
-- api/ingles.ts and are read in the Admin area, both with the service role.
-- Left with RLS on and no policy on purpose — that is a locked door, not a
-- forgotten one.
