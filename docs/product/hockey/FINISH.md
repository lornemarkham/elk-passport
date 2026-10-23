# Hockey Night — finish the experience (2026-10-22/23)

**Asked:** complete Hockey Night as one experience a group can use before,
during and after the game — a feature-completion pass, not a redesign.
Production baseline `1fc9a5f`.

**Status:** on `feature/hockey` after `2a9592a` (same tree as production). What
needs a database change is isolated in one migration that is **not applied
anywhere**; with it absent the night works exactly as production does.

Pictures: [`finish/shots/`](finish/shots/). Journey drivers:
[`verification/finish.spec.ts`](verification/finish.spec.ts),
[`finish-play.spec.ts`](verification/finish-play.spec.ts),
[`finish-off.spec.ts`](verification/finish-off.spec.ts).

## 1. The audit (before any code)

Method: read the doctrine and every Hockey doc, then drove the production-tree
build in a browser with a host and two guests through before, during and after
the game ([`finish/audit.mjs`](finish/audit.mjs)).

| #   | Capability                                                                                       | Verdict before                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Predictions, sealed reveal, scoring, leaderboard                                                 | **Complete and working** (picks deck, lock at puck drop, "Who called it" flip, Cup standings, receipts)                                              |
| 2   | Secret missions, dares, funny challenges                                                         | **Complete** in the engine and toy box; never exercised with three real people — now is (`finish-play.spec.ts`)                                      |
| 3   | Sycle Cup, forfeits                                                                              | **Complete** (Cup roll of honour across a run, forfeits attached to options, receipts block). Titles not points persist, by an earlier decision      |
| 4   | Photo sharing and group memories                                                                 | **Missing.** Photo "challenges" were captions only (README: "Photos are captions"). No upload, no storage, no album                                  |
| 5   | Live NHL information                                                                             | **Missing.** README: "Passport has no scores feed". The host called every result from memory                                                         |
| 6   | Morning-after results and recap                                                                  | **Complete** (the morning after leads with results, awards, "Now go have another") but had no photos in it and relied on the host typing the score   |
| 7   | Run it back                                                                                      | **Working**, with one defect: opened on a date already in the past when the last night was weeks old, so the first tap failed with "already started" |
| 8   | Host configuration and controls                                                                  | **Partial.** Modules, invitations, remove guests, call results existed. **Missing:** change the game (opponent/time), cancel a night                 |
| —   | Invitations, auth, restaurant cards, voting, meeting points, directions, seats, chat, Arena Mode | **Complete.** Not touched except as listed below                                                                                                     |

## 2. What changed

**Memories (new, needs `memories-migration.sql`).** A shared album on Play
(and on the "put your phone away" screen, where a photo is the one thing worth
a phone). Add a photo; the phone shrinks it to a 1280px JPEG; a caption is
optional, with the night's own photo challenges offered as ideas ("All of us
plus one Kraken fan"). Everyone on the night sees everything within ~15s;
the photographer or the host takes one down. Stored as base64 text in
`passport_occasion_photos` — no storage bucket, no public URL, nothing to
configure. RLS: read = members, add = a member as themselves, remove = owner or
host, edit = nobody, anon = nothing. A photo is only readable through
`/hockey/api/occasions/:id/photos/:photoId`, 404 to a stranger. Leads the
morning after, under the host's call.

**Live NHL (no migration).** `api-web.nhle.com` is public and keyless. A night
is matched to a league game only when a Canucks home game starts within 4h of
puck drop **and** the opponent name agrees; otherwise the page says nothing.
While the game is on the hero carries the league's score, period and clock
(and the last goal); between periods "After the 2nd". When the game is final
the host's **Call it** offers "Use the NHL's numbers" — final score, overtime,
first goal, total goals, and nothing the record cannot settle (refs, beer).
It is still the host's own call, editable afterwards. League down or no match →
no board, no suggestion, the host calls by hand as before. Cached seconds
while live, minutes otherwise. No logos or crests.

