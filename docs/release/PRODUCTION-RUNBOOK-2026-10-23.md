# Production runbook — Hockey + October + Conference Together (2026-10-23)

**Candidate:** `integration/release` — the merge commit named in §1 (Conference Together `3de2b72` merged `--no-ff` onto RC `743e171`).
**Status:** assembled and gated on Metatron. **Not pushed, not migrated, not deployed.**
Production access (Vercel, Supabase) does not exist from this checkout and was not attempted. Everything under "Owner steps" is for Lorne.

## 1. What is in

| Work                        | Commit    | Ancestor of candidate? | Notes                                                                                                                 |
| --------------------------- | --------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Hockey Night final          | `ee30857` | yes                    | unchanged from RC                                                                                                     |
| October                     | `8a7a6b0` | yes                    | unchanged from RC                                                                                                     |
| Conference Together         | `3de2b72` | yes                    | merged with **zero conflicts**; base `d8a1c0a` (same base as Hockey); 85 files, all Conference-owned plus doc/ADR 011 |
| Previous RC (preserved)     | `743e171` | yes                    | tag `rc-2026-10-23-pre-conference` points at it; roll the release back by resetting nothing, just deploy that tag     |
| Atlas Vancouver (`54a33fa`) | —         | **out**                | Atlas repository's own release. Not touched.                                                                          |

Not used: `release/october` (unsafe). No `.env*`, key, or token-shaped file is in the merge diff (checked by filename and by content pattern).

## 2. Gates on the candidate (Metatron)

| Gate                     | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`       | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `npx eslint .`           | 0 errors, 79 warnings (same count as RC)                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `npx prettier --check .` | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `npx vitest run`         | 3671 passed, 30 skipped (RC: 3649 — +22 are Together)                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `npm run build`          | ok (placeholder Supabase env)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `npx playwright test`    | 248 passed, 6 failed, 5 skipped (`next start` build, critic Atlas stand-in, placeholder Supabase). 4 are the recorded environmental baseline (core-loop:26, october:554/570, conference-mobile:23); discovery-natural:102 depends on today being Friday (same as RC); `october-door:260` (Witching Hour "Surprise me") failed under 10-worker load and **passed 10/10 when re-run alone** — it touches no Conference file. `conference.spec`, `conference-arrivals.spec` and the Hockey/October suites otherwise pass. |

**Not run here, and why:** `scripts/conference-stack/together.spec.ts` (five real accounts), `together-attack.mjs` and `rls-attack.mjs` need the real local Supabase stack (GoTrue + PostgREST + embedded Postgres). The Conference lane reports them green on its own stack (see `TOGETHER.md` §5); they were not re-run in this integration. The migration SQL was therefore **not** executed here.

## 3. Database: exact order

Project `frllwwxesxbmmaadzfaf` (shared with Atlas). **SQL editor only — never `supabase db push`.** Production has no default grants; each file states its own. **Apply before deploying.** All additive and idempotent.

0. Read-only diagnostic: `docs/release/PRODUCTION-DATABASE-READINESS.md` §4. Save the CSV; skip steps whose rows are `PASS`. (It does not know the Together tables — check step 6 by hand.)
1. `20260927000000_passport_baseline.sql` (if absent), then `docs/product/group-adventures/boards-owner-claim-fix.sql`.
2. `20261012000000_passport_conferences.sql` → `20261014000000_passport_conference_arrivals.sql` → `20261016000000_passport_conference_grants.sql`.
   _Arrivals' table was missing in production on 2026-10-21 and Together hard-depends on 2a and 2c._
3. `20261021000000_passport_adventures.sql`.
4. Hockey, each `*-preflight.sql` → migration → verify, in this order: `preflight.sql`/`migration.sql`/`verify.sql` (9 rows OK; then `verification/grants-check.sql`, `fix-grants.sql` if any not OK) → seats → arena → memories → chirp. All under `docs/product/hockey/`.
5. _(October: no migration.)_
6. **Conference Together:** `supabase/migrations/20261023000000_passport_conference_together.sql`.
   - Needs 2a (`passport_conferences`, `passport_conference_members`) and 2c grants. It does **not** reference Arrivals tables, and no storage bucket (photos are in a table).
   - Before: `select count(*) from pg_tables where tablename like 'passport_conference_%'` — expect ≥ 4 (6 once Arrivals is applied; you need Arrivals anyway, as it is switched on).
   - Pasting the file twice is safe (guarded).
   - After: tables `+11`, `select count(*) from pg_policies where tablename like 'passport_conference_%'` rises by **37** (to 48 against the earlier conference migrations).
7. Re-run step 0.

Rollbacks: Hockey `*-rollback.sql`, boards `docs/release/board-ownership-repair/rollback.sql`, Adventures per `docs/product/group-adventures/RELEASE.md`. **Together:** unset `CONFERENCE_TOGETHER` (code stops reading the tables immediately), then drop children-first if wanted; Conferences/Arrivals unaffected.

## 4. Production environment (Vercel project `elk-passport`)

Inlined at build or read at runtime — **a change only takes effect on the next deploy.**

| Variable                                                    | Value / rule                                                                                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the **same** project as the migrations (`frllwwxesxbmmaadzfaf`)                                                                                                    |
| `ATLAS_API_URL`                                             | `https://elk-atlas.vercel.app` (no `/api`)                                                                                                                         |
| `CONFERENCE_STORE`                                          | `supabase`                                                                                                                                                         |
| `CONFERENCE_ARRIVALS`                                       | `on` (already on)                                                                                                                                                  |
| **`CONFERENCE_TOGETHER`**                                   | **`on` — set only after step 6 is verified.** Absent/other = the four modules say "isn't open yet" and touch no table. Only read when `CONFERENCE_STORE=supabase`. |
| `OPENAI_API_KEY`                                            | present (Chirp Bot line writer)                                                                                                                                    |
| `ADMIN_EMAILS` / admin gate                                 | per `admin-security-integrated` (unset `NEXT_PUBLIC_ADMIN_EMAILS`)                                                                                                 |
| `ADSB_FALLBACK`                                             | must stay **off** (adsb.fi is non-commercial)                                                                                                                      |

