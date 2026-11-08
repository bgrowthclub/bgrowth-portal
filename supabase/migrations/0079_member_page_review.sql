-- 0079 — A Free member's page is reviewed before it goes public (08/11/2026)
--
-- The owner's decision: a Free account may have a page, and a Free page is
-- looked at by the team before anyone can open it. Someone who put a card in
-- has a name and a subscription to lose; a free account is disposable, and
-- whatever it publishes sits on bgrowth.app.
--
-- Only Free. A paying member publishes straight away, as they do today.
--
-- WHY A THIRD STATUS AND NOT A FLAG. 'pending' is a status of its own, so
-- the existing public policy ("status = 'published'") keeps a page under
-- review off the web with no change at all. A boolean beside 'published'
-- would have meant editing that policy, and a policy edited wrongly is a
-- page leaking to the public.
--
-- Requires 0044. Additive: no existing row changes (none is 'pending'), and
-- a database that never sees a Free page behaves exactly as before.

alter table portal.member_pages drop constraint if exists member_pages_status;
alter table portal.member_pages
  add constraint member_pages_status check (status in ('draft', 'pending', 'published'));

-- What the review left behind, for the member to read and for the team to
-- see what was decided before.
alter table portal.member_pages add column if not exists submitted_at timestamptz;
alter table portal.member_pages add column if not exists reviewed_at timestamptz;
alter table portal.member_pages add column if not exists review_note text;

comment on column portal.member_pages.submitted_at is
  'When the member asked for it to go public (status = pending). Null once decided.';
comment on column portal.member_pages.reviewed_at is
  'When the team last decided on this page.';
comment on column portal.member_pages.review_note is
  'What the team told the member when sending a page back. Shown to its owner.';

-- The team's queue, newest request last so the oldest is served first.
create index if not exists member_pages_pending_idx
  on portal.member_pages (submitted_at)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- Free and Starter pages stay out of search (08/11/2026, the owner's choice)
-- ---------------------------------------------------------------------------
--
-- Thousands of thin pages — a photo, a name, two links — on one domain is
-- the shape search engines treat as thin content, and the harm lands on
-- bgrowth.app as a whole, catalog and articles included. The link itself
-- still works and still previews: these pages are shared in a bio or a
-- message far more often than they are searched for.
--
-- The entitlement is NEGATIVE on purpose — `pageNoIndex` ticked on a plan
-- keeps its pages out. A positive "may be indexed" would have meant every
-- plan written before today suddenly dropping out of search until someone
-- ticked each one.
create or replace function portal.member_page_indexable(p_page uuid)
returns boolean
language sql
stable
security definer
set search_path = portal, public
as $$
  select coalesce(
    (
      select bool_or(
        -- Only a real JSON true keeps a page out; anything else (absent, a
        -- stray string) leaves the page as it is today: indexable.
        not (jsonb_typeof(e -> 'pageNoIndex') = 'boolean' and (e ->> 'pageNoIndex')::boolean)
      )
      from portal.member_pages mp
      cross join lateral portal.member_live_entitlements(mp.user_id) e
      where mp.id = p_page
    ),
    true
  );
$$;

grant execute on function portal.member_page_indexable(uuid) to anon, authenticated, service_role;
