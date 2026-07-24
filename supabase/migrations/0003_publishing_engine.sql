-- BGrowth Publishing Engine
--
-- Generalizes the earlier single-purpose "publish pipeline" into a schema
-- that can publish any content_type (Workspace today; Template, Document,
-- PDF, Course, Calculator, AI Tool, Academy Lesson later) to any destination
-- (Portal today; Website, Etsy, Gumroad, Academy later), through a workflow
-- richer than Draft/Published even though only those two states are driven
-- yet, tracking every generated asset and a full version history.
--
-- Everything here is additive to 0001/0002 — existing products rows and the
-- WorkspaceRenderer's read path are unaffected.

-- ---------------------------------------------------------------------------
-- products: content-type-aware + publish bookkeeping
-- ---------------------------------------------------------------------------

alter table public.products
  add column if not exists studio_product_id text,
  add column if not exists content_type text not null default 'workspace',
  -- Schema version of THIS content_type's JSON shape (lets a renderer pick
  -- the right parser if the shape ever changes) — distinct from
  -- current_version below, which counts publish/edit history.
  add column if not exists content_version int not null default 1,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists status text not null default 'draft',
  add column if not exists current_version int not null default 0,
  add column if not exists last_published_at timestamptz,
  add column if not exists last_published_by text;

alter table public.products
  add constraint if not exists products_content_type_check
  check (content_type in (
    'workspace', 'template', 'document', 'pdf', 'course',
    'calculator', 'ai_tool', 'academy_lesson'
  ));

alter table public.products
  add constraint if not exists products_status_check
  check (status in ('draft', 'ready_for_review', 'approved', 'published', 'archived'));

-- Migrate the old boolean gate, then retire it — status is now the single
-- source of truth for publish state.
update public.products set status = 'published' where is_published = true;
update public.products set status = 'draft' where is_published = false;

drop policy if exists "Anyone can read published products" on public.products;
alter table public.products drop column if exists is_published;

create unique index if not exists products_studio_product_id_key
  on public.products (studio_product_id)
  where studio_product_id is not null;

-- This is the actual "never expose Draft products" guarantee — enforced at
-- the database, not application logic. A bug in Portal's frontend cannot
-- leak a draft/archived row because there is no row to return.
create policy "Anyone can read published products"
  on public.products for select
  using (status = 'published');

-- ---------------------------------------------------------------------------
-- product_versions — full snapshot per publish, for history and rollback
-- ---------------------------------------------------------------------------
create table if not exists public.product_versions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  version int not null,
  status text not null check (status in ('draft', 'ready_for_review', 'approved', 'published', 'archived')),
  name text not null,
  short_description text not null,
  cover_image_url text,
  content jsonb not null,
  published_by text not null,
  change_notes text,
  created_at timestamptz not null default now(),
  unique (product_id, version)
);

