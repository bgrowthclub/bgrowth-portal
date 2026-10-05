-- 0033 — Security hardening (audit of 05/10/2026).
--
-- 1. Database functions: 0007's `alter default privileges in schema portal
--    revoke execute … from public` never took effect for functions created
--    after it (a schema-level default can't remove the global PUBLIC grant),
--    so SECURITY DEFINER functions such as grant_purchased_license and
--    publish_product were callable by anyone with the public anon key
--    through /rest/v1/rpc. Every caller is a server using the service role,
--    so EXECUTE now belongs to service_role only — except
--    has_workspace_access, which RLS policies call as the signed-in member.
--    Every future migration that creates a function must end with its own
--    `revoke execute … from public, anon, authenticated`.
revoke execute on all functions in schema portal from public, anon, authenticated;
grant execute on all functions in schema portal to service_role;
grant execute on function portal.has_workspace_access(uuid) to authenticated;

-- 2. Trial licenses: the browser inserts a member's one trial (Portal and
--    Website). The old policy only checked user_id and type, so a member
--    could insert a trial with no expiry or a far-future one, or a second
--    trial after the first was upgraded to a purchase. The row must now be
--    exactly what activateTrial()/startStudioTrial() send: active, expiring,
--    for a published trial-eligible product, within that product's trial
--    length, and only while the member has never used a trial.
drop policy if exists "Users can activate their own trial license" on portal.licenses;
create policy "Users can activate their own trial license"
  on portal.licenses for insert
  with check (
    auth.uid() = user_id
    and type = 'trial'
    and status = 'active'
    and access_policy = 'expiring'
    and expires_at is not null
    and not coalesce((select u.has_used_trial from portal.users u where u.id = auth.uid()), true)
    and exists (
      select 1 from portal.products p
      where p.id = product_id
        and p.status = 'published'
        and p.is_trial_eligible
        and p.trial_duration is not null
        and expires_at <= now()
          + case p.trial_unit
              when 'hours' then make_interval(hours => p.trial_duration)
              when 'weeks' then make_interval(weeks => p.trial_duration)
              when 'months' then make_interval(months => p.trial_duration)
              else make_interval(days => p.trial_duration)
            end
          + interval '10 minutes'
    )
  );

-- 3. Saved records: members may only change a record's own contents, never
--    move it to another product (product_id) or member (user_id).
revoke update on portal.workspace_instances from authenticated;
grant update (label, data, status, updated_at) on portal.workspace_instances to authenticated;

-- 4. Public bucket: files stay readable by their public URL (that path
--    doesn't use this policy), but nobody can list the bucket any more —
--    listing exposed Welcome PDFs of draft and paid Workspaces.
drop policy if exists "Anyone can read portal product assets" on storage.objects;
