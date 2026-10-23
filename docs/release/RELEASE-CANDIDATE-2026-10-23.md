# Release candidate — 2026-10-23 (Operation Ship It)

**Candidate:** `integration/release` @ `f9c97dd` plus this document (`ee30857` Hockey + `8a7a6b0` October on top of `d8a1c0a`).
**Status:** assembled and gated on Metatron. **Not pushed, not migrated, not deployed.**
No production access (Vercel, Supabase) exists from this checkout.

## What is in, what is out

| Work                  | Commit                 | In?     | Evidence                                                                                                                                                                                                                                |
| --------------------- | ---------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hockey Night final    | `ee30857`              | **in**  | fast-forward of `d8a1c0a` (= GitHub `main`); ancestry checked                                                                                                                                                                           |
| October               | `8a7a6b0`              | **in**  | merged with `--no-ff`, zero conflicts (branch base `6b2f560`, 168 commits behind; the one commit touches 3 October-only files)                                                                                                          |
| Atlas Vancouver       | `54a33fa`              | **out** | Lives in the live Atlas workspace (`~/atlas`, branch `lane/knowledge-ingestion-p0`), not in the reference clone. Release it through Atlas's own repository. Nothing from Atlas was copied here.                                         |
| Conference "together" | `a62c35d` (checkpoint) | **out** | Mission 427 is **still running** (uncommitted routes for chat / people / plans / memories / community, a Playwright run in flight at 13:00). Not complete, not tested: excluded. Durable Conference + Arrivals already in the baseline. |

Hockey Arena (`9f6d600`) and Seats were already ancestors of the baseline.

## Gates on the candidate

| Gate                                                                                            | Result                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                                                                              | clean                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `npx eslint .`                                                                                  | 0 errors, 79 warnings                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `npx prettier --check .`                                                                        | clean                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `npx vitest run`                                                                                | 3649 passed, 30 skipped                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `npm run build`                                                                                 | ok                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `npx playwright test` (`next start` built with placeholder Supabase env, critic Atlas stand-in) | 249 passed, 5 failed, 5 skipped. 4 are the recorded environmental baseline (core-loop:26, october:554/570, conference-mobile:23). The 5th, discovery-natural:102 ("this weekend" → expects "Saturday", got "tomorrow"), depends on today being Friday; the diff touches no Discovery code. Hockey browser suites need the real local Supabase stack and were not re-run here; they were green on `ee30857` per `FINAL-VERIFICATION.md`. |

## Database: exact execution order

Project `frllwwxesxbmmaadzfaf` (shared with Atlas). **SQL editor only — never `supabase db push`.**
Production has no default grants; every file below states its own.
**Apply before deploying.** All are additive/idempotent; Hockey files are create-if-missing.

0. **Read-only diagnostic:** `docs/release/PRODUCTION-DATABASE-READINESS.md` §4. Save the CSV. It tells you which steps below are already done (skip those whose rows are `PASS`).
1. `supabase/migrations/20260927000000_passport_baseline.sql` (if absent), then `docs/product/group-adventures/boards-owner-claim-fix.sql` (the `ca20324` version).
2. `20261012000000_passport_conferences.sql` → `20261014000000_passport_conference_arrivals.sql` → `20261016000000_passport_conference_grants.sql`. (Arrivals is switched on in production and its table was found missing on 2026-10-21.)
3. `20261021000000_passport_adventures.sql`.
4. Hockey, in this order, each preceded by its `*-preflight.sql` and followed by its verify:
   1. `docs/product/hockey/preflight.sql` → `migration.sql` → `verify.sql` (9 rows, all OK). Then run `verification/grants-check.sql`; if any row is not OK, run `fix-grants.sql`.
   2. `seats-preflight.sql` → `seats-migration.sql`
   3. `arena-preflight.sql` → `arena-migration.sql`
   4. `memories-preflight.sql` → `memories-migration.sql`
   5. `chirp-preflight.sql` → `chirp-migration.sql` (adds `nhl_team`, the `chirp` moment kind)
5. Re-run step 0. Every row `PASS` (known `REVIEW`s: `passport_board_interest`, `page_compositions`).

Dependencies: 2 needs 1 (conferences) and Arrivals needs 2a; grants need both. Every Hockey file requires `migration.sql` first; seats, arena, memories and chirp are independent of each other. Features whose migration is missing degrade rather than crash (Memories, Chirp and Seats are optional; per `FINISH.md` / `CHIRP-ROOM.md`).

**Rollbacks:** Hockey: `rollback.sql`, `seats-rollback.sql`, `arena-rollback.sql`, `memories-rollback.sql`, `chirp-rollback.sql`, soft switch `disable.sql`/`enable.sql`. Boards: `docs/release/board-ownership-repair/rollback.sql`. Adventures: see `docs/product/group-adventures/RELEASE.md` (drop; no data yet). Conference: see each migration header.

## Vercel

Production is a **CLI deploy** (`npx vercel deploy --prod`) of project `elk-passport`; its Git link has been reported as absent, so a push alone deploys nothing. This checkout has no `.vercel/` link and Vercel commands are denied here by design. Env to verify before building (inlined at build): `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` are the same project as the migrations; `ATLAS_API_URL=https://elk-atlas.vercel.app` (no `/api`); `CONFERENCE_STORE=supabase`, `CONFERENCE_ARRIVALS=on`; `OPENAI_API_KEY` present (Chirp Bot line writer); `ADMIN` env per `admin-security-integrated`.

## Mac commands

```bash
git fetch metatron:passport/main integration/release   # a person fetches; pushing is disabled in this clone
git checkout integration/release && git log -1          # expect the release-candidate commit
npm install --no-audit --no-fund && git checkout -- package-lock.json
npx tsc --noEmit && npx eslint . && npx prettier --check . && npx vitest run && npm run build
# --- run the SQL steps above in the Supabase SQL editor, then step 5 ---
npx vercel deploy --prod
```
