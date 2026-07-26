# Workspace Instances — Future Architecture (planning only, not implemented)

This document exists so today's decisions don't box in a future capability:
letting a member create, save, reopen, complete, and archive **multiple
independent filled-in records** of the same owned Workspace — e.g. a mobile
notary preparing three separate client checklists before leaving the
office, each saved and reopenable on its own, with a sidebar listing every
incomplete one for quick switching between clients.

**Nothing below is built.** This is a plan to build against later, written
now so nothing shipped in this pass (the Library/Marketplace split, the
Checkout/Notification service abstractions) needs to be reworked when this
capability is actually implemented.

## Today's constraint, precisely

`WorkspaceViewerPage` renders exactly one static view per owned product.
Field values a member types into a Planner/Checklist live in transient
React state only — refresh the page and they're gone. There is no concept
of "a specific filled-in record" anywhere in the schema; `portal.products`
holds the Workspace's *definition* (the rendering JSON), and there's
nothing that holds *an instance of someone filling it out*.

## The proven precedent: Studio already has this shape

BGrowth Studio's Checklist Builder already implements exactly this pattern
for its own internal use — `ChecklistInstance` (`bgrowth-studio/src/modules/checklist-builder/types.ts`),
with `api_saveInstance`/`api_getInstances`/`api_getInstance`
(`bgrowth-studio/src/modules/checklist-builder/api.ts`). Each instance has
its own `dataJson` (the filled values), `progressPercent`, and
`status: 'In Progress' | 'Completed'`, keyed by `templateId` +
`instanceId`. It's backed by Google Sheets there, not built for customers,
and not exposed anywhere in the Portal — but it proves the shape works and
gives the Portal's version a concrete model to mirror rather than
inventing one from scratch.

## Proposed Portal-side schema (new tables only — no changes to existing ones)

```sql
create table portal.workspace_instances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references portal.users(id) on delete cascade,
  license_id uuid not null references portal.licenses(id) on delete cascade,
  product_id uuid not null references portal.products(id) on delete cascade,
  label text not null,              -- e.g. the client/job name, member-supplied
  data jsonb not null default '{}', -- filled field values, keyed by field id — mirrors WorkspaceContent's section/field ids, never the definition itself
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- `user_id` is denormalized (not just derived via `license_id`) so RLS stays
  a simple, fast `auth.uid() = user_id` check — the same pattern already
  used on `portal.licenses` itself.
- `license_id` ties an instance to the specific owned Workspace — a member
  can only create instances for a Workspace they actually hold a license
  for, enforced the same way trial activation already is.
- `data` (filled values) is completely separate from `products.content`
  (the Workspace's rendering *definition*) — this split already exists
  conceptually today (`WorkspaceRenderer` takes `content` as a prop; field
  state is separate, just not persisted yet), so no rework of the
  definition/content model is needed to add this.

## Why nothing shipped in this pass blocks it

- **Licenses model** — `workspace_instances.license_id` extends cleanly
  from the existing one-row-per-owned-Workspace `licenses` table; nothing
  about today's Library/Marketplace split changes what a license means.
- **Content vs. data separation** — already true today (`WorkspaceContent`
  is the definition; field values were always meant to be a separate
  concern, just transient so far).
- **Service-layer pattern** — `checkoutService`/`notificationService`
  (added in this pass) establish the exact convention a future
  `workspaceInstanceService` (list/create/update/complete/archive) would
  also follow: components call a plain async service object, never the
  Supabase client directly for anything beyond simple reads.
- **WorkspaceViewerPage** — today renders one static view; evolving it into
  a list view (`/workspace/:slug`) plus a per-instance fill view
  (`/workspace/:slug/:instanceId`) is additive routing, not a rewrite of
  `WorkspaceRenderer` itself, which already just takes `content` as a prop
  and doesn't know or care whether the surrounding page shows one instance
  or ten.

## What building this for real would actually require (later, not now)

1. The migration above, plus RLS policies mirroring `licenses`' pattern
   (`select`/`insert`/`update` where `auth.uid() = user_id`).
2. A new `workspaceInstanceService` (list instances for a license, create,
   autosave/update `data`, mark completed, archive).
3. `WorkspaceViewerPage` split into two views: an instance list (the
   sidebar the brief describes — every incomplete instance for that
   Workspace, click to reopen) and a fill view (today's `WorkspaceRenderer`,
   now reading/writing a specific instance's `data` instead of purely local
   state).
4. Autosave wiring inside the fill view (debounced writes to
   `workspace_instances.data` — the one genuinely new interaction pattern
   this introduces, since today nothing in the Portal persists field input
   at all).

None of this needs to happen now. It's written down so the next person
picking it up (human or AI) starts from an evaluated plan instead of
re-deriving one.
