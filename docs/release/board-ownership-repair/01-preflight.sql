-- ============================================================================
-- BOARD OWNERSHIP REPAIR — A. PREFLIGHT                          (READ ONLY)
-- Project: frllwwxesxbmmaadzfaf.   Package: docs/release/board-ownership-repair
--
-- One SELECT. Reads catalogs and COUNTS rows in passport_board_members and
-- passport_board_invites. Prints no tokens, ids or emails. Changes nothing.
--
-- Run it before 02 (the repair). Save the output. Every row's `status`:
--   OK         as expected for an unrepaired production database
--   FIXED      this part of the repair is already live (re-running is safe)
--   ATTENTION  read `detail`; it does not block the repair
--   STOP       do not run the repair; escalate
-- The two `preserve:` rows are copied by 03-verify.sql: they must match exactly.
-- ============================================================================
with
pol as (
  select policyname, cmd, permissive, roles::text as roles, coalesce(qual, '') as qual, coalesce(with_check, '') as wc
  from pg_policies
  where schemaname = 'public' and tablename in ('passport_board_members', 'passport_board_invites')
),
pins as (select 'board_owner_id\s*=\s*\(?(select\s+)?auth\.uid\(\)'::text as owner_pin,
                'created_by\s*=\s*\(?(select\s+)?auth\.uid\(\)'::text as creator_pin),
