-- 0072 — Um artigo nasce livre; o restrito é que se marca
--
-- Até aqui, um artigo sem nada escrito no campo de acesso valia como
-- 'members': o visitante lia os três primeiros blocos e batia no aviso. Esse
-- padrão vive no coalesce das duas visões (0055, refeito em 0060), não numa
-- coluna — o Studio só grava o campo quando alguém mexe nele.
--
-- A decisão de 30/10/2026 inverte isso: artigo entra como gratuito e a
-- equipe marca em Studio → Knowledge Engine o que for 'members' ou
-- 'plan:<slug>'. É o que permite abrir o Knowledge antes do lançamento sem
-- mandar quem chega do Google para uma porta trancada — o cadastro está
-- fechado.
--
-- Efeito: todo artigo publicado que ninguém marcou passa a ser lido por
-- inteiro, por qualquer pessoa. Um artigo marcado 'members' ou 'plan:x'
-- continua exatamente como está.
--
-- As visões são recriadas iguais às de 0060, trocando só o padrão.
-- Aplicar depois da 0071.

begin;

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
    when coalesce(i.publishing ->> 'access', 'everyone') = 'everyone' then i.blocks
    else jsonb_path_query_array(i.blocks, '$[0 to 2]')
  end as blocks,
  i.attachments,
  i.related_content,
  i.featured_options,
  i.publishing ->> 'publishDate' as publish_date,
  coalesce(i.published_at, i.updated_at) as published_at,
  i.updated_at,
  coalesce(i.publishing ->> 'access', 'everyone') as access,
  coalesce(i.publishing ->> 'access', 'everyone') <> 'everyone' as locked,
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
    coalesce(i.publishing ->> 'access', 'everyone') not like 'plan:%'
    or exists (select 1 from portal.website_admins a where a.user_id = auth.uid())
    or portal.member_plan_rank(auth.uid()) >= coalesce(
      (select p.rank from portal.membership_plans p where p.slug = substr(i.publishing ->> 'access', 6)),
      0)
  );

revoke all on portal.knowledge_article_bodies from anon, public;
grant select on portal.knowledge_article_bodies to authenticated, service_role;

-- Confere: as duas visões existem, anon lê a primeira e não a segunda.
do $$
declare n int;
begin
  select count(*) into n from information_schema.views
   where table_schema = 'portal' and table_name in ('knowledge_articles', 'knowledge_article_bodies');
  if n <> 2 then raise exception 'Esperava as 2 visoes, encontrei %', n; end if;

  select count(*) into n from information_schema.role_table_grants
   where table_schema = 'portal' and table_name = 'knowledge_articles' and grantee = 'anon';
  if n < 1 then raise exception 'anon ficou sem SELECT em knowledge_articles'; end if;

  select count(*) into n from information_schema.role_table_grants
   where table_schema = 'portal' and table_name = 'knowledge_article_bodies' and grantee in ('anon', 'PUBLIC');
  if n <> 0 then raise exception 'knowledge_article_bodies ficou aberta para anon'; end if;
end $$;

commit;
