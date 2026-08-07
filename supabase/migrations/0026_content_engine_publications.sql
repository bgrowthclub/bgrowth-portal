-- BGrowth Content Engine — Phase 2E: Republish Content. Introduces
-- content_publications as an append-only ledger of every individual
-- publish/republish EVENT for a content_item, separate from
-- content_items.status/scheduled_at/published_at — those keep meaning
-- exactly what they mean today (the content's own authoring lifecycle,
-- including its own single built-in occurrence) and are never altered by
-- this migration or by Republish. A content_item may accumulate many
-- content_publications rows over time (one 'original' plus any number of
-- 'republish' occurrences); the content itself is never duplicated or
-- rewritten to produce one.
--
-- Purely additive: a brand-new table, no existing content_items column
-- touched, added, or altered. No backfill — a legacy published item's
-- 'original' row is recorded lazily, only when it's first republished (see
-- api/content-engine/content-items.js), or automatically going forward at
-- first-publish time. Every existing content_items row is completely
-- unaffected.

create table if not exists content_engine.content_publications (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_engine.content_items(id) on delete restrict,
  publication_type text not null check (publication_type in ('original', 'republish')),
  status text not null default 'scheduled' check (status in ('scheduled', 'published')),
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

-- ON DELETE RESTRICT (not CASCADE): a content_item with publication history
-- must not be silently deletable in a way that destroys that history —
-- the database refuses the delete instead of quietly losing it. In
-- practice this rarely matters today, since the existing Content Item
-- Panel already hides Delete once status='published' — this is the
-- defensive backstop for any future path that bypasses that UI rule.
--
-- No 'failed'/'publishing' status values yet, and no external_post_id /
-- external_post_url / error_message / attempted_at / creative_asset_id
-- columns — those belong to a future automatic-publishing / Creative
-- Studio phase and would be purely additive nullable columns at that
-- time; adding them now would be speculative, not structurally required.

alter table content_engine.content_publications enable row level security;
-- No anon/authenticated policy — read and write only through
-- bgrowth-studio's service-role-gated Content Engine API routes, same
-- posture as campaigns/content_items/platform_rules.

create index if not exists content_publications_content_item_id_idx
  on content_engine.content_publications (content_item_id);

create index if not exists content_publications_status_idx
  on content_engine.content_publications (status);

create index if not exists content_publications_scheduled_at_idx
  on content_engine.content_publications (scheduled_at);

-- At most one 'original' row per content_item, enforced at the database
-- level rather than relying only on application-side check-then-insert
-- logic (which has a race window). Scoped ONLY to publication_type is
-- 'original' — every 'republish' row is explicitly exempt from this
-- constraint, since multiple republishes per content_item are a normal,
-- required case, not an edge case to guard against. An insert that would
-- violate this (a duplicate 'original' attempt — see the lazy-ledger and
-- first-publish code paths) fails with Postgres error 23505
-- (unique_violation), which the API treats as "already recorded," not a
-- fatal error.
create unique index if not exists content_publications_one_original_per_item_idx
  on content_engine.content_publications (content_item_id)
  where publication_type = 'original';

grant select, insert, update, delete
  on content_engine.content_publications
  to service_role;
