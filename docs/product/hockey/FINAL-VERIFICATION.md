# Hockey Night — final feature verification (2026-10-23)

**Asked:** verify the whole of Hockey Night on release candidate `d8a1c0a`
(`integration/release`), fix defects found, no redesign, no deploy.

**Where:** `feature/hockey`. `d8a1c0a` was merged in first (merge `77defbd`,
tree identical to `d8a1c0a`), because the RC carried one commit the lane did
not have (`4261119`, the dinner-vote photo rules). `integration/release` was
not touched.

**Result:** every Hockey spec passes on today's production Atlas data. One
defect was found and fixed: a restaurant already on the vote lost its photo
when Atlas changed. Two things can only be checked live: the OpenAI line
writer and the NHL feed during a game in progress (§5).

---

## 1. Atlas data: today's, not a snapshot

The earlier "real" stand-in body was `atlas-real.json` from 2026-10-21. Since
then production's corpus changed a lot: 1,869 candidates are new and 513 have
gone. Today's was read from production's public `/go` page with no
credentials using the new
[`verification/prod-corpus.mjs`](verification/prod-corpus.mjs). That gave
4,384 candidates, 3,859 of them with a `presentationImage`. It was served by
`atlas-seats-stub.mjs` for every run below except `acceptance` (which needs
its synthetic stub).

- `prod-nearby-check.mjs`: Rogers Arena present (0.01 km). 719 Eat & drink
  within 1.6 km.
- **What the night offers today** (Hockey's own `nearbyWithCurated`, run on
  that body): 24 places, **all 24 with an `exact` or `organization`
  photograph** from the place's own site. Every non-group place was excluded
  as `pregame.ts` intends: arena lounges, coffee counters, places closed on
  game day and duplicates.

## 2. Restaurant photographs and broken image URLs

| Check                                                                                    | Result                                                                                                                  |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Every offered image URL fetched directly, with no Referer and with Passport's as Referer | **24/24 HTTP 200**, real image types (jpeg/png/webp/avif), 97 KB–3.5 MB. None depends on the Referer                    |
| `restaurant-photos.spec.ts`, phone 390 and desktop 1280, in Chromium                     | **24/24 cards draw a photo** (smallest 598×630). None fell back to "No photo". Nothing refused is offered. Voting works |
| `http://` URLs                                                                           | none on a card (`secureUrl`)                                                                                            |

**Defect found and fixed: a place on the ballot lost its photograph.** A
ballot card finds its picture and walk by matching its name against the
_current_ 24-place window (`placeFor` in `PlanTab.tsx`). Atlas changes, and
since `4261119` the window fills with photographed places first. So a place
nominated earlier can drop out of the window. Its card then shows no photo
and no walk time, and if it leads the vote the plan card's photo goes too.
Reproduced on the RC build with L'Abattoir, a photographed restaurant 0.68 km
away and just outside today's window:
`{"photo":"none","loaded":false,"walk":false}`.
**Fix:** `keepOnBallot` (`src/domain/hockey/nearby.ts`). `/nearby` now also
returns every place still near the arena whose name is on the dinner ballot.
The window itself is unchanged. On the fixed build the same check gives
`{"photo":"exact","loaded":true,"walk":true}`. Unit tests are in
`nearby.test.ts`. The scratch driver was a one-off and is not committed.

## 3. Live NHL against the real league API

Hockey's own `findScheduled`/`readGame`/`suggestedCalls`, run against
`api-web.nhle.com` today:

- **Sunday's game matches**: `2026020184`, MIN @ VAN, `2026-10-26T02:00Z`,
  `scheduled`, broadcast SN.
- **This week's real finals read correctly**: 22 Oct DET 5–2 VAN and 20 Oct
  CAR 6–3 VAN, with goals in order, "ended in regulation", the first scorer,
  and total goals.

The in-progress shape (period, clock, intermission) is still covered only by
unit tests. No Canucks game was on while testing.

## 4. Migrations, rehearsed locally

All five were run in order in a throwaway database on the local stack's
Postgres: `migration` → `memories` → `seats` → `arena` → `chirp`. Each one:
preflight, apply, apply again, re-run the preflight.

| Check                                                             | Result                                                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Each preflight before applying                                    | all rows OK                                                                     |
| Applied twice                                                     | no change, every one (final: 16 tables, RLS on 16/16, 47 policies, 124 columns) |
| `verify.sql` after `migration.sql`                                | 10/10 OK                                                                        |
| Preflights once applied                                           | say STOP / REVIEW, as designed                                                  |
| `verification/grants-check.sql`                                   | all OK                                                                          |
| Rollbacks in reverse (chirp → arena → seats → memories)           | each returns exactly the previous counts                                        |
| Preflights after rollback, then re-apply                          | all OK; same schema as the first full apply                                     |
| `rls-attack.mjs` (real users over PostgREST) / `arena-attack.mjs` | all checks passed / 78/78                                                       |

