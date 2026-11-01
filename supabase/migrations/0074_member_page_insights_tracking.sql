-- 0074 — Member page insights, part 2: the function that counts (Website
-- Sprint 176).
--
-- 0073 let portal.member_page_stats hold three new kinds ('search',
-- 'search_empty', 'category') and added member_pages.insights_granted. But
-- nothing is written to that table directly: everything goes through
-- portal.track_member_page(), which keeps its OWN list of accepted kinds
-- (0045, last widened in 0065 for 'signup'). Without this migration the
-- table would accept the new kinds and the function would silently drop
-- them — counted nowhere, with no error.
--
-- This replaces the function (additive: same name, same arguments, same
-- behaviour for every kind that already worked) and puts the privacy rule
-- for searches inside it, so it holds whoever calls it:
--
--   * a search is normalized like the catalog's (portal.record_site_search,
--     migration 0052): lower case, single spaces, cut to the target's 120
--     characters;
--   * a search that looks like an e-mail ('%@%') or carries a run of 6+
--     digits (a phone, a document, an order number) is NOT stored at all —
--     someone typing their own data into a search box must not leave it
--     behind in our numbers;
--   * nothing about the visitor is stored here either: no account, no IP,
--     no session. Only a daily total per term, as before.
--
-- Additive and reversible: no data is read, moved or deleted.

begin;

create or replace function portal.track_member_page(p_slug text, p_kind text, p_target text default '')
returns void
language plpgsql
security definer
set search_path = portal, public
as $$
declare
  v_page uuid;
  v_target text := left(coalesce(p_target, ''), 120);
begin
  if p_kind not in ('view', 'click', 'course_view', 'course_lead', 'signup', 'search', 'search_empty', 'category') then
    return;
  end if;

  -- What visitors typed: normalized, and never stored if it looks personal.
  if p_kind in ('search', 'search_empty') then
    v_target := left(regexp_replace(lower(btrim(v_target)), '\s+', ' ', 'g'), 120);
    if char_length(v_target) < 2 then
      return;
    end if;
    if v_target like '%@%' or v_target ~ '\d{6,}' then
      return;
    end if;
  end if;

  select id into v_page from portal.member_pages where slug = p_slug and status = 'published';
  if v_page is null then
    return;
  end if;

  insert into portal.member_page_stats (page_id, day, kind, target, count)
  values (v_page, (now() at time zone 'America/New_York')::date, p_kind, v_target, 1)
  on conflict (page_id, day, kind, target)
  do update set count = portal.member_page_stats.count + 1;
end;
$$;

revoke all on function portal.track_member_page(text, text, text) from public, anon, authenticated;
grant execute on function portal.track_member_page(text, text, text) to service_role;

-- Checks: the function must exist exactly once (a second overload would make
-- every call fail, as the four publish_product copies did in 0069), and 0073
-- must already be in place or nothing below would be counted anyway.
do $$
declare
  n int;
begin
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'portal' and p.proname = 'track_member_page';
  if n <> 1 then
    raise exception 'track_member_page tem % versoes — deveria ter 1', n;
  end if;

  perform 1 from pg_attribute
   where attrelid = 'portal.member_pages'::regclass
     and attname = 'insights_granted' and not attisdropped;
  if not found then
    raise exception 'Rode a 0073 primeiro: insights_granted nao existe';
  end if;
end $$;

commit;
