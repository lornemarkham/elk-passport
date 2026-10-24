# Release 2026-10-24 — Hockey Night (Plan + Crew) and Passport Vancouver

**Candidate:** local `main` on Metatron, the commit that adds this file
(parent `1e6a46c`). **Not pushed, not deployed, no database change made
from here.** Pushing is disabled in this clone on purpose
(`CLAUDE.local.md`), so the push and the SQL editor are the owner's steps
(§6).

## 1. The truth at the start (measured)

| What                     | Value                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| GitHub `main`            | `571fdb6` (Sycle Summit), fetched                                                            |
| Vercel production        | `dpl_F9ziAprocTr573ti95TQPU3SxShk`, READY, built from GitHub `main` `571fdb6` (gitSource)    |
| Candidate vs GitHub main | 27 commits + this one ahead; `origin/main` is an ancestor, so **the push is a fast-forward** |

## 2. What is in (by ancestry, not by cherry-pick)

| Work                                         | Commit                | Entered as                                    |
| -------------------------------------------- | --------------------- | --------------------------------------------- |
| Sycle Summit (production today)              | `571fdb6`             | `e922401` merge (one conflict, discover page) |
| Conference mobile first                      | `aa0090b`             | in `571fdb6` and `afe51ab`                    |
| Hockey Mayhem, predictions, Sycle Cup, Arena | `36dba1d` and earlier | already in GitHub main                        |
| Saved + Adventures (ADR 012)                 | `813d0cb`             | `476e62d`                                     |
| Discovery speed                              | `c24cb2a`             | `2ca7070`                                     |
| Vancouver launch                             | `d3a25fe`             | first-parent history                          |
| Hockey Bet button fix                        | `d80009b`             | `9f0b88f` (via `0e79fcf`)                     |
| Hockey Pregame Plan                          | `47f698d`             | `bb03e31` (via `b166288`)                     |
| Hockey Crew                                  | `b166288`             | `bb03e31`                                     |
| Earlier candidates                           | `374746b`, `e922401`  | first-parent history                          |

Every local branch tip was checked with `git rev-list main..<branch>`: none
holds a commit main lacks, except `release/october` `dcd5102` (its change is
already in main) and `feature/experience-theme-isolation` `17ae892` (ADR 004,
never approved). Lane working trees hold only screenshots and a scratch id
file, with no uncommitted feature work.

