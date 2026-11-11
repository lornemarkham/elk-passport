# Sesh Wars — every feature has a champion

**Owner brief:** "SESH WARS — BRING THE MOUNTAIN TO LIFE" (2026-11-10).
**Where:** Go Have A Day → Snow → **Sesh Wars**: `/snow/sesh-wars` (real) and
`/snow/sesh-wars/demo` (Demo Mode). Branch `feature/snow`.
**State:** BUILT and TESTED on `feature/snow`. Not pushed, not deployed, no SQL
applied anywhere real (see §8).

Someone hits a park feature, a friend films it, they post it. Someone on the
chairlift thinks "sick — but watch this" and answers with their own clip on
the same feature. That's a challenge. The mountain votes for 24 hours. Winners
become champions of the feature for the day, the week, the season, all time.
Riders earn embroidered-style patches along the way.

## 1. What a person can do

| Step                                                                                                                                                                                                                       | Where                                          | Real              | Demo                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------- | ------------------------------------- |
| Enter from Snow                                                                                                                                                                                                            | `/snow` hero button + the olive Sesh Wars card | ✓                 | ✓                                     |
| Pick a mountain (SilverStar, Big White, Whistler Blackcomb)                                                                                                                                                                | landing, `/m/<id>`                             | ✓                 | ✓                                     |
| See featured challenges, popular clips, trending riders, mountain champions, rivals                                                                                                                                        | mountain page                                  | ✓                 | ✓                                     |
| Open a feature: name, resort, where, description, sizes, resort's note and source, champions ×4 periods, live challenges, leaderboard (period × category × ski/snowboard × division), clips, hall of champions, Chirp Room | `/f/<id>`                                      | ✓                 | ✓                                     |
| Watch a clip (tap to play — nothing autoplays)                                                                                                                                                                             | `/c/<id>`                                      | real video        | drawn reel                            |
| React 🔥 👑 😂 ⚔️ 🚀 (toggle)                                                                                                                                                                                              | clip page                                      | ✓                 | ✓                                     |
| Chirp (quick chirps or typed), report, block                                                                                                                                                                               | every Chirp Room                               | ✓                 | ✓                                     |
| **⚔️ CHALLENGE THIS RIDER** → post your answer                                                                                                                                                                             | `/answer/<clip>`                               | ✓                 | ✓                                     |
| Post a session: mountain → feature → video → ski/board → division → category → caption → confirm → publish                                                                                                                 | `/post`                                        | upload to Storage | file stays on the phone, or a drawing |
| Head-to-head: both riders, both clips, category, what to judge, timer, vote, tally bar, winner + crown, Chirp Room, share                                                                                                  | `/x/<id>`                                      | ✓                 | ✓ + "skip to the buzzer"              |
| Share a clip or challenge (phone share sheet, else copy link)                                                                                                                                                              | clip / challenge                               | ✓                 | ✓ (demo links open the demo)          |
| Rider dossier: name, home mountain, sport, division, crew, record, patches, favourite features, challenges, clips                                                                                                          | `/r/<id>`                                      | ✓                 | ✓                                     |
| Patch locker: earned and locked patches                                                                                                                                                                                    | `/patches`                                     | ✓                 | ✓                                     |
| Chairlift feed: trending here, today's best tricks, new challenges, rivals' clips, champions dethroned, popular elsewhere                                                                                                  | `/feed/<mountain>`                             | ✓                 | ✓                                     |
| Rider profile (nickname, home mountain, sport, division, age group)                                                                                                                                                        | `/me`                                          | ✓                 | ✓                                     |

## 2. The rules (src/domain/snow/sesh/rules.ts, re-checked by Postgres)

- **A challenge** is an answer clip on the same feature, in the same
  division, between riders of the same age group who haven't blocked each
  other. One open challenge per rider per clip.
- **Voting**: 24 hours from the answer. One vote per signed-in rider per
  challenge, final. Riders in the challenge don't vote on it. No direct
  table writes exist — every write is a function that checks again.
- **The winner** has more votes at the close. **A tie goes to the defender**
  (you have to take the feature, not share it). **No votes is no contest** —
  nobody is crowned by default.
- **Champions** of a feature for a period (Vancouver day, week from Monday,
  season 1 Aug–31 Jul, all time): most challenge wins closed in it → most
  votes won → whoever got there first. History lists past days, weeks and
  seasons. Derived from votes on read, so a crown can't drift from the record.
