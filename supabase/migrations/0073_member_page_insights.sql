-- 0073 — O que as pessoas procuram dentro de uma página de membro
--
-- A página já conta visitas e cliques (0045). O que falta é o sinal mais
-- valioso de todos: o que a visitante DIGITA na busca da página e não
-- encontra. Isso é demanda dita pela própria pessoa — "procurei air fryer e
-- não tinha" — e hoje se perde. Passam a contar também as categorias que
-- ela abre, que mostram interesse mesmo de quem não clica em nada.
--
-- Decidido em 01/11/2026. Mesmo cuidado de privacidade da busca do catálogo
-- (0052): termo normalizado, nada de usuário, nada de IP, e termo com cara
-- de e-mail ou de número descartado antes de chegar aqui (api/ingles.ts).
--
-- Liberado como a lista de e-mails (0065): pelo plano, ou pela equipe numa
-- página só — promoção, sorteio, cortesia.
--
-- Três tipos novos, em vez de uma coluna nova: a chave primária da tabela é
-- (page_id, day, kind, target) e é ela que soma as contagens do dia. Separar
-- "achou" de "não achou" por tipo mantém a chave, a inserção e tudo o que já
-- lê a tabela exatamente como estão.
--   'search'        → target = o termo; a busca devolveu algo
--   'search_empty'  → target = o termo; a busca não devolveu nada
--   'category'      → target = a categoria aberta
--
-- Aplicar depois da 0072. Só acrescenta.

begin;

alter table portal.member_page_stats drop constraint if exists member_page_stats_kind;
alter table portal.member_page_stats add constraint member_page_stats_kind
  check (kind in ('view', 'click', 'course_view', 'course_lead', 'signup', 'search', 'search_empty', 'category'));

-- Quem pode ver: a equipe liga numa página específica, sem depender do plano.
alter table portal.member_pages add column if not exists insights_granted boolean not null default false;

-- Confere que a chave primária continua intacta e que os tipos antigos
-- seguem aceitos.
do $$
declare n int;
begin
  select count(*) into n
    from pg_constraint
   where conrelid = 'portal.member_page_stats'::regclass
     and contype = 'p';
  if n <> 1 then raise exception 'A chave primaria de member_page_stats sumiu'; end if;

  perform 1 from pg_attribute
   where attrelid = 'portal.member_pages'::regclass
     and attname = 'insights_granted' and not attisdropped;
  if not found then raise exception 'insights_granted nao foi criada'; end if;
end $$;

commit;
