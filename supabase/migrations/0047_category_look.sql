-- 0047 — How a category looks (Website → Admin → Catalog → Categories).
--
-- Each Area and category (portal.workspace_categories) can have an icon and
-- a color — keys from the Website's list (components/systems/
-- categoryIcons.ts), shown on the catalog filters and cards — and an
-- optional cover image for its future page. Empty = the Website's default.
-- Written only by the Website's server (service role); everyone can read,
-- as before (0007).

alter table portal.workspace_categories
  add column if not exists icon text,
  add column if not exists color text,
  add column if not exists cover_image_url text;

alter table portal.workspace_categories
  drop constraint if exists workspace_categories_look_lengths;
alter table portal.workspace_categories
  add constraint workspace_categories_look_lengths
  check (
    (icon is null or length(icon) <= 40)
    and (color is null or length(color) <= 20)
    and (cover_image_url is null or length(cover_image_url) <= 500)
  );