-- No public policy at all: anon/authenticated get zero rows. Only the
-- service role (used exclusively by the Publishing Engine's endpoint) can
-- read this — it may contain draft/unpublished snapshots.
alter table public.product_versions enable row level security;

create index if not exists product_versions_product_id_idx on public.product_versions (product_id);

-- ---------------------------------------------------------------------------
-- publication_destinations — lookup of where a product can be published
-- ---------------------------------------------------------------------------
create table if not exists public.publication_destinations (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  is_active boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.publication_destinations enable row level security;
-- Internal reference data — read via service role only, nothing customer-facing needs it.

insert into public.publication_destinations (key, name, is_active) values
  ('portal', 'BGrowth Portal', true),
  ('website', 'BGrowth Website', false),
  ('etsy', 'Etsy', false),
  ('gumroad', 'Gumroad', false),
  ('academy', 'BGrowth Academy', false)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- product_destinations — per-destination publish ledger
-- ---------------------------------------------------------------------------
-- Makes "destinations" real rather than decorative: a product can be
-- published to Portal today and, later, independently to Etsy/Gumroad/etc.,
-- each tracked with its own status/version/external reference.
--
-- products.status/current_version stay in place as a fast, direct RLS gate
-- for Portal specifically (so the hot customer read path isn't a join) —
-- this table is the full multi-channel record, including a 'portal' row
-- written on every Portal publish. The duplication between the two for the
-- 'portal' destination is deliberate, not an oversight.
create table if not exists public.product_destinations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  destination_id uuid not null references public.publication_destinations(id),
  status text not null default 'draft' check (status in ('draft', 'ready_for_review', 'approved', 'published', 'archived')),
  external_id text,
  external_url text,
  published_version int,
  last_published_at timestamptz,
  last_published_by text,
  created_at timestamptz not null default now(),
  unique (product_id, destination_id)
);

alter table public.product_destinations enable row level security;
-- Internal publishing ledger — service role only.

-- ---------------------------------------------------------------------------
-- published_assets — generation ledger for every asset tied to a publish
-- ---------------------------------------------------------------------------
-- Only workspace_json and cover_image are populated today. The remaining
-- asset_type values already exist so future PDF/social/marketplace asset
-- generation needs no schema change — just new rows.
create table if not exists public.published_assets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  product_version int not null,
  asset_type text not null check (asset_type in (
    'workspace_json', 'cover_image', 'thumbnail', 'welcome_pdf',
    'product_pdf', 'social_image', 'marketplace_image', 'marketing_material'
  )),
  destination_id uuid not null references public.publication_destinations(id),
  storage_path text,
  url text,
  mime_type text,
  size_bytes int,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (product_id, product_version, asset_type, destination_id)
);

alter table public.published_assets enable row level security;
-- Internal generation ledger — service role only (may reference
-- destination-specific assets not meant for public consumption).

create index if not exists published_assets_product_id_idx on public.published_assets (product_id);

-- ---------------------------------------------------------------------------
-- catalog_index — read-optimized foundation for categories/search/featured/
-- recommendations/related/new-releases. Populated by publish_product() below.
-- By construction it only ever holds currently-published products, so it's
-- safe to expose publicly — unlike product_versions/published_assets/
-- product_destinations, which may hold non-public snapshots.
-- Not yet queried by the Portal's own pages (productService still reads
-- products directly) — this is the ledger the engine maintains; wiring the
-- Portal's search/rails to read from it is a follow-up.
-- ---------------------------------------------------------------------------
create table if not exists public.catalog_index (
  product_id uuid primary key references public.products(id) on delete cascade,
  slug text not null,
  name text not null,
  short_description text not null,
  content_type text not null,
  category_id uuid references public.workspace_categories(id),
  cover_image_url text,
  is_featured boolean not null default false,
  is_best_seller boolean not null default false,
  published_at timestamptz,
  search_vector tsvector,
  updated_at timestamptz not null default now()
);

alter table public.catalog_index enable row level security;

create policy "Anyone can read the catalog index"
  on public.catalog_index for select
  using (true);

create index if not exists catalog_index_search_idx on public.catalog_index using gin (search_vector);
create index if not exists catalog_index_category_idx on public.catalog_index (category_id);

-- ---------------------------------------------------------------------------
-- publish_product() — the Publishing Engine's single atomic entry point.
-- Upserts products, inserts a product_versions snapshot, upserts the
-- destination ledger, inserts asset rows, and maintains catalog_index — all
-- in one transaction, so a partial write (e.g. product updated but no
-- version recorded) can't happen. Called exclusively by the Portal's
-- publishing-engine API route via the service role key.
-- ---------------------------------------------------------------------------
create or replace function public.publish_product(
  p_studio_product_id text,
  p_slug text,
  p_name text,
  p_short_description text,
  p_content jsonb,
  p_status text,
  p_content_type text default 'workspace',
  p_content_version int default 1,
  p_category_slug text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_cover_image_url text default null,
  p_destination_key text default 'portal',
  p_published_by text default 'studio',
  p_change_notes text default null,
  p_is_trial_eligible boolean default true,
  p_assets jsonb default '[]'::jsonb
)
returns public.products
language plpgsql
security definer set search_path = public
as $$
declare
  v_product public.products;
  v_category_id uuid;
  v_destination_id uuid;
  v_new_version int;
  v_asset jsonb;