tbl as (
  select c.relname, c.oid, c.relrowsecurity, c.relforcerowsecurity, pg_get_userbyid(c.relowner) as owner
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
    and c.relname in ('passport_board_members', 'passport_board_invites')
),
counts as (
  select
    case when to_regclass('public.passport_board_members') is null then null else
      (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.passport_board_members', false, true, '')))[1]::text end as members,
    case when to_regclass('public.passport_board_members') is null then null else
      (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.passport_board_members where role = ''owner''', false, true, '')))[1]::text end as owners,
    case when to_regclass('public.passport_board_invites') is null then null else
      (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.passport_board_invites', false, true, '')))[1]::text end as invites,
    case when to_regclass('public.passport_board_invites') is null then null else
      (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.passport_board_invites where revoked_at is null and (expires_at is null or expires_at >= now())', false, true, '')))[1]::text end as live_invites,
    -- A digest of every row, so 03-verify.sql can prove the repair changed no data.
    case when to_regclass('public.passport_board_members') is null then null else
      (xpath('/row/c/text()', query_to_xml('select md5(coalesce(string_agg(m::text, ''|'' order by m.board_id, m.user_id), '''')) as c from public.passport_board_members m', false, true, '')))[1]::text end as members_md5,
    case when to_regclass('public.passport_board_invites') is null then null else
      (xpath('/row/c/text()', query_to_xml('select md5(coalesce(string_agg(i::text, ''|'' order by i.token), '''')) as c from public.passport_board_invites i', false, true, '')))[1]::text end as invites_md5
),
audit(name, n) as (values
  ('audit: owner rows naming someone else', case when to_regclass('public.passport_board_members') is null then null else
     (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.passport_board_members where role = ''owner'' and board_owner_id <> user_id', false, true, '')))[1]::text::bigint end),
  ('audit: member rows whose board_owner_id is not that board''s owner', case when to_regclass('public.passport_board_members') is null then null else
     (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.passport_board_members m where m.role <> ''owner'' and not exists (select 1 from public.passport_board_members o where o.board_id = m.board_id and o.role = ''owner'' and o.user_id = m.board_owner_id)', false, true, '')))[1]::text::bigint end),
  ('audit: invites naming someone else', case when to_regclass('public.passport_board_invites') is null or to_regclass('public.passport_board_members') is null then null else
     (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.passport_board_invites i where i.board_owner_id <> i.created_by or not exists (select 1 from public.passport_board_members o where o.board_id = i.board_id and o.role = ''owner'' and o.user_id = i.created_by)', false, true, '')))[1]::text::bigint end),
  ('audit: LIVE invites naming someone else', case when to_regclass('public.passport_board_invites') is null or to_regclass('public.passport_board_members') is null then null else
     (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.passport_board_invites i where i.revoked_at is null and (i.expires_at is null or i.expires_at >= now()) and (i.board_owner_id <> i.created_by or not exists (select 1 from public.passport_board_members o where o.board_id = i.board_id and o.role = ''owner'' and o.user_id = i.created_by))', false, true, '')))[1]::text::bigint end),
  ('audit: boards with more than one owner row', case when to_regclass('public.passport_board_members') is null then null else
     (xpath('/row/c/text()', query_to_xml('select count(*) as c from (select board_id from public.passport_board_members where role = ''owner'' group by board_id having count(*) > 1) z', false, true, '')))[1]::text::bigint end)
),
checks(ord, chk, status, detail) as (
  select 1, 'environment: Postgres version', 'OK', current_setting('server_version')
  union all
  select 2, 'environment: roles anon, authenticated and auth.uid() exist',
         case when (select count(*) from pg_roles where rolname in ('anon', 'authenticated')) = 2
               and to_regprocedure('auth.uid()') is not null then 'OK' else 'STOP' end,
         'Not the Supabase project you expect if this is not OK'
  union all
  select 3, 'environment: you are ' || current_user,
         case when (select rolbypassrls or rolsuper from pg_roles where rolname = current_user)
                or current_user = (select owner from tbl where relname = 'passport_board_members') then 'OK' else 'STOP' end,
         'The new SECURITY DEFINER function runs as whoever creates it and must see every row: '
           || 'table owner is ' || coalesce((select owner from tbl where relname = 'passport_board_members'), '?')
           || ', bypassrls=' || coalesce((select (rolbypassrls or rolsuper)::text from pg_roles where rolname = current_user), '?')
  union all
  select 4, 'tables passport_board_members and passport_board_invites exist with RLS on',
         case when (select count(*) from tbl where relrowsecurity) = 2 then 'OK' else 'STOP' end,
         coalesce((select string_agg(relname || ' rls=' || relrowsecurity || ' force=' || relforcerowsecurity, '; ' order by relname) from tbl), 'NEITHER TABLE FOUND')
  union all
  select 5, 'baseline helper passport_board_role(text, uuid) exists (the repaired policies call it)',
         case when to_regprocedure('public.passport_board_role(text,uuid)') is not null then 'OK' else 'STOP' end,
         case when to_regprocedure('public.passport_board_role(text,uuid)') is not null then 'present' else 'MISSING — the baseline is not applied as the repo expects' end
  union all
  select 6, 'function passport_board_has_members(text)',
         case when to_regprocedure('public.passport_board_has_members(text)') is null then 'OK' else 'FIXED' end,
         case when to_regprocedure('public.passport_board_has_members(text)') is null
              then 'missing (expected before the repair; 02 creates it)' else 'already present (02 replaces it with the same body)' end
  union all
  select 7, 'policy passport_board_members_self_claim',
         case when p.policyname is null then 'ATTENTION'
              when p.wc ~ 'passport_board_has_members' and p.wc ~ (select owner_pin from pins) then 'FIXED'
              else 'OK' end,
         case when p.policyname is null then 'MISSING (02 creates it)'
              when p.wc ~ 'passport_board_has_members' then 'already repaired'
              else 'VULNERABLE (hole 1: anyone can claim any board). cmd=' || p.cmd || ' with_check=' || p.wc end
  from (select 1) x left join pol p on p.policyname = 'passport_board_members_self_claim'
  union all
  select 8, 'policy passport_board_members_owner_writes',
         case when p.policyname is null then 'ATTENTION'
              when p.wc ~ (select owner_pin from pins) then 'FIXED' else 'OK' end,
         case when p.policyname is null then 'MISSING (02 creates it)'
              when p.wc ~ (select owner_pin from pins) then 'already repaired'
              else 'VULNERABLE (hole 2: an owner can name someone else as owner). cmd=' || p.cmd || ' with_check=' || p.wc end
  from (select 1) x left join pol p on p.policyname = 'passport_board_members_owner_writes'
  union all
  select 9, 'policy passport_board_invites_owner_writes',
         case when p.policyname is null then 'ATTENTION'
              when p.wc ~ (select owner_pin from pins) and p.wc ~ (select creator_pin from pins) then 'FIXED' else 'OK' end,
         case when p.policyname is null then 'MISSING (02 creates it)'
              when p.wc ~ (select owner_pin from pins) and p.wc ~ (select creator_pin from pins) then 'already repaired'
              else 'VULNERABLE (hole 2: an owner can mint an invite naming someone else). cmd=' || p.cmd || ' with_check=' || p.wc end
  from (select 1) x left join pol p on p.policyname = 'passport_board_invites_owner_writes'
  union all
  select 10, 'no policies on the board tables beyond the five the repo knows',
         case when count(*) = 0 then 'OK' else 'ATTENTION' end,
         coalesce(string_agg(policyname || ' [' || cmd || '] using=' || qual || ' check=' || wc, '; '), 'none')
           || case when count(*) > 0 then ' — an extra INSERT/UPDATE/ALL policy can re-open the holes; 02 does not touch it. Read it and decide before or after.' else '' end
  from pol
  where policyname not in ('passport_board_members_self_claim', 'passport_board_members_owner_writes',
                           'passport_board_invites_owner_writes', 'passport_board_members_visible',
                           'passport_board_invites_members_read')
  union all
  select 11, 'sessions holding locks on the board tables, or idle in a transaction for over a minute',
         case when count(*) = 0 then 'OK' else 'ATTENTION' end,
         case when count(*) = 0 then 'none'
              else count(*) || ' session(s): ' || string_agg(distinct coalesce(a.state, '?') || ' since ' || coalesce(a.xact_start::text, '?'), '; ')
                   || ' — 02 waits at most 5 s for its lock and then aborts with nothing changed. Re-run later.' end
  from pg_stat_activity a
  where a.pid <> pg_backend_pid()
    and (exists (select 1 from pg_locks l join tbl t on t.oid = l.relation where l.pid = a.pid)
         or (a.state like 'idle in transaction%' and a.xact_start < now() - interval '1 minute'))
  union all
  select 12, 'preserve: row counts',
         'OK',
         'members=' || coalesce(members, '?') || ' owner_rows=' || coalesce(owners, '?')
           || ' invites=' || coalesce(invites, '?') || ' live_invites=' || coalesce(live_invites, '?')
  from counts
  union all
  select 13, 'preserve: content digest (members / invites)',
         'OK', coalesce(members_md5, '?') || ' / ' || coalesce(invites_md5, '?')
  from counts
  union all
  select 14 + row_number() over (order by name), name,
         case when n is null then 'STOP' when n = 0 then 'OK' else 'ATTENTION' end,
         case when n is null then 'table missing'
              when n = 0 then '0'
              else n || ' — possible past takeover. The repair does not delete or change these rows. Run docs/product/group-adventures/boards-ownership-audit.sql to list them; acting on them is a separate decision (README §E).' end
  from audit
)
select status, chk as "check", detail
from checks
order by case status when 'STOP' then 0 when 'ATTENTION' then 1 else 2 end, ord;
