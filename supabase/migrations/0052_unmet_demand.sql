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
