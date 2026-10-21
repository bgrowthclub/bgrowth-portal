-- 0066 — Journeys (BGrowth Website only). Additive.
--
-- A Journey is a guided path to a goal (stages → actions) built in BGrowth
-- Studio → Journeys and shown ONLY on the Website (/journeys). It is stored
-- as a portal.products row with content_type 'journey' so it reuses the
-- Studio → Publishing Engine → publish_product() save path and the release
-- flow (0051). Its `content` only REFERENCES existing products and
-- Knowledge articles (by id / slug) — it never copies them.
--
-- What this migration does:
--   1. Allows content_type 'journey'.
--   2. Hides Journeys from every browser read of portal.products and
--      portal.catalog_index (anon and authenticated), so the Portal can't
--      list, search or open one — not by link either. The Website reads
--      Journeys only through the two functions below.
--   3. portal.get_journey_outline(slug) / portal.list_journeys(): a
--      published Journey with every reference resolved on the server.
--      A reference to a product or article that is not published comes back
--      as 'coming_soon' or 'unavailable' with NO name, slug, id or price —
--      draft details never leave the database. An action marked
--      whenUnavailable = 'hide' is left out until its resource is published.
--      An action limited to some states is shown only for states listed in
--      the Journey's validatedStates.
--   4. A member can save progress in portal.workspace_instances for a
--      PUBLISHED, FREE Journey without any license: no purchase, license,
--      access e-mail or review request. One progress record per member and
--      Journey; it must carry data.kind = 'journey'.
--
-- Nothing here changes existing products, licenses, checkout, plans or
-- workspace records: every existing rule keeps working as before for every
-- other content type.

-- 1. The new content type (same list as 0041, plus journey). ---------------
alter table portal.products drop constraint if exists products_content_type_check;
alter table portal.products
  add constraint products_content_type_check
  check (content_type in (
    'workspace', 'template', 'document', 'pdf', 'course',
    'calculator', 'ai_tool', 'academy_lesson', 'bundle', 'journey'
  ));

-- 2a. Browsers never read Journey rows directly. ---------------------------
-- Same rule as 0016 (published, or licensed by this member), plus "not a
-- Journey". The old policy's name is longer than 63 characters, so
-- Postgres stored it shortened — both spellings are dropped.
drop policy if exists "Anyone can read published products or their own licensed products" on portal.products;
drop policy if exists "Anyone can read published products or their own licensed produc" on portal.products;
drop policy if exists "Read published or licensed products, never Journeys" on portal.products;
create policy "Read published or licensed products, never Journeys"
  on portal.products for select
  using (
    content_type <> 'journey'
    and (
      status = 'published'
      or exists (
        select 1 from portal.licenses l
        where l.product_id = products.id and l.user_id = auth.uid()
      )
    )
  );

-- 2b. Same for the Portal's catalog (publish_product() also indexes
-- Journeys there; they are simply never readable by a browser).
drop policy if exists "Anyone can read the catalog index" on portal.catalog_index;
drop policy if exists "Anyone can read the catalog index, never Journeys" on portal.catalog_index;
create policy "Anyone can read the catalog index, never Journeys"
  on portal.catalog_index for select
  using (content_type <> 'journey');

-- 3. Reading a published Journey. -----------------------------------------
-- Products a Journey action can point to.
create or replace function portal.journey_ref_types()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['workspace', 'calculator', 'pdf', 'bundle']::text[] $$;

