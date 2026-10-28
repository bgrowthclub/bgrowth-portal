-- 0070 — A regra de leitura de products deixa de depender de ler licenses
--
-- A política de SELECT de portal.products (hoje a de 0068) tem esta forma:
--
--   status = 'published' or exists (select 1 from portal.licenses ...)
--
-- O papel `anon` tem SELECT em products (0007), mas NÃO em licenses — de
-- propósito: licença de membro não é dado público. Isso só não quebra o site
-- porque o Postgres avalia primeiro a condição barata (status = 'published')
-- e, sendo ela verdadeira, nunca executa o subplano que leria licenses.
--
-- Ou seja: a leitura pública funciona por ordem de avaliação escolhida pelo
-- planejador, não por garantia. Qualquer consulta que force o subplano para
-- uma sessão anônima — ler uma linha não publicada, por exemplo — responde
-- "permission denied for table licenses" na hora. E a ordem escolhida pode
-- mudar sozinha com o volume de dados ou uma atualização do Postgres,
-- derrubando o Portal e o site juntos.
--
-- A correção tira a consulta de dentro da política e a põe numa função que
-- roda com a permissão do dono (security definer). O comportamento fica
-- idêntico — publicado todo mundo lê, não publicado só quem tem licença —
-- mas ninguém mais precisa de permissão em licenses para ler o catálogo.
--
-- A função responde apenas sobre quem está chamando (auth.uid()); não há
-- como perguntar pela licença de outra pessoa.
--
-- Aplicar depois da 0069.

begin;

create or replace function portal.owns_license(p_product uuid)
returns boolean
language sql
stable
security definer
set search_path = portal, public
as $$
  select exists (
    select 1
      from portal.licenses l
     where l.product_id = p_product
       and l.user_id = auth.uid()
  )
$$;

revoke all on function portal.owns_license(uuid) from public;
grant execute on function portal.owns_license(uuid) to anon, authenticated, service_role;

-- Mesma regra da 0068, sem a leitura direta de licenses.
drop policy if exists "Read published or licensed products, never Journeys" on portal.products;
create policy "Read published or licensed products, never Journeys"
  on portal.products for select
  using (
    content_type <> 'journey'
    and (status = 'published' or portal.owns_license(products.id))
  );

-- Confere que sobrou exatamente uma política de leitura em products.
do $$
declare n int;
begin
  select count(*) into n
    from pg_policies
   where schemaname = 'portal' and tablename = 'products' and cmd = 'SELECT';
  if n <> 1 then
    raise exception 'Esperava 1 politica de SELECT em products, encontrei %', n;
  end if;
end $$;

commit;
