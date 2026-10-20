# Database grants regression check

**For every Passport feature that adds a table.** Written for Hockey on
2026-10-20; nothing in it is Hockey-specific.

## The failure it prevents

Row-level security decides which **rows** a role may touch. A `GRANT` decides
whether the role may touch the **table** at all. Both are required, and RLS
policies do not imply grants.

A stock local Supabase gives `anon` and `authenticated` ALL on every new
`public` table. The shared production project (`frllwwxesxbmmaadzfaf`) does
not. So a migration with correct policies and no `GRANT` passes every local
test and then fails in production for every signed-in visitor:
`42501 permission denied for table …`. Conference did exactly that on
2026-10-16; Hockey's migration had the same defect until 2026-10-19.

## The rule

A migration states every privilege it needs, to the narrowest role, and
`verify.sql`-style checks prove it. Never rely on default privileges.

- Grant `authenticated` the DML the app really issues, per table. Not ALL.
  TRUNCATE, REFERENCES and TRIGGER are never needed by an app role and RLS does
  not gate TRUNCATE.
- `anon` gets nothing unless the feature is deliberately public (then say why).
- Narrow further with column-level `GRANT UPDATE (col, …)` where a row's other
  columns must not change.
- Functions: `REVOKE ALL … FROM PUBLIC`, then `GRANT EXECUTE` to exactly who may
  call them.
- Production's migration history is Atlas's: apply by pasting into the SQL
  editor; never `supabase db push`.

## The check (three steps, ~1 minute)

1. **Test on production's posture, not Supabase's.** Use
   `verification/stack.mjs`: real Postgres + GoTrue + PostgREST whose default
   privileges give new `public` tables to `service_role` only. If your feature
   has its own stack, make its `ALTER DEFAULT PRIVILEGES … ON TABLES` do the
   same. A test stack that grants by default **hides this bug**; that is how it
   shipped.

   ```bash
   export STACK=~/passport/scratch/<your-stack>    # not /tmp; it fills
   node docs/product/hockey/verification/stack.mjs start
   ```

2. **Run the catalog check** (read-only; also safe on a real project):

   ```bash
   # edit the `scope` line in the file to your tables' prefix first
   node $STACK/q.mjs docs/product/hockey/verification/grants-check.sql
   # or: psql "$DATABASE_URL" -f docs/product/hockey/verification/grants-check.sql
   ```

   | Row                                      | Means                                                                                    | Verdict if it fails |
   | ---------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------- |
   | 1 unbacked policy                        | A policy lets `anon`/`authenticated` do X but the role has no privilege for X → `42501`. | STOP                |
   | 2 RLS off but granted                    | A role can read/write a table with RLS disabled → every row is public.                   | STOP                |
   | 3 TRUNCATE/REFERENCES/TRIGGER held       | An app role holds a privilege no app needs, and RLS cannot gate.                         | STOP                |
   | 4 granted, RLS on, no policy admits role | The grant is dead; the feature probably meant to work and will not.                      | REVIEW              |

   Every row must be `OK`. It does **not** cover function `EXECUTE`, sequence
   `USAGE`, or column-level narrowing; write those into your own `verify.sql`.

3. **Exercise it as a signed-in user** (the check proves the grant exists, not
   that your queries use it): run the feature's attack/acceptance suite on that
   same stack. For Hockey: `rls-attack.mjs` (53 attacks, straight at PostgREST
   with real JWTs) and the Playwright specs in `verification/`.

## Proving the check itself still works

A check that cannot fail is decoration. After any edit to `grants-check.sql`,
sabotage a scratch copy inside a transaction and confirm each row turns red:

```sql
begin;
revoke select on public.<your_table> from authenticated;        -- row 1 (the Conference bug)
create table public.<prefix>_zz(id int); grant select on public.<prefix>_zz to anon;  -- row 2
grant truncate on public.<your_table> to authenticated;          -- row 3
-- … the check …
rollback;
```

This was done on 2026-10-20: all four rows went red on Hockey's tables and
back to `OK` after the rollback.

## Known gap

Scope `%` (whole `public` schema) also reports **baseline** tables — see
`PRODUCTION-READINESS.md` §14, "Found while building the check". Run it against
production, read-only, before deciding whether that matters.

## Where this should live

It sits in `docs/product/hockey/` because that is this lane's territory. It is
feature-neutral; `passport-domain` should promote it (for example to
`docs/architecture/` and `supabase/`) and reference it from the migration
template. Not done here: those are shared paths.
