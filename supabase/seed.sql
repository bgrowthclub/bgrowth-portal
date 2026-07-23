-- Example catalog data for local development only.
-- Not applied automatically in production — run manually against a dev project if useful.

insert into public.workspace_categories (name, slug, sort_order) values
  ('Business & Entrepreneurship', 'business-entrepreneurship', 0)
on conflict (slug) do nothing;

insert into public.products (slug, name, short_description, is_trial_eligible, is_published, category_id)
select
  'notary-appointment-workspace',
  'Notary Appointment Workspace',
  'The professional operating system that guides notaries before, during, and after every appointment.',
  true,
  true,
  (select id from public.workspace_categories where slug = 'business-entrepreneurship')
where not exists (
  select 1 from public.products where slug = 'notary-appointment-workspace'
);
