-- 0063 — A member page keeps its old addresses (Website Sprint 130)
--
-- Decided 19/10/2026: when a page's address (bgrowth.app/p/…) changes, the
-- old one keeps working and leads to the new one, so links already shared
-- don't break. member_pages.previous_slugs holds up to 10 old addresses
-- (newest last); an old address can't be taken by another page.
-- Reads go through the existing RLS policy (published pages only).
-- Requires 0044. Additive.

alter table portal.member_pages add column if not exists previous_slugs text[] not null default '{}';

create index if not exists member_pages_previous_slugs_idx on portal.member_pages using gin (previous_slugs);