The flag is safe to ship dark: deploy first with `CONFERENCE_TOGETHER` unset if you would rather split "code live" from "feature open". Existing conferences keep their stored module list; an organiser ticks Plans, Chat, Find my people and Memories in _Organiser settings_.

## 5. Authorized deployment steps (Lorne, on the Mac)

```bash
git fetch metatron:passport/main integration/release          # pushing is disabled on Metatron
git checkout integration/release && git log -1                # expect the merge commit of §1
npm install --no-audit --no-fund && git checkout -- package-lock.json
npx tsc --noEmit && npx eslint . && npx prettier --check . && npx vitest run && npm run build
# 1. Supabase SQL editor: §3 steps 0–7, in order.        (STOP if any step errors)
# 2. Vercel env: §4. Leave CONFERENCE_TOGETHER unset until the migration has been verified.
npx vercel deploy --prod                                      # CLI deploy; pushing alone deploys nothing
# 3. Set CONFERENCE_TOGETHER=on, redeploy (env needs a new build).
```

## 6. Production smoke checklist

Against `https://www.iamoctober.com`.

Core (`docs/RELEASE.md` §3): root opens Discover; Atlas rows present; search `pumpkin` multi-source; open a result and back; sign in → choose → Choices → sign out; password reset lands on `www.iamoctober.com/auth/callback`.

October: `/october` loads; Witching Hour readout does not run under "leave"; a pasted October link previews as October.

Hockey: create a night, add a guest, vote; Plan/Explore/Arena open; a place on the dinner vote keeps its photo.

Conference Together (two real accounts, one hidden member, one stranger):

1. Organiser: create a conference, tick Plans / Chat / Find my people / Memories.
2. Phone account joins: home answers who's here and what's on.
3. Recurring plan → per-day RSVP; invite-only lunch with a place vote.
4. Chat: post, react; a private plan thread is invisible to the stranger.
5. Find my people: share, appear to others, stop → disappears.
6. Memories: upload, react, delete.
7. Stranger gets 404 on every `/conferences/[id]/…` route.
8. With `CONFERENCE_TOGETHER` unset the modules say "isn't open yet" (check **before** flipping the flag).
9. `npx vercel logs <deployment> --json | grep october-error` — nothing new.

## 7. Where the release stops

Everything that can be done without production access is done. The remaining gate is: Supabase SQL editor (§3), Vercel env + `vercel deploy --prod` (§4–5), and a signed-in smoke test (§6). All three need Lorne.
