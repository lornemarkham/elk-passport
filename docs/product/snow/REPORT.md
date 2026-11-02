# Snow mission report — 2026-11-01

Branch `feature/snow`, local commit only. Nothing pushed, merged or deployed.

## 1. Features implemented

Homepage with original mountain artwork and one primary action; mountain
discovery (Atlas ski areas when connected, a static short list, distance from a
chosen town or opt-in location, skill guidance, live-vs-static badges, a live
town forecast); a Plan with seven voted topics, lock-in and last-minute change
notices; Crew (levels, rentals, notes, announcements, share by link); Get ready
(countdown, phase-aware reminders, gear lists, optional playlist); eleven vetted
challenges plus crew-written ones with a safety deny-list; derived standings and
awards; On the hill (plan card, meeting points, check-in in words, quick updates,
print); Memories (photos, moments, recap, plain-text share); Go have another
(vote on the next one, same crew carried over).

## 2. Features reused

Hockey's `countdown()`; Discovery's activity vocabulary and `doesActivity`;
the Atlas client and `candidateToExperience`; `distanceKm`; the Environment
Canada forecast route; `PassportNav`; links into Discovery, Saved and
adventures. Hockey's pattern (pure domain, derived leaderboard, plain-text
recap) was followed, not copied.

## 3. Data integration status

| Source                       | Status                                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Atlas ski areas              | Code written and unit-tested on fixtures. **Not exercised against real Atlas**: this lane has none. Outage is shown as such.      |
| Static short list (15 areas) | Names/regions from general knowledge; coordinates approximate; **resort URLs not fetched or verified**. Needs a human spot-check. |
| Forecast                     | Existing Passport route (Environment Canada). In this sandbox it returned no answer; the "couldn't reach" path was tested.        |
| Snow, lifts, trails, tickets | Deliberately absent, and shown as NOT CONNECTED with the resort's own site.                                                       |
| Supabase / adventures / chat | Not used. See `SHARING.md`.                                                                                                       |

## 4. Complete user journey tested

`e2e/snow.spec.ts`, 390×844 touch: home → start → plan (add, vote, lock,
change-after-lock) → crew → get ready → challenges (unsafe one refused) → on the
hill → **network cut, edit, restore, reload** → memories (real image upload) →
recap → Same crew, next snow day. Plus: share link opened in a second browser
context, and the mountains page.

## 5. Screenshots

`docs/product/snow/screenshots/01…09`.

## 6. Test results

- `npx tsc --noEmit` — clean
- `npx eslint .` — 0 errors (41 pre-existing warnings, none in Snow files)
- `npx prettier --check` — clean on everything I touched
- `npx vitest run` — 314 files passed, 8 skipped; 3,939 tests passed (36 new:
  `domain/snow/snow.test.ts` 33, `app/snow/_server/atlas.test.ts` 3)
- `npm run build` — passes (with placeholder Supabase env)
- Playwright `e2e/snow.spec.ts` — 3/3 on both `next dev` and the production
  build (`next start`, port 3132)
- **Not run:** the rest of the Playwright suite. No existing file was changed,
  and that suite rewrites tracked Discovery PNGs.

## 7. Remaining blockers

1. **Shared crew.** Copies by link do not merge; no live votes across phones, no
   group chat, no cross-phone points. Needs the `snow-day` kind and an extension
   migration from the contracts lane (`SHARING.md`).
2. **Nav entry.** `/snow` is not linked from the Experiences menu (shell file).
3. **Atlas** real-data pass for ski areas; Atlas is the intended primary source.
4. **No cold-start offline** (no service worker). Only "open page keeps working".
5. **Photos** live on one phone, capped at 16, shrunk; no upload.
6. **Mobile polish** on a real phone, and a pass for contrast and screen-reader
   labels beyond what the e2e asserts.
7. **Doctrine tension** on the skiing "who gets down fastest" example (README).

## 8. Release readiness

Code is gated green and self-contained: new files only, zero edits to shared
contracts or other lanes. **Outside my lane: none.** Safe to integrate as a
public, account-free `/snow` once someone adds the nav entry and spot-checks the
static list. It is **not** ready to be called a group product until the shared
tables exist. Suggested integration step: fetch
`git fetch metatron:passport/main feature/snow`.

## Addendum — Powder Day brief, 2026-11-01

Audit against the brief found one named item missing: **predictions**. Added
(domain, UI in Get ready, scoring, "Called It" award, recap, tests, e2e step).
Everything else in the brief already existed (see sections 1 and 4). Still
blocked, unchanged: shared multi-phone crew (needs a `snow-day` kind + migration
from the contracts lane), nav entry (shell), real-Atlas pass, cold-start offline,
cross-phone photo sharing. Nothing was deployed; release status is "gated, local
commit, not pushed".

## Addendum — Powder Day shared persistence, 2026-11-01

A snow day can now be shared between phones. See `SHARING.md`.

- **Built:** `docs/product/snow/shared-migration.sql` (+ preflight, rollback);
  `src/domain/snow/shared.ts` (pure: rows → day, action → who may / which rows,
  request parser); `src/app/snow/_server/shared.ts` and `src/app/snow/api/*`
  (start, read, change, invite, join, photo); UI: start "together", join by
  link, group chat, invite link, polling. Group chat is new (`say` action).
- **Verified:** a real two-account integration test against a local
  GoTrue + PostgREST + Postgres (`shared.stack.test.ts`), and two browser
  contexts on that stack (`verification/two-phones.spec.ts`).
- **Not verified:** anything against the real Supabase project; the migration
  has not been applied anywhere real.
- **Outside my lane:** none. Proposed for the contracts lane: the migration,
  the `snow-day` kind label, the nav entry.

## Addendum — Powder Day integrate, verify, release, 2026-11-02

Integrated on `feature/snow` (main `a47e611` merged in; the tip is a
fast-forward of GitHub `main`). The migration is now
`supabase/migrations/20261103000000_passport_snow.sql`, `snow-day` is a
registered kind, and Snow Day is the fifth Experiences entry. Release review
made starting a day and settling the plan single transactions and made
photos raster-only. Gates, migration rehearsal, operator steps and the
production checklist: `docs/release/RELEASE-2026-11-02-POWDER-DAY.md`. Not
pushed, no production SQL, not deployed.
