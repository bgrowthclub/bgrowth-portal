-- Lets a member save multiple independently-named, filled-in records of a
-- Workspace they own (e.g. one notary appointment checklist per client),
-- reopen any of them later, and continue editing. See
-- WORKSPACE_INSTANCES_ARCHITECTURE.md for the fuller future plan this is
-- deliberately a minimal slice of — simplified from that plan in one way:
-- ties to (user_id, product_id) directly rather than through a license_id
-- FK, since nothing else here needs that extra join for this scope and a
-- member can only ever hold one license per product today anyway.

create table if not exists portal.workspace_instances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references portal.users(id) on delete cascade,
  product_id uuid not null references portal.products(id) on delete cascade,
  label text not null,
  data jsonb not null default '{}'::jsonb,
  -- Only 'in_progress' is used today — 'completed'/'archived' are reserved
  -- for the future Workspace Engine (see WORKSPACE_INSTANCES_ARCHITECTURE.md)
  -- so adding that behavior later doesn't need another migration here.
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table portal.workspace_instances enable row level security;

drop policy if exists "Users can read their own workspace instances" on portal.workspace_instances;
create policy "Users can read their own workspace instances"
  on portal.workspace_instances for select
  using (auth.uid() = user_id);

-- Only lets a member create an instance for a Workspace they actually hold
-- an active license for — mirrors the access check WorkspaceViewerPage
-- already enforces client-side, now also enforced at the database.
drop policy if exists "Users can create instances for Workspaces they own" on portal.workspace_instances;
create policy "Users can create instances for Workspaces they own"
  on portal.workspace_instances for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from portal.licenses l
      where l.user_id = auth.uid()
        and l.product_id = workspace_instances.product_id
        and l.status = 'active'
    )
  );

drop policy if exists "Users can update their own workspace instances" on portal.workspace_instances;
create policy "Users can update their own workspace instances"
  on portal.workspace_instances for update
  using (auth.uid() = user_id);

create index if not exists workspace_instances_user_product_idx
  on portal.workspace_instances (user_id, product_id);

-- Same fix as 0007 — a new table/schema gets no role grants automatically.
grant select, insert, update on portal.workspace_instances to authenticated;
grant select, insert, update, delete on portal.workspace_instances to service_role;
