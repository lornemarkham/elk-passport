# Release record 2026-11-12: CourtQueue (`/badminton`)

Owner brief: _P0: Build CourtQueue_ — a working app by Thursday 2026-11-12,
before evening badminton. Product: `docs/product/badminton/README.md`. ADR 017.
Candidate: local `main` on Metatron, the commit that adds this file (code: `9841c26`). **Not
pushed and not deployed from the mission**: this checkout cannot push or
deploy (`CLAUDE.local.md`). Passport is BETA in Forge's policy (M664), so the
release runner picks up local `main` once no Passport mission is running.

## What ships

- Routes: `/badminton` (the app), `/badminton/manifest.webmanifest`,
  `/badminton/app-icon/{180,192,512}`, `/badminton/sw.js` (static),
  `/api/badminton/{live,act,me,stats,photo,photo/[id]}`.
- Code: `src/lib/courtqueue/`, `src/app/badminton/`, `src/app/api/badminton/`.
  Nothing else in Passport changed: no shared contract, no middleware, no shell,
  no package change.
- Migration: `supabase/migrations/20261110000000_passport_courtqueue.sql` —
  additive; new tables `passport_courtqueue_docs`, `passport_courtqueue_keys`
  (RLS on, no policies, no grants) and functions `passport_courtqueue_check`,
  `_claim`, `_get`, `_put`. No transaction control. No destructive statement
  anywhere in the file (the runner scans every added line).

## Production needs, in order

1. **The migration applied** to the Passport database (`frllwwxesxbmmaadzfaf`).
   It is independent of the four pending files in
   `RELEASE-2026-11-09-GHAD-SNOW-MIGRATIONS.md` and may be applied before,
   after or alone. Runner, or SQL editor: paste the file as it is.
2. **No new environment variable is required.** The server's key defaults to
   an HMAC of `ATLAS_SERVICE_TOKEN` (ADR 017). Optional:
   - `COURTQUEUE_ORGANIZER_CODE` (6+ characters): lets someone become organizer
     with a code. Without it, the organizer is whoever signs in to Passport as
     an administrator (`ADMIN_EMAILS`) and taps _I'm signed in to Passport as an
     administrator_ under **Me → Organizer?**. Organizers then make others
     organizers from their phone.
   - `COURTQUEUE_STORE_KEY` (24+ characters) to use a dedicated key instead.
3. **Deploy** the candidate.

Without step 1 the page says "CourtQueue isn't switched on yet" and names
what is missing (the API answers 503 `not-ready`). It never falls back to
memory in production.

## Check production (Thursday, before people arrive)

1. Open `https://gohaveaday.com/badminton` (or `https://elk-passport.vercel.app/badminton`)
   on a phone. The welcome screen says **CourtQueue — Everybody Plays**.
2. Register yourself; under **Me → Organizer?** become organizer.
3. **Tonight** shows Thursday's session (created automatically). Tap
   **I'M HERE**, **PLAY**. A second phone registers and plays; with four
   players a court is called on all four phones.
4. START, FINISH with a score, confirm from another phone. Organize → Games
   shows the times.
5. Optional: `node scripts/courtqueue/rehearse.mjs https://<host> 6` with
   `COURTQUEUE_ORGANIZER_CODE` set creates 26 rehearsal players — **only on a
   database you will reset** (below); it is meant for a local or preview copy.

## Measured on Metatron (this mission)

- Unit: 25 CourtQueue tests (engine, fairness, three seeded 24-player
  simulated nights, store selection) + 3 against real Postgres/PostgREST with
  the anon key (`store.stack.test.ts`, local stack, migration applied twice).
- `e2e/badminton.spec.ts` 2/2 on a production build, both on the memory
  store and on the real local Postgres store.
- Rehearsal over HTTP against the Postgres-backed production build: 26
  simultaneous sign-ups, 24 simultaneous PLAYs (3 courts called, 12 waiting),
  24 games with paired simultaneous START/FINISH taps, 24 phones polling every
  2 s: 757 requests, 0 server errors, 0 invariant breaks, p50 2 ms, p95 208 ms.
- **Not measured:** the production database, Vercel's functions, real iPhones
  (an iPhone viewport and user agent in Chromium only), push notifications.

## Resetting and rolling back (SQL editor; take a recovery point first)

Reset the recorded server key (if "a different CourtQueue key" ever shows):

```
delete from public.passport_courtqueue_keys;
```

Wipe CourtQueue's data (players, nights) and start over:

```
delete from public.passport_courtqueue_docs;
```

Roll back the migration entirely:

```
drop function if exists public.passport_courtqueue_get(text, text[]);
drop function if exists public.passport_courtqueue_put(text, text, bigint, jsonb);
drop function if exists public.passport_courtqueue_claim(text);
drop function if exists public.passport_courtqueue_check(text);
drop table if exists public.passport_courtqueue_docs;
drop table if exists public.passport_courtqueue_keys;
```

Code rollback: revert the CourtQueue commits; nothing else depends on them.
