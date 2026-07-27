-- Asset lifecycle management: retention-window cleanup on republish, a
-- soft Archive (Unpublish) action, and a tightly-guarded hard-delete for
-- never-published drafts. See PUBLISHING_ENGINE.md for the full design.
--
-- Governing decisions (confirmed with the user before implementing):
-- 1. Retention window = current version + previous version only. A
--    republish prunes anything older, but ONLY from Storage — the
--    portal.published_assets and portal.product_versions ROWS are never
--    deleted, so full publish history stays queryable as an audit trail
--    even once an old version's asset url no longer resolves.
-- 2. "Delete/unpublish" means Archive, never a hard delete: removes the
--    product from the public catalog and blocks new purchases/trials
--    (already guaranteed by every read path filtering on
--    status = 'published' — see productService.fetchPublished/
--    fetchTrialEligible and api/checkout/create-session.ts), while
--    preserving every existing license, review, and version snapshot,
--    and leaving existing customers' access completely untouched
--    (deriveAccessState() never looks at products.status).
-- 3. A real hard delete is allowed ONLY for a product that has status =
--    'draft', has NEVER had a published version in its history, and has
--    zero licenses — enforced in the function itself, not left to the
--    caller to check.

-- ---------------------------------------------------------------------------
-- Storage bookkeeping: published_assets already has storage_path/size_bytes
-- columns (0003_publishing_engine.sql) but nothing has ever populated them —
-- every asset insert only ever set `url`. Both are needed to actually locate
-- and delete a Storage object later (a public URL alone doesn't cleanly
-- decompose back into a bucket path), and size_bytes is needed for the
-- future Assets Manager's storage-usage view (not built yet, data model
-- prepared for it now per the user's explicit request).
-- ---------------------------------------------------------------------------
alter table portal.published_assets
  add column if not exists deleted_from_storage_at timestamptz;

comment on column portal.published_assets.deleted_from_storage_at is
  'Set once the underlying Storage object has been pruned (retention window or archive cleanup). The row itself is never deleted — it remains the audit trail that this asset existed, even though its url no longer resolves once this is set.';

-- ---------------------------------------------------------------------------
-- publish_product() — now also accepts and stores storage_path/size_bytes
-- for the cover image and Welcome PDF (the two assets given dedicated
-- parameters; the generic p_assets array already accepted a storage path
-- via its own shape and just needed the caller to actually send one).
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
-- Retention-window pruning. Called by api/_lib/pruneOldAssets.ts AFTER a
-- publish (or archive) has already succeeded — never before, since the
-- new version's assets must exist before anything older is removed.
-- get_prunable_assets() only SELECTs (Postgres has no way to delete a
-- Supabase Storage object via SQL — that's an HTTP-level Storage API call
-- the Node caller has to make); mark_assets_deleted() is called back
-- afterward, only for the paths that were actually removed.
-- ---------------------------------------------------------------------------
create or replace function portal.get_prunable_assets(p_product_id uuid)
returns setof portal.published_assets
language sql
security definer set search_path = ''
stable
as $$
  select pa.*
  from portal.published_assets pa
  join portal.products p on p.id = pa.product_id
  where pa.product_id = p_product_id
    and pa.storage_path is not null
    and pa.deleted_from_storage_at is null
    and pa.product_version < p.current_version - 1;
$$;

create or replace function portal.mark_assets_deleted(p_asset_ids uuid[])
returns void
language sql
security definer set search_path = ''
as $$
  update portal.published_assets
  set deleted_from_storage_at = now()
  where id = any(p_asset_ids);
$$;

