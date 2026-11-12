# CourtQueue — Everybody Plays

Drop-in doubles badminton, three courts, about 24 players, Monday and Thursday.
Everybody uses their own phone at **`/badminton`**; there is no central screen.

Owner brief: _P0: Build CourtQueue_ (2026-11-10, deadline Thursday 2026-11-12
before evening badminton). Architecture: [ADR 017](../../architecture/decisions/017-courtqueue-is-its-own-small-room.md).
Release: [`docs/release/RELEASE-2026-11-12-COURTQUEUE.md`](../../release/RELEASE-2026-11-12-COURTQUEUE.md).

## A night, from a player's phone

1. **Join** with a name and a PIN — nothing else. _"Everyone is welcome. Come
   play, meet people, and have fun!"_ Add to Home Screen for an app icon.
2. **Sign up** for a Monday or Thursday. The next of each is always on the
   calendar. 25 are confirmed; the rest join a waitlist, which moves up by
   itself when someone cancels or is marked a no-show.
3. **I'M HERE** at the gym, then **🏸 PLAY**. The phone shows your place in
   line, a rough wait, the courts, and your games and minutes tonight. Put it
   down. Any time tonight: **"What kind of game sounds fun today?"** (optional
   — see _Everyone belongs_).
4. **You're up!** — the phone says which court, who with, and why these four
   ("First game tonight for Sam", "New partners", "Dana is here to say hello").
   **I'm in**, or **Not this one** (keep your place, or take a break — no
   penalty either way).
5. **START GAME** on any of the four phones. The court is occupied and the
   clock is the server's.
6. **FINISH GAME** — no score is asked for. Forgot to tap? Say how many
   minutes ago it ended, or when it started. Say thanks to someone who made
   the game fun.
7. **BACK IN THE QUEUE** when you're ready (never automatic), until
   **I'm heading home**.

**Game invites** (the old "challenges"): pick a partner and the other two; all
four say yes, or "not tonight". Until all four have, nobody loses their place
in line. Then it waits for a free court, and never goes ahead of anyone still
waiting for a first game.

## Fairness

_Whoever has waited longest goes first; court time breaks a close call_ (amended 2026-11-12, fairness intelligence — see "Fairness intelligence" below). The previous rule was fewest games, then fewest minutes, then longest wait.
The most deserving player in line anchors the game and is always in it; the
other three come from the next seven in line, chosen to mix people up: new
partners, people they haven't shared a court with tonight, not the same four
again, a newcomer alongside a volunteer who likes to say hello — and, only as a
gentle tie-break, what each player said sounds fun today. **Nothing in the
engine knows how good anyone is.** Passing over a first-timer for someone who
has played costs heavily. A ready invite takes a court only when no first-timer
is waiting and its players have, on average, played no more than whoever would
go next. Nobody else's games or minutes are shown to players: the line is names
in order, never a league table of playing time.

## Courts

Court 1, 2 and 3 — far from the seats, the middle, by the seats. Every court is
for everyone; the organizer can rename one or change where it is, and can close
one. There are no tiers.

## Everyone belongs (2026-11-10, owner brief _P0: Everyone belongs_)

The Vernon Badminton Club's organizer pointed out that Beginner / Intermediate /
Expert labels could make people feel judged. CourtQueue is a welcome, not a
ranking, so:

- **Removed:** the self-rated level at sign-up, the level tag on every card, the
  organizer's level picker and level history, skill ranges on courts and the
  "never on the expert court" rule, ability-balanced teams, wins/losses and
  win %, points, the club board, "maybe ready for the next level" hints, score
  entry/confirmation/disputes, awards, and notifications that said "challenged"
  or "check the score". Old club documents are scrubbed of skill data the next
  time they are read (`tidyClub` in `model.ts`); the courts are renamed
  "Court 1/2/3".
- **Added:** _"What kind of game sounds fun today?"_ — **I'm here to have fun! /
  I'd love some friendly rallies. / I'm up for a challenge!** Optional, changed
  any time, stored for one night only (`Session.moods`), never shown on a card
  or to anyone else, and only a gentle tie-break in who is mixed together.
- **Welcome:** the first-time screen says _"Everyone is welcome. Come play, meet
  people, and have fun!"_; "mentor" became "happy to say hello to new players"
  and is used to seat a newcomer (registered in the three weeks before the
  night) next to a friendly face. It is a volunteer, not a rank.
