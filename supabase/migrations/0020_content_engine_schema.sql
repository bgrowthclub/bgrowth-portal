-- BGrowth Content Engine — internal, admin-only marketing module living in
-- BGrowth Studio (bgrowth-studio), reading published product data from
-- portal.catalog_index (no duplicate catalog) but keeping its own schema
-- for everything it authors itself: brand voice, content strategies,
-- campaigns, generated content, and provider/task routing.
--
-- Nothing here is reachable by an anonymous visitor or a Portal customer —
-- every table is either service-role-only (all reads/writes go through
-- bgrowth-studio's own requireAdmin()-gated API routes) or, for the admin
-- allowlist itself, readable only by the row's own owner. See
-- content_engine.admins below for how "is this session an admin" is
-- decided — everything else in this schema assumes that check already
-- passed server-side.

create schema if not exists content_engine;

-- ---------------------------------------------------------------------------
-- content_engine.admins — the allowlist, not a roles/permissions system.
-- Being a row in auth.users (shared with Portal's own customers, since both
-- apps point at the same Supabase project) grants nothing by itself; only
-- an additional row here makes a session a Studio admin. Rows are created
-- by hand (Supabase SQL editor / dashboard), never through a public
-- sign-up flow — there isn't one.
-- ---------------------------------------------------------------------------
create table if not exists content_engine.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table content_engine.admins enable row level security;

-- A logged-in user may check ONLY their own admin status — this is what
-- lets bgrowth-studio's client-side RequireAdmin gate decide "show Studio
-- or show Not Authorized" without a server round trip. It grants no
-- broader visibility into who else is an admin.
drop policy if exists "Admins can read their own admin row" on content_engine.admins;
create policy "Admins can read their own admin row"
  on content_engine.admins for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- content_engine.brand_profile — singleton. BGrowth has exactly one brand;
-- this is not a multi-tenant concept, so rather than rely on application
-- code alone to keep it that way, `id` is pinned to the literal value 1 by
-- a check constraint — the simplest available guarantee that a second row
-- can never exist, with no tenant/account model layered on top of it.
-- ---------------------------------------------------------------------------
create table if not exists content_engine.brand_profile (
  id smallint primary key default 1,
  name text not null default 'BGrowth',
  tagline text,
  default_language text not null default 'en-US',
  tone_voice jsonb not null default '{}'::jsonb,
  messaging_principles jsonb not null default '[]'::jsonb,
  prohibited_styles jsonb not null default '[]'::jsonb,
  preferred_cta_styles jsonb not null default '[]'::jsonb,
  target_audience jsonb not null default '{}'::jsonb,
  social_content_rules jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint brand_profile_singleton check (id = 1)
);

alter table content_engine.brand_profile enable row level security;
-- No anon/authenticated policy at all — read and write only through the
-- service-role-gated /api/content-engine/brand-profile route.

insert into content_engine.brand_profile (id, name, tagline)
values (1, 'BGrowth', 'Grow Anywhere. Win Everywhere.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- content_engine.content_strategies — a small, extensible library. Adding a
-- seventh strategy later is a new row, never a code change. Seeded with the
-- six named in the approved plan; prompt_guidance is deliberately a plain
-- text block (not further structured) since it's consumed as one piece of
-- the composed generation prompt, never parsed.
-- ---------------------------------------------------------------------------
create table if not exists content_engine.content_strategies (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  prompt_guidance text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table content_engine.content_strategies enable row level security;

insert into content_engine.content_strategies (key, name, description, prompt_guidance) values
  (
    'educational',
    'Educational',
    'Teaches a concept or skill relevant to the audience before mentioning the product.',
    'Lead with a genuinely useful piece of knowledge or a common mistake the audience makes. Only connect it to the product in the final beat, as a natural next step rather than the point of the post.'
  ),
  (
    'problem_solution',
    'Problem-Solution',
    'Names a real pain point the audience has, then positions the product as the fix.',
    'Open by naming a specific, recognizable frustration the target audience faces. Make the reader feel understood before introducing the product as the resolution — never lead with the product itself.'
  ),
  (
    'product_discovery',
    'Product Discovery',
    'Introduces a Workspace to an audience unfamiliar with it.',
    'Assume the reader has never heard of this Workspace. Explain what it is and who it is for in plain language before going into any specific feature or benefit.'
  ),
  (
    'feature_spotlight',
    'Feature Spotlight',
    'Highlights one specific feature or module of a Workspace in depth.',
    'Pick exactly one feature or module and go deep on it — what it does, why it matters, and a concrete scenario where it saves time or effort. Do not attempt to summarize the whole product.'
  ),
  (
    'launch',
    'Launch',
    'Announces a new or newly updated Workspace.',
    'Communicate that this is new or newly updated with genuine energy, without resorting to exaggerated urgency or countdown-style pressure tactics that conflict with BGrowth''s tone.'
  ),
  (
    'trial_conversion',
    'Trial Conversion',
    'Encourages an active trial user to convert to a paid purchase.',
    'Speak to someone who has already used the product during a trial. Reinforce the value they''ve likely already experienced and make the next step (purchasing) feel like a natural continuation, not a hard sell.'
  )
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- content_engine.campaigns — every content item belongs to exactly one
-- campaign (see content_items below), and every campaign has exactly one
-- content_strategy. product_id/product_slug are a snapshot from
-- portal.catalog_index at creation time (no cross-schema foreign key —
-- Content Engine never writes to portal.*, and a Workspace being archived
-- later shouldn't retroactively break a campaign's own record of what it
-- was about).
-- ---------------------------------------------------------------------------
create table if not exists content_engine.campaigns (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  product_slug text not null,
  strategy_id uuid not null references content_engine.content_strategies(id),
  name text not null,
  goal text,
  utm_campaign text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table content_engine.campaigns enable row level security;
create index if not exists campaigns_product_id_idx on content_engine.campaigns (product_id);

-- ---------------------------------------------------------------------------
-- content_engine.content_items — one row per generated piece of content
-- (one platform, one content type). Lifecycle: draft -> review -> approved
-- -> scheduled -> published. Phase 1 never sets status to 'published'
-- automatically — that transition is always a manual admin action taken
-- after posting the content externally by hand; there is no social-network
-- integration yet. scheduled_at is a plain column (not a separate calendar
-- table) since Phase 1 scheduling is "set one date on this item," not a
-- recurring/multi-slot concept.
-- ---------------------------------------------------------------------------
create table if not exists content_engine.content_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references content_engine.campaigns(id) on delete cascade,
  platform text not null,
  content_type text not null,
  status text not null default 'draft'
    check (status in ('draft', 'review', 'approved', 'scheduled', 'published')),
  body jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz,
  published_at timestamptz,
  generated_by_provider text,
  generated_by_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table content_engine.content_items enable row level security;
create index if not exists content_items_campaign_id_idx on content_engine.content_items (campaign_id);
create index if not exists content_items_status_idx on content_engine.content_items (status);
create index if not exists content_items_scheduled_at_idx on content_engine.content_items (scheduled_at);

-- ---------------------------------------------------------------------------
-- content_engine.provider_task_config — the AI Provider abstraction's
-- runtime routing table. Every row defaults to Gemini, the only provider
-- actually implemented in Phase 1; reassigning a task to a different
-- provider/model later is a row update here, never a code change.
-- ---------------------------------------------------------------------------
create table if not exists content_engine.provider_task_config (
  task_type text primary key,
  provider text not null default 'gemini',
  model text not null default 'gemini-2.0-flash',
  updated_at timestamptz not null default now()
);

alter table content_engine.provider_task_config enable row level security;

insert into content_engine.provider_task_config (task_type, provider, model) values
  ('caption', 'gemini', 'gemini-2.0-flash'),
  ('hashtags', 'gemini', 'gemini-2.0-flash'),
  ('carousel', 'gemini', 'gemini-2.0-flash'),
  ('script', 'gemini', 'gemini-2.0-flash'),
  ('hook_cta', 'gemini', 'gemini-2.0-flash'),
  ('variation', 'gemini', 'gemini-2.0-flash'),
  ('campaign_strategy', 'gemini', 'gemini-2.0-flash')
on conflict (task_type) do nothing;

-- ---------------------------------------------------------------------------
-- Grants — a distinct permission layer from RLS above (see
-- 0007_portal_schema_grants.sql's own note on this): RLS governs which rows
-- a query can see, GRANT governs whether the role can query the
-- schema/table at all. Scoped to match the policies just created — only
-- `admins` gets an authenticated-facing grant (for the self-read policy);
-- every other table is service_role only, reached exclusively through
-- bgrowth-studio's requireAdmin()-gated API routes.
-- ---------------------------------------------------------------------------
grant usage on schema content_engine to authenticated, service_role;

grant select on content_engine.admins to authenticated;
grant select, insert, update, delete on content_engine.admins to service_role;

grant select, insert, update, delete on content_engine.brand_profile to service_role;
grant select, insert, update, delete on content_engine.content_strategies to service_role;
grant select, insert, update, delete on content_engine.campaigns to service_role;
grant select, insert, update, delete on content_engine.content_items to service_role;
grant select, insert, update, delete on content_engine.provider_task_config to service_role;
