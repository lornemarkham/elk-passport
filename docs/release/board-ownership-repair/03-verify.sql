-- ============================================================================
-- BOARD OWNERSHIP REPAIR — C. POST-REPAIR VERIFICATION            (READ ONLY)
-- Project: frllwwxesxbmmaadzfaf.   Package: docs/release/board-ownership-repair
--
-- One SELECT. Reads catalogs and COUNTS rows in the two board tables. Prints
-- no tokens, ids or emails. Changes nothing. Run it after 02.
--
--   PASS    as the repair intends
--   FAIL    the repair is not live, or something re-opens a hole: stop
--   REVIEW  needs a human decision; not a failure of the repair
--   INFO    compare by eye with the same row from 01-preflight.sql
-- The first row is OVERALL. Expected: "REPAIRED: 0 FAIL" (README §D).
-- ============================================================================
with
pol as (
  select tablename, policyname, cmd, permissive, roles::text as roles,
         coalesce(qual, '') as qual, coalesce(with_check, '') as wc
  from pg_policies
  where schemaname = 'public' and tablename in ('passport_board_members', 'passport_board_invites')
),
pins as (select 'board_owner_id\s*=\s*\(?(select\s+)?auth\.uid\(\)'::text as owner_pin,
                'created_by\s*=\s*\(?(select\s+)?auth\.uid\(\)'::text as creator_pin,
                'user_id\s*=\s*\(?(select\s+)?auth\.uid\(\)'::text as user_pin,
                '(public\.)?passport_board_role\(\s*board_id\s*,\s*auth\.uid\(\)\s*\)\s*=\s*''owner''' as role_owner),
