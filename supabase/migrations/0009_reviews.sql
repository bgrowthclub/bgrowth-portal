-- Product Reviews — part of the Trial journey, not a standalone module.
-- Reviews belong to the product itself (never to a saved checklist
-- instance, see 0008), one per (user, product), enforced below by a
-- unique constraint. Eligible only to a member who holds — or once held —
-- a license for that product, trial or purchased.

create table if not exists portal.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references portal.users(id) on delete cascade,
  product_id uuid not null references portal.products(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  title text not null,
  comment text not null,
  -- Snapshot at submission time, not a live join to portal.users — a
  -- review's byline stays stable even if the member later renames their
  -- profile.
  display_name text not null,
  -- Distinguishes a review submitted after a Trial from one submitted
  -- after a purchase, for future analytics — no schema change needed
  -- later to support that.
  created_from text not null check (created_from in ('trial', 'purchase')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id)
);

alter table portal.reviews enable row level security;

-- Public read: reviews are social proof shown to every visitor (today's
-- Marketplace card, and eventually a dedicated Product Page) — not gated
-- to the author or to signed-in members.
drop policy if exists "Reviews are publicly readable" on portal.reviews;
create policy "Reviews are publicly readable"
  on portal.reviews for select using (true);

-- "Activated a Trial OR purchased" — any license row for this product,
-- regardless of its current status, so a review survives trial expiry.
drop policy if exists "Users can review Workspaces they own" on portal.reviews;
create policy "Users can review Workspaces they own"
  on portal.reviews for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from portal.licenses l
      where l.user_id = auth.uid() and l.product_id = reviews.product_id
    )
  );

drop policy if exists "Users can edit their own review" on portal.reviews;
create policy "Users can edit their own review"
  on portal.reviews for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists reviews_product_id_idx on portal.reviews (product_id);

-- Same fix as 0007/0008 — a new table gets no role grants automatically.
grant select on portal.reviews to anon;
grant select, insert, update on portal.reviews to authenticated;
grant select, insert, update, delete on portal.reviews to service_role;

-- Aggregate rating/count, retrieved separately from the full review list so
-- displaying a summary ("4.9 · 127 Reviews") never requires fetching every
-- review row — this scales independently of how many reviews a product
-- has. security_invoker keeps the view honoring portal.reviews' own RLS
-- (currently public-select anyway) rather than running as the view owner.
create or replace view portal.product_review_summary
  with (security_invoker = true) as
  select
    product_id,
    round(avg(rating)::numeric, 2) as average_rating,
    count(*)::int as review_count
  from portal.reviews
  group by product_id;

grant select on portal.product_review_summary to anon, authenticated, service_role;

-- Tracks whether the one-time "your trial expired, how was it?" email has
-- already been sent for this license — written only by the service-role
-- api/notifications/trial-review-request route (service_role already has
-- update on portal.licenses via 0007, so no new grant/policy is needed).
alter table portal.licenses add column if not exists review_requested_at timestamptz;
