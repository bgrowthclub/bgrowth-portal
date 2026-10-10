-- 0041 — Bundles: one product that sells several Workspaces together.
--
-- A bundle is a row in portal.products with content_type = 'bundle' (no
-- content of its own, never trialled) plus the list of Workspaces it
-- includes in portal.bundle_items. The Workspaces stay sold on their own
-- too; nothing is copied.
--
-- Bundles are created and edited in the Website's Admin → Bundles
-- (api/admin.ts, service role) and sold only on the Website. They are NOT
-- added to portal.catalog_index, so the Portal's catalog never lists them.
--
-- Buying a bundle goes through the same path as a Workspace: the Stripe
-- webhook (or the free claim) calls grant_purchased_license() with the
-- bundle's id, and that function now gives a lifetime license for every
-- Workspace in the bundle instead (a trial of one of them is upgraded in
-- place, as with a normal purchase). No license row is created for the
-- bundle itself, so it never shows up as a Workspace in a member's library.

-- 1. 'bundle' as a content type (same list as 0003, plus bundle).
alter table portal.products drop constraint if exists products_content_type_check;
alter table portal.products
  add constraint products_content_type_check
  check (content_type in (
    'workspace', 'template', 'document', 'pdf', 'course',
    'calculator', 'ai_tool', 'academy_lesson', 'bundle'
  ));

-- 2. What each bundle includes, in the order it's shown.
create table if not exists portal.bundle_items (
  bundle_id uuid not null references portal.products(id) on delete cascade,
  product_id uuid not null references portal.products(id) on delete cascade,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  primary key (bundle_id, product_id),
  check (bundle_id <> product_id)
);

create index if not exists bundle_items_product_id_idx on portal.bundle_items (product_id);

alter table portal.bundle_items enable row level security;

-- Visitors see the contents of published bundles only.
drop policy if exists "Anyone can read published bundle items" on portal.bundle_items;
create policy "Anyone can read published bundle items"
  on portal.bundle_items for select
  using (
    exists (
      select 1 from portal.products b
      where b.id = bundle_id and b.status = 'published' and b.content_type = 'bundle'
    )
  );

grant select on portal.bundle_items to anon, authenticated;
grant select, insert, update, delete on portal.bundle_items to service_role;

-- 3. A purchase of a bundle → a lifetime license for each Workspace in it.
--    Same signature as 0012, so the Portal's webhook and the Website's free
--    claim keep calling it unchanged.
create or replace function portal.grant_purchased_license(
  p_user_id uuid,
  p_product_id uuid
)
returns portal.licenses
language plpgsql
security definer set search_path = ''
as $$
declare
  v_license portal.licenses;
  v_content_type text;
  v_item uuid;
  v_count int := 0;
begin
  select content_type into v_content_type from portal.products where id = p_product_id;

  if v_content_type = 'bundle' then
    for v_item in
      select bi.product_id from portal.bundle_items bi
      where bi.bundle_id = p_product_id
      order by bi.sort_order, bi.created_at
    loop
      insert into portal.licenses (user_id, product_id, type, status, access_policy, activated_at, expires_at)
      values (p_user_id, v_item, 'purchased', 'active', 'lifetime', now(), null)
      on conflict (user_id, product_id) do update set
        type = 'purchased',
        status = 'active',
        access_policy = 'lifetime',
        -- Already bought before: keep its original purchase date.
        activated_at = case
          when portal.licenses.type = 'purchased' and portal.licenses.status = 'active' then portal.licenses.activated_at
          else excluded.activated_at
        end,
        expires_at = null
      returning * into v_license;
      v_count := v_count + 1;
    end loop;
    if v_count = 0 then
      raise exception 'Bundle % has no Workspaces', p_product_id;
    end if;
    return v_license;
  end if;

  insert into portal.licenses (user_id, product_id, type, status, access_policy, activated_at, expires_at)
  values (p_user_id, p_product_id, 'purchased', 'active', 'lifetime', now(), null)
  on conflict (user_id, product_id) do update set
    type = 'purchased',
    status = 'active',
    access_policy = 'lifetime',
    activated_at = excluded.activated_at,
    expires_at = null
  returning * into v_license;
  return v_license;
end;
$$;

-- Service role only (see 0033).
revoke execute on function portal.grant_purchased_license(uuid, uuid) from public, anon, authenticated;
grant execute on function portal.grant_purchased_license(uuid, uuid) to service_role;