fn as (
  select p.oid, p.prosecdef, p.provolatile, coalesce(array_to_string(p.proconfig, ';'), '') as cfg,
         format_type(p.prorettype, null) as rettype, p.prosrc
  from pg_proc p where p.oid = to_regprocedure('public.passport_board_has_members(text)')
),
tbl as (
  select c.relname, c.oid, c.relrowsecurity
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
    and c.relname in ('passport_board_members', 'passport_board_invites')
),
counts as (
  select
    (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.passport_board_members', false, true, '')))[1]::text as members,
    (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.passport_board_members where role = ''owner''', false, true, '')))[1]::text as owners,
    (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.passport_board_invites', false, true, '')))[1]::text as invites,
    (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.passport_board_invites where revoked_at is null and (expires_at is null or expires_at >= now())', false, true, '')))[1]::text as live_invites,
    (xpath('/row/c/text()', query_to_xml('select md5(coalesce(string_agg(m::text, ''|'' order by m.board_id, m.user_id), '''')) as c from public.passport_board_members m', false, true, '')))[1]::text as members_md5,
    (xpath('/row/c/text()', query_to_xml('select md5(coalesce(string_agg(i::text, ''|'' order by i.token), '''')) as c from public.passport_board_invites i', false, true, '')))[1]::text as invites_md5
),
audit(name, n) as (values
  ('audit: owner rows naming someone else',
     (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.passport_board_members where role = ''owner'' and board_owner_id <> user_id', false, true, '')))[1]::text::bigint),
  ('audit: member rows whose board_owner_id is not that board''s owner',
     (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.passport_board_members m where m.role <> ''owner'' and not exists (select 1 from public.passport_board_members o where o.board_id = m.board_id and o.role = ''owner'' and o.user_id = m.board_owner_id)', false, true, '')))[1]::text::bigint),
  ('audit: invites naming someone else',
     (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.passport_board_invites i where i.board_owner_id <> i.created_by or not exists (select 1 from public.passport_board_members o where o.board_id = i.board_id and o.role = ''owner'' and o.user_id = i.created_by)', false, true, '')))[1]::text::bigint),
  ('audit: LIVE invites naming someone else',
     (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.passport_board_invites i where i.revoked_at is null and (i.expires_at is null or i.expires_at >= now()) and (i.board_owner_id <> i.created_by or not exists (select 1 from public.passport_board_members o where o.board_id = i.board_id and o.role = ''owner'' and o.user_id = i.created_by))', false, true, '')))[1]::text::bigint),
  ('audit: boards with more than one owner row',
     (xpath('/row/c/text()', query_to_xml('select count(*) as c from (select board_id from public.passport_board_members where role = ''owner'' group by board_id having count(*) > 1) z', false, true, '')))[1]::text::bigint)
),
checks(ord, chk, status, detail) as (
  -- hole 1
  select 1, 'self_claim: INSERT only, own row, owner role, names yourself, empty boards only',
         case when p.cmd = 'INSERT' and p.permissive = 'PERMISSIVE'
               and p.wc ~ (select user_pin from pins) and p.wc ~ 'role\s*=\s*''owner'''
               and p.wc ~ (select owner_pin from pins)
               and p.wc ~ 'NOT\s+\(?\s*(public\.)?passport_board_has_members\(\s*board_id\s*\)' then 'PASS' else 'FAIL' end,
         coalesce(p.cmd || ' ' || p.permissive || ' check=' || p.wc, 'POLICY MISSING')
  from (select 1) x left join pol p on p.tablename = 'passport_board_members' and p.policyname = 'passport_board_members_self_claim'
  -- hole 2
  union all
  select 2, 'members owner_writes: only owners, and every row written names the writer as owner',
         case when p.cmd = 'ALL' and p.permissive = 'PERMISSIVE'
               and p.qual ~ (select role_owner from pins)
               and p.wc ~ (select role_owner from pins) and p.wc ~ (select owner_pin from pins) then 'PASS' else 'FAIL' end,
         coalesce(p.cmd || ' ' || p.permissive || ' using=' || p.qual || ' check=' || p.wc, 'POLICY MISSING')
  from (select 1) x left join pol p on p.tablename = 'passport_board_members' and p.policyname = 'passport_board_members_owner_writes'
  union all
  select 3, 'invites owner_writes: only owners, invite names the writer as owner and as creator',
         case when p.cmd = 'ALL' and p.permissive = 'PERMISSIVE'
               and p.qual ~ (select role_owner from pins)
               and p.wc ~ (select role_owner from pins) and p.wc ~ (select owner_pin from pins)
               and p.wc ~ (select creator_pin from pins) then 'PASS' else 'FAIL' end,
         coalesce(p.cmd || ' ' || p.permissive || ' using=' || p.qual || ' check=' || p.wc, 'POLICY MISSING')
  from (select 1) x left join pol p on p.tablename = 'passport_board_invites' and p.policyname = 'passport_board_invites_owner_writes'
  union all
  select 4, 'no other INSERT/UPDATE/ALL policy on the board tables (one would bypass the pins)',
         case when count(*) = 0 then 'PASS' else 'FAIL' end,
         coalesce(string_agg(tablename || '.' || policyname || ' [' || cmd || ' ' || permissive || ']', '; '), 'none')
  from pol
  where cmd in ('INSERT', 'UPDATE', 'ALL') and permissive = 'PERMISSIVE'
    and policyname not in ('passport_board_members_self_claim', 'passport_board_members_owner_writes', 'passport_board_invites_owner_writes')
  union all
  select 5, 'read policies unchanged (members_visible, invites_members_read)',
         case when count(*) = 2 then 'PASS' else 'FAIL' end,
         count(*) || ' of 2 present as SELECT using passport_is_board_member(board_id, auth.uid())'
  from pol
  where cmd = 'SELECT' and qual ~ '(public\.)?passport_is_board_member\(\s*board_id\s*,\s*auth\.uid\(\)\s*\)'
    and policyname in ('passport_board_members_visible', 'passport_board_invites_members_read')
  union all
  select 6, 'no other policies on the board tables',
         case when count(*) = 0 then 'PASS' else 'REVIEW' end,
         coalesce(string_agg(tablename || '.' || policyname || ' [' || cmd || ' ' || permissive || ']', '; '), 'none')
  from pol
  where policyname not in ('passport_board_members_self_claim', 'passport_board_members_owner_writes', 'passport_board_invites_owner_writes',
                           'passport_board_members_visible', 'passport_board_invites_members_read')
  -- the function
  union all
  select 7, 'passport_board_has_members(text): exists, SECURITY DEFINER, STABLE, search_path=public, returns boolean',
         case when f.oid is not null and f.prosecdef and f.provolatile::text = 's' and f.cfg = 'search_path=public' and f.rettype = 'boolean'
              then 'PASS' else 'FAIL' end,
         case when f.oid is null then 'FUNCTION MISSING'
              else 'secdef=' || f.prosecdef || ' volatile=' || f.provolatile::text || ' config=' || f.cfg || ' returns=' || f.rettype end
  from (select 1) x left join fn f on true
  union all
  select 8, 'passport_board_has_members: body as in the repair',
         case when f.oid is not null and md5(f.prosrc) = '3124d2f4c0ed9361e0b60b6db84a817d' then 'PASS'
              when f.oid is not null then 'REVIEW' else 'FAIL' end,
         coalesce(md5(f.prosrc), 'FUNCTION MISSING')
  from (select 1) x left join fn f on true
  union all
  select 9, 'passport_board_has_members: anon cannot execute, authenticated can',
         case when f.oid is not null
               and not has_function_privilege('anon', f.oid, 'EXECUTE')
               and has_function_privilege('authenticated', f.oid, 'EXECUTE') then 'PASS' else 'FAIL' end,
         case when f.oid is null then 'FUNCTION MISSING'
              else 'anon=' || has_function_privilege('anon', f.oid, 'EXECUTE') || ' authenticated=' || has_function_privilege('authenticated', f.oid, 'EXECUTE') end
  from (select 1) x left join fn f on true
  -- RLS and anon (unchanged by the repair; re-checked because the repair relies on them)
  union all
  select 10, 'RLS on for both board tables',
         case when (select count(*) from tbl where relrowsecurity) = 2 then 'PASS' else 'FAIL' end,
         coalesce((select string_agg(relname || '=' || relrowsecurity, ', ' order by relname) from tbl), 'tables missing')
  union all
  select 11, 'anon holds no SELECT/INSERT/UPDATE/DELETE on the board tables',
         case when not exists (select 1 from tbl t where has_table_privilege('anon', t.oid, 'SELECT') or has_table_privilege('anon', t.oid, 'INSERT')
                                              or has_table_privilege('anon', t.oid, 'UPDATE') or has_table_privilege('anon', t.oid, 'DELETE'))
              then 'PASS' else 'FAIL' end,
         'checked with has_table_privilege'
  union all
  select 12, 'anon can still read an invite link (passport_describe_board_invite)',
         case when has_function_privilege('anon', 'public.passport_describe_board_invite(text)', 'EXECUTE') then 'PASS' else 'FAIL' end,
         'signed-out visitors see what a link offers before they sign in'
  -- data preservation
  union all
  select 13, 'preserve: row counts', 'INFO',
         'members=' || members || ' owner_rows=' || owners || ' invites=' || invites || ' live_invites=' || live_invites
           || ' — must equal 01-preflight.sql'
  from counts
  union all
  select 14, 'preserve: content digest (members / invites)', 'INFO',
         members_md5 || ' / ' || invites_md5 || ' — must equal 01-preflight.sql (only if nobody used boards in between)'
  from counts
  union all
  select 15 + row_number() over (order by name), name,
         case when n = 0 then 'PASS' else 'REVIEW' end,
         case when n = 0 then '0'
              else n || ' — rows written before the repair; it closes the door but does not undo them. See README §E.' end
  from audit
)
select status, "check", detail
from (
  select 'OVERALL' as status, 'BOARD OWNERSHIP REPAIR' as "check",
         case when count(*) filter (where status = 'FAIL') > 0 then 'NOT REPAIRED: ' else 'REPAIRED: ' end
           || count(*) filter (where status = 'FAIL') || ' FAIL, '
           || count(*) filter (where status = 'REVIEW') || ' REVIEW, '
           || count(*) filter (where status = 'PASS') || ' PASS' as detail,
         -1 as o1, 0 as ord
  from checks
  union all
  select status, chk, detail, case status when 'FAIL' then 0 when 'REVIEW' then 1 when 'INFO' then 3 else 2 end, ord
  from checks
) r
order by o1, ord;
