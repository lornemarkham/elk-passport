# CourtQueue — Everybody Plays

Drop-in doubles badminton, three courts, about 24 players, Monday and Thursday.
Everybody uses their own phone at **`/badminton`**; there is no central screen.

Owner brief: _P0: Build CourtQueue_ (2026-11-10, deadline Thursday 2026-11-12
before evening badminton). Architecture: [ADR 017](../../architecture/decisions/017-courtqueue-is-its-own-small-room.md).
Release: [`docs/release/RELEASE-2026-11-12-COURTQUEUE.md`](../../release/RELEASE-2026-11-12-COURTQUEUE.md).

## A night, from a player's phone

1. **Join** with a name, a PIN and a self-rated level (Beginner, Beginner+,
   Intermediate, Advanced, Expert). Add to Home Screen for an app icon.
2. **Sign up** for a Monday or Thursday. The next of each is always on the
   calendar. 25 are confirmed; the rest join a waitlist, which moves up by
   itself when someone cancels or is marked a no-show.
3. **I'M HERE** at the gym, then **🏸 PLAY**. The phone shows your place in
   line, a rough wait, the courts, and your games and minutes tonight. Put it
   down.
4. **You're up!** — the phone says which court, who with, and why these four
   ("First game tonight for Sam", "Evenly matched teams", "New partners").
   **I'm in**, or **Not this one** (keep your place, or take a break — no
   penalty either way).
5. **START GAME** on any of the four phones. The court is occupied and the
   clock is the server's.
6. **FINISH GAME**, with the score or without. Forgot to tap? Say how many
   minutes ago it ended, or when it started. Another player confirms the score
   or says "not quite" (that goes to the organizer). Shout out a good sport.
7. Back in line automatically (switchable), until **I'm heading home**.

**Challenges:** pick a partner and two opponents; all four accept. Until all
four have, nobody loses their place in line. Then it waits for a court the
matchup is allowed on, and never goes ahead of anyone still waiting for a
first game.

## Fairness

_Fewest games tonight goes first; among equals, whoever has waited longest._
The most deserving player who may use the free court anchors the game and is
always in it; the other three come from the next seven in line, chosen for
close levels, even teams, new partners, and not the same four again. Passing
over a first-timer for someone who has played costs heavily. A ready challenge
takes a court only when no first-timer is waiting and its players have, on
average, played no more than whoever would go next — or after
`challengePatienceMinutes` (15). Nobody else's games or minutes are shown to
players: the line is names in order, never a league table of playing time.

## Courts (defaults; the organizer can change levels)

| Court                         | Allowed                                                    | Mostly for                                   |
| ----------------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| 1 · Beginner (far from seats) | Beginner – Intermediate                                    | Beginner, Beginner+                          |
| 2 · Intermediate (middle)     | Everyone                                                   | Beginner+ – Advanced; mentors with beginners |
| 3 · Expert (by the seats)     | Advanced, Expert; an Intermediate partnered with an Expert | Advanced, Expert                             |

**Beginner and Beginner+ are never put on the expert court**, by the engine,
a challenge or the organizer, whatever the levels are set to.

## Organizer (the Organize tab)

Open or close registration, open check-in early, end the session; the roster
and waitlist (promote, check in, no-show, remove, add); levels; PIN resets;
close a court; assign four by hand; finish or cancel a game; **fix a game's
start, finish or score with a reason**, kept in the audit trail; awards for
sportsmanship; alerts for a game running long, a call nobody started, a
disputed score, an idle court nobody waiting may use.

## Points (participation, never skill)

Attending 10 · a game 3 · a first-ever partner 2 · a volunteer mentor
(Advanced/Expert) partnering a beginner 4 · a player's shout-out 2 · an
organizer's award 5. Players choose whether their stats appear on the club
board; the organizer always sees them, with a hint when someone wins ≥ 70 % of
8+ games.

## Built vs deferred

Built: every P0 in the brief. P1 built lightly: mentor flag and recognition,
level history, the club board, kudos and awards, promotion hints.

Deferred: server-sent push notifications (the service worker shows an alert
only while the app is open in the background — a phone that is locked hears
nothing; in-app banner, sound and vibration otherwise); achievement badges;
point-by-point scoring; skill changes from results (the hint informs the
organizer, it never changes a level).

## Running it locally

- `npx next dev -p 3120` uses the memory store; the organizer code is
  `organizer` unless `COURTQUEUE_ORGANIZER_CODE` is set.
- `e2e/badminton.spec.ts`: four phones, start to confirm, offline and back,
  the 25 limit. Needs a fresh server with `COURTQUEUE_STORE=memory`.
- `node scripts/courtqueue/rehearse.mjs <url> [games]`: 25 sign-ups at once,
  24 PLAYs at once, 24 phones polling, simultaneous START and FINISH taps,
  invariants checked every round.
- Real Postgres: `node docs/product/badminton/verification/stack.mjs start`,
  then `set -a; . ~/passport/scratch/courtqueue-stack/env; set +a; npx vitest
run src/lib/courtqueue/store.stack.test.ts`.
