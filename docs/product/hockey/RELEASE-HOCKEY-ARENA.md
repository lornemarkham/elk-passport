# Combined release: Hockey Night + Our Seats + Arena Mode (incl. Where's That Idiot)

Branch `release/hockey-arena`, cut 2026-10-22 from `feature/hockey-arena`
(9dc6c15, itself cut from the Seats RC b4f9dfc) plus one commit.

"Where's That Idiot" is the friend-finding half of Arena Mode (mission 404):
check-ins, the herd, "Find this legend", "I'm over here, genius", one-tap
meetups, status lines, and pings. It has no separate code.

## Approved product decisions (2026-10-22)

Keep side quests. Keep the window (3 h before puck drop to 5 h after). Pings
in-app only. Arena Mode reachable throughout the event (this release adds the
door to the quiet mid-period page). No live GPS: check-ins are typed or tapped.

## Ancestry

GitHub `main` (b6f571a) and `origin/integration/release` (23b21ac) are both
ancestors of this branch. Nothing on `main` is rewritten. No shared contract is
touched (no `supabase/migrations/`, `package*.json`, `schemas.ts`, layout, shell).

## Migrations — apply in this order (Supabase SQL editor; never `db push`)

All files are in this directory. Each has a preflight; every row must say OK.

1. `preflight.sql` → `migration.sql` → `verify.sql` → `grants-check.sql`
   (occasions: Hockey Night). If the tables were created before 2026-10-20 and
   `grants-check.sql` fails, run `fix-grants.sql`.
2. `seats-preflight.sql` → `seats-migration.sql` (needs 1).
3. `arena-preflight.sql` → `arena-migration.sql` (needs 1; independent of 2).
   Optional: `select cron.schedule('passport-arena-purge','17 * * * *','select public.passport_arena_purge()');`

Rollbacks, newest first: `arena-rollback.sql`, `seats-rollback.sql`,
`rollback.sql` (each has a confirm line). The code can stay deployed without
any of the tables: seats and check-ins say "isn't switched on".

## Not Hockey, but on this branch

It carries what `integration/release` carried: admin security (activation needs
Vercel env, see `docs/admin-workbench.md`) and board docs. Board-ownership
repair SQL and migration `20261021000000` are separate and not part of this.
