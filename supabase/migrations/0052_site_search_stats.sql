-- 0052 — What visitors search for on bgrowth.app (Website Sprint 97)
--
-- First demand source for the future Product Discovery ("Opportunities") in
-- Studio's Content Engine: the words people type in the catalog search,
-- and whether we had anything for them. Only daily totals per search are
-- kept — nothing about who searched (no user, no IP, no session).
--
-- Counting goes through the Website's server (service role) with
-- portal.record_site_search(); nobody else can read or write the table.
-- Additive only.

create table if not exists portal.site_search_stats (
  day date not null,
  query text not null,
  had_results boolean not null,
  count integer not null default 0,
  primary key (day, query, had_results),
  constraint site_search_stats_query_length check (char_length(query) between 2 and 100)
);

create index if not exists site_search_stats_query_idx on portal.site_search_stats (query);

alter table portal.site_search_stats enable row level security;
-- No policies: only the service role reads or writes.
revoke all on portal.site_search_stats from anon, authenticated;
grant select, insert, update, delete on portal.site_search_stats to service_role;

-- Adds one to today's count (US Eastern days) for a normalized search:
-- lower case, single spaces, 2–100 characters. Searches that look like an
-- e-mail or a phone/ID number are ignored (never stored).
create or replace function portal.record_site_search(p_query text, p_results integer)
returns void
language plpgsql
security definer
set search_path = portal, public
as $$
declare
  v_query text := left(regexp_replace(lower(btrim(coalesce(p_query, ''))), '\s+', ' ', 'g'), 100);
begin
  if char_length(v_query) < 2 then
    return;
  end if;
  if v_query like '%@%' or v_query ~ '\d{6,}' then
    return;
  end if;
  insert into portal.site_search_stats (day, query, had_results, count)
  values ((now() at time zone 'America/New_York')::date, v_query, coalesce(p_results, 0) > 0, 1)
  on conflict (day, query, had_results)
  do update set count = portal.site_search_stats.count + 1;
end;
$$;

revoke all on function portal.record_site_search(text, integer) from public, anon, authenticated;
grant execute on function portal.record_site_search(text, integer) to service_role;
