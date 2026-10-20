-- **Grants regression check — reusable by any Passport feature that adds tables.**
--
-- Why it exists: on 2026-10-16 Conference shipped tables with RLS policies but no
-- GRANTs and crashed for every signed-in visitor (`42501 permission denied`). The
-- production project does NOT give new `public` tables to `anon`/`authenticated`
-- by default, but a stock local Supabase does — so tests passed locally and failed
-- in production. Hockey's migration had the same bug. Policies say which ROWS a
-- role may touch; only a GRANT lets the role touch the table at all. Both are needed.
--
-- Run it, read-only, against a database that has had your migration applied AND
-- whose default privileges mirror production (verification/stack.mjs does this:
-- new public tables go to service_role only). Every row must say OK.
--
--   node $STACK/q.mjs docs/product/hockey/verification/grants-check.sql
--   psql "$DATABASE_URL" -f docs/product/hockey/verification/grants-check.sql   # or, read-only, on a real project
--
-- It reads the catalog only. It changes nothing. Scope: ONE line to edit — the
-- `scope` CTE below. It is set to Hockey's tables; a new feature sets it to its
-- own prefix (a LIKE pattern, `_` escaped). Set it to '%' to audit all of
-- `public`: today that also reports pre-existing BASELINE tables (see
-- PRODUCTION-READINESS.md, "Found while building the check") — real, but not a
-- reason for a new feature's check to fail.
--
-- Checks:
--   1 UNBACKED POLICY   a policy lets anon/authenticated do X, but the role has no
--                       table privilege for X          -> 42501 in production
--   2 RLS OFF + GRANTED a table readable/writable by anon/authenticated has RLS
--                       disabled                      -> every row is public
--   3 BROAD PRIVILEGE   anon/authenticated hold TRUNCATE, REFERENCES or TRIGGER
--   4 NO POLICY         RLS on, role holds a privilege, but no policy admits that
--                       role -> the grant is dead (not an error, but a smell:
--                       the feature probably meant to work and does not)
--
-- Out of scope (say so rather than imply coverage): EXECUTE on functions
-- (this stack grants it by default; production's posture is unconfirmed),
-- sequence USAGE, column-level narrowing (use verify.sql-style checks).

with schemas(s) as (values ('public')),
scope(pat) as (values ('passport\_occasion%')),   -- <- edit me
roles(r) as (values ('anon'), ('authenticated')),
tbl as (
  select c.oid, n.nspname sch, c.relname t, c.relrowsecurity rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p') and n.nspname in (select s from schemas)
    and c.relname like (select pat from scope)
),
-- what each policy promises each role
promised as (
  select distinct p.schemaname sch, p.tablename t, roles.r role,
         unnest(case p.cmd when 'ALL' then array['select','insert','update','delete']
                           else array[lower(p.cmd)] end) priv
  from pg_policies p
  join roles on roles.r = any (p.roles) or 'public' = any (p.roles)
  where p.schemaname in (select s from schemas)
    and p.tablename like (select pat from scope)
),
unbacked as (
  select sch, t, role, priv from promised
  where not case priv
    when 'delete' then has_table_privilege(role, format('%I.%I', sch, t), 'delete')
    else has_any_column_privilege(role, format('%I.%I', sch, t), priv)
  end
)
select '1 unbacked policy' as check_name,
       coalesce(string_agg(role || ' ' || priv || ' on ' || t, '; ' order by t, role, priv), 'none') as found,
       case when count(*) = 0 then 'OK' else 'STOP' end as verdict
from unbacked
union all
select '2 RLS off but granted', coalesce(string_agg(tbl.t || ' → ' || roles.r, '; '), 'none'),
       case when count(*) = 0 then 'OK' else 'STOP' end
from tbl cross join roles
where not tbl.rls
  and (has_table_privilege(roles.r, tbl.oid, 'select') or has_table_privilege(roles.r, tbl.oid, 'insert')
    or has_table_privilege(roles.r, tbl.oid, 'update') or has_table_privilege(roles.r, tbl.oid, 'delete'))
union all
select '3 TRUNCATE/REFERENCES/TRIGGER held', coalesce(string_agg(tbl.t || ' → ' || roles.r, '; '), 'none'),
       case when count(*) = 0 then 'OK' else 'STOP' end
from tbl cross join roles
where has_table_privilege(roles.r, tbl.oid, 'truncate') or has_table_privilege(roles.r, tbl.oid, 'references')
   or has_table_privilege(roles.r, tbl.oid, 'trigger')
union all
select '4 granted, RLS on, no policy admits role', coalesce(string_agg(tbl.t || ' → ' || roles.r, '; '), 'none'),
       case when count(*) = 0 then 'OK' else 'REVIEW' end
from tbl cross join roles
where tbl.rls
  and (has_table_privilege(roles.r, tbl.oid, 'select') or has_any_column_privilege(roles.r, tbl.oid, 'insert')
    or has_any_column_privilege(roles.r, tbl.oid, 'update') or has_table_privilege(roles.r, tbl.oid, 'delete'))
  and not exists (select 1 from pg_policies p
                  where p.schemaname = tbl.sch and p.tablename = tbl.t
                    and (roles.r = any (p.roles) or 'public' = any (p.roles)));
