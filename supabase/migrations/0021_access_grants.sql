-- BGrowth Access Grants — manual, admin-issued Workspace access, completely
-- separate from Stripe purchases (portal.licenses) and trial activation.
-- Access rule going forward, everywhere it matters:
--
--   Workspace Access = Purchased License OR Active Trial OR Active Access Grant
--
-- Nothing here creates a licenses row, touches grant_purchased_license(),
-- activateTrial(), has_used_trial, or the one-trial-per-user constraint —
-- this is purely additive. Phase 1 administration is direct SQL/Supabase
-- Dashboard (postgres/service_role bypass RLS entirely); there is
-- deliberately no insert/update policy for `authenticated` here. A future
-- BGrowth Studio Access Management UI would write through service_role,
-- same as Content Engine's own admin-gated routes — no schema change
-- needed for that later.

-- ---------------------------------------------------------------------------
-- portal.access_grants
-- ---------------------------------------------------------------------------
create table if not exists portal.access_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references portal.users(id) on delete cascade,
  scope text not null check (scope in ('specific', 'all')),
  -- Required for scope='specific', must be null for scope='all' — enforced
  -- below by access_grants_scope_product_check, not left to application code.
  product_id uuid references portal.products(id) on delete cascade,
  -- null = lifetime access. In the future = temporary, checked against
  -- now() at read time (same pattern licenses.expires_at already uses) —
  -- deliberately no separate is_lifetime boolean, expires_at is null already
  -- means that unambiguously.
  expires_at timestamptz,
  note text,
  -- Free text, not a FK — Phase 1 admins act via the Supabase Dashboard as
  -- postgres, not as a portal.users/auth.users row. Matches the existing
  -- published_by/last_published_by convention (portal.publish_product()).
  granted_by text,
  created_at timestamptz not null default now(),
  -- Set once, never cleared — same "immutable fact" pattern as
  -- portal.users.has_used_trial. A grant is never hard-deleted, only
  -- revoked, preserving history/audit information.
  revoked_at timestamptz,

  constraint access_grants_scope_product_check check (
    (scope = 'specific' and product_id is not null) or
    (scope = 'all' and product_id is null)
  )
);

create index if not exists access_grants_user_id_idx on portal.access_grants (user_id);
-- Matches the exact filter every access check performs (active = not revoked).
create index if not exists access_grants_user_active_idx on portal.access_grants (user_id) where revoked_at is null;
create index if not exists access_grants_product_id_idx on portal.access_grants (product_id) where product_id is not null;

alter table portal.access_grants enable row level security;

drop policy if exists "Users can read their own access grants" on portal.access_grants;
create policy "Users can read their own access grants"
  on portal.access_grants for select
  using (auth.uid() = user_id);

-- No insert/update/delete policy for `authenticated` — intentional, see the
-- top-of-file note. Grants are never self-service.

grant select on portal.access_grants to authenticated;
grant select, insert, update on portal.access_grants to service_role;
-- No delete grant to anyone — revocation is `update revoked_at`, never a
-- row deletion, so grant history is never lost.

-- ---------------------------------------------------------------------------
-- portal.has_workspace_access() — the one centralized place "does this
-- session have access to this product" is decided at the database level.
-- Mirrors deriveAccessState()'s client-side logic (src/lib/workspaceAccess.ts)
-- so RLS and the client never disagree, and closes a real pre-existing gap:
-- the workspace_instances INSERT policy below used to check only
-- license.status = 'active', never expires_at — an expired trial (whose
-- status column is never flipped away from 'active' by anything) could
-- still pass. This function requires the license to actually still be
-- current (lifetime, or expiring-but-not-yet-expired) before counting it.
--
-- security invoker (the default) is deliberate, not an oversight: both
-- portal.licenses and portal.access_grants already scope every row to
-- auth.uid() = user_id via their own SELECT RLS policies, so an
-- invoker-rights function sees exactly what the calling role could already
-- see with a plain query — no privilege escalation surface to reason about,
-- and no need for security definer.
-- ---------------------------------------------------------------------------
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
  );
$$;

grant execute on function portal.has_workspace_access(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Fix: workspace_instances INSERT now goes through has_workspace_access()
-- instead of its own inline, narrower license check — this both closes the
-- expired-trial gap above and adds Access Grants support to New Fill
-- creation in the same change. Every other workspace_instances policy
-- (SELECT/UPDATE) and every other table's RLS is untouched.
-- ---------------------------------------------------------------------------
drop policy if exists "Users can create instances for Workspaces they own" on portal.workspace_instances;
create policy "Users can create instances for Workspaces they own"
  on portal.workspace_instances for insert
  with check (
    auth.uid() = user_id
    and portal.has_workspace_access(workspace_instances.product_id)
  );
