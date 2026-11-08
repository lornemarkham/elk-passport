# Snow Day P0 — the mountain experience

Mission "SNOW DAY — P0: COMPLETE THE MOUNTAIN EXPERIENCE", 2026-11-07, on
`feature/snow`. Read with [`README.md`](README.md) (what Snow is),
[`SHARING.md`](SHARING.md) (shared days) and
[`../../release/RELEASE-2026-11-02-POWDER-DAY.md`](../../release/RELEASE-2026-11-02-POWDER-DAY.md).

Not pushed, not deployed, no production SQL. Everything below is on this branch.

## 1. Recovered state (before this mission)

Base: `feature/snow` fast-forwarded to local `main` `1db3efb`, which already
contains Snow (merge `eafdb99`) and the reconciliation onto production
`dfa7d69` (mission 531). Production runs the **standalone** Snow Day
(`cb85556`): no `/snow/api/*`, no shared days, no migration. In `main` the
shared days code is present but the "Plan it together" option was switched off
with `{false && …}` because the migration is not applied.

Doctrine read: §2.7 (START is a mode change), §6 (less phone, more life,
skiing example), §15.12 (group experiences), §14 (no sensing, no elaborate
social games). Hockey Night's patterns (pure domain, derived leaderboard,
plain-text recap, opt-in presence) and ADR 011 (Find my people) were reused.

### Feature inventory at the start

| Area                                                              | State                                                                                                      |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Mountain discovery (Atlas + 15 static areas, distance, skill)     | WORKING (Atlas never run against real Atlas from a lane; static URLs unverified)                           |
| Date, crew, levels, rentals, notes                                | WORKING                                                                                                    |
| Plan: 7 voted topics, lock-in, change notice, getting there, meet | WORKING                                                                                                    |
| Mountain conditions                                               | **PARTIAL**: nearest-city Environment Canada text, on request, on the mountains page only                  |
| Snow forecast, wind, temperature for the day                      | **MISSING**                                                                                                |
| Equipment reminders / per-person gear list                        | WORKING                                                                                                    |
| Group invitations, shared day on many phones                      | PARTIAL: built and tested, **hidden in `main`** (migration unapplied); one-phone share-by-link works       |
| Predictions, challenges, standings, awards                        | WORKING                                                                                                    |
| Photo challenges                                                  | PARTIAL: two photo challenges                                                                              |
| START YOUR SNOW DAY / a mountain mode                             | **MISSING**: an "On the hill" tab with small controls                                                      |
| Quick updates on a shared day                                     | **BROKEN**: used `announce`, which the core allows the host alone; a guest's tap was refused               |
| Location sharing                                                  | **MISSING** (check-in is words only, by design)                                                            |
| Lunch coordination                                                | PARTIAL: a voted "Meals" topic, nothing on the day                                                         |
| Après: suggest, vote, lock                                        | WORKING in Plan; **not reachable from the hill**                                                           |
| Departure coordination                                            | **MISSING**                                                                                                |
| Photos, moments, recap, plain-text share, go-again                | WORKING                                                                                                    |
| Offline (an open day keeps taking changes)                        | WORKING for a one-phone day; shared days need signal (no queue); no cold-start offline (no service worker) |
| Release                                                           | Standalone is live. Shared needs SQL + a code flip nobody owns.                                            |

## 2. What this mission built

### Before the mountain: conditions (verified, never invented)

- `domain/snow/conditions.ts`: validates an Open-Meteo model forecast for the
  **resort's own coordinates** (a chosen mountain, never a person's position)
  and turns it into plain sentences: sky, min/max, new snow, gusts, and what
  to bring. It **never says conditions are good**; a valley-point model cannot
  know, and says so on screen ("about 672 m, not a reading from the hill. Snow
  depth, open lifts and runs are the resort's to say") with the resort's own
  link beside it.
- `GET /snow/api/conditions?mountain=<id>`: 15-minute cache, 6 s timeout,
  `null` on any failure, 502/404 honestly. The test fixture is a **real
  recorded answer** for Whistler (2026-11-07).
- `ConditionsCard` is on Plan, Get ready and the hill. It keeps its last good
  answer on the phone and shows it **marked old** when the signal goes
  (tested: offline, "3 h ago"). Days beyond the forecast say so.
- Not included: snow depth, lift/run status, base conditions. There is no
  licensed feed; each remains `NOT CONNECTED` with the resort's link.

### On the mountain: START and a glove-sized companion

- **Start your snow day** (a 64 px button) is the first thing on the hill tab.
  It is a note on that phone, not a fact about the crew: one person starting
  never starts anyone else's day. Pressing it narrows Passport (doctrine
  §2.7): elapsed time, six big buttons (**I'm here · Lunch · Photo ·
  Challenges · Last run · Heading out**), the sky, and "Find your crew".
  Everything planned stays in the other tabs. All targets are ≥ 64 px tall
  (asserted in the e2e).
