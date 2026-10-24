# Hockey Night — Plan, the pregame hype machine (2026-10-24)

**Asked:** make Plan as enjoyable as Play, for a different reason: discovering
places, debating options, making an unforgettable night happen. Keep the game
header, countdown, participants, timeline, arena details and bottom bar. Fix the
planning experience.

**Baseline:** production `36dba1d`; this branch is on GitHub main `d542503`
(merged clean), carrying the Bet button fix.

**Status:** release candidate on `feature/hockey`, local commits only. Not
pushed, not deployed. One optional SQL file (`plan-migration.sql`, §6) is
unapplied; without it nothing breaks, the "joining?" question is just absent
from nights that already exist.

---

## 1. What changed

| Brief                                     | What Plan does now                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pregame is the main event                 | **Three venue cards are on the page**, no dropdown. Each: Atlas's own photograph (source label where it is not plainly the place), name, kind, walk (an estimate, said so), Atlas's one-sentence description, game-day hours quoted, group facts (happy hour, screens…), a reason to go, who is backing it, one-tap vote. |
| Propose more, via Discovery               | "Think you know somewhere better? Throw it into the mix." opens **Find one in Passport**: every place Passport's Discovery pipeline holds near the arena, as the same cards, with a name/kind search and Restaurants / Bars & pubs filters. A typed name still works.                                                     |
| Meeting logic                             | **The pregame winner is the meeting point.** The "Where are we meeting?" vote is no longer asked.                                                                                                                                                                                                                         |
| Joining / arena / not sure                | **Are you joining the pregame?** three one-tap answers, visible to the group, changeable until puck drop.                                                                                                                                                                                                                 |
| Skipping pregame                          | "Meeting at the arena" crew gets _Outside {arena}_, the closest curated landmark when one is at the doors, and walking directions (Google / Apple Maps) to the arena.                                                                                                                                                     |
| Host override                             | Host-only **Override the meeting point**: the arena (with a gate, Rogers only), any place Passport knows, or typed words, plus a time. "Back to the pregame plan" clears it. Same `meetup` data and host-only permission as before.                                                                                       |
| After the game                            | The **After** stop has three venue cards for the after-party, hours quoted from Atlas or "no hours on file", voting, proposing, and the old mood answers (Keep going / Food / One last drink / We're cooked). It can be voted on **before** the game.                                                                     |
| Adaptive                                  | Before votes: three good bets. Moving: who has voted, who is being waited on, who leads. Settled (closed with one leader, or everyone going has voted): the winner as a large card, "We're meeting at X", with **Still on the table** one tap away. Locked at warm-up: "Locked in".                                       |
| Personality                               | Reasons are templated from Atlas facts only (`reasons.ts`): "Atlas lists a happy hour, which makes this pregame maths." Never a rating, price, crowd or opinion (unit-tested against a banned-word list).                                                                                                                 |
| Atlas + Passport, not a Rogers-only build | Everything is driven by the night's venue and Atlas candidates. The one Rogers-specific thing is the gate picker, shown only when the venue is Rogers Arena (the existing `arena.ts` data).                                                                                                                               |

## 2. Product decisions this makes (flagging them, not hiding them)

1. **A second meeting vote is gone.** Earlier (2026-10-23) the page deliberately
   said a restaurant was only a _suggestion_. The brief reverses that; the
   rule is now in `gameplan.ts`: host override → pregame winner (decided once
   settled, "leading" before) → an earlier meet-spot vote if the night has
   one → the arena. A tie or no votes means the arena, and says why.
2. **The host's override applies to everyone.** The old "Meet at the arena" form
   was only the arena's meeting point; it is now the host's one override of
   wherever the group would otherwise meet. If the host should be able to set
   a separate arena-crew spot, that is a second field and a decision.
3. **After-party voting opens before the game** (it was only on the page after
   the horn). The prompt's database rule already allowed it.
4. **Settled = everyone going has voted or voting is closed.** A solo host who
   votes therefore sees their pick as "the plan" immediately.

## 3. Honest limits

- **Walks are straight lines at 5 km/h**, labelled "estimate" on every card.
  Passport still has no routing; Atlas's routed legs are used by the existing
  Game-time directions where it holds both places.
- **Gate:** no verified coordinates exist for any gate, so arena directions end
  at the arena, and the screen says so.
- **Reasons** are coarse by design. If Atlas holds no facts for a place the
  reason is about its kind, its walk, or its missing hours.
- **Photographs** are whatever Atlas holds under Passport's picture rule; a
  place with none gets the designed no-photo card, never a stock image.
- The Hockey "Explore" button, the dinner ballot's compact rows and the
  "Where are we meeting?" vote are gone from the page (the vote's old answers
  are still read as a fallback).

## 4. Files

New: `src/domain/hockey/{reasons,candidates}.ts` (+tests),
`src/components/hockey/{PlanBoards,PlanShared}.tsx`,
`docs/product/hockey/{plan-migration,plan-preflight,plan-rollback}.sql`,
`verification/plan-pregame.spec.ts`, `plan/` (screenshots).
Changed: `gameplan.ts` (+tests), `night.ts` (the "joining?" question, blocks),
`modules.ts`, `tabs.ts`, `plan.ts`, `PlanTab.tsx`, `VenueCard.tsx`
(`BallotVenueCard`: reason, add-and-vote, badge, hero),
`_server/night.ts` (`venue` in the nearby read; after-party names kept on the
ballot window), and the Hockey specs that drove the old Plan
(`acceptance, alive, polish, seats`, `night-tabs.ts`).
Outside the lane: none.

One defect fixed on the way: **Add & vote lost its vote if the places browser
was closed straight after the tap** (the pending vote lived in the sheet). The
ballot now lives in the plan. The browser also no longer steals focus on every
poll (the same bug the Bet sheet had).

## 5. Verification

Real local stack (Postgres + GoTrue + PostgREST, production's grants posture,
every Hockey migration applied), `next start` build, Atlas stand-in serving a
saved **production** Atlas body from 2026-10-23.

`plan-pregame.spec.ts` — four real accounts (host on a 390 phone, a guest on a
1280 desktop, a guest on 390, a guest on 320), 12 steps: cards on the page with
photographs and walks · one-tap vote, seen by others, survives reload · "waiting
on" · throw a place in from the browser (and by typing) · winner shown big and
is the meeting point, no meeting vote · joining/arena/not sure · arena crew
directions · host override, a guest refused in the UI **and the API (403)** ·
after-party cards, hours, voting, proposing · a night with no "joining?" rule
row still works and `plan-migration.sql` (twice, then rollback, then again)
brings it in without losing answers · warm-up lock · after the game · 390/320
no sideways scroll, no tap under 40 px, no text under 12 px.

Screenshots (reviewed): `plan/` — phone 390, phone 320, desktop 1280.

Gates: `tsc`, `eslint` (0 errors), `prettier`, `vitest`, `next build`. See the
report for the run.

## 6. For the owner

1. **`plan-migration.sql`** (insert-only, idempotent; preflight and rollback
   alongside) gives nights created **before** this release the "joining?"
   question. Nights created after deploy get it automatically. Without it,
   Plan works exactly as described minus that question. Apply by paste in the
   SQL editor, as the others.
2. Check the first real night: photographs on the three cards, and that the
   after-party list is sensible (hours quoted come from Atlas's own statements).
3. Product decisions in §2.

## 7. Running it

```
STACK=~/passport/scratch/hockey-stack node docs/product/hockey/verification/stack.mjs start
node docs/product/hockey/verification/atlas-seats-stub.mjs <atlas body.json> 3135 &
set -a; . $STACK/env; set +a; npm run build
ATLAS_API_URL=http://127.0.0.1:3135 npx next start -p 3130 &
PLAN_SHOTS=docs/product/hockey/plan STACK=$STACK E2E_PORT=3130 \
  npx playwright test -c docs/product/hockey/verification/playwright.config.ts plan-pregame
```