**Summit preserved:** from `571fdb6` to this candidate, `src/app/conferences`,
`src/components/conference` and `src/lib/conference*` change in one file,
`conferences/[id]/discover/page.tsx` (+13/−1: Vancouver's "Ask Go Have A
Day" doors, re-added by the `e922401` resolution). `modules.ts` only gains
lines.

## 3. Gates (Metatron, this tree)

| Gate                                                                                                                                                                       | Result                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                                                                                                                                                         | clean                                                                                                                                                                                                                               |
| `npx eslint .`                                                                                                                                                             | 0 errors, 80 warnings                                                                                                                                                                                                               |
| `npx prettier --check .`                                                                                                                                                   | clean                                                                                                                                                                                                                               |
| `npx vitest run`                                                                                                                                                           | **3876 passed**, 38 skipped                                                                                                                                                                                                         |
| `npm run build`                                                                                                                                                            | ok                                                                                                                                                                                                                                  |
| `npx playwright test` (`next start`, critic Atlas mock, `E2E_ATLAS=1`)                                                                                                     | 246 passed, 8 failed, 8 skipped. **Baseline (5):** conference-mobile:23, core-loop:26, discovery-natural:102, october:554/570. **Load flakes (3):** go-intent:138, go-release:110/216; both files are 28/28 green when re-run alone |
| Vancouver visitor (phone, real GoTrue/RLS, production corpus)                                                                                                              | 1/1                                                                                                                                                                                                                                 |
| Adventures (acceptance, journey, extraordinary) + Atlas-down                                                                                                               | 12 passed, 1 skipped; 1/1                                                                                                                                                                                                           |
| Conference `together.spec` (5 accounts, five tabs at 320/375/390)                                                                                                          | 1/1                                                                                                                                                                                                                                 |
| Conference attacks                                                                                                                                                         | together 76/76, rls 68/68, arrivals 33/33                                                                                                                                                                                           |
| Sycle Summit real-accounts spec                                                                                                                                            | 1/1                                                                                                                                                                                                                                 |
| Hockey specs (alive, arena-mode, chirp, crew, finish, finish-play, mayhem, multi-night, plan-and-results, polish, redesign, restaurant-photos, seats, acceptance, modules) | all pass (modules: one flake, green on rerun)                                                                                                                                                                                       |
| Hockey bet-button / plan-pregame                                                                                                                                           | 8/8 / 12/12                                                                                                                                                                                                                         |
| Hockey deploy-before-migration (mayhem-off, finish-off, crew-off)                                                                                                          | pass                                                                                                                                                                                                                                |
| Hockey chirp-ai-live (local Ollama qwen3:8b)                                                                                                                               | pass                                                                                                                                                                                                                                |
| Hockey attacks                                                                                                                                                             | rls, mayhem all pass; seats 35/35; arena 78/78; crew 93/93                                                                                                                                                                          |
| `grants-check.sql`                                                                                                                                                         | 4/4 OK; all 24 `passport_occasion%` tables have RLS on                                                                                                                                                                              |
| Owner path on a production-shaped stack                                                                                                                                    | PREFLIGHT read NOT APPLIED → each `*-preflight.sql` all OK → migrations → PREFLIGHT read APPLIED, `issue_challenge` overloads = 1                                                                                                   |

Phones (320, 375, 390): three Pregame venue cards fully on screen, vote
persists on reload, winner becomes the meeting point, host override (guest
refused in UI and 403 from the API), after-game voting, Bet sends and a
second account confirms, predictions and Sycle Cup, crew check-ins, Find My
Drunk Friend consent and stop sharing, Summon the Squad, Snack runs, and a
night created before Plan (no `pregame-plans` row) still works. No sideways
scroll at 320.

Known spec nits (not product defects): `plan-pregame.spec.ts:148`
hard-codes PG port 54329; `mobile.spec.ts:31-37` counts the visually hidden
photo input as a tap target (intermittent at 375/390);
`scripts/conference-stack/acceptance.spec.ts` still looks for "Your name
here" on Home (it moved to `/you` in `0f67d0d`, already in production).

Not run: Hockey `email-confirmation` (no auth change), `alive-off` /
`chirp-off` / `arena-off` (production already has those migrations),
`mayhem-ai` (model run).

## 4. Database (production `frllwwxesxbmmaadzfaf`)

Measured from here with the **public anon key, existence only** (42501 =
table exists but anon has no grant; PGRST205 = no such table; a misspelt RPC
name's "Perhaps you meant …" hint = the function exists). Policy counts,
overload counts and the Plan data rows cannot be seen this way, so
**`PREFLIGHT-2026-10-26.sql` in the SQL editor is still the authority.**

| Migration           | File                                                                    | Probe result                                                                                                                               | Expected PREFLIGHT row               |
| ------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| Hockey Memories     | `docs/product/hockey/memories-migration.sql`                            | `passport_occasion_photos` exists                                                                                                          | APPLIED                              |
| Hockey Mayhem       | `docs/product/hockey/mayhem-migration.sql`                              | 3 tables, `passport_issue_challenge`, `passport_occasion_mission_ledger` exist                                                             | APPLIED (check overloads = 1)        |
| Arena prerequisites | `docs/product/hockey/arena-migration.sql`                               | `passport_occasion_checkins`, `passport_arena_open`, `passport_arena_purge`, `passport_occasion_role`, `passport_is_occasion_member` exist | (Crew row is not BLOCKED)            |
| Hockey Plan         | `docs/product/hockey/plan-migration.sql` (data only)                    | `passport_occasion_prompts` exists; rows unreadable to anon                                                                                | **unknown** — likely NOT APPLIED     |
| Hockey Crew         | `docs/product/hockey/crew-migration.sql`                                | none of the 5 tables, neither function                                                                                                     | **NOT APPLIED**                      |
| Adventure origin    | `supabase/migrations/20261023100000_passport_adventure_item_origin.sql` | column `origin` does not exist (42703)                                                                                                     | **NOT APPLIED**                      |
| Conference Together | `supabase/migrations/20261023000000_passport_conference_together.sql`   | tables exist                                                                                                                               | APPLIED (if 11/37/0); flag stays off |

Order for what is left (each additive and idempotent): Plan (needs only
`migration.sql`), Crew (needs Arena), Adventure origin (independent). The
code is safe to deploy before any of them: the Plan question is left out,
Crew sections are absent (`crew-off.spec`), and the Adventures store falls
back on 42703/PGRST204. Hockey Crew is **not live until `crew-migration.sql`
is applied**.

**Do not set `CONFERENCE_TOGETHER`.** Its tables exist, but the security
check against the real project (`together-attack.mjs` against production)
has not been run, and the flag is an owner decision.

## 5. Production deployment status

Not deployed. Production is `571fdb6`. Nothing is LIVE from this candidate
until the owner pushes, Vercel reports this SHA, and §7 passes.

## 6. Owner steps (Mac), in order

See the mission report for the exact commands. The order: SQL preflight,
then the migrations, then the preflight again, then the fast-forward push,
then the Vercel SHA check, then smoke tests.

## 7. Production smoke (signed in, two real accounts, phones)

1. Hockey, existing night: predictions, Sycle Cup, Bet → second phone
   accepts; Memories photo; Chirp.
2. Hockey, Plan: three Pregame cards, vote, reload, the vote is still there,
   winner is the meeting point, host override, after-game vote.
3. Hockey, Crew (after crew SQL): check in, Find My Drunk Friend → consent →
   stop sharing, Summon the Squad, Snack run.
4. Vancouver: `/` with JW Marriott Parq: "Great coffee near my hotel",
   "bars in Yaletown", open a venue (title "… — Go Have A Day").
5. Saved → Create an adventure → invite second account → sign out/in, still
   there.
6. Conference Sycle Summit on a phone: five tabs, 26–29 October, the agenda,
   a signed-out visitor gets a 404. Plans/Chat still "isn't open yet".

## 8. Rollback

- **Code:** Vercel → elk-passport → Deployments → promote
  `dpl_F9ziAprocTr573ti95TQPU3SxShk` (`571fdb6`, Summit). No git change
  needed. To make GitHub agree afterwards, run `git revert -m 1 <merge>` and
  push. **No force-push.**
- **Database:** leave applied migrations in place; `571fdb6` runs with them.
  If needed: `plan-rollback.sql`, `crew-rollback.sql` (it refuses while rows
  exist), and the origin file's header reversal.
