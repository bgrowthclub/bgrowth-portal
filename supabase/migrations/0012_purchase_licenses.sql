-- Separates "license type" (the commercial model: trial, purchased, and —
-- reserved for later, not used yet — subscription/enterprise) from "access
-- policy" (whether the license expires at all). Previously these were
-- conflated: 'lifetime' was a `type` value, even though "does this expire"
-- is a different question from "what did the member buy." Nothing has ever
-- created a type = 'lifetime' license (only activateTrial() writes licenses
-- today), so this is a clean redesign, not a data migration.
--
-- Also enforces "one license per member per Workspace" — going forward, a
-- purchase upgrades an existing trial license in place (same row: type
-- trial -> purchased, access_policy expiring -> lifetime) rather than
-- creating a second row for the same product. This is additive to, not a
-- replacement for, the existing "one trial per member, ever, platform-wide"
-- rule (licenses_one_trial_per_user) — a member can still only ever trial
-- once, but can hold purchased licenses for other Workspaces too.

alter table portal.licenses
  add column if not exists access_policy text not null default 'expiring';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'licenses_access_policy_check' and conrelid = 'portal.licenses'::regclass
  ) then
    alter table portal.licenses
      add constraint licenses_access_policy_check
      check (access_policy in ('expiring', 'lifetime'));
  end if;
end $$;

alter table portal.licenses drop constraint if exists licenses_type_check;
alter table portal.licenses
  add constraint licenses_type_check
  check (type in ('trial', 'purchased', 'subscription', 'enterprise'));

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'licenses_user_product_unique' and conrelid = 'portal.licenses'::regclass
  ) then
    alter table portal.licenses
      add constraint licenses_user_product_unique unique (user_id, product_id);
  end if;
end $$;

-- The one write path for a purchase-created license, mirroring
-- publish_product()'s "one function, service-role only" pattern. Upserts on
-- (user_id, product_id): a member who trialed this Workspace gets their
-- existing row upgraded in place; a member buying without ever trialing
-- gets a new row. Either way expires_at is cleared — access_policy =
-- 'lifetime' means expiry is never checked (see deriveAccessState()), but
-- clearing it too keeps the row itself unambiguous to read directly.
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
begin
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

-- Only the service-role (webhook) client calls this — never exposed to
-- anon/authenticated directly. No RLS grant needed beyond what
-- 0007_portal_schema_grants.sql already gives service_role on the schema.
