-- 0062 — Member pages built with blocks, edited by the subscriber (Website Sprint 127)
--
-- Decided 19/10/2026: the subscriber edits their own page (bgrowth.app/p/…)
-- from the member area, by plan (membership_plans.entitlements.memberPage):
--   'partial' (Pro)        — one of the ready-made templates, fixed blocks;
--                            edits texts, photo, contacts, services and ONE
--                            featured photo/video; no page numbers.
--   'full' (Enterprise)    — adds, reorders and hides blocks, chooses the
--                            address, color and cover, unlimited featured
--                            work, sees the page numbers.
-- A plan made only for the page ("avulso") is just a plan with that
-- entitlement and a low rank.
--
-- member_pages gains:
--   template       — the ready-made model it started from ('cleaning',
--                    'notary', 'teacher', 'creator', 'blank')
--   blocks         — the page's sections in order: [{ id, type, hidden?, data? }];
--                    null = the original fixed layout (pages made before this)
--   theme          — { color, cover }
--   owner_managed  — true when the subscriber made it: it is shown only while
--                    their plan includes a page (otherwise it stays saved, off
--                    the site). Pages the team made stay as they are.
-- portal.member_page_level(user) → 'full' | 'partial' | null.
-- Requires 0044, 0057. Additive.

alter table portal.member_pages add column if not exists template text;
alter table portal.member_pages add column if not exists blocks jsonb;
alter table portal.member_pages add column if not exists theme jsonb not null default '{}'::jsonb;
alter table portal.member_pages add column if not exists owner_managed boolean not null default false;

create or replace function portal.member_page_level(p_user uuid)
returns text
language sql
stable
security definer
set search_path = portal, public
as $$
  select case
    when bool_or(p.entitlements ->> 'memberPage' = 'full') then 'full'
    when bool_or(p.entitlements ->> 'memberPage' = 'partial') then 'partial'
    else null
  end
  from portal.member_plans m
  join portal.membership_plans p on p.id = m.plan_id
  where m.user_id = p_user
    and m.status in ('active', 'trialing', 'past_due')
    and m.starts_at <= now()
    and (m.ends_at is null or m.ends_at > now())
$$;

grant execute on function portal.member_page_level(uuid) to anon, authenticated, service_role;

-- Published pages: the team's always; a subscriber's only while their plan
-- includes a page.
drop policy if exists "Anyone can read published member pages" on portal.member_pages;
create policy "Anyone can read published member pages"
  on portal.member_pages for select
  to anon, authenticated
  using (
    status = 'published'
    and (not owner_managed or portal.member_page_level(user_id) is not null)
  );
