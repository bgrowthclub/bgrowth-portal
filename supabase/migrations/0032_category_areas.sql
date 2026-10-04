-- 0032 — Two-level Workspace categories: Area → Ramo (purpose/industry).
--
-- An Area is one of BGrowth's Growth Categories (the same slugs as the
-- Website's types/growth.ts: business-entrepreneurship, careers-professions,
-- …). A Ramo is a category with parent_id pointing at its Area (Notary,
-- Cleaning, …). A product keeps ONE category_id — either a Ramo (its Area
-- is the Ramo's parent) or an Area directly (a general Workspace with no
-- specific Ramo). publish_product() is unchanged: Studio still sends one
-- category slug.
--
-- The list is managed in the Website's Admin → Categories (service role);
-- browsers keep the existing public read.

alter table portal.workspace_categories
  add column if not exists parent_id uuid references portal.workspace_categories(id) on delete restrict,
  add column if not exists description text;

create index if not exists workspace_categories_parent_idx on portal.workspace_categories (parent_id, sort_order);

-- Areas (Growth Categories). 'business-entrepreneurship' may already exist
-- (seed.sql) — on conflict keeps it and its id.
insert into portal.workspace_categories (name, slug, sort_order) values
  ('Business & Entrepreneurship', 'business-entrepreneurship', 0),
  ('Careers & Professions', 'careers-professions', 1),
  ('Languages', 'languages', 2),
  ('Personal Finance', 'personal-finance', 3),
  ('Productivity', 'productivity', 4),
  ('Education', 'education', 5),
  ('Health & Wellness', 'health-wellness', 6),
  ('Family & Lifestyle', 'family-lifestyle', 7)
on conflict (slug) do nothing;

-- Starting Ramos under Business & Entrepreneurship (editable in Admin).
insert into portal.workspace_categories (name, slug, sort_order, parent_id)
select v.name, v.slug, v.sort_order, a.id
from (values
  ('Notary', 'notary', 0),
  ('Cleaning', 'cleaning', 1),
  ('Bookkeeping', 'bookkeeping', 2),
  ('Tax Preparation', 'tax-preparation', 3),
  ('Delivery', 'delivery', 4),
  ('Handyman', 'handyman', 5),
  ('Landscaping', 'landscaping', 6),
  ('Mobile Car Wash & Detailing', 'mobile-car-wash', 7),
  ('Catering', 'catering', 8)
) as v(name, slug, sort_order)
cross join (select id from portal.workspace_categories where slug = 'business-entrepreneurship') a
on conflict (slug) do nothing;
