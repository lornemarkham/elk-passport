# Release record: Go Have a Day + Snow Day, 2026-11-08 (M638)

Status: **INTEGRATED and TESTED. Not deployed.** Deploying is forbidden in this
checkout (`CLAUDE.local.md`) and push is disabled; a person fetches and ships.

## What is in `main`

- Go Have a Day: `043402c` (M623 `1db3efb`, M627).
- Snow Day: `feature/snow` `ff83176` (M628, includes `9c91fdd`), merged without
  conflicts as `40781f3`.
- One new change: `/snow/api/conditions` returns 503 unless `SNOW_FORECAST=on`.
  Open-Meteo's free tier is non-commercial and nobody has cleared it. The Snow
  screen already says "couldn't reach the forecast" in that case. Set the env
  var only after the owner decides (or the source is changed in
  `_server/conditions.ts`).

## Gates (on the merged tree)

- `tsc --noEmit` clean; `eslint .` 0 errors / 82 warnings.
- `vitest run`: 4269 passed, 46 skipped.
- `npm run build` ok.
- Playwright, `next start`, Atlas stand-in (critic fixture), placeholder
  Supabase env: targeted Snow, adventure, Day Builder and experiences-nav
  specs 42/42. Full suite 255 passed / 10 failed. The same 7 non-baseline
  failures (card-titles x2, conference-mobile:23, creative:198,
  discovery-one-search:58, fairview3:31, gohaveaday-door:34) fail identically
  on `043402c` built alone, so they are environmental. The rest are the known
  baseline: core-loop:26, october:554/570.

## Database

Nothing applied. Production identity was not confirmed (Forge's database
service points at `mbyig…`, the live app at `frllwwxesxbmmaadzfaf`).

| Feature                                                 | Needs                                                                                                                                    |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Solo "one-phone" Snow Day, companion, challenges, recap | nothing                                                                                                                                  |
| Shared Snow Days (crew)                                 | `20261103000000_passport_snow.sql`; the page probes for the table and hides the option until it exists                                   |
| Find your crew (live location)                          | `docs/product/snow/location-migration.sql`, after the Snow migration; privacy controls are opt-in, temporary, mutual. Absent table = off |
| Go Have a Day: sharing a memory with a group            | ADR 014 migration                                                                                                                        |
| Forecast                                                | `SNOW_FORECAST=on` after the commercial-terms decision                                                                                   |

---

## M646 update, 2026-11-08: GHAD overhaul + Snow Day alive

Status: **INTEGRATED and TESTED locally on `adecbee`. Not pushed, no preview,
not deployed.** Production is still `dfa7d69` (runner ledger `previous`; the
live bar on 2026-11-08 still shows Places and Labs, with no My Stuff). `dfa7d69`
is an ancestor of `adecbee`.

### What `main` now carries beyond production

- Go Have a Day overhaul, M642: `09f1891` … `fe5e305` (four-part bar, Adventure
  Pocket, My Stuff, Pocket to Day Builder to a saved adventure).
- Snow Day alive, M643: `feature/snow` `8e9c302` (resort facts, Atlas around
  the mountain, the 9-card dashboard, the day in words), merged as `41ed78e`.
  No conflicts: the doctrine's two edits merged by themselves.
- `93c34a3`: the runner blocked `fe5e305` at its secret safeguard
  (`PASSWORD = "<16+ chars>"` in the GHAD journey spec, a throwaway password
  for a local-stack account). Renamed to `testPassword`, same value. A rescan
  of the whole `dfa7d69..` diff with the runner's patterns is clean.
- `ea5f2ac`: the Snow lane's proposed integration step. `activity-migration.sql`
  becomes `supabase/migrations/20261108000000_passport_snow_activity.sql`, and
  shared days stop refusing activities. Without it, "vote on activities" works
  only on a one-phone day.
- `adecbee`: the real-stack test now stores and votes on an activity on a
  shared day.

### Gates (Metatron)

| Gate                                                                     | Result                                                                                                                                                           |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsc --noEmit` / `eslint .` / `prettier --check .` (at `93c34a3`)        | clean / 0 errors, 82 warnings / clean                                                                                                                            |
| `vitest run` (at `93c34a3`)                                              | 4313 passed, 46 skipped, 0 failed; Snow domain at `ea5f2ac`: 105/105                                                                                             |
| `npm run build` (at `ea5f2ac`)                                           | ok, twice (placeholder env; stack env in a scratch clone)                                                                                                        |
| Playwright full suite, `next start`, critic Atlas stand-in               | 256 passed, 12 failed, 8 skipped, 4 did not run. 10 failures are M638's named baseline. The other 2 are `snow-silverstar` ×2, which need the SilverStar fixture  |
| Snow specs with the SilverStar fixture (silverstar, snow, snow-mountain) | 9/9 twice. The first run had 1 Chromium `Page.captureScreenshot` protocol error and no assertion failure                                                         |
| Shared days, real local Supabase (`stack.mjs`, two accounts)             | `shared.stack.test` + `location.stack.test` 16/16; `two-phones.spec` + `hill.spec` 2/2                                                                           |
| GHAD journey, real local Supabase, desktop + Pixel 7                     | 2/2 (discover, save ×3, Pocket, remove/undo, My Stuff, collection, build, adjust, save, start, complete, Memories)                                               |
| Activity migration over existing data                                    | stack started without it, shared-day tests wrote rows, then it was applied twice: every `passport_snow_*` row count unchanged, the CHECK now includes `activity` |

### Database, in order (production applied-state UNKNOWN; nothing applied by M646)

1. `20261101000000_passport_adventure_together.sql` (ADR 014; already in the
   production tree; earlier notes say production lacks it).
2. `20261103000000_passport_snow.sql`. The shared Snow tables. Rollback:
   `docs/product/snow/shared-rollback.sql` (deletes shared snow data).
3. `20261108000000_passport_snow_activity.sql`. One CHECK, widened. This must
   land **before** the code: the code now stores activities on shared days.
   Rollback is in the file's header.
4. Optional, not promoted: `docs/product/snow/location-migration.sql` (ADR 015,
   which awaits the owner).

The runner's destructive-SQL pattern will match 2 and 3: their `DROP POLICY IF
EXISTS` / `DROP CONSTRAINT IF EXISTS` are idempotent re-creates, not data
loss. A recorded backup and the owner's SHIP are still needed. The runner's
`passport-production` database service points at `mbyig…`, not the live
`frllwwxesxbmmaadzfaf` (ledger, 04e5a62: "one-time setup missing"). Until that
is fixed, the runner can't apply these, and a person runs them in the SQL editor.

### Rollback

- Code: production is `dfa7d69`. Promote its Vercel deployment again, or
  revert `main` to it with a new commit. No force-push.
- Database: nothing in 1–3 rewrites existing rows. Code at `dfa7d69` runs
  against the migrated schema (it never writes `activity`, and it predates the
  Snow tables), so a code rollback needs no SQL rollback.
