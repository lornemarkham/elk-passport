# Snow Day standalone — release candidate

Branch `ship/snow-standalone`, from production baseline `963daec`.

## What is in it

- `/snow`, `/snow/new`, `/snow/mountains`, `/snow/day/[id]`, `/snow/join`:
  the Snow Day Experience from `feature/snow` (33ee9f8), with its domain
  (`src/domain/snow`), components, tests, e2e spec and product docs.
- A "Snow Day" entry in the Experiences bar (`PassportNav`) and its tests.

## What is deliberately not in it

- **No database migration.** `20261103000000_passport_snow.sql` is not here.
- **No shared days.** Removed: `/snow/api/*`, `src/app/snow/_server/shared.ts`
  (and its stack test), the "Plan it together, live" option, the live-sync
  hook, the invite-join flow, and the `snow-day` adventure kind. An invite
  link (`/snow/join?t=`) says plainly that invites are not on yet.
- Kept working with no account and no tables: planning, mountains (Atlas with
  local fallback), get ready, challenges, on the hill (offline), memories on
  the phone, recap, and "Share the plan" (the plan travels inside the link).
- Nothing from Date Night, Hockey or other lanes.

Turning shared days on later is its own release: the migration, the routes,
and the kind, from `feature/snow` (see `docs/product/snow/SHARING.md`).

## Gates (at the commit this record ships in)

typecheck clean; lint 0 errors; prettier clean; vitest 4183 passed / 42
skipped; `npm run build` ok; Snow + Experiences-nav e2e 15/15; full e2e 250
passed / 12 failed / 8 skipped. The same 12 fail on an untouched `963daec`
build run the same way, so they are environmental (placeholder Supabase env,
Atlas mock), not from this change. Added-line credential scan: nothing found.