create or replace function portal.journey_resolve_action(p_action jsonb, p_validated jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_kind text := p_action ->> 'kind';
  v_state text := 'unavailable';
  v_ref jsonb := null;
  v_states jsonb := '[]'::jsonb;
  v_product record;
  v_article record;
  v_id text := p_action ->> 'productId';
  v_slug text := p_action ->> 'articleSlug';
  v_url text := p_action ->> 'url';
begin
  -- State-specific actions: only states that were validated stay; none left
  -- = the action is not shown at all.
  if jsonb_typeof(p_action -> 'states') = 'array' and jsonb_array_length(p_action -> 'states') > 0 then
    select coalesce(jsonb_agg(s.value), '[]'::jsonb) into v_states
      from jsonb_array_elements(p_action -> 'states') s
     where jsonb_typeof(p_validated) = 'array' and p_validated @> jsonb_build_array(s.value);
    if jsonb_array_length(v_states) = 0 then
      return null;
    end if;
  end if;

  if v_kind = 'product' then
    if v_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select p.id, p.status, p.content_type, p.slug, p.name, p.is_free, p.price_cents, p.currency, p.cover_image_url
        into v_product
        from portal.products p
       where p.id = v_id::uuid;
      if found and v_product.content_type = any (portal.journey_ref_types()) then
        if v_product.status = 'published' then
          v_state := 'available';
          v_ref := jsonb_build_object(
            'productId', v_product.id,
            'slug', v_product.slug,
            'name', v_product.name,
            'contentType', v_product.content_type,
            'isFree', v_product.is_free,
            'priceCents', v_product.price_cents,
            'currency', v_product.currency,
            'coverImageUrl', v_product.cover_image_url
          );
        elsif v_product.status in ('draft', 'ready_for_review', 'approved') then
          v_state := 'coming_soon';
        end if;
      end if;
    end if;
  elsif v_kind = 'article' then
    if coalesce(v_slug, '') <> '' then
      select a.slug, a.title, a.access, a.required_plan_name
        into v_article
        from portal.knowledge_articles a
       where a.slug = v_slug
       limit 1;
      if found then
        v_state := 'available';
        v_ref := jsonb_build_object(
          'slug', v_article.slug,
          'title', v_article.title,
          'access', v_article.access,
          'requiredPlanName', v_article.required_plan_name
        );
      elsif exists (
        select 1 from knowledge_engine.items i
         where i.slug = v_slug
           and i.status <> 'Archived'
           and coalesce(i.publishing ->> 'visibility', 'Public') <> 'Private'
      ) then
        v_state := 'coming_soon';
      end if;
    end if;
  elsif v_kind in ('video', 'link') then
    if v_url like 'https://%' then
      v_state := 'available';
      v_ref := jsonb_build_object('url', v_url);
    end if;
  elsif v_kind = 'manual' then
    v_state := 'available';
  end if;

  if v_state <> 'available' and coalesce(p_action ->> 'whenUnavailable', 'coming_soon') = 'hide' then
    return null;
  end if;

  return jsonb_build_object(
    'id', p_action ->> 'id',
    'title', coalesce(p_action ->> 'title', ''),
    'instructions', coalesce(p_action ->> 'instructions', ''),
    'optional', coalesce((p_action ->> 'optional')::boolean, false),
    'kind', v_kind,
    'state', v_state,
    'ref', v_ref,
    'states', v_states
  );
end;
$$;

create or replace function portal.get_journey_outline(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_product record;
  v_validated jsonb;
  v_stages jsonb := '[]'::jsonb;
  v_actions jsonb;
  v_resolved jsonb;
  s record;
  a record;
begin
  select p.id, p.slug, p.name, p.short_description, p.cover_image_url, p.category_id, p.is_free,
         p.last_published_at, p.content
    into v_product
    from portal.products p
   where p.slug = p_slug and p.content_type = 'journey' and p.status = 'published'
   order by p.last_published_at desc nulls last
   limit 1;
  if not found then
    return null;
  end if;

  v_validated := case
    when jsonb_typeof(v_product.content -> 'validatedStates') = 'array' then v_product.content -> 'validatedStates'
    else '[]'::jsonb
  end;

  for s in
    select st.value, st.ord
      from jsonb_array_elements(
             case when jsonb_typeof(v_product.content -> 'stages') = 'array' then v_product.content -> 'stages' else '[]'::jsonb end
           ) with ordinality st(value, ord)
     order by st.ord
  loop
    v_actions := '[]'::jsonb;
    for a in
      select ac.value, ac.ord
        from jsonb_array_elements(
               case when jsonb_typeof(s.value -> 'actions') = 'array' then s.value -> 'actions' else '[]'::jsonb end
             ) with ordinality ac(value, ord)
       order by ac.ord
    loop
      v_resolved := portal.journey_resolve_action(a.value, v_validated);
      if v_resolved is not null then
        v_actions := v_actions || jsonb_build_array(v_resolved);
      end if;
    end loop;
    if jsonb_array_length(v_actions) > 0 then
      v_stages := v_stages || jsonb_build_array(jsonb_build_object(
        'id', s.value ->> 'id',
        'title', coalesce(s.value ->> 'title', ''),
        'summary', coalesce(s.value ->> 'summary', ''),
        'actions', v_actions
      ));
    end if;
  end loop;

  return jsonb_build_object(
    'id', v_product.id,
    'slug', v_product.slug,
    'name', v_product.name,
    'shortDescription', v_product.short_description,
    'coverImageUrl', v_product.cover_image_url,
    'categoryId', v_product.category_id,
    'isFree', v_product.is_free,
    'publishedAt', v_product.last_published_at,
    'goal', coalesce(v_product.content ->> 'goal', ''),
    'intro', coalesce(v_product.content ->> 'intro', ''),
    'completionMessage', coalesce(v_product.content ->> 'completionMessage', ''),
    'notice', coalesce(v_product.content ->> 'notice', ''),
    'validatedStates', v_validated,
    'stages', v_stages
  );
end;
$$;

-- The published Journeys, newest first (the Website's /journeys list).
create or replace function portal.list_journeys()
returns table (
  id uuid,
  slug text,
  name text,
  short_description text,
  cover_image_url text,
  category_id uuid,
  is_free boolean,
  published_at timestamptz,
  stage_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.slug, p.name, p.short_description, p.cover_image_url, p.category_id, p.is_free,
         p.last_published_at,
         case when jsonb_typeof(p.content -> 'stages') = 'array' then jsonb_array_length(p.content -> 'stages') else 0 end
    from portal.products p
   where p.content_type = 'journey' and p.status = 'published'
   order by p.last_published_at desc nulls last
$$;

revoke execute on function portal.journey_ref_types() from public;
revoke execute on function portal.journey_resolve_action(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function portal.get_journey_outline(text) from public;
revoke execute on function portal.list_journeys() from public;
grant execute on function portal.journey_ref_types() to anon, authenticated, service_role;
grant execute on function portal.journey_resolve_action(jsonb, jsonb) to service_role;
grant execute on function portal.get_journey_outline(text) to anon, authenticated, service_role;
grant execute on function portal.list_journeys() to anon, authenticated, service_role;

-- 4. Progress on a free Journey, without a license. ------------------------
-- security definer: the policy below can't see Journey rows through RLS (2a).
create or replace function portal.is_open_journey(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from portal.products p
     where p.id = p_product_id
       and p.content_type = 'journey'
       and p.status = 'published'
       and p.is_free
  )
$$;

revoke execute on function portal.is_open_journey(uuid) from public;
grant execute on function portal.is_open_journey(uuid) to authenticated, service_role;

-- Added next to the existing (license-based) insert policy; either one
-- allows the row. Reading and updating stay "own rows only" (0008, 0033).
drop policy if exists "Members can start a free published Journey" on portal.workspace_instances;
create policy "Members can start a free published Journey"
  on portal.workspace_instances for insert
  with check (
    auth.uid() = user_id
    and data ->> 'kind' = 'journey'
    and status = 'in_progress'
    and portal.is_open_journey(product_id)
  );

-- One progress record per member and Journey.
create unique index if not exists workspace_instances_one_journey_idx
  on portal.workspace_instances (user_id, product_id)
  where (data ->> 'kind') = 'journey';
