-- BGrowth Content Engine — Phase 2F-A: Creative Assets. Introduces
-- creative_assets, the MEDIA layer for a content_item — a content_item may
-- accumulate any number of these (multiple images, later carousel slides,
-- later video), never duplicating the content_item itself. No platform
-- column here: platform is already owned by the parent content_items row
-- (derive via join), exactly matching content_publications' own
-- established precedent from Phase 2E.
--
-- Purely additive. No existing content_items/content_publications column
-- touched. asset_type is deliberately unconstrained text (no check
-- constraint), matching content_items.platform/content_type's own
-- established convention — validated at the application layer, so adding
-- a future asset type (carousel, video) is a code change, never a
-- migration.

create table if not exists content_engine.creative_assets (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_engine.content_items(id) on delete cascade,
  asset_type text not null,
  status text not null default 'ready' check (status in ('ready', 'failed')),
  provider text,
  model text,
  storage_path text,
  public_url text,
  mime_type text,
  width int,
  height int,
  duration_seconds numeric,
  size_bytes bigint,
  checksum text,
  generation_prompt text,
  generation_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

-- ON DELETE CASCADE (not RESTRICT): unlike content_publications (Phase
-- 2E), a creative_asset's value is entirely derivative of its parent
-- content_item, not itself a historical record worth protecting from the
-- content_item's own deletion. In practice this rarely matters once an
-- item is Published, since Delete is already hidden in the UI for
-- status='published' content_items — this only affects assets attached to
-- an abandoned draft being cleaned up, where losing them alongside the
-- draft is expected, not a loss of history. Note: this CASCADEs the
-- database row only — it does not remove the underlying Supabase Storage
-- object, which has no knowledge of Postgres foreign keys. That cleanup
-- is a deliberately deferred future concern (see the Phase 2F-A storage
-- refinement audit), not implemented in this migration or its API.

alter table content_engine.creative_assets enable row level security;
-- No anon/authenticated policy — service-role only, same posture as every
-- other Content Engine table.

create index if not exists creative_assets_content_item_id_idx
  on content_engine.creative_assets (content_item_id);

create index if not exists creative_assets_asset_type_idx
  on content_engine.creative_assets (asset_type);

grant select, insert, update, delete
  on content_engine.creative_assets
  to service_role;

-- No provider_task_config seed row for 'creative_image' in this migration:
-- the image-generation provider/model has not been officially selected yet
-- (see the Phase 2F-A audit). Schema migrations must not seed speculative
-- provider/model values. Until a row for task_type='creative_image' is
-- added (a separate, later, deliberate change — a plain INSERT, never a
-- schema change), api/_lib/ai/mediaGeneration.js's getProviderForTask()
-- lookup falls through to registry.js's existing fallback, which is a TEXT
-- model unsuitable for images — so Generate Creative will fail cleanly
-- with a clear error until that row is added, rather than silently
-- routing to an unverified guess.
