-- 0060 — Knowledge articles by plan (Website Sprint 125, Studio Sprint 105)
--
-- An article's access (knowledge_engine.items.publishing ->> 'access') can
-- now also be 'plan:<slug>': only members on that plan or a higher one
-- (portal.membership_plans.rank, Portal migration 0057) read it whole. As
-- with 'members', everyone else gets the first 3 blocks.
--
-- portal.member_plan_rank(user): the rank of the plan a member has now
-- (paid or given by the team; 0 = Free).
-- portal.knowledge_articles gains required_plan / required_plan_name.
-- portal.knowledge_article_bodies returns a plan article only to a member
-- whose plan is high enough, or to the BGrowth team (website_admins).
-- Requires 0055 and 0057. Views are recreated; no data changes.

create or replace function portal.member_plan_rank(p_user uuid)
returns int
language sql
stable
security definer
set search_path = portal, public
as $$
  select coalesce(
    (select max(p.rank)
       from portal.member_plans m
       join portal.membership_plans p on p.id = m.plan_id
      where m.user_id = p_user
        and m.status in ('active', 'trialing', 'past_due')
        and m.starts_at <= now()
        and (m.ends_at is null or m.ends_at > now())),
    0)
$$;

grant execute on function portal.member_plan_rank(uuid) to authenticated, service_role;

drop view if exists portal.knowledge_articles;

create view portal.knowledge_articles as
select
  i.id,
  i.slug,
  i.title,
  i.excerpt,
  i.featured_image,
  i.content_type,
  i.category,
  i.industry,
  i.language,
  i.difficulty,
  i.reading_time,
  i.tags,
  i.author_id,
  i.seo,
  case
    when coalesce(i.publishing ->> 'access', 'members') = 'everyone' then i.blocks
    else jsonb_path_query_array(i.blocks, '$[0 to 2]')
  end as blocks,
  i.attachments,
  i.related_content,
  i.featured_options,
  i.publishing ->> 'publishDate' as publish_date,
  coalesce(i.published_at, i.updated_at) as published_at,
  i.updated_at,
  coalesce(i.publishing ->> 'access', 'members') as access,
  coalesce(i.publishing ->> 'access', 'members') <> 'everyone' as locked,
  case when i.publishing ->> 'access' like 'plan:%' then substr(i.publishing ->> 'access', 6) end as required_plan,
  p.name as required_plan_name
from knowledge_engine.items i
left join portal.membership_plans p
  on i.publishing ->> 'access' like 'plan:%' and p.slug = substr(i.publishing ->> 'access', 6)
where i.status = 'Published'
  and i.slug <> ''
  and coalesce(i.publishing ->> 'visibility', 'Public') <> 'Private';

grant select on portal.knowledge_articles to anon, authenticated, service_role;

drop view if exists portal.knowledge_article_bodies;

create view portal.knowledge_article_bodies as
select i.slug, i.blocks
from knowledge_engine.items i
where i.status = 'Published'
  and i.slug <> ''
  and coalesce(i.publishing ->> 'visibility', 'Public') <> 'Private'
  and (
    coalesce(i.publishing ->> 'access', 'members') not like 'plan:%'
    or exists (select 1 from portal.website_admins a where a.user_id = auth.uid())
    or portal.member_plan_rank(auth.uid()) >= coalesce(
      (select p.rank from portal.membership_plans p where p.slug = substr(i.publishing ->> 'access', 6)),
      0)
  );

revoke all on portal.knowledge_article_bodies from anon, public;
grant select on portal.knowledge_article_bodies to authenticated, service_role;