**What production needs.** No database credentials were used, so production's
state could not be read. Per the earlier Hockey reports, `migration.sql` is
applied and these four are not:

1. `memories-migration.sql` (Memories album; absent → the section is hidden)
2. `seats-migration.sql` (Our seats)
3. `arena-migration.sql` (Arena Mode check-ins, pings, quests; needs seats)
4. `chirp-migration.sql` (teams + Chirp Bot)

Run each preflight first, in the SQL editor, by a person. Each has a rollback.
Without them the night works and the features stay out of sight. That was
proven by `chirp-off`, `finish-off` and `arena-off`. Afterwards,
`passport-domain` should land them in `supabase/migrations/`.

## 5. Feature checklist

All runs: real GoTrue sign-ups, PostgREST under RLS, Chromium, today's Atlas
data, fixed build.

| #   | Feature                          | Evidence                                                                     | Verdict                                                                                                                                  |
| --- | -------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Invitations and joining          | acceptance, email-confirmation ×2, finish, multi-night, rls-attack           | working                                                                                                                                  |
| 2   | Restaurant recommendations, vote | restaurant-photos ×2, redesign, polish, release1, release2, plan-and-results | working                                                                                                                                  |
| 3   | Restaurant photographs           | §2                                                                           | working; ballot defect fixed                                                                                                             |
| 4   | Meeting points and directions    | seats, release2                                                              | working. The four meeting spots have no Atlas photo, so they show the designed no-photo card                                             |
| 5   | Predictions and leaderboard      | redesign, plan-and-results, finish, finish-play                              | working                                                                                                                                  |
| 6   | Secret missions and forfeits     | finish-play                                                                  | working                                                                                                                                  |
| 7   | Sycle Cup                        | finish-play, multi-night                                                     | working                                                                                                                                  |
| 8   | NHL team allegiance              | chirp, chirp-off                                                             | working                                                                                                                                  |
| 9   | Chirp Room and AI commentator    | chirp, chirp-off                                                             | library path working. **Model path never run against OpenAI** (no key here); someone with the key should read real output before release |
| 10  | Live NHL scoreboard              | finish (recorded real final), §3 real API, finish-off (league down)          | working; in-progress shape unit-tested only                                                                                              |
| 11  | Arena Mode                       | arena-mode, arena-off, arena-attack                                          | working                                                                                                                                  |
| 12  | Memories photo album             | finish, finish-off                                                           | working (needs its migration)                                                                                                            |
| 13  | Shareable recap                  | finish                                                                       | working                                                                                                                                  |
| 14  | Run It Back                      | finish, multi-night                                                          | working                                                                                                                                  |

## 6. Test results

| Gate                                                                                                                                                                                            | Result                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Hockey e2e, full stack (17 tests: arena-mode, chirp, finish, finish-play, mobile ×3, modules, multi-night, plan-and-results, polish, redesign, release1, release2, restaurant-photos ×2, seats) | **17/17** on the RC, **17/17** fixed |
| acceptance (synthetic `atlas-stub`)                                                                                                                                                             | 1/1                                  |
| chirp-off (`HOCKEY_CHIRP=0`), finish-off (`HOCKEY_MEMORIES=0`, NHL down), arena-off (`HOCKEY_ARENA=0`)                                                                                          | 3/3                                  |
| email-confirmation (`CONFIRM_EMAIL=1`, SMTP sink)                                                                                                                                               | 2/2                                  |
| `vitest` (repo)                                                                                                                                                                                 | 3,648 pass, 30 skipped               |
| `tsc`, `eslint` (0 errors), `prettier`, `npm run build`                                                                                                                                         | green                                |
| Repo-wide Playwright                                                                                                                                                                            | see the mission report               |

## 7. Still open (named, not fixed)

- The OpenAI model path for Chirp Bot has never produced a real line.
- The live in-progress NHL board: watch it on Sunday.
- The toy box does not close on Escape (its ✕ works). This was found earlier
  in `FINISH.md` and is out of scope here.
- The corpus read from `/go` carries Atlas's `schedule.onDate` reading for
  today (Friday), not for game day. The server asks Atlas for game day, so on
  Sunday "closed on game day" can differ slightly from this run.