- **Patches** (9, derived the same way): First Flight, Gauntlet Thrown, Top
  Cover (10 votes cast), Rail Ace, Style Commander, Comeback Kid, Local Legend
  (finish a season as champion), Mountain Legend (wins on 3 features),
  Squadron Leader (locked — "arrives with crews"). Four of nine reward taking
  part, not winning.

## 3. Safety as product design

- **Only resort-listed features.** Real features are parks/lanes each resort
  publishes, with the page and the day read (`catalogue.ts`, seeded by the
  migration; a test keeps them equal). No jump, rail or hazard is invented,
  and nothing is placed on a map. A park with a published opening day takes
  no clips before it.
- **Posting asks two things**: rights ("I filmed it or have the OK, and
  everyone recognisable is fine with it") and "open, resort-built feature,
  nobody got hurt". Postgres refuses a clip without both.
- **Nothing rewards size, speed or risk.** Categories judge style, control,
  cleanliness, creativity, progression. "Funniest Harmless Bail" says the
  rider got up laughing or it isn't eligible. Captions and chirps refuse
  escalation ("bigger than", dares, gaps, closed terrain, ducking ropes, no
  helmet), injury, drinking, insults and contact details (`safety.ts`).
- **Younger riders (13–17)** compete only with riders their age; signed-out
  visitors never see their profile, clips or chirps (row-level security —
  their video links 404 too); adults can react on a younger rider's clip or
  challenge but can't post words there. Under 13: no profile — a parent or
  guardian posts and the clip says so. The age group is set once.
- **No locations.** A clip names a feature, never where someone is now.
- **Report** (7 reasons, one per person per thing): three distinct reports
  hide a clip or chirp, or close a feature, until a moderator looks.
  **Block** stops challenges and chirps both ways. Moderators
  (`passport_sesh_moderators`, added by SQL) restore, remove, approve and
  close through `passport_sesh_moderate`.
- **Less phone, more life (doctrine §6):** no autoplay, no background
  preloading, still images on cards.

## 4. Real vs demo

**Persistent (real):** riders, features (+ proposals), clips, challenges,
votes, chirps, reactions, reports, blocks, moderators — tables in
`docs/product/snow/sesh-wars-migration.sql` (PROPOSED; contracts lane moves it
to `supabase/migrations/`). Video and stills: private Storage bucket
`sesh-wars-clips` (ADR 019, PROPOSED). Champions and patches are derived from
those rows, not stored.

**Demo-only:** `/snow/sesh-wars/demo`. 30 fictional riders in 4 fictional
crews (6 of them 13–17, to show the protections), 10 fictional features on the
three real mountains (each marked "Demo · fictional feature"), ~10 days of
clips, challenges, votes, chirps, reactions and last season's legends, built
deterministically around the moment the demo opened. Clips are **drawn
reels**, labelled "DEMO ILLUSTRATION · NOT FOOTAGE" — no footage is
pretended. Everything the visitor does is replayed from a short log in their
own browser through the same rules; nothing is sent to a server, so demo
activity can never mix with real riders. "Skip 24 h" lets the fictional crowd
vote so a crown is handed out in front of you. Starts over after 12 hours.

**Before the migration is applied**, `/snow/sesh-wars` says "Sesh Wars is
warming up" and offers the demo. It probes the database (as Snow's readiness
probe does), so code can ship before SQL with nothing broken and no flag
to flip.

## 5. Verified features (read 2026-11-10, official sites only)