- **Organizer controls** (Organize tab): **Play next** on anyone checked in
  (a new face, someone who has waited, someone with a bus to catch — cleared
  when they are called), assign four by hand, close/rename a court, pause or
  sign someone out, see games and minutes tonight to balance court time, and
  fix a game's times.
- **Player stats are private to the player:** nights, games, minutes, people
  played with, thank-yous. Nothing about anyone else is ever sent.
- A guard test (`belong.test.ts`) fails the build if skill words, win records or
  boards come back into the source.

Open: the game still stores `score`/`winner` fields and the engine still
accepts `score`, `confirm` and `dispute` commands for games recorded before this
change; nothing in the app sends them or shows them.

## Organizer (the Organize tab)

Open or close registration, open check-in early, end the session; the roster
and waitlist (promote, check in, no-show, remove, add, **play next**); PIN
resets; close or rename a court; assign four by hand; finish or cancel a game;
**fix a game's start or finish with a reason**, kept in the audit trail; alerts
for a game running long or a call nobody started.

## Built vs deferred

Built: every P0 in the brief, then _Everyone belongs_. Deferred: achievement
badges; point-by-point scoring. Skill levels, points, boards and scores are
**not deferred — they are removed on purpose.**

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
  once, with no score asked for; organizer corrections stay in the audit trail.
- **Fairness order:** longest wait, adjusted by court time (`fairness.ts`); partner variety and a warm welcome choose the rest of the four.
  Requested games (invites) never go ahead of that order — the 15-minute "patience"
  override is retired.
- **The next games are prepared:** for each busy court, in the order they
  should free, the four that will be called (`prepared()` in `fair.ts`),
  shown under each court and to the players in it.
- **Tracked per game:** players, court, start, finish, duration; per
  player tonight: games, minutes played, minutes waited.
- **Push notifications** (Web Push, real, where the phone allows it — iPhone
  needs CourtQueue on the Home Screen, iOS 16.4+): sign-up open (once, on the
  day, to subscribers not yet in), off the waitlist, your court is called, a
  called court nobody started after 5 minutes, a game running past the long-game
  limit, a game invite. The screen always shows the same
  thing — polling every 2 s stays the source of truth.
- **Nights put themselves away** an hour after their end: games still on court
  are finished there (marked estimated), the queue is cleared, history stays.

## The Clubhouse (2026-11-10, owner brief _CourtQueue — Clubhouse social features_)

**One chat for the whole club** — the Clubhouse tab. Every registered member
reads and writes in the same room; there is **no private messaging** (a
message has no recipient, no thread, and the API has no way to address one
person). Everybody plays — and everybody talks in the open.

- **Talk:** banter, emoji (panel + quick replies like _Good game! 👏_ and
  _Rematch? 🔁_), reactions (👍 😂 🔥 👏 🏸 😮), `@Name` pings. 300 characters; a
  second between messages, 12 a minute.
- **Family-friendly:** a rude-word filter that sees through `sh1t`, `f u c k`,
  `f***` and `fuuuck` without catching _class_, _pass_, _tonight_ or
  _shuttlecock_; links refused. A member can **report** a message; three
  different reporters hide it until an organizer looks. Hiding never deletes.
- **Organizer controls** (Organizer controls panel in the Clubhouse, and a tap
  on any message): remove / put back, pause one player's chat (24 h from a
  message, or until they're let back), pause the whole room, pin an
  announcement. Each is logged with who did it. Removed messages stay in the
  database and visible to organizers.
- **Challenges, any time before the night ends.** Pick your partner and two
  opponents (anyone in the club), the night, and a playful line. The room sees
  a card; the three others **accept or decline without signing up** — saying
  yes reserves nobody's attendance and nobody's place in line. A rematch is the
  same four again from your last game (_Rematch my last game_).
- **On the day** (sign-up opens 8:00 am, 25 confirmed first come, first
  served, then the waitlist — unchanged) a challenge only becomes real when
  **all four have said yes, are confirmed for the night, are checked in and
  have joined the queue** (`readiness()` in `engine.ts`; the card names who
  still has to do what). It then leaves the line as one group and goes to a
  court only when the fairness engine allows it (`challengeMayGo`): it never
  jumps a waiting first-timer or anyone with fewer games. _Everybody plays._
- **Share to WhatsApp** on every challenge and an **Invite a friend** link: a
  `wa.me` share link with ready-written text. There is no WhatsApp group sync
  and none is attempted.
