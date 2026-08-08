-- BGrowth Knowledge Engine — Phase A: persistent backing store for the
-- existing Knowledge Engine admin UI (src/modules/knowledge-engine in
-- bgrowth-studio), which today persists every KnowledgeItem only to the
-- browser's own localStorage. Purely additive: introduces knowledge_engine,
-- a new, dedicated schema — isolated from content_engine and portal, so
-- Knowledge Engine stays an independent module rather than living inside
-- content_engine (per the Phase A audit's own recommendation).
--
-- Every column below was verified field-by-field against the existing
-- KnowledgeItem TypeScript type (bgrowth-studio's
-- src/modules/knowledge-engine/types.ts) immediately before writing this
-- migration. Nothing on KnowledgeItem is dropped; nothing not already on
-- KnowledgeItem is introduced.
--
-- Column vs JSONB split follows exactly what the existing UI actually
-- queries today: Library.tsx filters/searches title, excerpt, tags,
-- contentType, and category; Library.tsx and Dashboard.tsx both key off
-- publishing.status. Those become real columns. Every other nested object
-- (seo, blocks, attachments, relatedContent, featuredOptions, and the rest
-- of publishing) is never individually filtered anywhere in the existing
-- code, so it stays exactly as structured today, as JSONB — flattening it
-- would be a redesign of the content model, which this phase does not do.
--
-- publishing.status is promoted to its own `status` column. publishing.slug
-- is NOT stored a second time — in the existing KnowledgeItem shape it was
-- always a byte-for-byte duplicate of the top-level slug; the API
-- reconstructs publishing.slug = items.slug on every read, so the frontend
-- still receives an identical field with an identical value, just without
-- storing the same string twice server-side. No information is lost.

create schema if not exists knowledge_engine;

create table if not exists knowledge_engine.items (
  id uuid primary key default gen_random_uuid(),

  -- Flat/scalar KnowledgeItem fields, kept as columns because Library.tsx's
  -- search and filters (or Dashboard.tsx's stat counts) read them directly.
  title text not null default '',
  slug text not null default '',
  excerpt text not null default '',
  featured_image text not null default '',
  content_type text not null default 'Article',
  category text not null default '',
  industry text not null default '',
  language text not null default 'en',
  difficulty text not null default 'Beginner',
  reading_time text not null default '',
  tags text[] not null default '{}',
  author_id text not null default '',

  -- Extracted from KnowledgeItem.publishing.status specifically (see above)
  -- — the rest of `publishing` stays grouped in the jsonb column below.
  status text not null default 'Draft',

  -- Nested KnowledgeItem objects/arrays, never individually queried today —
  -- stored exactly as the existing type already groups them.
  seo jsonb not null default '{}'::jsonb,
  blocks jsonb not null default '[]'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  related_content jsonb not null default '[]'::jsonb,
  featured_options jsonb not null default '{}'::jsonb,
  -- Everything from KnowledgeItem.publishing except slug and status (both
  -- promoted above): visibility, publishDate, scheduleDate,
  -- futureWebsiteUrl, publicationNotes.
  publishing jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Partial unique index, not a plain unique constraint: the existing editor
-- creates a new item with slug='' immediately on "New Asset" (see
-- KnowledgeEngine.tsx's createBlankItem/handleNew), before the admin has
-- typed anything. A plain unique constraint on slug would make a second
-- "New Asset" click fail outright, which is a real behavior regression —
-- excluding the empty string preserves today's "an untitled draft has no
-- slug yet" behavior while still enforcing uniqueness on every real slug.
create unique index if not exists knowledge_engine_items_slug_idx
  on knowledge_engine.items (slug)
  where slug <> '';

-- Supports Library.tsx's status filter and Dashboard.tsx's per-status
-- counts — the one nested field actually queried today.
create index if not exists knowledge_engine_items_status_idx
  on knowledge_engine.items (status);

alter table knowledge_engine.items enable row level security;
-- No anon/authenticated policy — service-role only, same posture as every
-- content_engine table. api/knowledge-engine.js is temporarily
-- unauthenticated at the application layer (Studio-wide admin auth is not
-- yet activated — see that file's own comment) — that is unrelated to and
-- unaffected by RLS, which stays locked down regardless.

grant usage on schema knowledge_engine to service_role;
grant select, insert, update, delete on knowledge_engine.items to service_role;
