-- Adds the auto-generated Welcome Guide PDF (see api/_lib/generateWelcomePdf.ts)
-- as a first-class product field, mirroring exactly how cover_image_url
-- already works: a convenience column on portal.products for cheap reads,
-- plus a row in portal.published_assets (asset_type 'welcome_pdf' — already
-- a valid enum value, reserved for this back when the Publishing Engine was
-- first built) for the full publish-history ledger. Unlike cover_image_url,
-- this is never "sticky" across a republish that omits it — the Portal
-- generates a fresh one from the payload on every single publish, so
-- there's no legitimate "Studio omitted it, keep the old one" case to guard
-- against.

alter table portal.products add column if not exists welcome_pdf_url text;

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
  p_welcome_pdf_url text default null
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
    status, current_version, last_published_at, last_published_by
  ) values (
    p_studio_product_id, p_slug, p_name, p_short_description, p_content, p_content_type,
    p_content_version, v_category_id, p_metadata, p_cover_image_url, p_is_trial_eligible,
    p_trial_duration, p_trial_unit, p_welcome_pdf_url,
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
    insert into portal.published_assets (product_id, product_version, asset_type, destination_id, url, mime_type)
    values (v_product.id, v_new_version, 'cover_image', v_destination_id, p_cover_image_url, 'image/*')
    on conflict (product_id, product_version, asset_type, destination_id) do update set url = excluded.url;
  end if;

  if p_welcome_pdf_url is not null then
    insert into portal.published_assets (product_id, product_version, asset_type, destination_id, url, mime_type)
    values (v_product.id, v_new_version, 'welcome_pdf', v_destination_id, p_welcome_pdf_url, 'application/pdf')
    on conflict (product_id, product_version, asset_type, destination_id) do update set url = excluded.url;
  end if;

  for v_asset in select * from jsonb_array_elements(coalesce(p_assets, '[]'::jsonb))
  loop
    insert into portal.published_assets (product_id, product_version, asset_type, destination_id, url, mime_type, size_bytes, metadata)
    values (
      v_product.id, v_new_version, v_asset->>'assetType', v_destination_id, v_asset->>'url',
      v_asset->>'mimeType', (v_asset->>'sizeBytes')::int, coalesce(v_asset->'metadata', '{}'::jsonb)
    )
    on conflict (product_id, product_version, asset_type, destination_id) do update set
      url = excluded.url, mime_type = excluded.mime_type, size_bytes = excluded.size_bytes, metadata = excluded.metadata;
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
