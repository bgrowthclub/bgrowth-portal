-- 0045 — Numbers for member pages ("quantas pessoas acessaram").
--
-- The owner of a member page (bgrowth.app/p/<slug>) sees, per day: visits
-- to the page, clicks on each contact button and featured item, visits to
-- their course and the e-mails it received. Only totals are kept — nothing
-- about who visited (no IP, no cookies, no account).
--
-- Counting goes through the Website's server (service role) with
-- portal.track_member_page(); only published pages count. The page's owner
-- (member_pages.user_id) reads their own numbers in the Website's member
-- area; the team reads everything with the service role (Admin → Pages).

create table if not exists portal.member_page_stats (
  page_id uuid not null references portal.member_pages(id) on delete cascade,
  day date not null,
  kind text not null,
  -- What was clicked: 'link:<type>' for a contact button, 'featured:<title>'
  -- for a featured item; '' for page/course visits and e-mails.
  target text not null default '',
  count integer not null default 0,
  primary key (page_id, day, kind, target),
  constraint member_page_stats_kind check (kind in ('view', 'click', 'course_view', 'course_lead')),
  constraint member_page_stats_target check (length(target) <= 120)
);

alter table portal.member_page_stats enable row level security;

drop policy if exists "Owners read their page numbers" on portal.member_page_stats;
create policy "Owners read their page numbers"
  on portal.member_page_stats for select
  to authenticated
  using (exists (select 1 from portal.member_pages p where p.id = page_id and p.user_id = auth.uid()));

revoke all on portal.member_page_stats from anon, authenticated;
grant select on portal.member_page_stats to authenticated;
grant select, insert, update, delete on portal.member_page_stats to service_role;

-- The owner also reads their own page (drafts included), to find it in the
-- member area.
drop policy if exists "Owners read their own page" on portal.member_pages;
create policy "Owners read their own page"
  on portal.member_pages for select
  to authenticated
  using (user_id = auth.uid());

-- Adds one to today's count (US Eastern days). Unknown kinds and
-- unpublished or missing pages are ignored.
create or replace function portal.track_member_page(p_slug text, p_kind text, p_target text default '')
returns void
language plpgsql
security definer
set search_path = portal, public
as $$
declare
  v_page uuid;
begin
  if p_kind not in ('view', 'click', 'course_view', 'course_lead') then
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
