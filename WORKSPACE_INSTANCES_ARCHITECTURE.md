# Workspace Instances — Future Architecture

This document was written as planning-only, before any of it was built, so
today's decisions wouldn't box in a future capability: letting a member
create, save, reopen, complete, and archive **multiple independent
filled-in records** of the same owned Workspace — e.g. a mobile notary
preparing three separate client checklists before leaving the office, each
saved and reopenable on its own.

**An MVP slice of this is now built** — see `supabase/migrations/0008_workspace_instances.sql`,
`src/services/workspaceInstanceService.ts`, and the "Saved Checklists" list
on each `LibraryWorkspaceCard`. What shipped is deliberately the smallest
useful slice: create/save/reopen/continue-editing, surfaced as a flat list
per Workspace card in My Library — **not** the sidebar-based in-Workspace
switcher, and **not** complete/archive UI, both described below as still
future. The schema below was simplified in one way from the original plan
(`user_id`/`product_id` directly, no `license_id` FK — noted where it
comes up) but is otherwise exactly what was proposed here.

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

## Portal-side schema (built — supabase/migrations/0008_workspace_instances.sql)

```sql
create table portal.workspace_instances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references portal.users(id) on delete cascade,
  product_id uuid not null references portal.products(id) on delete cascade,
  label text not null,              -- e.g. the client/job name, member-supplied
  data jsonb not null default '{}', -- filled field values, keyed by field id — mirrors WorkspaceContent's section/field ids, never the definition itself
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- **Simplified from the original plan**: ties to `(user_id, product_id)`
  directly rather than through a `license_id` FK. A member can only ever
  hold one license per product today, and the insert RLS policy already
  checks `exists (select 1 from portal.licenses where user_id = auth.uid()
  and product_id = ... and status = 'active')` — so ownership is still
  enforced at the database, just without an extra join column that nothing
  else needed yet. Revisit if licenses ever become non-unique per product
  (e.g. renewals as new rows instead of updates).
- `user_id` denormalized so RLS stays a simple, fast `auth.uid() = user_id`
  check — the same pattern already used on `portal.licenses` itself.
- `data` (filled values) is completely separate from `products.content`
  (the Workspace's rendering *definition*) — this split already existed
  conceptually (`WorkspaceRenderer` took `content` as a prop; field state
  was separate, just transient) — no rework of the definition/content
  model was needed to add this.
- `status` defaults to, and today only ever holds, `'in_progress'` —
  `'completed'`/`'archived'` are valid per the check constraint but nothing
  writes them yet; see "still future" below.

## What's built vs. what's still future

**Built**: `workspaceInstanceService` (list for user, create, fetch by id,
save data); a "Saved Checklists" flat list + "+ New Checklist" action on
each `LibraryWorkspaceCard`; `WorkspaceViewerPage` reads an optional
`?instance=<id>` query param (no new route) to load/save a specific
instance's data via `WorkspaceRenderer`'s `initialData`/`onSave` props,
which existed but were unwired before this. A plain "Open Workspace" visit
with no instance param is completely unaffected — same transient,
unsaved behavior as always.

**Still future, deliberately not built in this pass**:
1. The in-Workspace sidebar switcher this document originally
   described — every incomplete instance for that Workspace, listed
   inside the Workspace view itself for one-click switching between
   clients without going back to Library. Today reopening a different
   checklist means returning to the Library card's list instead.
2. Complete/archive UI and behavior — the `status` column already
   supports it (see above), but nothing currently reads or writes anything
   but `'in_progress'`.
3. Autosave — saving today is an explicit "Save Checklist" click, not a
   debounced background write.

None of these three need to happen now. They're written down so the next
person picking this up (human or AI) starts from an evaluated plan instead
of re-deriving one, and so the schema already in place doesn't need to
change to support them later.
