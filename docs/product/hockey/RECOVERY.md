# Hockey Night — recover the experience (2026-10-22)

**Asked:** Hockey Release 2 (production, `2dad9bd`) works, but Plan reads like
an administrative checklist. Recover the strongest card-based Hockey Night
built so far, keep everything newer, and don't redesign it.

**Status:** on `feature/hockey`, after `e85e887` (= production's tree). **Not
pushed, not deployed, `integration/release` not touched.** Code only: no
migration, no schema, no Atlas, auth, invitation or API change. Owner approval
needed before release.

Pictures: [`recovery/`](recovery/). The same night (one host, two guests who
joined through real invitation links, three real Atlas places, real votes,
seats and the host's gate and time) was photographed on all three builds by
[`recovery/compare.mjs`](recovery/compare.mjs). It runs against a local stack,
with Atlas stubbed by production's own candidates body.

---

## 1. Forensics: what each version was

| Commit                        | What Plan was                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aded7ff` private night       | One long column of the lab's blocks: running order, roster, plan, then every vote as identical text rows. Places near the arena sat behind a "What's near the arena?" link (`NearbyPicker`).                                                                                                                                                                                                                |
| `f3b1aa3` game-day page       | **The card-based night appears.** Matchup hero with a countdown, Plan / Play / Chat / Group. Plan: _The plan_ summary, then **"Where are we going before?" as big photographic cards for every place on the vote** (`BallotVenueCard`: photo, kind, walk, game-day hours, facts, faces, a race bar, "Lorne put this on the vote"), then a swipe shelf "More near Rogers Arena". Picks by thumb, the reveal. |
| `56d87fd` photos and voting   | Photos survive https and logos. With nothing real on the vote, the best three places lead **full width**; the rest are the shelf. Retry on a slow first Atlas read.                                                                                                                                                                                                                                         |
| `b5eb736` coworker polish     | 12 px text and 40 px taps at 320/375/390. Same composition. **This is the best card presentation** (`polish/` pictures).                                                                                                                                                                                                                                                                                    |
| `30899b9`/`eed37c3` Our Seats | Seats, the meeting point and the walk arrive as one large `OurSeats` block placed **above** the dinner vote. On a phone that pushes the photographs about 2,000 px down. This was the first time the cards got buried.                                                                                                                                                                                      |
| `a4ea151`/`9f6d600` Arena     | Arena Mode, with a door card on Plan and on the quiet page in a period. `9f6d600` is the **best complete version**: every card plus seats and Arena.                                                                                                                                                                                                                                                        |
| `71d211d` Release 1           | **Where the card presentation disappeared.** Plan became one white card of five accordion rows with pills (Vote / Set / Add yours / Change / Edit) and chevrons, one open at a time. `BallotVenueCard` was **deleted** and the vote became compact rows (`BallotRow`). The shelf went behind "Explore places & vote", and the Arena door card was removed (Arena moved into the bar).                       |
| `f724f94` Release 2           | Cards came back, but **only inside an opened row**, as a sideways carousel of three places _not yet_ on the vote. The vote itself stayed rows. The hero lost the second commentary line and "Now / Next" on phones. Added: meeting places as cards with a host's pick, and one-tap "Add & vote".                                                                                                            |
| `e85e887`, `2dad9bd`          | Test token rename; author identity. `2dad9bd`'s tree is identical to `e85e887`. **No UI change.**                                                                                                                                                                                                                                                                                                           |

**Overwritten or never integrated?** Nothing is stranded. Every branch that
touches Hockey (`feature/hockey-arena`, `release/hockey-arena`,
`origin/release/hockey-arena`, `origin/main`) is an ancestor of
`feature/hockey`. `integration/release` has no Hockey commit that this branch
lacks. What was lost was **presentation code deleted on purpose** in Release 1:
`BallotVenueCard`, its `Details`, the always-visible shelf and the door card on
Plan. No data or behaviour was lost.

**Why it reads as a checklist.** Measured at 390 px on production with this
night: closed, Plan is 1,375 px. It is a white card of five rows, each a label,
a status, an orange pill and a chevron. That is a form's anatomy. The group's
argument (whose place is winning, who backed what, the photographs) is one tap
down, and when opened the places on the vote are 56 px rows.

## 2. What the recovery does

The composition of `b5eb736`/`9f6d600`, with the order fixed and everything
since kept (`PlanTab.tsx`):

1. **The plan** leads, in the polish version's style: "So far · by vote", five
   lines with the dinner leader's photo, votes, and a quiet orange "yours?",
   "add yours" or "set it" where something waits on you. No pills or
   chevrons. **Tapping a line goes to its part of the page** instead of
   unfolding it. During a period, the plan alone is shown, as before.
2. **Every part of the night is open under it, in the order it happens**
   (`DECISIONS` order). Each starts with a yellow kicker (BEFORE THE GAME, …)
   and a big question:
   - **Where are we going before?** Every place on the vote is a
     **photographic card** again (`BallotVenueCard`, restored from `9f6d600`):
     Leading / Tied, kind, walk, game-day hours, facts, Atlas's sentence, "More
     about … in Passport", who put it there, a big vote button, faces and a
     race bar. A fresh night opens on the **three best places full width**.
     Once the vote has places, the three good bets are a **swipe shelf** under
     it ("More near Rogers Arena"), and "See all 24 places" opens everything
     with the filters. Release 2's one-tap **Add & vote** stays on every card.
     The concourse stays Release 1's compact row, under "Or keep it easy".
   - **Getting there**: the host's gate and time, the walk with map links, and
     the arena guide, on a light card.
   - **Meeting point**: Release 2's meeting-place cards and **host's pick**,
     then the ballot.
   - **Our seats**: the block, everyone's seats, who's sitting together. Under
     it, the **Arena Mode door card** is back, where the building begins.
   - **After the game**: the leaving vote, and after the horn, where next.
3. **The hero** keeps Release 2's compact matchup and countdown, and shows
   Passport's **two** commentary lines on phones again ("Maya is the only
   person going with Shark Club. Bold strategy." · "Sam has answered nothing.
   We can see you.").

Fixed in passing: tapping a plan line while places or seats are still arriving
used to land in the wrong place, because they load late and grow the page
above. The page now follows the part for 2.5 s, unless the person scrolls
themselves. `seats.spec` caught it.

### Preserved: checked, not assumed

| Feature                                            | Where it is now                                           | Test that proves it                                    |
| -------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| Restaurant discovery with real photos              | Ballot cards, lead cards, shelf, See all + filters        | polish, redesign, release1, release2, acceptance       |
| Restaurant voting, add & vote, typed               | Card buttons (`Vote for X`, `Add X and vote`, `Back X`)   | release1, release2, plan-and-results, acceptance       |
| Matchup and countdown                              | `GameDayHero` (Release 2 layout, both commentary lines)   | release2 (hero < 500 px, plan in the first screen)     |
| Predictions and games                              | Play tab, untouched                                       | redesign, modules                                      |
| Seats and meeting point, host's pick               | Getting there, Meeting point, Our seats parts             | seats, release1, release2                              |
| Arena Mode                                         | Bar link (Release 1) **and** the door card on Plan        | arena-mode, release1                                   |
| Group interaction (chat, live updates)             | Chat / Group tabs; votes move other phones without reload | acceptance, redesign, modules                          |
| Invitations and authentication                     | Untouched                                                 | acceptance, multi-night, release1/2 (guest via invite) |
| Phones: 40 px taps, 12 px text, no sideways scroll | Plan card and every part                                  | mobile, release1, release2, seats                      |

## 3. Pictures

`recovery/` (390 px phone at 2×; desktop 1280):

- `01-first-screen-390.jpg`: production · best earlier (`9f6d600`) · recovered.
- `02-whole-plan-390.jpg`: the whole Plan, scaled side by side. Production is
  shown with the dinner row open (its best case).
- `03-dinner-vote-390.jpg`: the dinner vote on each.
- `04-fresh-night-390.jpg`: a new night, nothing voted yet.
- `05-desktop-1280.jpg`: the top of Plan on a desktop.
- `06-guest-390.jpg`: the guest's Plan.
- `recovered-*`: full-length pages of the recovered version (host and guest at
  390, host at 1280), at 1×.

**What improved.** The vote is the photographs again, so the group's argument
(Leading, faces, race bar, who added it) can be seen without opening anything.
Nothing hides behind a row or an Explore button. A new night opens on three
full-width photographs. Every part of the night has a headline question rather
than a form row. The plan card reads as "so far", not as a to-do list. Arena
Mode has its card again. The banter is back in the hero.

**What it costs.** The page is long: about 7,300 px at 390 for a busy night,
against 2,700 for production with the dinner row open and 6,500 for
`9f6d600`. This is the trade Release 1 made in the other direction. The plan
card at the top, with each line going to its part, is the answer to "where's
the bit I need". If it is still too long, the next lever is folding _Getting
there_'s directions (the longest part), not the cards.

## 4. Decisions for the owner — named, not resolved

1. **Long page vs accordion.** The recovery reverses Release 1's main choice
   (one row open at a time). That was the brief, but say so if a middle way is
   wanted, e.g. the dinner vote always open and the rest folded.
2. **Order.** Plan follows `DECISIONS`: before, getting there, meeting point,
   seats, after. In `9f6d600` seats came first, which buried dinner. Getting
   there / meeting point might read better swapped. One line in `DECISIONS`.
3. **Arena door in two places** (bar and Plan). Release 1 removed the card as
   duplication. It is back because it is the most inviting way in. Either is
   one line to change.
4. **Hero size.** Kept compact (Release 2). The `9f6d600` hero (50 px codes,
   big countdown tiles, "Now / Next") is more dramatic, but it pushes the plan
   about 200 px further down a phone screen. Not restored.

## 5. Verification

On Metatron, 2026-10-22, against the local stack (`verification/stack.mjs`:
real Postgres, GoTrue, PostgREST, seats and arena tables):

| Gate                                             | Result                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                               | clean                                                                                                                                                                                                                                                                                                                             |
| `npx eslint .`                                   | 0 errors, 40 warnings (the baseline count; none new)                                                                                                                                                                                                                                                                              |
| `npx prettier --check .`                         | clean                                                                                                                                                                                                                                                                                                                             |
| `npx vitest run`                                 | 3,560 passed, 30 skipped                                                                                                                                                                                                                                                                                                          |
| `npm run build`                                  | ok                                                                                                                                                                                                                                                                                                                                |
| Hockey browser suite                             | **13/13 pass** on the final build (11 spec files): acceptance (synthetic Atlas stub, as designed), arena-mode, mobile 320/375/390, modules, multi-night, plan-and-results, polish, redesign, release1, release2, seats. Not run: `arena-off` and `email-confirmation`, which need their own stack variants. Neither touches Plan. |
| `npx playwright test` (whole repo, critic Atlas) | **250 passed, 4 failed, 5 skipped**: exactly the recorded baseline (core-loop:26, october:554, october:570, conference-mobile:23)                                                                                                                                                                                                 |

Spec changes: `night-tabs.ts` `openDecision` now taps the plan line and checks
that its part is in view. `release1.spec` / `release2.spec` keep every
behavioural check, with "one open at a time", the "closed Plan is short"
assertion and the pill texts changed to the recovered layout (stated in each
file). `plan-and-results.spec` finds a locked line by its list item, not by a
region inside the plan card.

### 5.1 How it was run

`next start` on 3130 built against the stack's env, with Atlas as
`atlas-seats-stub.mjs` serving production's candidates body (2026-10-20).
Acceptance used a second `next start` of the same build on 3133 with
`atlas-stub.mjs` on 54341. The whole-repo suite used a third on 3134 with
`scripts/critic/atlas-mock.mjs` and `E2E_ATLAS=1`. It rewrites 13 committed
Discovery evidence PNGs, which were restored by path afterwards. The baselines
for the pictures were scratch clones at `2dad9bd` and `9f6d600`
(`git clone --shared`), built against the same stack and photographed by
`compare.mjs`.

**Not verified:** a real phone in the hand (Chromium emulation only), and
production Atlas. The stub carries production's body, but meeting-place
photos and `?on=` game-day verdicts depend on what production Atlas sends.

## 6. Seeing it (owner preview)

Nothing is deployed. To look at it on the Mac:

```
git fetch metatron:passport/main feature/hockey
git checkout FETCH_HEAD        # detached, nothing else moves
npm run dev                    # your normal env; open a Hockey night → Plan
```

Releasing it after approval is the usual Hockey route (`RELEASE-2-DISCOVERY.md`
→ `RELEASE-FINAL-2026-10-22.md`): code only, Vercel Instant Rollback undoes it.
