-- 0077 — How many pages a member may have (07/11/2026)
--
-- Decided with the owner: Free 1 page, Pro 2, Enterprise 3, and the team
-- can hand one person an extra one (a Free or Starter member who asks, a
-- promotion). The per-plan number lives in the plan's own `entitlements`
-- JSON (`pages`), which needs no migration. What needs a column is the
-- per-person grant.
--
-- Requires 0044 (member_pages) and 0057 (membership_plans). Additive: it
-- adds one column and one function, changes no policy and no existing row's
-- behaviour. Applying it alone, before the site ships the feature, is safe
-- — nothing reads the column yet.

alter table portal.users
  add column if not exists extra_member_pages smallint not null default 0;

comment on column portal.users.extra_member_pages is
  'Pages the team granted this member ON TOP of their plan''s allowance (Admin → Members). 0 = only what the plan gives.';

-- How many pages this member may have in total: the most generous live
-- plan, plus the team's grant.
--
-- A plan with no `pages` number but with a `memberPage` entitlement counts
-- as 1, so every plan that already promised "a page" keeps working exactly
-- as it did the day before this shipped. A member with no plan at all gets
-- 0 from the plan side — their grant, if any, still counts, which is how
-- the team hands a page to someone who has none.
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
            -- Only cast when it really is a JSON number: a plan saved with
            -- a stray string would otherwise make this function throw, and
            -- it is called while someone is trying to open their page.
            when jsonb_typeof(p.entitlements -> 'pages') = 'number'
              then greatest(0, (p.entitlements ->> 'pages')::int)
            when p.entitlements ? 'memberPage' then 1
            else 0
          end
        )
        from portal.member_plans m
        join portal.membership_plans p on p.id = m.plan_id
        where m.user_id = p_user
          and m.status in ('active', 'trialing', 'past_due')
          and m.starts_at <= now()
          and (m.ends_at is null or m.ends_at > now())
      ),
      0
    )
    + coalesce((select u.extra_member_pages from portal.users u where u.id = p_user), 0)
  );
$$;

grant execute on function portal.member_page_allowance(uuid) to anon, authenticated, service_role;
