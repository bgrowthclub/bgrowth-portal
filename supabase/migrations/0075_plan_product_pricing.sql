-- 0075 — O que cada plano faz com cada produto (Website Sprint 183)
--
-- Hoje existem TRÊS lugares decidindo preço para quem tem plano, e eles não
-- conversam:
--   * portal.product_plan_access (0061): o plano mínimo que INCLUI o produto
--     — uma linha por produto, então não dá para dizer coisas diferentes
--     por plano;
--   * entitlements.workspaceDiscountPercent: um único "% off" por plano,
--     que vale para tudo — inclusive para cursos, sem ninguém ter pedido;
--   * entitlements.academyDiscount: existe na tela de Planos, é salvo, e
--     NUNCA é lido pelo checkout. Promessa que não acontece.
--
-- Esta migração cria a tabela que substitui os três: para cada par
-- (plano, produto), o que aquele plano faz — inclui, dá % de desconto,
-- cobra um preço fixo, ou não muda nada.
--
-- Regras decididas com a dona (01/11/2026):
--   * Dois planos vivos dizendo coisas diferentes: vale o MELHOR para o
--     membro, não o do plano mais caro.
--   * Quem já comprou não é afetado: preço se decide na hora da compra.
--   * Desconto de plano e cupom NÃO somam — o membro escolhe um dos dois
--     antes do checkout (isso é código, não banco; fica registrado aqui
--     porque é a mesma decisão).
--
-- ADITIVA E REVERSÍVEL: product_plan_access continua existindo e
-- funcionando. Nada é apagado, nada muda de comportamento só por rodar
-- isto — o checkout só passa a ler esta tabela quando o código do site
-- for publicado. As linhas que já existem em product_plan_access são
-- COPIADAS para cá como "incluso", para o estado de hoje ser preservado.

begin;

create table if not exists portal.plan_product_pricing (
  plan_id uuid not null references portal.membership_plans(id) on delete cascade,
  product_id uuid not null references portal.products(id) on delete cascade,
  -- included = abre sem pagar; percent = % off; fixed = preço fixo para
  -- quem tem este plano; full = o plano não muda nada (o mesmo que não ter
  -- linha, guardado quando alguém escolhe explicitamente).
  kind text not null check (kind in ('included', 'percent', 'fixed', 'full')),
  percent int check (percent is null or (percent >= 1 and percent <= 100)),
  price_cents int check (price_cents is null or price_cents >= 0),
  updated_at timestamptz not null default now(),
  primary key (plan_id, product_id),
  -- Cada tipo guarda exatamente o seu campo, e só ele.
  constraint plan_product_pricing_shape check (
    (kind = 'percent' and percent is not null and price_cents is null)
    or (kind = 'fixed' and price_cents is not null and percent is null)
    or (kind in ('included', 'full') and percent is null and price_cents is null)
  )
);

create index if not exists plan_product_pricing_product_idx on portal.plan_product_pricing (product_id);

alter table portal.plan_product_pricing enable row level security;

-- Preço faz parte da vitrine: qualquer um pode ler, como já acontece com
-- product_plan_access (0061). Escrever, só a equipe pelo api/admin.ts.
drop policy if exists "plan pricing is public" on portal.plan_product_pricing;
create policy "plan pricing is public" on portal.plan_product_pricing for select using (true);
grant select on portal.plan_product_pricing to anon, authenticated;
grant select, insert, update, delete on portal.plan_product_pricing to service_role;

-- O estado de hoje, preservado: cada produto incluído em um plano vira uma
-- linha "included" daquele plano. A herança para planos de rank maior
-- continua sendo calculada na leitura, como sempre foi — não é copiada
-- aqui, senão mudar o rank de um plano deixaria a tabela mentindo.
insert into portal.plan_product_pricing (plan_id, product_id, kind)
select ppa.plan_id, ppa.product_id, 'included'
  from portal.product_plan_access ppa
 on conflict (plan_id, product_id) do nothing;

-- Conferências: a tabela existe com a chave certa, e nada se perdeu na
-- cópia (toda linha de product_plan_access tem a sua correspondente).
do $$
declare
  n int;
  faltando int;
begin
  select count(*) into n
    from pg_constraint
   where conrelid = 'portal.plan_product_pricing'::regclass and contype = 'p';
  if n <> 1 then
    raise exception 'plan_product_pricing sem chave primaria';
  end if;

  select count(*) into faltando
    from portal.product_plan_access ppa
   where not exists (
     select 1 from portal.plan_product_pricing p
      where p.plan_id = ppa.plan_id and p.product_id = ppa.product_id
   );
  if faltando > 0 then
    raise exception '% linhas de product_plan_access nao foram copiadas', faltando;
  end if;
end $$;

commit;
