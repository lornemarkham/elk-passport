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
7. **BACK IN THE QUEUE** when you're ready (never automatic), until
   **I'm heading home**.

**Challenges:** pick a partner and two opponents; all four accept. Until all
four have, nobody loses their place in line. Then it waits for a court the
matchup is allowed on, and never goes ahead of anyone still waiting for a
first game.

## Fairness

_Fewest games tonight goes first; then fewest minutes; then whoever has waited longest._
The most deserving player who may use the free court anchors the game and is
always in it; the other three come from the next seven in line, chosen for
close levels, even teams, new partners, and not the same four again. Passing
over a first-timer for someone who has played costs heavily. A ready challenge
takes a court only when no first-timer is waiting and its players have, on
average, played no more than whoever would go next. Nobody else's games or minutes are shown to
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

Deferred: achievement badges;
point-by-point scoring; skill changes from results (the hint informs the
organizer, it never changes a level).

## Real-world release (2026-11-10, owner brief _P0: CourtQueue real-world release_)

What changed for the club's first real nights (Thursday 2026-11-12 on):

- **The season is data** (`src/lib/courtqueue/schedule.ts`): Vernon Badminton
  Club at Coldstream Elementary School Gym, Mondays 7:00–9:00 pm and
  Thursdays 6:30–8:30 pm, October 5, 2026 – April 15, 2027, America/Vancouver
  (BC is on UTC-7 all year in this codebase, `legalOffset`). The **Schedule**
  tab draws the season month by month; cancelled nights are crossed out with
  their reason.
- **Cancelled nights:** the owner's official schedule (with its crossed-out
  dates) was not available to the mission — not in the brief, the inbox or the
  repository — so **no dates were typed in or guessed**. Organizers tap a night
  in the Schedule tab to cancel it (with a reason) or put it back; every change
  is logged with who made it. The Schedule shows organizers a reminder until
  one taps _This matches the official schedule_. `OFFICIAL_CANCELLED` in
  `schedule.ts` takes permanent dates if they are ever committed.
- **Same-day sign-up, enforced on the server:** a night opens at 8:00 am on its
  own day and closes when it ends. Nobody — organizer included — reserves a
  future night or a cancelled one. 25 confirmed, then a waitlist that promotes
  itself in sign-up order.
- **Home shows one word and one button**: NOT SIGNED UP → SIGN ME UP ·
  REGISTERED → I'M HERE · READY TO PLAY → JOIN THE QUEUE · WAITING (place in
  line, the rule in your own numbers, and _ON DECK_ when you're in the next
  prepared game) · YOU'RE UP → START GAME · PLAYING → FINISH GAME · FINISHED →
  BACK IN THE QUEUE. Being called takes over the whole screen:
  **"COURT 2 — YOU'RE UP!"**.
- **Nobody is requeued automatically** after a game. FINISH frees the court at
  once, with or without a score; the score can follow later, provisional until
  another player confirms it; organizer corrections stay in the audit trail.
- **Fairness order:** fewest games tonight, then fewest minutes, then longest
  wait; skill and partner variety choose the rest of the four. Requested games
  (challenges) never go ahead of that order — the 15-minute "patience"
  override is retired.
- **The next games are prepared:** for each busy court, in the order they
  should free, the four that will be called (`prepared()` in `fair.ts`),
  shown under each court and to the players in it.
- **Tracked per game:** players, court, start, finish, duration, score; per
  player tonight: games, minutes played, minutes waited.
- **Push notifications** (Web Push, real, where the phone allows it — iPhone
  needs CourtQueue on the Home Screen, iOS 16.4+): sign-up open (once, on the
  day, to subscribers not yet in), off the waitlist, your court is called, a
  called court nobody started after 5 minutes, a game running past the long-game
  limit, a score to confirm, a challenge. The screen always shows the same
  thing — polling every 2 s stays the source of truth.
- **Nights put themselves away** an hour after their end: games still on court
  are finished there (marked estimated), the queue is cleared, history stays.

## Running it locally

- `COURTQUEUE_CLOCK=2026-11-12T18:45:00-07:00` (memory store only) starts the
  server's clock on a club night, so sign-up rules can be rehearsed any day.
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
