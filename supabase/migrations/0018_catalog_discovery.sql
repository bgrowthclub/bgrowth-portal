-- Product Discovery & Browse redesign — wires up the read-optimized
-- catalog_index (created in 0003_publishing_engine.sql, never actually
-- queried by the Portal frontend until now) with the columns/indexes a
-- scalable Browse/Home experience needs: tags, denormalized rating and
-- popularity signals, curated collections, and keyset-pagination-friendly
-- indexes. Additive only — publish_product()'s signature is unchanged, so
-- every existing Studio caller keeps working with no changes on that side.

-- ---------------------------------------------------------------------------
-- catalog_index: taxonomy + denormalized rating/popularity signals
-- ---------------------------------------------------------------------------
-- avg_rating/review_count mirror portal.product_review_summary
-- (0009_reviews.sql) but denormalized onto the row Browse actually reads —
-- a listing page becomes one indexed catalog_index scan instead of a join
-- against portal.reviews per page load. license_count is the real,
-- first-party "Popular" signal (distinct members who trialed or purchased),
-- not a proxy.
-- is_free/price_cents/currency/is_trial_eligible are denormalized straight
-- off portal.products (same values, no independent source of truth) so
-- Browse's price/trial filters and sorts stay a single catalog_index scan
-- instead of a join against products per request.
alter table portal.catalog_index
  add column if not exists tags text[] not null default '{}',
  add column if not exists avg_rating numeric,
  add column if not exists review_count int not null default 0,
  add column if not exists license_count int not null default 0,
  add column if not exists is_recommended boolean not null default false,
  add column if not exists is_free boolean not null default false,
  add column if not exists price_cents int,
  add column if not exists currency text not null default 'usd',
  add column if not exists is_trial_eligible boolean not null default true;

create index if not exists catalog_index_price_cents_idx on portal.catalog_index (price_cents, product_id);

create index if not exists catalog_index_tags_idx on portal.catalog_index using gin (tags);
create index if not exists catalog_index_content_type_idx on portal.catalog_index (content_type);
create index if not exists catalog_index_published_at_idx on portal.catalog_index (published_at desc, product_id);
create index if not exists catalog_index_updated_at_idx on portal.catalog_index (updated_at desc, product_id);
create index if not exists catalog_index_license_count_idx on portal.catalog_index (license_count desc, product_id);
create index if not exists catalog_index_avg_rating_idx on portal.catalog_index (avg_rating desc nulls last, product_id);

-- ---------------------------------------------------------------------------
-- collections + product_collections — curated groups ("Featured",
-- "New Arrivals", "Under $50"). A product can belong to many collections;
-- populated by direct SQL for now, same precedent as today's manually-set
-- catalog_index.is_featured/is_best_seller — no Studio or admin-UI authoring
-- surface exists yet, and building one is out of scope here.
-- ---------------------------------------------------------------------------
create table if not exists portal.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  cover_image_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table portal.collections enable row level security;

drop policy if exists "Anyone can read collections" on portal.collections;
create policy "Anyone can read collections"
  on portal.collections for select
  using (true);

create table if not exists portal.product_collections (
  collection_id uuid not null references portal.collections(id) on delete cascade,
  product_id uuid not null references portal.products(id) on delete cascade,
  sort_order int not null default 0,
  primary key (collection_id, product_id)
);

alter table portal.product_collections enable row level security;

drop policy if exists "Anyone can read product collections" on portal.product_collections;
create policy "Anyone can read product collections"
  on portal.product_collections for select
  using (true);

create index if not exists product_collections_product_id_idx on portal.product_collections (product_id);

-- Same fix as 0007/0009 — a new table gets no role grants automatically.
grant select on portal.collections to anon, authenticated;
grant select, insert, update, delete on portal.collections to service_role;
grant select on portal.product_collections to anon, authenticated;
grant select, insert, update, delete on portal.product_collections to service_role;

