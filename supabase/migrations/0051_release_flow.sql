-- 0051 — Release flow (Website Sprint 89)
--
-- Products go through stages before they are sold, using the statuses
-- products already had (0003):
--   draft            → being prepared (e.g. just imported from Wix)
--   ready_for_review → reviewed by the team, waiting for approval
--   approved         → approved; publishes on scheduled_publish_at, or by hand
--   published        → on sale
-- Studio changes the stage through /api/access-management?resource=release.
-- A daily job (the Website's cron) calls portal.publish_scheduled().
-- Additive only.

alter table portal.products
  add column if not exists scheduled_publish_at timestamptz,
  add column if not exists reviewed_by text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists approved_by text,
  add column if not exists approved_at timestamptz;

create index if not exists products_scheduled_publish_idx
  on portal.products (scheduled_publish_at)
  where status = 'approved' and scheduled_publish_at is not null;

-- Publishes an existing product exactly as it is saved now (same content,
-- price, cover...), through publish_product() so the catalog, versions and
-- destination ledger stay right.
create or replace function portal.publish_existing(p_product_id uuid, p_published_by text default 'schedule')
returns portal.products
language plpgsql
security definer set search_path = ''
as $$
declare
  v portal.products;
  v_category_slug text;
  v_result portal.products;
begin
  select * into v from portal.products where id = p_product_id;
  if v.id is null then
    raise exception 'Product not found';
  end if;
  if v.studio_product_id is null then
    raise exception 'Product has no Studio id';
  end if;
  if v.content_type = 'pdf' and coalesce(jsonb_array_length(v.content->'files'), 0) = 0 then
    raise exception 'A Download needs at least one file';
  end if;
  if not v.is_free and v.price_cents is null then
    raise exception 'Set a price or mark it as free';
  end if;
  select slug into v_category_slug from portal.workspace_categories where id = v.category_id;

  v_result := portal.publish_product(
    p_studio_product_id => v.studio_product_id,
    p_slug => v.slug,
    p_name => v.name,
    p_short_description => v.short_description,
    p_content => v.content,
    p_status => 'published',
    p_content_type => v.content_type,
    p_content_version => v.content_version,
    p_category_slug => v_category_slug,
    p_metadata => coalesce(v.metadata, '{}'::jsonb),
    p_cover_image_url => v.cover_image_url,
    p_destination_key => 'portal',
    p_published_by => p_published_by,
    p_change_notes => 'Published from the release flow',
    p_is_trial_eligible => v.is_trial_eligible,
    p_trial_duration => v.trial_duration,
    p_trial_unit => coalesce(v.trial_unit, 'days'),
    p_welcome_pdf_url => v.welcome_pdf_url,
    p_is_free => v.is_free,
    p_price_cents => v.price_cents,
    p_currency => coalesce(v.currency, 'usd'),
    p_stripe_price_id => v.stripe_price_id
  );

  update portal.products set scheduled_publish_at = null where id = p_product_id;
  return v_result;
end;
$$;

-- Publishes every approved product whose date has come. Returns how many.
-- One failure doesn't stop the others.
create or replace function portal.publish_scheduled()
returns int
language plpgsql
security definer set search_path = ''
as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select id from portal.products
    where status = 'approved' and scheduled_publish_at is not null and scheduled_publish_at <= now()
    order by scheduled_publish_at
  loop
    begin
      perform portal.publish_existing(r.id, 'schedule');
      n := n + 1;
    exception when others then
      raise warning 'publish_scheduled: % failed: %', r.id, sqlerrm;
    end;
  end loop;
  return n;
end;
$$;

revoke all on function portal.publish_existing(uuid, text) from public, anon, authenticated;
revoke all on function portal.publish_scheduled() from public, anon, authenticated;
grant execute on function portal.publish_existing(uuid, text) to service_role;
grant execute on function portal.publish_scheduled() to service_role;
