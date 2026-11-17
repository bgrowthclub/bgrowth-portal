-- 0084 — A whole page given by the team (17/11/2026)
--
-- THE NEED. Before launch the team builds pages for chosen people and gives
-- them away, to spread the word. Those people are on the Free plan. Handing
-- the page to them ("The owner edits this page", owner_managed) used to
-- mean: the page now follows THEIR plan — so on Free it showed only what
-- Free allows, or nothing at all.
--
-- THE DECISION (the owner's, 17/11/2026): a per-page switch, "Whole page
-- given by the team". On that page the owner edits everything a whole page
-- has, and it stays online whatever their plan is — Free included. It is
-- about the PAGE, not the person: it gives no plan, opens no product and
-- counts for no other page.
--
-- Everything else is unchanged: the page must be published, the closed
-- site still applies (released / demo / team), and turning the switch off
-- puts the page back under its owner's plan exactly as before.
--
-- Requires 0067, 0079, 0081, 0082. The read policy is REPLACED — compare it
-- with 0081's before applying (one condition added: `or full_granted`).

alter table portal.member_pages add column if not exists full_granted boolean not null default false;

comment on column portal.member_pages.full_granted is
  'Set by the team (Admin → Pages): the owner edits the whole page and it stays online whatever their plan is.';

-- A given page is not part of the owner's allowance, like a team-made page.
create or replace function portal.member_page_within_allowance(p_page uuid)
returns boolean
language sql
stable
security definer
set search_path = portal, public
as $$
  with page as (
    select id, user_id, owner_managed, full_granted from portal.member_pages where id = p_page
  ),
  ranked as (
    select mp.id,
           row_number() over (order by mp.priority desc, mp.created_at) as rn
      from portal.member_pages mp
      join page on page.user_id = mp.user_id
     where mp.status = 'published'
       and mp.owner_managed
       and not mp.full_granted
  )
  select case
    when (select not owner_managed or full_granted from page) then true
    else coalesce(
      (select r.rn <= portal.member_page_allowance((select user_id from page)) from ranked r where r.id = p_page),
      true
    )
  end;
$$;

grant execute on function portal.member_page_within_allowance(uuid) to anon, authenticated, service_role;

-- The model and level the page is SHOWN under: a given page keeps its own
-- model, at the whole-page level, and can be found on Google.
create or replace function portal.member_page_view_rules(p_page uuid)
returns table (template text, level text, indexable boolean)
language sql
stable
security definer
set search_path = portal, public
as $$
  with page as (
    select id, user_id, owner_managed, full_granted, template from portal.member_pages where id = p_page
  ),
  ent as (
    select e from page cross join lateral portal.member_live_entitlements(page.user_id) e
  ),
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
      when (select not owner_managed or full_granted from page) then (select template from page)
      when (select coalesce(unlimited, false) from allowed) then (select template from page)
      when (select list from allowed) ? (select coalesce(template, '') from page) then (select template from page)
      else (select x from allowed, lateral jsonb_array_elements_text(allowed.list) x limit 1)
    end as template,
    case
      when (select full_granted from page) then 'full'
      else portal.member_page_level((select user_id from page))
    end as level,
    case
      when (select full_granted from page) then true
      else portal.member_page_indexable(p_page)
    end as indexable;
$$;

grant execute on function portal.member_page_view_rules(uuid) to anon, authenticated, service_role;

-- The public read policy: 0081's, with `or full_granted` added.
drop policy if exists "Anyone can read published member pages" on portal.member_pages;
create policy "Anyone can read published member pages"
  on portal.member_pages for select
  to anon, authenticated
  using (
    status = 'published'
    and (not owner_managed or full_granted or portal.member_page_level(user_id) is not null)
    and portal.member_page_within_allowance(id)
    and (portal.site_is_open() or is_demo or portal.member_page_released(id) or portal.is_website_team())
  );