- **Notifications:** two independent settings under Me → Notifications —
  _Court-ready & game-night alerts_ (default on) and _Clubhouse chat alerts_
  (**Off** by default · **Just me**: @mentions · **Every message**). Turning chat
  down never costs a court call, and the other way round.
- **Stored** in the existing shared database (`passport_courtqueue_docs`, no
  migration): one document per week of chat (`chat:<Monday>`), `chatmod`
  (locked, muted, pinned, log), and notification choices inside `push`.
  Players and chat are never pruned: the whole season stays readable (_Earlier
  messages_ pages back week by week).

Limits: a week of chat holds 3,000 messages; a challenge needs all four in the
queue at the same moment, which in a full gym takes some coordination;
pushes need the phone to allow them (iPhone: from the Home Screen).

## Running it locally

- `COURTQUEUE_CLOCK=2026-11-12T18:45:00-07:00` (memory store only) starts the
  server's clock on a club night, so sign-up rules can be rehearsed any day.
- `npx next dev -p 3120` uses the memory store; the organizer code is
  `organizer` unless `COURTQUEUE_ORGANIZER_CODE` is set.
- `e2e/badminton.spec.ts`: four phones, start to confirm, offline and back,
  the 25 limit. Needs a fresh server with `COURTQUEUE_STORE=memory`.
- `e2e/clubhouse.spec.ts`: the Clubhouse on phones — chat between two phones,
  the filter, a challenge made for next Monday and answered without signing up,
  the on-the-day rule, organizer controls, notification choices, sign-in again.
  Own server (`COURTQUEUE_STORE=memory`, `COURTQUEUE_CLOCK` Thursday after
  8:00 am); restart the server between runs.
- `node scripts/courtqueue/rehearse.mjs <url> [games]`: 25 sign-ups at once,
  24 PLAYs at once, 24 phones polling, simultaneous START and FINISH taps,
  invariants checked every round.
- Real Postgres: `node docs/product/badminton/verification/stack.mjs start`,
  then `set -a; . ~/passport/scratch/courtqueue-stack/env; set +a; npx vitest
run src/lib/courtqueue/store.stack.test.ts`. The Clubhouse survives a restart:
  `STACK_PHASE=write npx vitest run src/lib/courtqueue/clubhouse.stack.test.ts`,
  `node docs/product/badminton/verification/stack.mjs restart`, then
  `STACK_PHASE=read` the same.

## Play. Learn. Grow. Together. (2026-11-12, owner brief M687)

- **Where are you in your badminton journey?** One optional card on Home
  (Beginner / Intermediate / Advanced / "not now"), asked once, private.
- **Playing mood** (per night): Just Here to Play · Find My Rhythm · Challenge
  Me · Happy to Help.
- **Suggestions**: turns → minutes → waiting first; level and mood only break
  ties (helper beside someone who asked, peers for Challenge Me, steadier mix
  for Find My Rhythm). Players still choose partners via game invites;
  organizers can assign or play-next.
- **Grow tab**: _My Journey_ (skills to explore, techniques to practise,
  three goals, encouraging progress from the player's own nights, optional
  challenges) and _Learn_ (six lessons with drawn diagrams; no outside links).
- **Happy to Help** is voluntary; nobody is required to coach.
- **`/badminton/demo`**: three made-up nights on the real engine (new player
  joins; experienced players' challenge game; a newer player invites a
  stronger one).
  Not built: video, organizer view of levels (deliberately), mentor pairing
  beyond the gentle seating bias.

## Test Game Night, countdown and calendar (2026-11-10, owner brief _Game Night Simulator_, M715)

**Test Game Night** (Organize tab, and Home for organizers: _🏸 Test Game
Night_) rehearses a whole night with 25 fictional players on the club's own
courts and capacity. `src/lib/courtqueue/gamenight.ts` drives the real engine
(`applySession`, `tick`, `fair.ts`) on a copy held only in the browser tab
(`sessionStorage`, so a reload carries on and Exit forgets it). It has no I/O:
no store, push, Clubhouse or statistics code is imported (a unit test checks
this) and the e2e suite checks that no request is written and the real club
reads back identical afterwards.

- **The night is a list of things that will happen** — sign-ups from 8:00
  a.m. (25 of 25 by evening), doors open, arrivals, games called, started and
  finished, people catching their breath or taking a break, two leaving
  early, one no-show, the end. **Next event** jumps the clock to the next one;
  **+5 min**, **Auto** and **Skip to the end** let time pass.