-- ---------------------------------------------------------------------------
-- publish_product(): additive change to the existing function body only.
-- IMPORTANT — this must be based on the CURRENT full signature (last
-- changed in 0015_asset_lifecycle.sql, 26 parameters covering trial/pricing/
-- storage-path fields), not the original 0003 signature — CREATE OR REPLACE
-- FUNCTION only replaces a function with the SAME parameter list; a
-- shorter/different one creates a dead second overload instead of touching
-- the real one Studio actually calls. No parameter is added, removed, or
-- reordered here — only the body changes: search_vector is now weighted
-- (name > description > tags), tags is populated from the existing generic
-- p_metadata passthrough (Studio already sends metadata today; this reads
-- metadata->'tags' if present, defaulting to an empty array otherwise — no
-- Studio-side change required for this to be safe), and catalog_index also
-- gets a denormalized copy of is_free/price_cents/currency/is_trial_eligible
-- so Browse's filters/sorts stay a single-table read.
-- ---------------------------------------------------------------------------
create or replace function portal.publish_product(
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
  p_assets jsonb default '[]'::jsonb,
  p_trial_duration int default null,
  p_trial_unit text default 'days',
  p_welcome_pdf_url text default null,
  p_is_free boolean default false,
  p_price_cents int default null,
  p_currency text default 'usd',
  p_stripe_price_id text default null,
  p_cover_image_storage_path text default null,
  p_cover_image_size_bytes int default null,
  p_welcome_pdf_storage_path text default null,
  p_welcome_pdf_size_bytes int default null
)
returns portal.products
language plpgsql
security definer set search_path = ''
as $$
declare
  v_product portal.products;
  v_category_id uuid;
  v_destination_id uuid;
  v_new_version int;
  v_asset jsonb;
  v_tags text[];
