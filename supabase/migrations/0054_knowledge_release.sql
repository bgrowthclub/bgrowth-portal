-- 0054 — Knowledge articles: release flow + public reading (Studio Sprint 101)
--
-- Same steps as products (0051): an article in Studio → Knowledge Engine goes
--   Draft → In Review ("reviewed") → Approved → Scheduled (a date) → Published
-- Studio changes the stage through /api/knowledge-engine?release=1 (service
-- role); the editor can no longer set the status by hand. The Website's
-- daily job calls portal.publish_scheduled_knowledge() next to
-- portal.publish_scheduled().
--
-- portal.knowledge_articles is the public, read-only view the site's
-- Knowledge hub reads: published, non-private articles only, without the
-- team's names/notes. Additive only.

alter table knowledge_engine.items
  add column if not exists reviewed_by text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists approved_by text,
  add column if not exists approved_at timestamptz,
  add column if not exists scheduled_publish_at timestamptz,
  add column if not exists published_at timestamptz;

create index if not exists knowledge_engine_items_scheduled_idx
  on knowledge_engine.items (scheduled_publish_at)
  where status = 'Scheduled';

-- Publishes every scheduled article whose date has come. Returns how many.
create or replace function portal.publish_scheduled_knowledge()
returns int
language plpgsql
security definer set search_path = ''
as $$
declare
  n int;
begin
  update knowledge_engine.items
     set status = 'Published', published_at = now(), updated_at = now()
   where status = 'Scheduled' and scheduled_publish_at is not null and scheduled_publish_at <= now();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function portal.publish_scheduled_knowledge() from public, anon, authenticated;
grant execute on function portal.publish_scheduled_knowledge() to service_role;

create or replace view portal.knowledge_articles as
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
  blocks,
  attachments,
  related_content,
  featured_options,
  publishing ->> 'publishDate' as publish_date,
  coalesce(published_at, updated_at) as published_at,
  updated_at
from knowledge_engine.items
where status = 'Published'
  and slug <> ''
  and coalesce(publishing ->> 'visibility', 'Public') <> 'Private';

grant select on portal.knowledge_articles to anon, authenticated, service_role;