- **Quick updates fixed**: on a shared day they go to the chat (the core lets
  only the host announce); a one-phone day still posts a note.
- **Lunch**: pick a time, one tap tells the crew the place and time; the
  Meals vote is right there.

### Find your crew (opt-in, temporary, privacy-preserving) — shared days only

Follows ADR 011. **Needs one new table; see §4.** Rules, each enforced by
Postgres and proven on a real local stack (`location.stack.test.ts`):

| Rule                                                           | Enforced by                                          |
| -------------------------------------------------------------- | ---------------------------------------------------- |
| Nothing exists until a person taps 30 min / 1 h / 2 h / 4 h    | the page; the phone's own permission prompt          |
| Ends by itself; never more than 4 h                            | CHECK; expired rows unreadable, then purged          |
| Can't be lengthened quietly                                    | no UPDATE grant on `expires_at` (proven: 42501)      |
| Stop deletes the row; leaving erases it; "We're done" stops it | DELETE policy; member-gone trigger; the app          |
| Mutual: you see the crew only while you share, and they you    | read policy via `passport_snow_is_sharing`           |
| ~11 m, rounded by Postgres, not trusted to the phone           | guard trigger                                        |
| At most one update per 10 s                                    | guard trigger                                        |
| Strangers / other kinds of adventure / anon get nothing        | RLS (proven with a Hockey Night adventure)           |
| No account ids on the wire                                     | the core's random `member_id`                        |
| Updates only while the page is open                            | `watchPosition` lives in the page; no service worker |

If the table is absent every call answers 501 and the screen says "Location
sharing isn't switched on yet". Shared days work without it. Words-only
check-in remains for every day, including one-phone days (a one-phone day has
no one to share with).

### Competition and fun

- Three more **photo challenges** (frostiest face, something red, the view from
  the lift), each with a safety line, all passing the same deny-list as every
  other challenge (no speed, risk or rule-breaking words; a test enforces it).
- Three **funny awards** derived from what people did: DJ Chairlift (songs),
  Social Director (plan ideas), Chatterbox (chat). They need a crew of two
  or more. Everything stays optional (the challenges switch is unchanged) and
  nothing pays for risk.

### Après

