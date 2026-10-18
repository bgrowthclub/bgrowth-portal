-- 0057 — Plans & Subscriptions, step 1 (Website Sprint 121)
--
-- portal.membership_plans: the plans BGrowth offers (Free, Starter, Pro,
-- Enterprise to start), edited in the Website's Admin → Plans — names,
-- order, status, monthly/yearly prices (with an optional sale price), the
-- texts of the Pricing card and what each plan unlocks (`entitlements`).
--   status: 'active'   — offered on the Pricing page
--           'hidden'   — not offered, but members can still have it
--           'disabled' — retired: no new members (existing ones keep it
--                        until their period ends)
--   rank: the plan order (Free 0 < Starter 10 < Pro 20 < Enterprise 30),
--         used for rules like "Pro or above".
--   provider_prices: each payment provider's own price ids, e.g.
--         {"stripe": {"month": "price_…", "year": "price_…"}} — filled when
--         plans start selling (step 2), so another provider can be added
--         later without changing this table.
--
-- portal.member_plans: which plan each member has, and why —
--   source 'subscription' (paid, through a payment provider) or 'team'
--   (given in Admin → Members: a promotion, a giveaway, a referral…).
--   A member with more than one live row has the highest-ranked plan
--   (portal.member_plan_of()). No row = Free.
--
-- Settings live in portal.site_settings, key 'plans'.
-- Plans are readable by everyone (the Pricing page); a member reads only
-- their own member_plans rows; all writes go through the service role.
-- Additive only. Requires 0031 (site_settings).

create table if not exists portal.membership_plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  description text not null default '',
  rank int not null default 0,
  status text not null default 'active' check (status in ('active', 'hidden', 'disabled')),
  is_free boolean not null default false,
  price_on_request boolean not null default false,
  currency text not null default 'usd',
  monthly_cents int check (monthly_cents is null or monthly_cents >= 0),
  yearly_cents int check (yearly_cents is null or yearly_cents >= 0),
  monthly_sale_cents int check (monthly_sale_cents is null or monthly_sale_cents >= 0),
  yearly_sale_cents int check (yearly_sale_cents is null or yearly_sale_cents >= 0),
  features text[] not null default '{}',
  highlighted boolean not null default false,
  entitlements jsonb not null default '{}'::jsonb,
  provider_prices jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists portal.member_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references portal.membership_plans(id),
  source text not null check (source in ('subscription', 'team')),
  reason text check (reason is null or reason in ('promotion', 'giveaway', 'referral', 'support', 'other')),
  note text,
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'canceled', 'ended')),
  billing_interval text check (billing_interval is null or billing_interval in ('month', 'year')),
  provider text,
  provider_customer_id text,
  provider_subscription_id text unique,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists member_plans_user_idx on portal.member_plans (user_id);

alter table portal.membership_plans enable row level security;
alter table portal.member_plans enable row level security;

drop policy if exists "plans are public" on portal.membership_plans;
create policy "plans are public" on portal.membership_plans for select using (status <> 'disabled');

drop policy if exists "own plans" on portal.member_plans;
create policy "own plans" on portal.member_plans for select to authenticated using (user_id = auth.uid());

grant select on portal.membership_plans to anon, authenticated;
grant select on portal.member_plans to authenticated;
grant select, insert, update, delete on portal.membership_plans, portal.member_plans to service_role;

-- The plan a member has right now: the highest-ranked live row, else Free.
create or replace function portal.member_plan_of(p_user uuid)
returns text
language sql
stable
security definer
set search_path = portal, public
as $$
  select coalesce(
    (select p.slug
       from portal.member_plans m
       join portal.membership_plans p on p.id = m.plan_id
      where m.user_id = p_user
        and m.status in ('active', 'trialing', 'past_due')
        and m.starts_at <= now()
        and (m.ends_at is null or m.ends_at > now())
      order by p.rank desc
      limit 1),
    'free')
$$;

grant execute on function portal.member_plan_of(uuid) to authenticated, service_role;

-- The four plans of the 27/09 draft. What each one unlocks is left for the
-- team to set in Admin → Plans (only what was already decided is filled:
-- member page editing — part on Pro, all on Enterprise — and priority
-- support on Enterprise).
insert into portal.membership_plans (slug, name, description, rank, status, is_free, price_on_request, monthly_cents, yearly_cents, features, highlighted, entitlements)
values
  ('free', 'Free', 'Get started before you buy anything.', 0, 'active', true, false, 0, 0,
    array['Free account', 'Free Workspaces™', 'A free trial of one paid Workspace™', 'Newsletter'], false, '{}'::jsonb),
  ('starter', 'Starter', 'For getting started with the essentials.', 10, 'hidden', false, false, 1900, null,
    array[]::text[], false, '{}'::jsonb),
  ('pro', 'Pro', 'For professionals who want it all.', 20, 'hidden', false, false, 4900, null,
    array[]::text[], true, '{"memberPage": "partial"}'::jsonb),
  ('enterprise', 'Enterprise', 'For teams and growing organizations.', 30, 'hidden', false, true, null, null,
    array[]::text[], false, '{"memberPage": "full", "prioritySupport": true}'::jsonb)
on conflict (slug) do nothing;

insert into portal.site_settings (key, value)
values ('plans', '{"provider": "stripe", "cancelAt": "period_end", "graceDays": 7, "allowSwitch": true, "yearlyDiscountPercent": 20}'::jsonb)
on conflict (key) do nothing;
