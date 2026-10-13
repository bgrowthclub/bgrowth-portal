-- 0052 — Privacy-conscious unmet-demand capture for Portal Browse.
-- Stores aggregate search demand only; no user ID, IP address, email, or session identifier.
-- This migration is additive and isolated to the portal schema.

create table if not exists portal.unmet_demand (
  id uuid primary key default gen_random_uuid(),
  normalized_query text not null,
  category_slug text not null default '',
  content_type text not null default '',
  filter_signature text not null default '',
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (normalized_query, category_slug, content_type, filter_signature)
);

alter table portal.unmet_demand enable row level security;
-- No anon/authenticated policies: only the server-side service-role API can read/write this table.
revoke all on table portal.unmet_demand from public, anon, authenticated;
grant select, insert, update on table portal.unmet_demand to service_role;

create or replace function portal.record_unmet_demand(
  p_normalized_query text,
  p_category_slug text,
  p_content_type text,
  p_filter_signature text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into portal.unmet_demand (
    normalized_query, category_slug, content_type, filter_signature,
    occurrence_count, first_seen_at, last_seen_at
  ) values (
    left(p_normalized_query, 100),
    left(p_category_slug, 80),
    left(p_content_type, 40),
    left(p_filter_signature, 1000),
    1, now(), now()
  )
  on conflict (normalized_query, category_slug, content_type, filter_signature)
  do update set
    occurrence_count = portal.unmet_demand.occurrence_count + 1,
    last_seen_at = now();
end;
$$;

revoke all on function portal.record_unmet_demand(text, text, text, text) from public, anon, authenticated;
grant execute on function portal.record_unmet_demand(text, text, text, text) to service_role;
