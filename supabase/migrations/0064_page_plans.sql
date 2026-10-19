-- 0064 — The three Business Page plans (Website Sprint 132)
--
-- Decided 19/10/2026: the member's page (bgrowth.app/p/…) is also sold on
-- its own, monthly or yearly, in three packages by page level — not one price
-- per model:
--   Simple Page        — the five simple one-column models, part of the page
--   Business Page      — every model (the four site looks + Affiliate Picks)
--   Business Page Plus — every model, the whole page (sections, address,
--                        gallery, 60 products, page numbers)
-- Ranks sit between Free (0) and Starter (10), so these plans never open the
-- products included in Starter and up. They start "hidden": review prices and
-- texts in Admin → Plans, then set them to "Offered".
-- membership_plans.entitlements.pageTemplates lists the models a plan allows
-- (none = all). Requires 0057. Additive.

insert into portal.membership_plans (slug, name, description, rank, status, is_free, price_on_request, monthly_cents, yearly_cents, features, highlighted, entitlements)
values
  ('page-simple', 'Simple Page', 'A simple page to share your work.', 2, 'hidden', false, false, 500, 4900,
    array['Your page at bgrowth.app/p/your-name', '5 simple models', 'Contact buttons, services and one featured photo or video', 'Copy-link and share buttons'], false,
    '{"memberPage": "partial", "pageTemplates": ["cleaning", "notary", "teacher", "creator", "blank"]}'::jsonb),
  ('page-business', 'Business Page', 'A professional mini-site for your business.', 4, 'hidden', false, false, 1000, 9900,
    array['Everything in Simple Page', 'All models: Professional, Local Services, Creative Portfolio, Personal Brand, Affiliate Picks', 'Up to 12 product picks'], true,
    '{"memberPage": "partial"}'::jsonb),
  ('page-plus', 'Business Page Plus', 'Your page your way, with its numbers.', 6, 'hidden', false, false, 1700, 16900,
    array['Everything in Business Page', 'Choose your address', 'Add, move and hide sections, colors and cover', 'Photo gallery and up to 60 product picks', 'Page numbers: visits and clicks'], false,
    '{"memberPage": "full"}'::jsonb)
on conflict (slug) do nothing;