-- ---------------------------------------------------------------------------
-- Archive (Unpublish). Deliberately NOT a repurposed publish_product() call
-- — Studio's draft state doesn't persist pricing/trial config between
-- sessions (see 0011_pricing.sql's comment on the same gap), so reusing the
-- general publish path for a simple "hide this product" action would risk
-- silently overwriting is_free/is_trial_eligible with Studio's per-session
-- defaults. This function touches ONLY status/version/catalog visibility —
-- every other field (pricing, trial config, content) is left completely
-- untouched, read back from the existing row rather than re-supplied.
-- ---------------------------------------------------------------------------
create or replace function portal.archive_product(
  p_studio_product_id text,
  p_published_by text default 'studio'
)
returns portal.products
language plpgsql
security definer set search_path = ''
as $$
declare
  v_product portal.products;
  v_new_version int;
begin
  select * into v_product from portal.products where studio_product_id = p_studio_product_id;
  if v_product.id is null then
    raise exception 'No product found for studio_product_id %', p_studio_product_id;
  end if;

  v_new_version := v_product.current_version + 1;

  update portal.products
  set status = 'archived', current_version = v_new_version, last_published_at = now(), last_published_by = p_published_by
  where id = v_product.id
  returning * into v_product;

  insert into portal.product_versions (
    product_id, version, status, name, short_description, cover_image_url, content, published_by, change_notes
  ) values (
    v_product.id, v_new_version, 'archived', v_product.name, v_product.short_description, v_product.cover_image_url, v_product.content, p_published_by, 'Archived (unpublished)'
  );

  update portal.product_destinations
  set status = 'archived', published_version = v_new_version, last_published_at = now(), last_published_by = p_published_by
  where product_id = v_product.id;

  -- Removed from the public catalog — every read path that lists products
  -- for discovery already filters on status = 'published' independently
  -- (productService.fetchPublished/fetchTrialEligible, ProductPage,
  -- api/checkout/create-session.ts), so this alone is enough to block new
  -- purchases/trials. Existing licenses, reviews, and workspace_instances
  -- are untouched — nothing here references those tables.
  delete from portal.catalog_index where product_id = v_product.id;

  return v_product;
end;
$$;

-- ---------------------------------------------------------------------------
-- Hard delete — guarded to the one case where it's actually safe: a
-- product that has never left draft status and that no member has ever
-- held a license for. Nothing in Studio sends status = 'draft' to
-- publish_product() today (its "Publish to Portal" action always sends
-- 'published'), so this has no caller yet — it exists as a safety-checked
-- primitive ready for whenever a "delete this draft" action is built,
-- rather than something to reach for via a raw DELETE statement that
-- skips these checks.
-- ---------------------------------------------------------------------------
create or replace function portal.delete_draft_product(p_studio_product_id text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_product portal.products;
  v_license_count int;
  v_ever_published boolean;
begin
  select * into v_product from portal.products where studio_product_id = p_studio_product_id;
  if v_product.id is null then
    raise exception 'No product found for studio_product_id %', p_studio_product_id;
  end if;

  if v_product.status <> 'draft' then
    raise exception 'Refusing to hard-delete: product % is not in draft status (status = %)', p_studio_product_id, v_product.status;
  end if;

  select exists(
    select 1 from portal.product_versions where product_id = v_product.id and status = 'published'
  ) into v_ever_published;
  if v_ever_published then
    raise exception 'Refusing to hard-delete: product % has a published version in its history', p_studio_product_id;
  end if;

  select count(*) into v_license_count from portal.licenses where product_id = v_product.id;
  if v_license_count > 0 then
    raise exception 'Refusing to hard-delete: product % has % existing license(s)', p_studio_product_id, v_license_count;
  end if;

  -- Storage cleanup for this product's assets is the caller's
  -- responsibility beforehand (same get_prunable_assets-style pattern,
  -- scoped to ALL versions rather than "older than current - 1" — not
  -- built yet since nothing calls this function today) — cascading
  -- deletes below only clean up the database rows.
  delete from portal.product_versions where product_id = v_product.id;
  delete from portal.product_destinations where product_id = v_product.id;
  delete from portal.published_assets where product_id = v_product.id;
  delete from portal.catalog_index where product_id = v_product.id;
  delete from portal.products where id = v_product.id;
end;
$$;