- **The organizer's controls**: start, finish, send back, _next group on_ (one
  court), _rotate all courts_, pick four for a free court, open/close a
  court, move a player (a swap with someone on another court), mark
  unavailable / available, play next, add a walk-in (the waitlist once full),
  remove, reset. **Move** exists only in the demo; the club app does it by
  sending a call back and assigning four.
- The fictional players carry a private level and mood like any player's
  journey, shown only on the demo's Players list (as `demo.ts` already does)
  and never on a court, in the line or in the summary. The summary is
  alphabetical: games, minutes, people played with — nobody is ranked.

**Registration countdown** (`countdown.ts`): from the night's own date and
`SEASON.registrationOpens`. More than 12 hours before: "Registration opens
Thursday, November 12 at 8:00 a.m."; within 12 hours: "Registration opens in
11h 42m" with the day and "Opens Thursday at 8:00 a.m."; then "Registration is
open!" with spaces out of 25, and the waitlist once full. It only says;
nobody is signed up when it reaches zero. Shown on Home (the next session is
now its own card, with a way to the courts) and in the calendar.

**Calendar**: today is ringed in white on any date, club night or not;
nights are marked coming up, registration open, you're registered,
completed (✓) and cancelled. Every night opens a sheet with its details,
sign-up state and countdown; organizers also cancel or restore it there.
Home lists who is here tonight by name (what members already see on the
courts and in Play with friends); before the night only counts are shown, as
no setting lets members see who has signed up.

## Fairness intelligence (2026-11-12)

Owner brief "P0 addendum — CourtQueue fairness intelligence". Built in
`src/lib/courtqueue/fairness.ts`, nothing stored: every figure is read back out
of the night's games, so a corrected time corrects it.

- **Ledger per checked-in player:** minutes played, minutes waiting in line,
  games, minutes on each court, last game ended, current wait, passes
  (declined calls), break minutes, partners and everyone played with.
- **Waiting means time in the line.** A break, a drink or waiting for friends
  is time out of the line: never waiting, never priority. Played minutes stay
  exact either way.
- **Priority** (`priority()`): minutes waited, ±5 min of the night's average
  court time ignored (a close call is decided by the wait); beyond that, being
  behind earns 0.75 min of credit per minute (capped at 25 so a late arrival is
  not owed the night), being ahead costs 1.25. First tie-break: fewer games.
  The organizer's "play next" still goes first. The anchor + mixing logic in
  `fair.ts` is unchanged.
- **Organizer dashboard** (Organizer tab, live night only): Player · Played ·
  Waiting · Games · Next, least court time first, with a
  one-line headline (least played, waiting longest) and plain-words
  recommendations. 🟠 = 8+ min under the average, 🔴 = 15+, and only for
  someone waiting in the line. "Next" is the court the engine has prepared them for.
- **Players** see only their own minutes against the night's average, in the
  line explanation. Nobody sees another player labelled underserved.
- **Not built, by design: court eligibility.** The brief asks never to violate
  court eligibility. CourtQueue has none since "Everyone belongs" (every court
  takes anybody; doctrine, ADR 017), so there is nothing to respect and no
  skill-level column. This is an open owner question: _should any court ever
  be limited for anyone?_ Until answered, it is not built; the simulation
  measures what such a limit would cost.
- **Preferred partners** are not a stored concept in the real app (a challenge
  is the nearest thing and already waits its turn), so "respect preferred
  partners" is satisfied only by never forcing a game and never counting
  time out of the line as waiting. Nothing new was added.

Simulation: `fairness.sim.ts` / `fairness.sim.test.ts`, 60 seeded nights per
scenario, 25 players, three courts, FIFO against the same priority function.
`FAIRNESS_REPORT=path npx vitest run src/lib/courtqueue/fairness.sim` writes
the tables. Groups A/B/C in the simulation stand for the three private-guide
levels (the source stays free of level words, `belong.test.ts`). Result,
60/90/120 min: spread between most and fewest minutes narrows 13% / 22% / 28%;
players under 60% of the average fall from 2.5 / 0.22 / 0.17 to 1.7 / 0.02 / 0
a night; the longest wait _rises_ by about 1–2 min (the price of sending the
under-served ahead of a longer waiter); idle courts do not change; the gap
between groups is within about 1 min of FIFO's. The simulation is a simplified
model (game lengths 11–22 min, 18% breaks), not the engine itself.
