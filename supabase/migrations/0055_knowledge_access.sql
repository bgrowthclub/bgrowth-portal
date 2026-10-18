-- 0055 — Knowledge articles: who can read each one (Website Sprint 112)
--
-- Each article in Studio → Knowledge Engine has an access level, kept in
-- knowledge_engine.items.publishing ->> 'access':
--   'everyone' — anyone reads the whole article
--   'members'  — (default) visitors see the start; signed-in members read it all
--
-- portal.knowledge_articles (0054) is rebuilt so a members-only article
-- carries only its first 3 blocks (`locked` = true) for everyone, and
-- portal.knowledge_article_bodies gives the whole body to signed-in members
-- only (no grant to anon). Views run as their owner, so knowledge_engine
-- stays service-role only. Requires 0054. Additive only.

drop view if exists portal.knowledge_articles;

create view portal.knowledge_articles as
select
  id,
  slug,
  title,
  excerpt,
  featured_image,
  content_type,
  category,
  industry,
  language,
  difficulty,
  reading_time,
  tags,
  author_id,
  seo,
  case
    when coalesce(publishing ->> 'access', 'members') = 'everyone' then blocks
    else jsonb_path_query_array(blocks, '$[0 to 2]')
  end as blocks,
  attachments,
  related_content,
  featured_options,
  publishing ->> 'publishDate' as publish_date,
  coalesce(published_at, updated_at) as published_at,
  updated_at,
  coalesce(publishing ->> 'access', 'members') as access,
  coalesce(publishing ->> 'access', 'members') <> 'everyone' as locked
from knowledge_engine.items
where status = 'Published'
  and slug <> ''
  and coalesce(publishing ->> 'visibility', 'Public') <> 'Private';

grant select on portal.knowledge_articles to anon, authenticated, service_role;

create or replace view portal.knowledge_article_bodies as
select slug, blocks
from knowledge_engine.items
where status = 'Published'
  and slug <> ''
  and coalesce(publishing ->> 'visibility', 'Public') <> 'Private';

revoke all on portal.knowledge_article_bodies from anon, public;
grant select on portal.knowledge_article_bodies to authenticated, service_role;
