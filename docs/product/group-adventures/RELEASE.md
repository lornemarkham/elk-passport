# Release: board security fix, then Adventures

**For the Passport release owner.** Lane `boards`, 2026-10-12. Nothing in this
file has been applied or deployed. Production status is recorded only when
someone has checked it.

Fetch: `git fetch metatron:passport/main lane/boards`.

| Step | What                                              | Kind                 | Depends on     | Status                         |
| ---- | ------------------------------------------------- | -------------------- | -------------- | ------------------------------ |
| 1    | Board ownership fix                               | SQL only, no deploy  | nothing        | **ready, urgent; not applied** |
| 2    | First board share works (`writeOwnerRow`)         | app deploy           | nothing        | ready; not deployed            |
| 3    | Adventures migration                              | SQL                  | 1 (sequencing) | ready; not applied             |
| 4    | Adventures app (`/adventures`, `/api/adventures`) | app deploy           | 3              | on lane/boards; not deployed   |
| 5    | Real-account isolation check                      | script, two accounts | 1 (and 3)      | not run                        |

## 1. Board ownership fix — do this first, on its own

Two holes, both live (README §6). Use the version at `ca20324` or later. **Not
the d1ba0be file**: that version closed hole 1 only.

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

`migration.sql` (with `77315b2` and the schema reload). Apply it in the SQL
editor, never with `supabase db push` (`supabase/README.md`). Re-running is
safe. Its table grants are explicit, so it doesn't depend on the project's
default privileges. Verified on the local stack only. **A local stack is not
production**: don't record this step as done until the check in step 5 has
passed against production.

It also has to become `supabase/migrations/<timestamp>_passport_adventures.sql`.
That's a shared contract for `passport-domain` or integration to add, not this
lane.

## 4. Adventures app

The routes and pages on `lane/boards` call functions that exist only after
step 3. Deploy after step 3. Prod deploys are full snapshots from a checkout,
so the deploy must also contain whatever production already runs (Conference
is live from `conference/live`).

## 5. Real-account isolation in production

`verification/prod-isolation.mjs`. It needs two accounts made for the purpose,
plus the project URL and the public anon key. It writes only test rows, and
deletes them. It refuses to run without `--i-mean-production`. Add
`--adventures` once step 3 is applied. It has been validated against the local
stack: it fails exactly the two holes on the baseline, and passes everything
once fixed.

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
