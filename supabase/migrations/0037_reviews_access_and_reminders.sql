-- 0037 — Reviews: members with granted access can review too, and the
-- "how is it going?" e-mails get a second, end-of-period moment.
--
-- 1) Who may review: until now only a member with a license row (0009).
--    A member who received access from the team (portal.access_grants,
--    0021) can now review too — a grant for that Workspace or for all
--    Workspaces, active or not (like licenses: a review survives the end
--    of access). Their reviews are marked created_from = 'access'.
--
-- 2) Review e-mails, sent once a day by the Website
--    (api/cron/review-requests.ts):
--    - 7 days after access starts (licenses.review_requested_at, already
--      there since 0009, also the Portal's trial e-mail marker);
--    - when a trial or a timed access ends, if still not reviewed
--      (review_end_requested_at, new).
--    access_grants gets the same two markers.

alter table portal.reviews
  drop constraint if exists reviews_created_from_check;
alter table portal.reviews
  add constraint reviews_created_from_check
  check (created_from in ('trial', 'purchase', 'access'));

drop policy if exists "Users can review Workspaces they own"
  on portal.reviews;
create policy "Users can review Workspaces they own"
  on portal.reviews for insert
  with check (
    auth.uid() = user_id
    and (
      exists (
        select 1 from portal.licenses l
        where l.user_id = auth.uid()
          and l.product_id = reviews.product_id
      )
      or exists (
        select 1 from portal.access_grants g
        where g.user_id = auth.uid()
          and (g.scope = 'all'
               or g.product_id = reviews.product_id)
      )
    )
  );

alter table portal.licenses
  add column if not exists review_end_requested_at timestamptz;

alter table portal.access_grants
  add column if not exists review_requested_at timestamptz;
alter table portal.access_grants
  add column if not exists review_end_requested_at timestamptz;
