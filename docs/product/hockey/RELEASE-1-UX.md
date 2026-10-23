# Hockey Night — UX cleanup, small release 1 (2026-10-22)

The first of several small releases, to ship before Sunday's game. The goal is a
night out with friends rather than a stack of forms, directories and voting
widgets. **Code only.** No migration, no schema, no Atlas change, no new Atlas
dependency, and no auth or permission change. Not deployed.

Branch `feature/hockey`, on top of `9f6d600` (Seats + Arena Mode + the Arena
door on the quiet page). Because of that ancestry, deploying this also deploys
Our Seats and Arena Mode. Their migrations (`seats-migration.sql`,
`arena-migration.sql`) are still needed for those features to switch on; without
them, the code says "isn't switched on" (see `RELEASE-HOCKEY-ARENA.md`).

## What changed

**1. Plan is five decisions.** Plan opens on one card with five rows. Each row
shows where the decision stands, a pill for what is waiting on you (**Vote**,
**Add yours**, **Set**) or how to change it (**Change**, **Edit**, **Open**),
and a chevron. Tapping a row opens its editor in place. Only one row is open at
a time, so with everything closed Plan is about a screen and a half on a 390 px
phone (it used to be about eight).

| Row             | Current state shown                                                                  | Opens                                                                       |
| --------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Before the game | Leader of `pregame-spot` (with its photo), tie as a tie, "No votes yet"; votes, mine | The dinner vote (below)                                                     |
| Getting there   | Host's time and gate at the arena, e.g. "6:15pm at the arena · Gate 10"              | Our Seats' meeting point (host edits), the walk with map links, arena guide |
| Meeting point   | Leader of `meet-spot`                                                                | The meeting-place vote                                                      |
| Our seats       | My seat, else the group's block                                                      | The block, everyone's seats, who's sitting together                         |
| After the game  | `hard-out` ("when are you leaving") until the game is over, then `postgame`          | Those votes                                                                 |

The mapping lives in `DECISIONS` / `decisionVote` (`src/domain/hockey/plan.ts`)
and is unit-tested. Every vote, nomination, seat and meeting point is the same
data, read and written through the same endpoints. Only the layout moved.

**2. Restaurant discovery is collapsed.** The dinner vote's ballot is now
compact rows: a small photo or emoji, name, walk, Leading/Tied, and voters. The
whole row is the vote, and Atlas places keep their "More about … in Passport"
link. The full neighbourhood list is gone from the default view. **Explore
places & vote** opens three recommendations: not already on the vote, not
closed on game day by Atlas's own hours, in the server's photo-first, nearest
order. **See all N places** shows everything, with the Restaurants / Bars &
pubs filters. Explore opens on its own only while nothing real is on the vote.
Typed nominations ("Somewhere else? Type a name") and Atlas nominations work as
before. No new Atlas call: it is the same `/nearby` read as before.

**3. Filler removed.** The "Just eat in the concourse" poster card and its "Or
keep it easy" heading are now one compact row at the bottom of the ballot.
Other removals:

- the separate full-width Arena Mode card on Plan
- the duplicated "Puck drop" line on the plan card, which the hero already shows
- the repeated "Getting there" heading inside Getting there (now "The walk")
- some top padding

Vote questions are smaller headings inside their rows.

**4. Arena in the bar.** The bottom bar is **PLAN | PLAY | ARENA | CHAT | GROUP**
for members of a Rogers Arena night. Plan, Play, Chat and Group stay tabs of the
page. Arena is a link to `/hockey/<id>/arena`, which is unchanged (map,
check-ins, quests, eat & drink). The Arena Mode page now carries the same bar,
with Arena current and the other four linking back to that room (`#plan`, …).
Its pings sit above the bar. Arena Mode is still reachable during periods
through the door on the quiet page, where there is no bar. Before the game the
map, guide and quests can be browsed and check-ins say when they open; that
behaviour is unchanged.

**5. Mobile.** The new spec checks every control in the plan card is at least
40 px tall, no text is under 12 px, and nothing scrolls sideways at 320 and
390 px, with each decision open. It also checks a 1280 px desktop.

## A reading of the brief to confirm

"Getting there — when we're leaving" could mean two existing things:

- the host's **time and gate at the arena** plus the walk (Our Seats' meeting
  point), or
- the **`hard-out`** vote, "Be honest — when are you leaving?" (straight home /
  one drink / until close). The old plan card labelled it "Leaving".

`hard-out`'s answers are all about the end of the night, so this release puts
it under **After the game** until the game ends, and uses the arena time and the
walk for **Getting there**. Nothing is lost either way. If the other reading was
meant, the change is one line in `DECISIONS`.

## Files

`src/domain/hockey/plan.ts` (decisions), `src/components/hockey/PlanTab.tsx`
(rewritten), `OurSeats.tsx` (split into `useSeats`, `SeatsEditor`,
`GettingThereEditor` and two summaries), `VenueCard.tsx` (`BallotRow` replaces
the ballot poster card), `NightTabs.tsx` (Arena link, `ArenaNav`),
`HockeyNightScreen.tsx`, `arena/ArenaMode.tsx` + `arena/IncomingPings.tsx`
(bar, pings above it). Tests: `presentation.test.ts`, new
`verification/release1.spec.ts`, `verification/night-tabs.ts` (`openDecision`),
and the Hockey specs updated to open decisions before using them. Screenshots:
`release-1/`.

Nothing outside the lane's own paths was changed.

## Tests

See the mission report for the run. Recipe: the same local stack and stubs as
`ARENA-MODE.md` §10, plus:

```
RELEASE1_SHOTS=docs/product/hockey/release-1 STACK=… E2E_PORT=3130 \
  npx playwright test -c docs/product/hockey/verification/playwright.config.ts release1
```

## Next candidates (not in this release)

- The game-day hero is still about 600 px tall on a phone, so the plan card
  starts near the bottom of the first screen. It sits above every tab, so it
  was left alone here.
- When a vote closes, its row can't be opened to show the full tally; only the
  leader and count remain. This matches the old page, which also hid closed
  votes.
