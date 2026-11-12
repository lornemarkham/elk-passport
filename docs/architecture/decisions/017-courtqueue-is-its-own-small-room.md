# 017 · CourtQueue keeps its own small room: name-and-PIN players, versioned documents

**Decided:** 2026-11-10, by mission for the owner's brief _P0: Build
CourtQueue_ ("Simple authentication"; "Keep the implementation isolated from
unrelated Passport products"; "Prevent duplicate assignments through database
transactions or equivalent concurrency controls"). **Status:** implemented on
local `main`; migration `20261110000000_passport_courtqueue.sql` not yet
applied to production. **Departs from** [ADR 009](009-one-group-foundation.md)
— see _The conflict_.

## Context

CourtQueue (`/badminton`) runs a drop-in badminton night: about 24 people,
three courts, a fair queue, games started and finished on players' own phones.
It has to work for people who have never heard of Passport, on Thursday, from
one gym Wi-Fi, with every phone agreeing on who is on which court.

## Decision

1. **Players are CourtQueue's own**: a name and a 4–8 digit PIN, no email, no
   Passport account. A sign-in is an httpOnly cookie holding a random token;
   the server keeps only its hash. The organizer resets forgotten PINs.
   Organizers are unlocked by `COURTQUEUE_ORGANIZER_CODE`, or by being signed
   in to Passport as an administrator (`ADMIN_EMAILS`, the curator gate).
2. **State is a few versioned JSON documents** — the club and one per session
   — in `passport_courtqueue_docs`, written only by compare-and-swap through
   two SECURITY DEFINER functions that require the server's key. Every change
   is a pure function of (document, who, what, server time)
   (`src/lib/courtqueue/engine.ts`); the loser of a race re-reads and
   re-applies. One document per night makes "one game per court, one place per
   player" a check on one value, run before every write.
3. **Statistics are derived, never stored**, so an organizer's correction to a
   start time corrects everyone's minutes.
4. **Phones poll every two seconds** (immediately on returning to the
   foreground or regaining signal) instead of holding a realtime socket: the
   documents are not readable by the anon key, so Supabase Realtime would need
   a policy that exposes them, and polling survives an iPhone locking and
   switching networks with nothing to reconnect.
5. **The server key defaults to an HMAC of the existing `ATLAS_SERVICE_TOKEN`**
   when `COURTQUEUE_STORE_KEY` is not set, so the feature needs no new secret
   to start. The derivation is one-way.

## The conflict

ADR 009 says every group thing uses one Passport-owned core
(`passport_adventures`) for membership and invitations. CourtQueue does not:
its players are not Passport users and its night is not an adventure. That
follows the brief's "simple authentication" and "isolated" — 25 people
signing up for Passport accounts (email, confirmation) in a gym is the
opposite of simple — but it is a second membership system, which is what ADR
009 set out to prevent. **Not resolved here.** If CourtQueue outlives its beta,
the owner decides whether its players should become Passport accounts and its
nights adventures of kind `badminton`.

## Reversibility

Additive: two new tables and four functions, nothing else in the database
touched. The rollback is in `docs/release/RELEASE-2026-11-12-COURTQUEUE.md`.

## Amendment 2026-11-10 — the real-world release

Owner brief _P0: CourtQueue real-world release_. Same room, three additions:

1. **Push without a new secret.** The VAPID key pair for Web Push is derived
   (HMAC → P-256 scalar) from the same server key as the store, so it is
   stable across deploys and needs no new environment variable. Changing the
   store key (or `ATLAS_SERVICE_TOKEN` when it is the base) changes the VAPID
   key and silently invalidates every phone's subscription; they re-subscribe
   the next time the app opens (`notify.ts` re-posts its subscription on load).
   Encryption (RFC 8291) and VAPID (RFC 8292) are written with `node:crypto`,
   no package, and checked against the reference decoder `http_ece` and an
   RFC-written decryptor in `release.test.ts`. Subscriptions live in one more
   document, `push`, in `passport_courtqueue_docs` — no migration.
2. **What the clock does happens on the way past.** Filling courts, reminders,
   "sign-up is open" and putting a night away are done by whichever request
   arrives first (every phone polls every 2 s) and written by compare-and-swap,
   so exactly one server sends each message. Before 8:00 am nobody polls, so a
   Vercel cron (`vercel.json`, 15:00 UTC = 8:00 am in BC) calls
   `/api/badminton/tick`, which does only what a poll does.
3. **The season is code, its cancellations are data.** Dates and hours are in
   `schedule.ts`; cancellations are on the club document, changed only by an
   organizer, logged.

## Amendment 2026-11-10 — the Clubhouse

Owner brief _CourtQueue — Clubhouse social features_ (M681). The same small
room, with a chat in it:

1. **One shared chat, no private messaging.** A message belongs to the club:
   no recipient, no thread, no endpoint to address a person. Written by
   members only (the same name-and-PIN players), read by members only.
2. **Documents, not tables.** Messages are one document per week
   (`chat:<Monday>`), so a season never grows a single document without bound
   and nothing is ever deleted; moderation state is `chatmod`; notification
   choices live in the existing `push` document (`prefs`). All through the
   same compare-and-swap, so **no migration**. Moderation hides, never erases.
3. **A challenge is a request that costs nothing until the day.** It can be made
   for any night not yet over, answered without signing up, and only becomes
   real when all four are confirmed, checked in and in the queue
   (`readiness()`); the fairness engine then decides when it goes
   (`challengeMayGo`, unchanged). This **tightens** the 2026-11-10 rule for
   in-night challenges too: a challenge no longer goes ahead of the queue merely
   because its four were checked in and said yes — they have to be in it.
4. **Announcements from the server.** A challenge posts a card to the Clubhouse
   itself; a member cannot forge one.
5. **Two notification switches.** `Notice.kind` is `court` or `chat`; a player
   chooses each independently (courts on by default, chat off by default).

**Still open (not resolved here):** ADR 009's question — whether CourtQueue's
players and chat should one day be Passport accounts and adventures — is
unchanged, and a Clubhouse makes a second membership system more visible.

## Amendment 2026-11-10 — Everyone belongs

The Vernon Badminton Club's organizer said skill labels could make people feel
judged (owner brief _P0: Everyone belongs_). CourtQueue therefore **does not
model ability at all**:

- `Player.skill`, `skillHistory`, `statsPublic`, `Court.kind` and the court
  skill ranges are gone from the types. Stored clubs that still carry them are
  scrubbed when read (`tidyClub`) and rewritten clean on the next club write —
  **no migration**, the documents are plain JSON.
- Courts are interchangeable (`Court 1/2/3`). The fairness engine
  (`fair.ts`) mixes people by turns, minutes, waiting, new partners, a welcome
  for newcomers and, as a gentle tie-break, a per-night `Session.moods` choice
  ("what kind of game sounds fun today?"). It never reads or infers ability.
- Organizers get `play-next` (a queue nudge cleared when called) instead of a
  level picker.
- Scores, winners, win %, points and the club board are no longer produced or
  shown. The `score`/`confirm`/`dispute` engine commands and stored game
  fields remain only so earlier nights still load; nothing sends them.

This is a product decision recorded in `docs/PASSPORT-PRODUCT-DOCTRINE.md` §10
and `docs/product/badminton/README.md`.

## Amendment 2026-11-12 — Play. Learn. Grow. Together.

The owner's next brief (_P0: Play. Learn. Grow. Together._, M687) refines the
2026-11-10 amendment. **This is a deliberate partial reversal, named here so it
is not mistaken for drift:** an optional Beginner / Intermediate / Advanced
answer returns — as a private guide, not a label.

- `Player.journey` (`journey.ts`): optional level, "friendly partner" wish,
  goals, techniques being practised, challenges tried. It is sent to that
  player's phone only (`MeView.journey`); no card, roster, organizer view,
  notification or "why" line ever carries it (`journey.test.ts` checks).
- Still removed and guarded by `belong.test.ts`: courts for a level, scores,
  win records, points, boards. Level words may appear only in the journey,
  learn, demo and Grow files.
- The fairness engine uses level and mood only as small tie-breaks, always
  behind turns, minutes and waiting (`fair.ts`): helper beside someone who
  asked for one, "Challenge Me" with someone at least as experienced, "Find My
  Rhythm" avoiding the widest spread. Mixed games are never required and no
  one is made to coach. Organizers keep assign / play-next.
- Moods are now four: Just Here to Play, Find My Rhythm, Challenge Me, Happy
  to Help (stored ids `fun`, `rallies`, `challenge`, `help`).
- `/badminton/demo` runs three made-up nights through the real engine.
- No migration: `journey` is a new optional field in the club JSON document.

## Amendment 2026-11-11 — scores and comparisons, in a demo of their own

Owner brief M737 ("Ship Badminton and Sesh Wars now"), Lorne, verbatim:
**"The latest owner requirements supersede the old doctrine prohibiting scores
and player comparisons."** and "No authentication or database is required for
this demonstration."

- Built as M735 recommended: a separate simulator, `src/lib/badminton-demo/`
  (pure, seeded) with its page at `/badminton/game-night` and its UI in
  `src/components/badminton-demo/`. It has 25 fictional players with levels
  1–5, four doubles courts, scores (validated as finished games: to 21, win by
  two, 30 cap), wins, losses, games and minutes, a FIFO queue with estimated
  waits, automatic rotation (the front of the line always plays, partners
  closest in level from the next five, pairs balanced by level total), and
  `localStorage` persistence with Reset Demo.
- The real engine, its stored documents and `belong.test.ts` are **unchanged**.
  The demo shares no code or storage with them, so nothing it shows can reach
  a real player's phone.
- Open: whether the real club night now takes scores and records too. The
  owner's words allow it; this amendment does not do it.

## Amendment 2026-11-12 — the real club night keeps scores, wins and losses

Owner brief M757 ("P0 — BADMINTON: 25-PERSON LIVE LAUNCH TOMORROW"), Lorne:
"THIS IS NOT A DEMO", with "Record final scores. Track wins and losses. Show
player statistics. Preserve game history." This is the further owner call the
2026-11-11 amendment left open, and it is answered **yes** for the real night.

- **Four doubles courts** (was three). A club stored with three gets Court 4
  the next time it is read (`tidyClub`); no migration.
- **Email at sign-up** (required, private to the organizer, never used to sign
  in; sign-in stays name + PIN). It is not verified: nothing is sent to it.
  Existing players can add theirs under Me.
- **Final score** is entered by whoever taps FINISH (two numbers, no ties, 0–99)
  and can be added or fixed afterwards by any of the four or an organizer.
  Old `confirm` / `dispute` stay unused. Game documents already carried
  `score` / `winner`; no new fields, no migration.
- **Stats**: a player's own page shows nights, games, wins, losses, minutes;
  Me also shows everyone's games, wins and losses **in name order** (a record,
  not a ladder) and the game history with scores.
