-- 0080 — The page review lives in a support conversation (08/11/2026)
--
-- The owner's decision: a page sent for review should arrive as a support
-- ticket, and the team's answer should reach the member in the app as well
-- as by e-mail. Both already exist — the Support Center is the one place a
-- member and the team talk, and a staff reply already e-mails the member.
-- So the review borrows it instead of growing a notification system of its
-- own.
--
-- This column is what keeps the two from drifting apart: the decision made
-- in the queue posts its answer into THIS conversation and closes it, so a
-- page can never be approved while its ticket sits open forever.
--
-- Requires 0079 and the support tables (0030s). Additive.

alter table portal.member_pages add column if not exists review_thread_id uuid;

comment on column portal.member_pages.review_thread_id is
  'The support conversation opened when this page was sent for review. The team''s decision is posted there.';