From the hill, **Heading out** opens: a leave time (15 / 30 / 60 min, told to
the crew with "say if you need longer"), the Après vote (suggest restaurants,
vote, lock in: the Plan's own topic, not a copy), a reminder that whoever
drives stays alcohol-free, and **We're done for the day**. That turns the
screen into the recap (photos, standings, awards, highlights, share text)
and **Plan another snow day**.

### Release: shared days switch on when the SQL does

`NewDay` no longer has a `false &&` that someone must remember to edit. The
start page asks the database (`_server/readiness.ts`): a table that exists but
holds no grant for `anon` answers permission denied (42501), a missing one
answers PGRST205. "Plan it together, live" appears only when the former,
and anything unexpected counts as not ready. See §4.

## 3. Quality evidence

See §6 for commands and numbers. Mobile (390×844, touch), real recorded
forecast, group participation across two real accounts, persistence across a
reload and a fresh session, empty states (no forecast, no mountain chosen,
nobody else sharing, location off), errors (502, abort, denied permission),
slow/no connection (stale forecast marked old, offline start), glove targets.

## 4. Release: what unblocks production, exactly

Production database: `frllwwxesxbmmaadzfaf` (the app's `NEXT_PUBLIC_SUPABASE_URL`).
Forge's `passport-production` service points at `mbyigfvqqolmtszgzruy`, a
different project (mission 514, M521). **Therefore no Forge database SHIP can
land this**; the SQL is the owner's, pasted into the live project's SQL
editor. That is the blocker, and the only one that is not code.

### Release A — needs no SQL, can go first

Conditions, Start/companion, après, awards, challenges. Everything works
without a database change: the shared option stays hidden because the readiness
probe finds no Snow tables. `git fetch metatron:passport/main feature/snow`,
gate, push (fast-forward of `main`).

### Release B — shared days (+ find your crew), after SQL

In the live project's SQL editor, in this order. Never `supabase db push`.

1. Backup note (Dashboard → Database → Backups).
2. `docs/product/snow/shared-preflight.sql` → the four `core:` rows must be
   `true`. If row 4 (`notices, acks and moments present`) is `false`, apply
   `supabase/migrations/20261101000000_passport_adventure_together.sql`
   first; if any other `core:` row is `false`, **stop**.
3. `supabase/migrations/20261103000000_passport_snow.sql`. Idempotent. Re-run
   preflight: all 15 rows `true`.
4. **Optional, for Find your crew:** `docs/product/snow/location-migration.sql`
   (a proposal; the contracts lane moves it to
   `supabase/migrations/20261107000000_passport_snow_location.sql`). Then
   `location-preflight.sql`: 8 rows `true`. Rollback: `location-rollback.sql`.
   Skipping it costs only the Find your crew card.
5. No code change, no Vercel env change: the next page load of `/snow/new`
   offers "Plan it together, live" (within 15 s).
6. Acceptance: `docs/release/RELEASE-2026-11-02-POWDER-DAY.md` §6 (twelve
   steps on two real phones), plus: START on both, a guest's "Last run" lands
   in the chat, both tap Share, each sees the other, Stop empties both.

Rollback of B is SQL-only and the app degrades by itself: with the tables
dropped the probe says not ready and the option disappears; existing shared
day URLs show "Adventures can't be reached".

## 5. Not done, and why (named, not hidden)

- **Real resort data.** No snow depth, lifts, trails, prices: no licensed feed
  exists. Atlas ski areas are still not exercised against a real Atlas from
  this lane. The 15 static resort URLs are unverified.
- **Open-Meteo terms.** Free use is non-commercial; a commercial product needs
  their paid plan or another source. **Owner decision** before Release A is
  called done. The seam is one file (`_server/conditions.ts`) if the source
  changes. Attribution (CC BY 4.0) is on screen.
- **Offline for shared days** still has no write queue; a cold start offline
  still needs a service worker. Stale forecast + an open one-phone day work.
- **Location sharing on a one-phone day** is not possible (nobody to see it).
- **Doctrine tensions, unchanged:** §6's "who gets down fastest" is not built
  (mission forbids rewarding speed); §14's "elaborate social games" fence: the
  awards are derived titles, not a game system. Doctrine text is untouched.
- **Mission #627** works on the core adventure; this change reuses the core and
  touches none of its files (see the report's "Outside my lane").

## 6. Gates (this tree, Metatron, 2026-11-07)

| Gate                                                                          | Result                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npx tsc --noEmit`                                                            | clean                                                                                                                                                                                                  |
| `npx eslint .`                                                                | 0 errors, 42 warnings (none new in Snow files)                                                                                                                                                         |
| `npx prettier --check` (src, e2e, docs/product/snow)                          | clean                                                                                                                                                                                                  |
| `npx vitest run` with the local stack env                                     | 4,248 passed / 42 skipped (349 files), including both real-stack Snow tests (shared day, find your crew)                                                                                               |
| `npm run build`                                                               | ok; `/snow/api/conditions`, `/snow/api/[id]/location` and a dynamic `/snow/new` in the route table                                                                                                     |
| Snow e2e on the production build (`next start`, 390×844 touch)                | `snow.spec` 3/3, `snow-mountain.spec` 3/3 (start/companion/après/recap; no forecast; old forecast with no signal), `experiences-nav` 12/12                                                             |
| Two real accounts on the real local stack (`verification/`, production build) | `two-phones.spec` 1/1 (unchanged) and `hill.spec` 1/1: both start, a guest's "Last run" reaches the chat, share is mutual, Stop empties both, "We're done" ends a share, signed-out stranger refused   |
| Find your crew on real Postgres (`location.stack.test.ts`)                    | 2/2: opt-in, mutual, ~11 m, can't be lengthened (42501), can't write or stop another's, stranger and Hockey adventure refused, expiry hides and purges, Stop/leave delete, absent table → `Off`        |
| Location migration rehearsal                                                  | apply ×2 → preflight 8/8 → rollback → 2/8 (as expected) → re-apply 8/8; with it applied Snow's preflight stays 15/15; `location-rollback` then `shared-rollback` clean; the reverse order fails loudly |
| Readiness probe on the real stack                                             | option present with tables; **gone** 62 s after renaming `passport_snow_days`; back within 15 s of restoring it                                                                                        |

**Not run:** the whole-repo Playwright suite (its 12–17 recorded environmental
failures need a real Atlas, and it rewrites tracked Discovery PNGs); anything
on production; a real phone's GPS (the e2e sets a geolocation); the real
Open-Meteo from the e2e (mocked there, exercised by `curl` and the recorded
fixture).

## 7. Outside my lane

None of the shared contracts (`schemas.ts`, `domains/`, `supabase/migrations/`,
`layout.tsx`, `components/shell/`, `package.json`) were changed. Files outside
`src/{app,components,domain}/snow`, `docs/product/snow` and `e2e/snow*`:

- `docs/PASSPORT-PRODUCT-DOCTRINE.md`: one "Informed 2026-11-07" paragraph in §15.12.
- `docs/architecture/decisions/015-find-your-crew-on-a-snow-day.md` (new).

**Proposed for `passport-domain`:** move `docs/product/snow/location-migration.sql`
to `supabase/migrations/20261107000000_passport_snow_location.sql` (it
requires only the Snow migration, and the app works without it).

**Operator decisions** (not mine): Open-Meteo's commercial terms (§5); ADR 015
confirmation; the Forge database target (§4); whether to ship Release A first.