| Mountain           | Feature (resort's name)                                                               | Source                                           |
| ------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Big White          | TELUS Park — Small & Medium lane (opens 2026-11-26)                                   | bigwhite.com/mountain-conditions/park-conditions |
| Big White          | TELUS Park — Large & XL lane (opens 2026-11-26)                                       | same                                             |
| Big White          | TELUS Park halfpipe (opens 2026-11-26)                                                | same                                             |
| Whistler Blackcomb | Ego Park (small features, Whistler)                                                   | whistlerblackcomb.com/…/terrain-parks.aspx       |
| Whistler Blackcomb | Choker Park (small features, Blackcomb)                                               | same                                             |
| Whistler Blackcomb | Terrain Park (intermediate + advanced)                                                | same                                             |
| Whistler Blackcomb | Highest Level Terrain Park (expert; helmets mandatory)                                | same                                             |
| SilverStar         | **none** — no park names on any page Passport could read; trail map is a PDF not read | —                                                |

Not verified: lifts and runs serving each park, individual named jumps/rails
(parks rebuild them), Whistler's park opening dates, the Smart Style rule
wording (an image on Big White's page).

## 6. Architecture

- `src/domain/snow/sesh/` — pure: model, rules, time, safety, patches, feed,
  actions (parse/check/apply), catalogue, demo.
- `src/app/snow/_server/sesh.ts` — reads as the caller (RLS), writes via RPC.
- `src/app/snow/sesh-wars/` — layout (fonts + patch celebration),
  `[[...path]]` real pages, `demo/[[...path]]`, `api/act`, `api/video/[id]`.
- `src/components/snow/sesh/` — art (patches, insignia, marmot mascot, demo
  reels), screens, post flow, demo store, styles.
- Reuses: Passport auth/session (`adventureSession`, `/auth?next=`), the
  Snow shell and mountains list, Passport's Supabase client, the readiness
  probe pattern. Not reused, deliberately: the adventures core (a sesh is not
  a planned day) and Snow Day's photo store (video doesn't fit in rows).

Visual identity: olive, cream, burnt orange, faded red, charcoal on a
weathered contour-map paper; Alfa Slab One + Special Elite (scoped to Sesh
Wars); stitched outlines, hard offset shadows, film-sprocket clip frames;
an invented squadron insignia with a goggled marmot mascot. No real unit
insignia or real-world symbols.

## 7. Tests (at the committed sha; see the release record in the report)

- `src/domain/snow/sesh/sesh.test.ts` (unit, 20): voting, tie/no-contest,
  champions, age/blocks, moderation threshold, words, time, catalogue ↔
  migration, demo determinism and its own rules, the scripted crown + patches.
- `src/components/snow/sesh/ctx.test.ts`: URLs.
- `src/app/snow/_server/sesh.stack.test.ts` (real local Supabase, 3):
  seeded features; post → challenge → votes with every refusal from Postgres
  (own clip, double vote, self vote, other people's files, missing
  confirmations, unopened park, direct inserts); signed links; chirps,
  reaction toggle, blocks; 3 reports hide; younger-rider protections.
- `docs/product/snow/verification/sesh.spec.ts` (phone, Playwright, 2): the
  brief's success journey in the demo; real upload (a WebM recorded in the
  browser), challenge, vote and chirp on three accounts.

Run: `node docs/product/snow/verification/stack.mjs start`;
`SNOW_STACK_ENV=~/passport/scratch/snow-stack/env npx vitest run src/app/snow/_server/sesh.stack.test.ts`;
`next dev -p 3132` with the stack env; `E2E_PORT=3132 npx playwright test -c docs/product/snow/verification sesh`.
The stack's Storage is a stand-in (stack.mjs) that enforces the same rules;
real Supabase Storage is first exercised in a deployed preview.

## 8. To release (owner / release runner)

1. Code can ship first: without the tables, `/snow/sesh-wars` shows
   "warming up" + the demo, which is fully playable.
2. Apply `sesh-wars-migration.sql` (after it is moved to
   `supabase/migrations/`). It creates the bucket only where Supabase Storage
   exists. Rollback: `sesh-wars-rollback.sql`.
3. Add at least one moderator:
   `insert into passport_sesh_moderators (user_id) values ('<uuid>');`
4. Decide the Storage plan (ADR 019) before inviting riders.

## 9. Open questions for the owner

1. **Doctrine §14 lists "elaborate social games" as not-now.** This brief
   asks for exactly a social competition. Built because the brief is the
   owner's own words. Recorded in the doctrine as an owner decision, not
   resolved silently.
2. **Snow Day's own rule** ("there is no point source for … jumps, terrain")
   still governs snow days. Sesh Wars keeps a different, narrower line
   (escalation and harm, not the park itself). Two rule sets, both named.
3. Storage plan and cost (ADR 019); whether to add transcoding (HEVC `.mov`
   from iPhones may not play in every browser).
4. Age model: self-declared 13–17 / 18+, under-13 via a parent. Whether that
   is enough for launch (consent records, verified guardians) is a legal and
   owner call.
5. SilverStar's features: ask the resort, or read the trail-map PDF and have
   a moderator approve.
6. Who moderates, and the moderation queue UI (P1 — today it's SQL + the
   function).
7. The word filter runs in the app. Postgres enforces lengths, not words. A
   hand-crafted call could post a rude chirp, and only reports catch it.

## 10. Not built (P1 / P2)

Crews and crew challenges (Squadron Leader is shown locked), friends/follows
(the feed uses "rivals" — riders you've faced), feature proposals UI (the
function exists), moderation queue UI, notifications, link-preview images,
seasonal-championship ceremony, resort partnerships, events, physical patches
(each patch already carries a code, `SW-01`…), cross-resort tournaments.