**Host controls.** Group → _The game_: change opponent or puck drop while the
game is ahead (every lock moves with it, nobody's answers are lost); _Cancel
this night_ asks twice and takes everything with it. Host only, enforced by
the database's host policies.

**Run it back.** Opens on a fortnight later, or a week from today when that
has already gone by.

**Not changed:** the restaurant photo cards, Plan, invitations, auth, voting,
meeting points, directions, seats, chat, Arena Mode, the schema of everything
that exists. `GroupTab`, `PlayTab`, `GameDayHero`, `HockeyNightScreen`,
`CallIt` gained one block each.

## 3. Verification

All with real accounts on the local GoTrue + PostgREST + Postgres stack
(production's grants), real Chromium at 390px, photographs in `finish/shots/`.

| What                                                                                                                                                                                                                                                                                                                                                                           | Result |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| `finish.spec.ts` — create → invite → join (two real sign-ups) → vote → predict by thumb → photo upload (real file → shrunken JPEG, seen by another phone, strangers 404, guests 403, direct-to-PostgREST attacks refused) → host changes the game twice → the league's recorded real game (26 Sep 2026 Canucks–Kraken 4–3) → one-tap call → recap → run it back → cancel No. 2 | passes |
| `finish-play.spec.ts` — secret mission private to its target (absent from every other payload), forfeit opt-in, prediction called by its asker, Cup and receipts                                                                                                                                                                                                               | passes |
| `finish-off.spec.ts` — photos table absent **and** NHL down: night unchanged, Memories absent, photo routes answer in sentences (409), no scoreboard, Call it by hand                                                                                                                                                                                                          | passes |
| Unit: `nhl.test.ts`, `memories.test.ts`, `schedule.test.ts`                                                                                                                                                                                                                                                                                                                    | pass   |

NHL data in the journey is a **recorded real answer** served by
`finish/nhl-stub.mjs`; the live in-progress shape is covered by unit tests
only (no game is on this week while testing). Verify it on a real game night.

Full existing Hockey suite on the same build (17 specs): **acceptance** (against
`atlas-stub.mjs`, as it needs), arena-mode, mobile 320/375/390, modules,
plan-and-results, polish, redesign, release1, release2, seats, finish,
finish-play, finish-off (on a `HOCKEY_MEMORIES=0` stack with the NHL down):
all pass. Not run: `email-confirmation` (needs the confirming stack) and
`arena-off` (needs `HOCKEY_ARENA=0`). Repo gates: `tsc`, `eslint`, `prettier`,
`vitest` (3,574 pass) green; see the release note below for the rest.

Defects found by driving it and fixed here: photo POST on a missing table
answered 500 (now a 409 sentence); Run it back opened on a past date; the
league's score and the host's called final were both shown (now one).
Finding, not fixed: the toy box does not close on Escape (its ✕ works).
A secret mission's text is sent back to the host who wrote it (the page does
not show it to them); no other member's payload contains it.

## 4. Before it is used

1. **Apply `memories-migration.sql`** (preflight first: `memories-preflight.sql`;
   rollback: `memories-rollback.sql`), by a human in the SQL editor. Until then
   Memories simply does not appear.
2. Nothing else: the NHL reader needs no key, secret or configuration.
3. Tell the `passport-domain` lane to land the migration in
   `supabase/migrations/` (shared contract; this lane only proposes it).

## 5. Known limits, named

- Photos are small JPEGs in the database. ~120 per night is the cap; a bucket
  would be the move if nights ever want video or originals.
- No push notifications; the page refreshes while looked at (photos 15s, NHL 30s).
- The league's API is unofficial in the sense that it is undocumented; its shape
  may change. All of it degrades to "no board".
- Doctrine: §14 lists "elaborate social games" as not-now — unchanged from the
  earlier note; §15.12 (group experiences) stays open and is not answered here.