begin
  if p_status not in ('draft', 'ready_for_review', 'approved', 'published', 'archived') then
    raise exception 'Invalid status: %', p_status;
  end if;

  if p_trial_unit not in ('days') then
    raise exception 'Invalid trial unit: %', p_trial_unit;
  end if;

  if not p_is_free and p_price_cents is null then
    raise exception 'A non-free product must have price_cents set';
  end if;

  select id into v_destination_id from portal.publication_destinations where key = p_destination_key;
  if v_destination_id is null then
    raise exception 'Unknown publication destination: %', p_destination_key;
  end if;

  if p_category_slug is not null then
    select id into v_category_id from portal.workspace_categories where slug = p_category_slug;
  end if;

  select coalesce(array_agg(value #>> '{}'), '{}')
    into v_tags
    from jsonb_array_elements(coalesce(p_metadata->'tags', '[]'::jsonb));

  -- Upsert the product row by its stable Studio id.
  select current_version + 1 into v_new_version
    from portal.products where studio_product_id = p_studio_product_id;
  v_new_version := coalesce(v_new_version, 1);

  insert into portal.products (
    studio_product_id, slug, name, short_description, content, content_type,
    content_version, category_id, metadata, cover_image_url, is_trial_eligible,
    trial_duration, trial_unit, welcome_pdf_url,
    is_free, price_cents, currency, stripe_price_id,
    status, current_version, last_published_at, last_published_by
  ) values (
    p_studio_product_id, p_slug, p_name, p_short_description, p_content, p_content_type,
    p_content_version, v_category_id, p_metadata, p_cover_image_url, p_is_trial_eligible,
    p_trial_duration, p_trial_unit, p_welcome_pdf_url,
    p_is_free, p_price_cents, p_currency, p_stripe_price_id,
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
    cover_image_url = coalesce(excluded.cover_image_url, portal.products.cover_image_url),
    is_trial_eligible = excluded.is_trial_eligible,
    trial_duration = coalesce(excluded.trial_duration, portal.products.trial_duration),
    trial_unit = excluded.trial_unit,
    welcome_pdf_url = coalesce(excluded.welcome_pdf_url, portal.products.welcome_pdf_url),
    is_free = excluded.is_free,
    price_cents = coalesce(excluded.price_cents, portal.products.price_cents),
    currency = excluded.currency,
    stripe_price_id = coalesce(excluded.stripe_price_id, portal.products.stripe_price_id),
    status = excluded.status,
    current_version = excluded.current_version,
    last_published_at = excluded.last_published_at,
    last_published_by = excluded.last_published_by
  returning * into v_product;

  -- Full snapshot for history/rollback.
  insert into portal.product_versions (
    product_id, version, status, name, short_description, cover_image_url, content, published_by, change_notes
  ) values (
    v_product.id, v_new_version, p_status, p_name, p_short_description, v_product.cover_image_url, p_content, p_published_by, p_change_notes
  );

  -- Per-destination ledger (the 'portal' row here mirrors products.status
  -- deliberately — see the comment on product_destinations above).
  insert into portal.product_destinations (
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
  -- the Welcome PDF if provided, and whatever else was sent.
  insert into portal.published_assets (product_id, product_version, asset_type, destination_id, mime_type, metadata)
  values (v_product.id, v_new_version, 'workspace_json', v_destination_id, 'application/json', '{}'::jsonb)
  on conflict (product_id, product_version, asset_type, destination_id) do nothing;

  if p_cover_image_url is not null then
    insert into portal.published_assets (product_id, product_version, asset_type, destination_id, url, storage_path, size_bytes, mime_type)
    values (v_product.id, v_new_version, 'cover_image', v_destination_id, p_cover_image_url, p_cover_image_storage_path, p_cover_image_size_bytes, 'image/*')
    on conflict (product_id, product_version, asset_type, destination_id) do update set
      url = excluded.url, storage_path = excluded.storage_path, size_bytes = excluded.size_bytes;
  end if;

  if p_welcome_pdf_url is not null then
    insert into portal.published_assets (product_id, product_version, asset_type, destination_id, url, storage_path, size_bytes, mime_type)
    values (v_product.id, v_new_version, 'welcome_pdf', v_destination_id, p_welcome_pdf_url, p_welcome_pdf_storage_path, p_welcome_pdf_size_bytes, 'application/pdf')
    on conflict (product_id, product_version, asset_type, destination_id) do update set
      url = excluded.url, storage_path = excluded.storage_path, size_bytes = excluded.size_bytes;
  end if;

  for v_asset in select * from jsonb_array_elements(coalesce(p_assets, '[]'::jsonb))
  loop
    insert into portal.published_assets (product_id, product_version, asset_type, destination_id, url, storage_path, mime_type, size_bytes, metadata)
    values (
      v_product.id, v_new_version, v_asset->>'assetType', v_destination_id, v_asset->>'url', v_asset->>'storagePath',
      v_asset->>'mimeType', (v_asset->>'sizeBytes')::int, coalesce(v_asset->'metadata', '{}'::jsonb)
    )
    on conflict (product_id, product_version, asset_type, destination_id) do update set
      url = excluded.url, storage_path = excluded.storage_path, mime_type = excluded.mime_type, size_bytes = excluded.size_bytes, metadata = excluded.metadata;
  end loop;

  -- Catalog index only ever holds currently-published rows.
  if p_status = 'published' and p_destination_key = 'portal' then
    insert into portal.catalog_index (
      product_id, slug, name, short_description, content_type, category_id,
      cover_image_url, tags, is_free, price_cents, currency, is_trial_eligible,
      published_at, search_vector, updated_at
    ) values (
      v_product.id, v_product.slug, v_product.name, v_product.short_description, v_product.content_type,
      v_product.category_id, v_product.cover_image_url, v_tags,
      v_product.is_free, v_product.price_cents, v_product.currency, v_product.is_trial_eligible,
      now(),
      setweight(to_tsvector('english', v_product.name), 'A') ||
        setweight(to_tsvector('english', v_product.short_description), 'B') ||
        setweight(to_tsvector('english', array_to_string(v_tags, ' ')), 'C'),
      now()
    )
    on conflict (product_id) do update set
      slug = excluded.slug,
      name = excluded.name,
      short_description = excluded.short_description,
      content_type = excluded.content_type,
      category_id = excluded.category_id,
      cover_image_url = excluded.cover_image_url,
      tags = excluded.tags,
      is_free = excluded.is_free,
      price_cents = excluded.price_cents,
      currency = excluded.currency,
      is_trial_eligible = excluded.is_trial_eligible,
      published_at = coalesce(portal.catalog_index.published_at, excluded.published_at),
      search_vector = excluded.search_vector,
      updated_at = excluded.updated_at;
  else
    delete from portal.catalog_index where product_id = v_product.id;
  end if;

  return v_product;
end;
$$;

-- ---------------------------------------------------------------------------
-- Popularity trigger: license_count = distinct members who ever held a
-- license (trial or purchase) for this product. AFTER INSERT only —
-- portal.licenses has a (user_id, product_id) unique constraint
-- (0012_purchase_licenses.sql), so a trial-to-purchase upgrade is an UPDATE
-- on the same row, not a second INSERT, keeping this an accurate count of
-- distinct member relationships rather than double-counting an upgrade.
-- ---------------------------------------------------------------------------
create or replace function portal.bump_catalog_license_count()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  update portal.catalog_index
    set license_count = license_count + 1
    where product_id = new.product_id;
  return new;
end;
$$;

drop trigger if exists licenses_bump_catalog_license_count on portal.licenses;
create trigger licenses_bump_catalog_license_count
  after insert on portal.licenses
  for each row execute function portal.bump_catalog_license_count();

-- ---------------------------------------------------------------------------
-- Rating trigger: keeps catalog_index.avg_rating/review_count in lockstep
-- with portal.product_review_summary's own formula (0009_reviews.sql),
-- just denormalized onto the row Browse/Home actually read.
-- ---------------------------------------------------------------------------
create or replace function portal.refresh_catalog_rating()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_product_id uuid := coalesce(new.product_id, old.product_id);
begin
  update portal.catalog_index ci
    set avg_rating = agg.average_rating,
        review_count = agg.review_count
    from (
      select round(avg(rating)::numeric, 2) as average_rating, count(*)::int as review_count
      from portal.reviews where product_id = v_product_id
    ) agg
    where ci.product_id = v_product_id;
  return null;
end;
$$;

drop trigger if exists reviews_refresh_catalog_rating on portal.reviews;
create trigger reviews_refresh_catalog_rating
  after insert or update or delete on portal.reviews
  for each row execute function portal.refresh_catalog_rating();

-- ---------------------------------------------------------------------------
-- One-time backfill: existing catalog_index rows predate the triggers above
-- and the tags column, so recompute them directly rather than requiring a
-- republish from Studio.
-- ---------------------------------------------------------------------------
-- Correlated per-row subqueries rather than a join — simplest to reason
-- about correctly for a one-time backfill, and catalog_index is small
-- enough today (this repo is pre-launch) for the per-row cost not to matter.
update portal.catalog_index ci set
  tags = coalesce((
    select array_agg(value #>> '{}')
    from portal.products p, jsonb_array_elements(coalesce(p.metadata->'tags', '[]'::jsonb))
    where p.id = ci.product_id
  ), '{}'),
  is_free = coalesce((select p.is_free from portal.products p where p.id = ci.product_id), false),
  price_cents = (select p.price_cents from portal.products p where p.id = ci.product_id),
  currency = coalesce((select p.currency from portal.products p where p.id = ci.product_id), 'usd'),
  is_trial_eligible = coalesce((select p.is_trial_eligible from portal.products p where p.id = ci.product_id), true),
  avg_rating = (
    select round(avg(rating)::numeric, 2) from portal.reviews r where r.product_id = ci.product_id
  ),
  review_count = coalesce((
    select count(*)::int from portal.reviews r where r.product_id = ci.product_id
  ), 0),
  license_count = coalesce((
    select count(*)::int from portal.licenses l where l.product_id = ci.product_id
  ), 0);

-- Recompute search_vector's weighting for every existing row so relevance
-- ranking is consistent from day one, not just for future publishes.
update portal.catalog_index set
  search_vector =
    setweight(to_tsvector('english', name), 'A') ||
    setweight(to_tsvector('english', short_description), 'B') ||
    setweight(to_tsvector('english', array_to_string(tags, ' ')), 'C');
