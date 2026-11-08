-- 0082 — A page is shown under the plan its owner has TODAY (08/11/2026)
--
-- THE GAP. The model rules were only ever applied when the member SAVED.
-- Someone who built a full Enterprise page, then dropped to Pro, Starter or
-- Free, kept the whole thing online — every section, every feature their
-- new plan doesn't include — simply by never touching it again. The plan
-- said one thing and the web showed another.
--
-- THE DECISION (the owner's, 08/11/2026): the page is SHOWN under the new
-- plan, and nothing is converted. The content stays in the database exactly
-- as it was written, so going back up a plan brings the whole page back. A
-- one-way conversion would have had the same effect today and destroyed
-- their work for the day they return.
--
-- This function answers "under which model, and how much of it" for one
-- page. The sections each model has are NOT repeated here: the site already
-- holds that list (src/modules/find/memberPageTemplates.ts) and uses it to
-- fit the page to the model. SQL only decides WHICH model.
--
-- Requires 0078 (member_live_entitlements). Additive: a new function only.

create or replace function portal.member_page_view_rules(p_page uuid)
returns table (template text, level text, indexable boolean)
language sql
stable
security definer
set search_path = portal, public
as $$
  with page as (
    select id, user_id, owner_managed, template from portal.member_pages where id = p_page
  ),
  ent as (
    select e from page cross join lateral portal.member_live_entitlements(page.user_id) e
  ),
  -- The models the plans allow, as one list. A plan with a page and NO list
  -- allows every model, which is how it has always worked — that is what
  -- the "unlimited" flag below records.
  allowed as (
    select
      bool_or(
        (e ? 'memberPage')
        and (jsonb_typeof(e -> 'pageTemplates') is distinct from 'array' or jsonb_array_length(e -> 'pageTemplates') = 0)
      ) as unlimited,
      coalesce(jsonb_agg(distinct t) filter (where t is not null), '[]'::jsonb) as list
    from ent
    left join lateral jsonb_array_elements_text(
      case when jsonb_typeof(e -> 'pageTemplates') = 'array' then e -> 'pageTemplates' else '[]'::jsonb end
    ) t on true
  )
  select
    case
      -- A page the team made is not governed by the member's plan.
      when (select not owner_managed from page) then (select template from page)
      when (select coalesce(unlimited, false) from allowed) then (select template from page)
      when (select list from allowed) ? (select coalesce(template, '') from page) then (select template from page)
      -- Not allowed any more: the first model their plan does allow. With
      -- no model at all the page is already off the web (the read policy
      -- checks member_page_level), so the value here does not matter.
      else (select x from allowed, lateral jsonb_array_elements_text(allowed.list) x limit 1)
    end as template,
    portal.member_page_level((select user_id from page)) as level,
    portal.member_page_indexable(p_page) as indexable;
$$;

grant execute on function portal.member_page_view_rules(uuid) to anon, authenticated, service_role;
