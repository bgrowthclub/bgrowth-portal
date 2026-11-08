-- 0078 — The Free plan can finally give something (08/11/2026)
--
-- THE PROBLEM. "Free" has always been a fallback LABEL, not a membership:
-- someone who never subscribed has no row in portal.member_plans at all.
-- Every permission rule asks that table, so the Free plan's own
-- `entitlements` were written, saved — and read by nobody. Ticking "Part of
-- the page" on the Free plan in Admin → Plans did nothing at all, silently.
--
-- It only surfaces now because this is the first time Free is meant to give
-- anything (the owner's decision, 07/11/2026: Free gets one simple page).
--
-- THE FIX. One helper, portal.member_live_entitlements(user), which returns
-- the live plans' entitlements — or, when the member has none, the Free
-- plan's. Every rule is rewritten on top of it, so the fallback can never
-- be applied in one place and forgotten in another. The same rule is copied
-- into api/account.ts (livePlanEntitlements), which cannot import from the
-- database; change both.
--
-- Requires 0057, 0062, 0077. Additive in shape, but NOT in behaviour: from
-- the moment it is applied, whatever the Free plan's entitlements say
-- applies to every member without a subscription. Check what that row holds
-- in Admin → Plans before applying — '{}' (the seeded value) grants nothing
-- and keeps today's behaviour exactly.

create or replace function portal.member_live_entitlements(p_user uuid)
returns setof jsonb
language sql
stable
security definer
set search_path = portal, public
as $$
  with live as (
    select p.entitlements
      from portal.member_plans m
      join portal.membership_plans p on p.id = m.plan_id
     where m.user_id = p_user
       and m.status in ('active', 'trialing', 'past_due')
       and m.starts_at <= now()
       and (m.ends_at is null or m.ends_at > now())
  )
  select entitlements from live
  union all
  -- Only when there are none: a paying member is never also given the Free
  -- plan's terms. The ORDER BY/LIMIT has to sit inside its own subquery —
  -- written after UNION ALL they would apply to the whole result instead of
  -- to this branch, and the member's own plan could be the row dropped.
  select f.entitlements from (
    select p.entitlements, p.rank
      from portal.membership_plans p
     where not exists (select 1 from live)
       and p.is_free
       and p.status = 'active'
     order by p.rank
     limit 1
  ) f
$$;

grant execute on function portal.member_live_entitlements(uuid) to anon, authenticated, service_role;

-- How much of their page the member may edit.
create or replace function portal.member_page_level(p_user uuid)
returns text
language sql
stable
security definer
set search_path = portal, public
as $$
  select case
    when bool_or(e ->> 'memberPage' = 'full') then 'full'
    when bool_or(e ->> 'memberPage' = 'partial') then 'partial'
    else null
  end
  from portal.member_live_entitlements(p_user) e
$$;

-- How many pages they may have: the most generous live plan (or Free),
-- plus what the team granted this person.
create or replace function portal.member_page_allowance(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = portal, public
as $$
  select greatest(
    0,
    coalesce(
      (
        select max(
          case
            when jsonb_typeof(e -> 'pages') = 'number' then greatest(0, (e ->> 'pages')::int)
            when e ? 'memberPage' then 1
            else 0
          end
        )
        from portal.member_live_entitlements(p_user) e
      ),
      0
    )
    + coalesce((select u.extra_member_pages from portal.users u where u.id = p_user), 0)
  );
$$;

grant execute on function portal.member_page_allowance(uuid) to anon, authenticated, service_role;
