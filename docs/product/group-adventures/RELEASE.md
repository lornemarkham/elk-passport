# Release: board security fix, then Adventures

**For the Passport release owner.** Written on lane `boards` 2026-10-12;
updated by integration 2026-10-21 when Adventures and _Saved leads to
adventures_ (ADR 010) reached `integration/release`. Nothing in this file has
been applied or deployed. Production status is recorded only when someone has
checked it.

Everything is on `integration/release` now: `git fetch metatron:passport/main
integration/release`.

| Step | What                                                  | Kind                 | Depends on     | Status                                   |
| ---- | ----------------------------------------------------- | -------------------- | -------------- | ---------------------------------------- |
| 1    | Board ownership fix                                   | SQL only, no deploy  | nothing        | **ready, urgent; not applied (unknown)** |
| 2    | First board share works (`writeOwnerRow`)             | app deploy           | nothing        | in integration/release                   |
| 3    | Adventures migration (`20261021000000`)               | SQL                  | 1 (sequencing) | ready; not applied                       |
| 4    | Adventures app + Saved → adventures + `/go` save-back | app deploy           | 3              | in integration/release; not deployed     |
| 5    | Real-account isolation check                          | script, two accounts | 1 (and 3)      | not run                                  |

**If the app ships before step 3** (the Forge release runner auto-ships
`integration/release`): nothing breaks, but nothing about adventures works.
`/adventures` says it couldn't load, Saved's _Add to an adventure_ says
adventures can't be reached (_Make a day out of these_ still works), Saved
shows no adventures strip, and `/go` shows no _Save to_ button. Every
adventure API answers 503, never "you have none".

## 1. Board ownership fix — do this first, on its own

Two holes, both live (README §6). Use the version at `ca20324` or later. **Not
the d1ba0be file**: that version closed hole 1 only.

**Production execution package:** `docs/release/board-ownership-repair/README.md`
(read-only preflight and verification, expected results, rollback, scratch
test). Follow it; the steps below are the short form.

1. SQL editor, read-only: run `boards-ownership-audit.sql`. Keep the output.
2. SQL editor: run `boards-owner-claim-fix.sql`. It runs as one transaction, is
   idempotent, changes no rows, and reloads PostgREST's schema.
3. Read-only check that it is live:

   ```sql
   select policyname, with_check from pg_policies
   where tablename in ('passport_board_members', 'passport_board_invites');
   ```

   Expected:
   - `passport_board_members_self_claim` contains `passport_board_has_members`;
   - both `*_owner_writes` contain `board_owner_id = auth.uid()`.

4. Run the audit again. It should show no new findings.
5. Any audit finding is a **separate human decision**: revoke the invites and
   delete the rows it names, and treat those boards as disclosed. The fix
   deletes nothing.
6. Run step 5 below (boards half).

**Rollback** (re-opens both holes; only if genuine sharing breaks): re-run the
three policy statements from `supabase/migrations/20260927000000_passport_baseline.sql`
after `DROP POLICY` on each.

## 2. First share of a board

`5f91b5c`. Today, `ensureOwnerMembership`'s upsert is refused for every board
with no rows, so a board's first share fails. This commit fixes that. It ships
with any app deploy, in either order relative to step 1. If the audit's
`owner_rows_total` is near zero, that confirms the bug in production.

## 3. Adventures migration

File: **`supabase/migrations/20261021000000_passport_adventures.sql`** (moved
from `docs/product/group-adventures/migration.sql`). Changes from the lane
draft, both found or needed on 2026-10-21:

- the invites policy is split; the draft's `WITH CHECK (… uses = 0)` on every
  command meant **an owner could not revoke a link once anyone had used it**
  (Postgres refused silently; reproduced on the local stack);
- `passport_adventure_days`: how each planned day was asked for (members
  read, owner writes, explicit grants).

Apply:

1. Supabase dashboard → the Passport project → SQL editor. **Never**
   `supabase db push` from this repo (`supabase/README.md`).
2. Paste the whole file and run it. It is idempotent (proven by applying it
   twice on the local stack), grants explicitly (production has no default
   grants), and ends with `NOTIFY pgrst, 'reload schema'`.
3. Read-only checks:

   ```sql
   select table_name from information_schema.tables
   where table_schema = 'public' and table_name like 'passport_adventure%'
   order by 1;
   -- expect 8: passport_adventure_days, _hockey, _invites, _items, _members,
   --           _removals, _responses, passport_adventures

   select tablename, policyname, cmd from pg_policies
   where tablename like 'passport_adventure%' order by 1, 2;
   -- expect passport_adventure_invites_owner_{read,create,change,delete}
   -- and NO passport_adventure_invites_owner_all

   select grantee, table_name, privilege_type
   from information_schema.role_table_grants
   where table_name like 'passport_adventure%' and grantee = 'anon';
   -- expect 0 rows
   ```

4. Then step 5 with `--adventures`. Don't record step 3 as done until it
   passes against production.

Rollback (no data yet to lose; only before anyone uses it): `drop table`
the eight tables in reverse dependency order and drop the
`passport_*adventure*` functions. No other table is touched.

## 4. Adventures app

In `integration/release`: `/adventures`, `/api/adventures/**` (including
`ideas` and `days`), Saved's _Plan with these_, and `/go?adventure=`'s _Save
to_. Deploy after step 3 (see the note at the top if it ships first). Prod
deploys are full snapshots, so deploy `integration/release`, which already
contains Conference, Hockey, October, Creative and Discovery.

## 5. Real-account isolation in production

`verification/prod-isolation.mjs`. It needs two accounts made for the purpose,
plus the project URL and the public anon key. It writes only test rows, and
deletes them. It refuses to run without `--i-mean-production`. Add
`--adventures` once step 3 is applied. It has been validated against the local
stack: it fails exactly the two holes on the baseline, and passes everything
once fixed. It does not cover `passport_adventure_days`;
`src/lib/adventures/planning.stack.test.ts` does, on the local stack only.

The browser journey (`verification/journey.spec.ts`: Discovery → Save →
Saved → adventure → plan → refine → save → share → reopen, three accounts,
desktop and phone) runs against a local build only; see its header.

## Product integration (not part of this release)

- **Hockey:** README §4, "Hockey". Reusable nights work today at
  `/adventures` with kind Hockey Night. The Hockey lane moves
  `passport_occasion_*` onto the core incrementally. New nights come first.
- **Conference:** README §4, "Conference". This starts only after the
  Conference activation has been verified in production. Ids, links,
  membership and data are carried across unchanged (plaintext tokens become
  hashes, so links already sent keep working). This needs its own migration,
  written with the Conference owner against the live schema. It isn't written
  yet.
