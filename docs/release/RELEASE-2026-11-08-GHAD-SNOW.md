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
