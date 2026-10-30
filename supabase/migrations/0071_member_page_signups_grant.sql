-- 0071 — Permissão que faltou em portal.member_page_signups
--
-- A 0065 criou a tabela, ligou o RLS e escreveu "só o papel de serviço lê e
-- escreve" — mas nunca concedeu permissão nenhuma. Neste schema as
-- permissões são dadas tabela por tabela (0007), então nem o service_role
-- ficou com acesso.
--
-- O sintoma registrado em produção (29/10/2026, /api/account):
--   permission denied for table member_page_signups
--
-- Isso derruba as três pontas da lista de e-mails:
--   - a inscrição pela própria página (api/ingles.ts ?action=page-signup);
--   - My Business Page → Contatos (api/account.ts, my-page-signups);
--   - Admin → Pages → Contatos (api/admin.ts, member-page-signups).
--
-- RLS continua ligado e sem política: anon e authenticated seguem sem ver
-- nada. A lista é do dono da página e só é lida pelo servidor.
--
-- Aplicar depois da 0070.

begin;

grant select, insert, update, delete on portal.member_page_signups to service_role;

-- Confere que o papel de serviço lê, e que ninguém mais ganhou nada.
do $$
declare
  servico int;
  publico int;
begin
  select count(*) into servico
    from information_schema.role_table_grants
   where table_schema = 'portal' and table_name = 'member_page_signups'
     and grantee = 'service_role' and privilege_type = 'SELECT';

  select count(*) into publico
    from information_schema.role_table_grants
   where table_schema = 'portal' and table_name = 'member_page_signups'
     and grantee in ('anon', 'authenticated', 'PUBLIC');

  if servico <> 1 then
    raise exception 'service_role continua sem SELECT em member_page_signups';
  end if;
  if publico <> 0 then
    raise exception 'member_page_signups ficou visivel para anon/authenticated (% permissoes)', publico;
  end if;
end $$;

commit;
