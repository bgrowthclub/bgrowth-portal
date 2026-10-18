-- 0061 — Products included in a plan (Website Sprint 126)
--
-- Decided 18/10/2026: each product (Workspace, calculator, download) can be
-- "included" from a plan up — e.g. included in Starter = Starter, Pro and
-- Enterprise members open it without buying, while their plan is live. A
-- plan whose entitlements has "includesAll": true (Enterprise) opens every
-- product. Cancelling ends that access; what the member filled in stays
-- (workspace_instances are never deleted) and comes back if they subscribe
-- again. Products bought or given keep working as before.
--
-- portal.product_plan_access: one row per included product = the lowest
--   plan that includes it. Set in the Website's Admin → Plans → Included.
--   Public read (shown on product pages); written by the service role.
-- portal.member_includes_all(user) / portal.plan_included_products():
--   helpers for the site (security definer, the caller's own plan only).
-- portal.has_workspace_access() — the one rule for "can open this" (0021,
--   used by workspace content and instances) — now also counts the plan.
-- Requires 0057 and 0060 (member_plan_rank). Additive.

create table if not exists portal.product_plan_access (
  product_id uuid primary key references portal.products(id) on delete cascade,
  plan_id uuid not null references portal.membership_plans(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table portal.product_plan_access enable row level security;
drop policy if exists "included products are public" on portal.product_plan_access;
create policy "included products are public" on portal.product_plan_access for select using (true);
grant select on portal.product_plan_access to anon, authenticated;
grant select, insert, update, delete on portal.product_plan_access to service_role;

create or replace function portal.member_includes_all(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = portal, public
as $$
  select exists (
    select 1
      from portal.member_plans m
      join portal.membership_plans p on p.id = m.plan_id
     where m.user_id = p_user
       and m.status in ('active', 'trialing', 'past_due')
       and m.starts_at <= now()
       and (m.ends_at is null or m.ends_at > now())
       and coalesce((p.entitlements ->> 'includesAll')::boolean, false)
  )
$$;

grant execute on function portal.member_includes_all(uuid) to authenticated, service_role;

-- What the signed-in member's plan opens: every included product whose plan
-- is at or below theirs, plus everything when their plan includes all.
create or replace function portal.plan_included_products()
returns table (product_id uuid, plan_name text, includes_all boolean)
language sql
stable
security definer
set search_path = portal, public
as $$
  select a.product_id, p.name, false
    from portal.product_plan_access a
    join portal.membership_plans p on p.id = a.plan_id
   where auth.uid() is not null
     and p.rank > 0
     and portal.member_plan_rank(auth.uid()) >= p.rank
  union all
  select null::uuid, null::text, true
   where auth.uid() is not null and portal.member_includes_all(auth.uid())
$$;

grant execute on function portal.plan_included_products() to authenticated;

create or replace function portal.has_workspace_access(p_product_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from portal.licenses l
    where l.user_id = auth.uid()
      and l.product_id = p_product_id
      and l.status = 'active'
      and (l.access_policy = 'lifetime' or l.expires_at is null or l.expires_at > now())
  )
  or exists (
    select 1 from portal.access_grants g
    where g.user_id = auth.uid()
      and g.revoked_at is null
      and (g.expires_at is null or g.expires_at > now())
      and (g.scope = 'all' or (g.scope = 'specific' and g.product_id = p_product_id))
  )
  -- Included in the member's plan (0061).
  or exists (
    select 1 from portal.product_plan_access a
    join portal.membership_plans p on p.id = a.plan_id
    where a.product_id = p_product_id
      and p.rank > 0
      and portal.member_plan_rank(auth.uid()) >= p.rank
  )
  or portal.member_includes_all(auth.uid());
$$;

grant execute on function portal.has_workspace_access(uuid) to authenticated;
