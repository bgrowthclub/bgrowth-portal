-- 0034 — Workspace content access, step 1 of 2 (safe to run any time).
--
-- portal.products.content (the full Workspace JSON published from Studio)
-- is readable by anyone today, because products is readable column by
-- column. Step 2 (0035) removes `content` from what the browser can select.
-- These two functions are what the Portal and the Website use instead:
--
--   get_workspace_content(product_id)  the full JSON, only to a signed-in
--                                       member with access (license, trial or
--                                       access grant — has_workspace_access)
--   get_workspace_outline(slug)         the public outline of a published
--                                       Workspace: each section's id, number,
--                                       title, description, icon, optional —
--                                       no fields, items, tips or texts
--
-- Both are security definer so they can read the column after 0035.

create or replace function portal.get_workspace_content(p_product_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select p.content
  from portal.products p
  where p.id = p_product_id
    and auth.uid() is not null
    and portal.has_workspace_access(p_product_id)
$$;

create or replace function portal.get_workspace_outline(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.section->>'id',
        'number', s.section->'number',
        'title', coalesce(s.section->>'title', ''),
        'description', coalesce(s.section->>'description', ''),
        'icon', coalesce(s.section->>'icon', ''),
        'optional', s.section->'optional'
      )
      order by s.ord
    ),
    '[]'::jsonb
  )
  from (
    select p.content
    from portal.products p
    where p.slug = p_slug and p.status = 'published'
    order by p.last_published_at desc nulls last
    limit 1
  ) latest
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(latest.content->'sections') = 'array' then latest.content->'sections' else '[]'::jsonb end
  ) with ordinality as s(section, ord)
$$;

revoke execute on function portal.get_workspace_content(uuid) from public, anon;
grant execute on function portal.get_workspace_content(uuid) to authenticated, service_role;
revoke execute on function portal.get_workspace_outline(text) from public;
grant execute on function portal.get_workspace_outline(text) to anon, authenticated, service_role;