begin
  if p_status not in ('draft', 'ready_for_review', 'approved', 'published', 'archived') then
    raise exception 'Invalid status: %', p_status;
  end if;

  select id into v_destination_id from public.publication_destinations where key = p_destination_key;
  if v_destination_id is null then
    raise exception 'Unknown publication destination: %', p_destination_key;
  end if;

  if p_category_slug is not null then
    select id into v_category_id from public.workspace_categories where slug = p_category_slug;
  end if;

  -- Upsert the product row by its stable Studio id.
  select current_version + 1 into v_new_version
    from public.products where studio_product_id = p_studio_product_id;
  v_new_version := coalesce(v_new_version, 1);

  insert into public.products (
    studio_product_id, slug, name, short_description, content, content_type,
    content_version, category_id, metadata, cover_image_url, is_trial_eligible,
    status, current_version, last_published_at, last_published_by
  ) values (
    p_studio_product_id, p_slug, p_name, p_short_description, p_content, p_content_type,
    p_content_version, v_category_id, p_metadata, p_cover_image_url, p_is_trial_eligible,
    p_status, v_new_version, now(), p_published_by
  )
  on conflict (studio_product_id) where studio_product_id is not null
  do update set
    slug = excluded.slug,
    name = excluded.name,
    short_description = excluded.short_description,
    content = excluded.content,
    content_type = excluded.content_type,
    content_version = excluded.content_version,
    category_id = excluded.category_id,
    metadata = excluded.metadata,
    cover_image_url = coalesce(excluded.cover_image_url, public.products.cover_image_url),
    is_trial_eligible = excluded.is_trial_eligible,
    status = excluded.status,
    current_version = excluded.current_version,
    last_published_at = excluded.last_published_at,
    last_published_by = excluded.last_published_by
  returning * into v_product;

  -- Full snapshot for history/rollback.
  insert into public.product_versions (
    product_id, version, status, name, short_description, cover_image_url, content, published_by, change_notes
  ) values (
    v_product.id, v_new_version, p_status, p_name, p_short_description, v_product.cover_image_url, p_content, p_published_by, p_change_notes
  );

  -- Per-destination ledger (the 'portal' row here mirrors products.status
  -- deliberately — see the comment on product_destinations above).
  insert into public.product_destinations (
    product_id, destination_id, status, published_version, last_published_at, last_published_by
  ) values (
    v_product.id, v_destination_id, p_status, v_new_version, now(), p_published_by
  )
  on conflict (product_id, destination_id) do update set
    status = excluded.status,
    published_version = excluded.published_version,
    last_published_at = excluded.last_published_at,
    last_published_by = excluded.last_published_by;

  -- Asset ledger: the Workspace JSON itself, the cover image if provided,
  -- and whatever else was sent (future PDF/social/marketplace assets need
  -- no schema change here — just new entries in p_assets).
  insert into public.published_assets (product_id, product_version, asset_type, destination_id, mime_type, metadata)
  values (v_product.id, v_new_version, 'workspace_json', v_destination_id, 'application/json', '{}'::jsonb)
  on conflict (product_id, product_version, asset_type, destination_id) do nothing;

  if p_cover_image_url is not null then
    insert into public.published_assets (product_id, product_version, asset_type, destination_id, url, mime_type)
    values (v_product.id, v_new_version, 'cover_image', v_destination_id, p_cover_image_url, 'image/*')
    on conflict (product_id, product_version, asset_type, destination_id) do update set url = excluded.url;
  end if;

  for v_asset in select * from jsonb_array_elements(coalesce(p_assets, '[]'::jsonb))
  loop
    insert into public.published_assets (product_id, product_version, asset_type, destination_id, url, mime_type, size_bytes, metadata)
    values (
      v_product.id, v_new_version, v_asset->>'assetType', v_destination_id, v_asset->>'url',
      v_asset->>'mimeType', (v_asset->>'sizeBytes')::int, coalesce(v_asset->'metadata', '{}'::jsonb)
    )
    on conflict (product_id, product_version, asset_type, destination_id) do update set
      url = excluded.url, mime_type = excluded.mime_type, size_bytes = excluded.size_bytes, metadata = excluded.metadata;
  end loop;

  -- Catalog index only ever holds currently-published rows.
  if p_status = 'published' and p_destination_key = 'portal' then
    insert into public.catalog_index (
      product_id, slug, name, short_description, content_type, category_id,
      cover_image_url, published_at, search_vector, updated_at
    ) values (
      v_product.id, v_product.slug, v_product.name, v_product.short_description, v_product.content_type,
      v_product.category_id, v_product.cover_image_url, now(),
      to_tsvector('english', v_product.name || ' ' || v_product.short_description), now()
    )
    on conflict (product_id) do update set
      slug = excluded.slug,
      name = excluded.name,
      short_description = excluded.short_description,
      content_type = excluded.content_type,
      category_id = excluded.category_id,
      cover_image_url = excluded.cover_image_url,
      published_at = coalesce(public.catalog_index.published_at, excluded.published_at),
      search_vector = excluded.search_vector,
      updated_at = excluded.updated_at;
  else
    delete from public.catalog_index where product_id = v_product.id;
  end if;

  return v_product;
end;
$$;