- **Still true**: no skill levels, tiers, ranking, points, percentage or
  leaderboard. `belong.test.ts` still bans `leaderboard`, `winPct`, `won–lost`
  and `club board`; it now allows `score`/`winner`/`wins`/`losses`.
- The club organizer's earlier worry (the labels made people feel judged) is
  not answered by this; it is a decision to be watched on the first night.
- **Join**: the Organize tab shows a QR code and the link `/badminton`.

## Amendment 2026-11-12 — court eligibility is optional, and the organizer's

Owner brief _P0: CourtQueue — finish configurable drop-in play_ (M779), Lorne,
via the brief: **"Court eligibility is OPTIONAL and configurable by the
organizer."** and "Open play. Every player is eligible for every court" as the
default. **This explicitly supersedes** the 2026-11-10 amendment ("courts are
interchangeable… no court is for a level") **and narrows** the 2026-11-12
"Play. Learn. Grow." rule that a level is only ever a private guide: in
guided play a level now decides which courts a player may be put on. It is a
named owner decision, not drift.

- **Two modes** (`Rules.mode`, absent = open). _Open_: every player, every
  court — what the club has run so far. _Guided_: each court may carry a
  `minLevel` (beginner / intermediate / advanced); a player below it is never
  put on that court — by the fairness engine, an organizer's `assign`, or a
  challenge. A player above it may play any lower court. Switching mode is one
  tap and takes effect at once: a called-but-not-started game that is no longer
  allowed is returned to the line, with places kept.
- **Whose level counts** (`eligibility.ts`): the organizer's placement
  (`Player.placedAt`), else the player's own private answer, else
  **beginner** — a player nobody has placed is never sent to a court asking for
  more. Levels are shown to the organizer in one card (_How courts are
  chosen_), in guided play only, and are never in any player's view; a player
  sees only "Open to Advanced and up" on the court itself.
- **Selection** (`fair.ts`): the line is filtered to the players a court may
  take **before** anyone is anchored, so the longest-waiting _eligible_ player
  goes first, and an ineligible player at the front neither blocks the court
  nor loses their place for another. The most restricted free court is filled
  first, so a scarce advanced court is not starved by a beginner court taking
  its players. If too few eligible players are waiting the court stays empty
  rather than break the rule.
- **Any number of courts**: `Court.id` is a number, `courts-count` sets 1–12
  (removing a court with a game on it is refused), and `Club.courtsSet` stops
  `tidyClub` topping a shortened list back up to four. A club that never
  changes it keeps its four courts; a legacy three-court club is still
  upgraded to four.
- **Unchanged**: the rotation (all four leave after every game, nobody stays
  on, longest wait first, a passing player never blocks the court), the
  fairness ledger from b9cf9b7 (not duplicated; the dashboard now adds each
  waiting player's place in line, eligible courts and an _eligible_ court to
  take next), and statistics derived from the games, so a corrected time
  corrects every figure.
- **Still true**: no ranking, ladder, or level on a player's card; ability is
  never used to balance teams. No migration — every new field is optional on
  the existing JSON documents.
