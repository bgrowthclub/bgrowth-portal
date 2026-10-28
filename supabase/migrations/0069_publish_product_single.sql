-- 0069 — Uma só versão de portal.publish_product()
--
-- O "Publish now" do fluxo de release (0051) falhava com
--   function portal.publish_product(... ) is not unique
--
-- Motivo: publish_product() foi recriada sete vezes (0003, 0005, 0006, 0010,
-- 0011, 0015, 0018), cada uma acrescentando parâmetros. Acrescentar um
-- parâmetro NÃO substitui a função: `create or replace` cria uma sobrecarga
-- nova ao lado da antiga. O banco de produção ficou com quatro:
--
--   16 parâmetros  (era 0005/0006)
--   18 parâmetros  (era 0006/0010)
--   23 parâmetros  (era 0011)
--   27 parâmetros  (atual, 0015/0018)
--
-- O endpoint de publicação do Portal (api/publishing-engine/publish.ts) manda
-- p_cover_image_storage_path, que só existe na de 27 — por isso ele sempre
-- resolveu. Já 0051 chama com 22 parâmetros nomeados, que as quatro aceitam
-- (o resto tem valor padrão em todas), e aí o Postgres não consegue escolher.
--
-- Esta migração apaga as três versões antigas e deixa só a atual. Nada passa
-- a se comportar diferente: toda chamada que hoje resolve já vai para a de 27.
--
-- Sem `cascade`, de propósito: se alguma coisa ainda depender de uma versão
-- antiga, o drop falha e a migração para, em vez de apagar o dependente junto.
--
-- Aplicar depois da 0068.

begin;

-- 16 parâmetros
drop function if exists portal.publish_product(
  text, text, text, text, jsonb, text, text, integer, text, jsonb, text, text,
  text, text, boolean, jsonb
);

-- 18 parâmetros
drop function if exists portal.publish_product(
  text, text, text, text, jsonb, text, text, integer, text, jsonb, text, text,
  text, text, boolean, jsonb, integer, text
);

-- 23 parâmetros
drop function if exists portal.publish_product(
  text, text, text, text, jsonb, text, text, integer, text, jsonb, text, text,
  text, text, boolean, jsonb, integer, text, text, boolean, integer, text, text
);

-- Confere: tem de sobrar exatamente uma, a de 27 parâmetros.
do $$
declare
  n int;
  args int;
begin
  select count(*), max(pronargs) into n, args
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'portal' and p.proname = 'publish_product';

  if n <> 1 then
    raise exception 'Esperava 1 versao de publish_product, encontrei %', n;
  end if;
  if args <> 27 then
    raise exception 'A versao que sobrou tem % parametros, esperava 27', args;
  end if;
end $$;

commit;
