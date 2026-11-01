# Hockey Night — finish the experience (2026-11-01)

**Asked (P0):** after a real group used Hockey Night at Canucks vs Wild on
25 October 2026 (6/10, "earned another cycle"): fix the score-prediction
orientation, add host announcements and chat replies, give the pregame a
week to develop, keep the AI's context-aware humour, improve live
predictions and assess mini-fantasy, preserve food and arena, make the
postgame rewarding, open Hockey Night to the public at `gohaveaday.com/hockey`
without hard-coding Sycle, Vancouver, Rogers Arena or a matchup, audit
mobile, and release. Not a redesign: keep the personality, the visuals,
the features.

**Where:** `feature/hockey` on Metatron, fast-forwarded first onto GitHub
`main` `26b9ccf` (Fairview 3; every earlier Hockey commit was already in
it). **Not pushed, not migrated, not deployed** — this clone cannot push
and never deploys (`CLAUDE.local.md`); §9 is the owner's path. Everything
"measured" below was measured here, on a real local Postgres + GoTrue +
PostgREST stack with production's grants and every Hockey migration
applied.

---

## 1. What was fixed

### A prediction means the same thing everywhere

**The finding.** The league's own record of the real game
(`api-web.nhle.com/v1/gamecenter/2026020184`, read 2026-11-01) is **Wild
4, Canucks 2** — home VAN 2, away MIN 4. The host meant "the Wild win 5–0";
Alex meant "the Wild win 4–2" — Alex had the exact score. In the code, a
score has always been **stored `[home, away]`**: the entry card (two
columns, VAN | MIN), the "Call it" sheet, the league's suggestion and the
scoring all agree on that order, and nothing re-interprets a stored pick.
What was wrong is that **five places said a score as two bare numbers** —
"5–0" — with nothing to say whose number was whose: the reveal, the hero's
"Final 2–4", Chirp Bot's "picks are sealed, Lorne called it 5–0", the
spectacularly-wrong line, and Passport's own voice in the feed. Read aloud
in a room where everyone is thinking "Wild", "5–0" means the Wild, and the
page meant the Canucks. The welcome card also said "Wild at Canucks"
(away first) under a poster that says "Canucks vs Wild".

**The fix.** One helper, `src/domain/hockey/score.ts`, says every score
with both codes around it, home first — **"VAN 2–4 MIN"** — and every
place that used to print a bare pair now uses it: the reveal
(`answerText`), the hero's Final row (drawn from the stored pair, not a
parsed string), the Cup's spectacularly-wrong line, Chirp Bot's sealed
and worst-pick lines (the render context now carries tonight's sides),
the league's "Use the NHL's numbers" suggestion, and the lab's voice
(`pairLabels` are used when present). Historical picks are untouched; a
pick made on 25 October reads exactly as it was stored, now with its
teams named.

**Regression suite** — `src/domain/hockey/score.test.ts`, 13 tests on the
real record: the question's labels are `[home, away]` for the Sycle night
and for any opponent a host picks; `readGame` reads the league's record
home first and `suggestedCalls` says "VAN 2–4 MIN" with the Wild scoring
first; scoring on `[2, 4]`: Alex's `[2, 4]` is exact, the host's `[0, 5]`
is "right winner", and the same numbers the other way round score nothing;
the reveal, the voice, Chirp Bot and the Cup all say both codes. The
public-night spec adds the same check for a Leafs home game (labels
"Maple Leafs", "Bruins").

### Also fixed on the way

- The hero's Final row parsed the reveal's text with `split("–")`; it now
  reads the stored pair.
- On a phone, the new game picker widened the page (a `fieldset`'s minimum
  width is its content's; a flex `li` will not shrink); both fixed, and
  the spec asserts no sideways scroll on the form.
- Chirp Bot's server-side game context assumed the home side was the
  Canucks; it now reads the night's own home team.

## 2. What was improved

| Area              | Before                                                                                   | Now                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Chat**          | Lines, reactions, Chirp Bot. No way to answer one line in particular; no times.          | **Reply** (↩ on any line, people's or Chirp Bot's): the composer shows "Replying to Alex — …" with ✕; the reply carries a quote of the line it answers on every phone. Every line shows its time. A reply to something you said reads like a mention at a whistle ("Alex replied to you"). Announcements and photos count as unread.                                                                                                                                                                                         |
| **Pregame**       | Started two days out; `before` phase from −14 days; Chirp Bot's questions from 72 h out. | **The run-up** (`runup.ts`): stages by calendar days in the arena's zone — invitations & teams (7+), rivalries & early picks (4–5), chirps & dares (2–3), lock it in (1), game day, after. A card on Plan says what the stretch is for and what is still open, from what the group has done (done things tick and sink; four at most; only the host is asked to invite). Chirp Bot says **one line per stage**, only with two people in and only once somebody has spoken since its last. Nothing daily, nothing on a timer. |
| **Postgame**      | Results called by the host, Cup verified, awards, recap, photos, run it back.            | The same, plus: every result and pick says its teams; after the horn the **host is nudged from the hero** — "The league has it VAN 2–4 MIN. Call it so the Cup counts." — straight to Call it. The recap's score was already labelled.                                                                                                                                                                                                                                                                                       |
| **Trophy**        | "Sycle Cup" everywhere.                                                                  | The night's own name (`details.cup`; the start form asks "What's your trophy called?"): the drawn trophy's engraving, the Cup board, the champion card, the shelf, Chirp Bot's verdict and lead lines. Every existing night keeps the Sycle Cup. A run keeps its name when run back.                                                                                                                                                                                                                                         |
| **Time**          | Vancouver's clock everywhere.                                                            | The arena's zone (`details.timeZone` from the league) on the hero, the welcome, the shelf and the host's game form; Vancouver when unknown.                                                                                                                                                                                                                                                                                                                                                                                  |
| **Arena honesty** | Every night measured distances from Rogers Arena.                                        | `venuePoint()` gives coordinates only for Rogers Arena. A night in any other arena measures nothing and the pregame says "Passport hasn't measured Scotiabank Arena yet, so it can't say what's near it" — typed places still work. Arena Mode, seats directions and the Crew stay Rogers Arena's.                                                                                                                                                                                                                           |

## 3. What was added

### Host announcements — "CHANGE OF PLANS!"

`src/domain/hockey/announce.ts`, `src/components/hockey/Announcements.tsx`,
`docs/product/hockey/announce-migration.sql`. Screens: `announce/`.

- **The host** opens Chat → **Announce a change** → a sheet: the kind
  (Important update · Venue change · Meeting spot · Time change), the
  words, and optionally a place name (becomes a Google Maps _search_ link
  — a search, never a claim about the place) or any https link.
- **Everyone else** sees it as a gold banner at the top of **every tab**,
  and **above "Put your phone away"** in a period, until they tap **Got
  it!** (a ✅ reaction — the chat's own reactions table, one per person,
  in the database, so a reload or another phone agrees) or ✕ it on that
  phone only. "View location" opens the link. More than one pending:
  the newest on top, "N more after this".
- **In the chat** the same announcement is a card in the conversation,
  with time and "2 of 4 got it · waiting on Sam, Maya" for the host, who
  can **Take it down** (asked twice).
- **Reuse, not a second system.** There is no shared Passport announcement
  implementation to reuse (checked: boards, conference chat, the adventures
  core have none), so this is built on the conversation the night already
  has: an announcement is a moment with `kind = 'announce'` and a `tag`;
  acknowledgement is a reaction; members-only reading, removal and
  reactions are the existing policies. **Only the host may insert one**
  (policy). Proposed for the adventures core when Hockey adopts it (ADR
  009): the same two columns and the same reaction would carry over.
- **Without the migration** the chat works as before: no Announce button,
  the API answers 409, replies post as plain lines.

### Chat replies

`reply_to` on the moments table, checked by a trigger to point at a line
on the **same night** (a person's line, a photo, a Chirp Bot line or an
announcement); the `say` action takes `replyTo`; the server posts a plain
line if the target is not on this night rather than refusing what the
person typed.

### Public Hockey Night — `/hockey`

`src/components/hockey/HockeyLanding.tsx`, `StartNight.tsx`,
`GET /hockey/api/games`, `nhl.ts`, `schedule.ts`. Screens: `public/`.

- **Signed out, `/hockey` is a front door** (indexable, unlike every night
  behind it): "Hockey is better with your crew. Plan the night. Pick your
  teams. Talk trash. Make predictions. Compete. Make memories. **Start a
  Hockey Night.**" — plus before/during/after in three lines and "got an
  invitation link? open it". Nothing on it comes from a night. The
  spec asserts the page does not contain "Sycle" and that a stranger
  with a night's id still gets a 404.
- **Signed in, the start form picks a game from the league's own
  schedule**: the next three weeks of regular-season and playoff games
  (`/v1/schedule/<date>` walked by `nextStartDate`, cached 15 min), any
  team filter, each game as "Bruins at Maple Leafs · Thu, Nov 12 · 9:00
  p.m. EST · Scotiabank Arena" in the arena's zone. The night then
  carries the league's **game id**, both sides by code and nickname, the
  arena and its zone; the live score and the host's suggestions are tied
  to that game and no other (`findScheduled` by id first). The league
  down, or a game not listed: **"Set a Canucks home game by hand"**, the
  form as before.
- **Not hard-coded.** `details.home` is the home team (Canucks only by
  default for hand-set nights); the first-goal question's option ids
  stay `canucks`/`opponent` for stored answers' sake but are labelled
  from the night; the title of a schedule-picked night is "Hockey Night";
  the Cup is the group's own (above). Still Rogers-only, by design and
  said so: Arena Mode, seats directions, the Crew, the curated meeting
  spots and the "near the arena" offer.
- **Private stays private.** No night, name or arena on the public page;
  nights are members-only as before; `[id]` pages stay `noindex`.

### Mini fantasy — assessment, and a reader

**Data:** the same key-less league feed already used for the live score
publishes, per game, a **boxscore** (`/v1/gamecenter/{id}/boxscore`:
every skater's goals, assists, shots, hits, blocks; every goalie's saves,
goals against, decision) and **play-by-play** (294 events for the real
game: goals with scorer and assists, shots, hits, penalties, period
starts), plus `rosterSpots` (40 players with names and positions) on the
play-by-play. Reliability: cached by the league's CDN, 4 s timeout here,
any failure is "not available" rather than a wrong number. **Licensing:**
it is the league's public API with no published terms for this use; no
logos or headshots are used (the night already avoids marks), and only
names and counting stats would be shown. That is an owner question
before a public feature, named in §8.

**Built (no screen):** `src/domain/hockey/fantasy.ts` reads a boxscore
into lines and scores a roster by a fixed, published rule (goal 3, assist
2, shot/hit/block ½, save 0.2, goalie win 3, shutout 4; two skaters and
one goalie), says which rostered players the record does not list (0,
never invented), and ranks a table deterministically. `fantasy.test.ts`
proves it on the **real 25 October boxscore** (trimmed to the fields
used, `fixtures/nhl-boxscore-2026020184.json`): Boeser 1 G, 1 SOG, 3 hits,
1 block = 5.5; the winning goalie's saves + win; no shutout.

**Plan for the working version** (one mission, ~a day, after §8's
licensing answer): a `fantasy` prompt kind or a `passport_occasion_fantasy`
table (three player ids per member, locked at puck drop by the existing
lock rule), a roster picker from `rosterSpots` once the league posts
lines (game day; before that, `/v1/roster/{team}/current`), the reader on
the game route, a leaderboard card under the Cup (separate from Cup
points, or 5 Cup points to the winner — owner's call), Chirp Bot lines
for the lead change. Nothing fabricated: a player not in the record is 0
and says so.

### Live challenges — assessed, not built

"Who scores next?", next-goal timing and period scores are feasible from
the same play-by-play (goal events carry period, time, scorer, score
after), with a lock rule per challenge (open after a goal, lock at the
next). It is a second real-time system (polling every 10 s, settlement
by event id, re-settlement when the league corrects a scorer) and was not
started: the existing bets on first goal, winner, overtime and over/under
already settle from the host's call, which can be made from the league's
numbers. Recommended order: fantasy first (end-of-game settlement, no
timing edge), then live challenges on the same reader.

### Food run

Already built as the Crew's **Snack run** (`CREW.md`, 2026-10-24): "I'm
going for food" to a stand from the arena's own map, friends add one
line of request (chips from the dietary guide where it lists items), the
runner closes it; no prices, no payment. Not live in production until
`crew-migration.sql` is applied (§9). Not changed here; its spec is in
the regression run (§6).

## 4. Mobile audit

Every new screen was built at 390 px and the specs assert no sideways
scroll at 390 (announcements on Plan, in the chat, in a period; the
picker; the landing). `mobile.spec.ts` (320/375, tap targets ≥ 32 px) is
in the regression run. Found and fixed: the picker's page-widening
(above). Not changed: the `mobile.spec` nit from MAYHEM §8 (the hidden
photo input counted as a tap target, intermittent).

## 5. Files

New: `src/domain/hockey/{score,announce,runup,fantasy}.ts` (+tests,
`chirp-runup.test.ts`, `public-night.test.ts`,
`fixtures/nhl-boxscore-2026020184.json`),
`src/components/hockey/{Announcements,HockeyLanding,RunUp,CupName}.tsx`,
`src/app/hockey/api/games/route.ts`,
`docs/product/hockey/announce-{migration,preflight,rollback}.sql`,
`verification/{announce,public-night}.spec.ts`,
`verification/nhl-schedule-stub.mjs`, screens `announce/`, `public/`.

Changed: `night.ts` (details, `venuePoint`, `detailsOf`, `cupNameOf`,
moments), `nhl.ts`, `schedule.ts`, `chirp.ts`, `chirp-library.ts`,
`cup.ts`, `reveal.ts`, `actions.ts`, `series.ts`, `_server/{night,chirp,game}.ts`,
`api/occasions/route.ts`, `app/hockey/page.tsx`, `ChatRoom`, `GameDayHero`,
`HockeyNightScreen`, `useSharedNight`, `StartNight`, `NightsShelf`,
`HostGame`, `PlanTab`, `PlanBoards`, `CallIt`, `Cup`, `CupRoll`,
`RunItBack`, `play/CupBoard`, `verification/{stack.mjs,playwright.config.ts,mayhem-helpers.ts}`.

**Outside my lane** (named, minimal): `e2e/experiences-nav.spec.ts` (the
Hockey link's test, §6), `src/experience-lab/core/types.ts`
(additive: `Moment` kind `announce` and `replyTo/tag/href`;
`ExperienceDefinition.timeZone`), `src/experience-lab/core/voice.ts`
(a pair is said with its labels), `docs/PASSPORT-PRODUCT-DOCTRINE.md` (one
dated paragraph in §10 recording that `/hockey` is public). No shared
contract (`schemas.ts`, `domains/`, `supabase/migrations/`, layout, shell,
`package.json`) was touched; the migration is proposed in
`docs/product/hockey/` as every Hockey one is.

## 6. Test results

Local stack: real GoTrue sign-ups, PostgREST under production's grants,
embedded Postgres, every Hockey migration applied (including
`announce-migration.sql`), the 2026-10-23 production Atlas body as the
Atlas stand-in, the league stubbed (the recorded Kraken game for the
older specs; the synthetic schedule for `public-night`).

| Gate                                                                                                                                                                                                                    | Result                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                                                                                                                                                                                                      | clean                                                                                                       |
| `npx eslint .`                                                                                                                                                                                                          | 0 errors, 41 warnings (the baseline's; none in Hockey)                                                      |
| `npx prettier --check .`                                                                                                                                                                                                | clean                                                                                                       |
| `npx vitest run`                                                                                                                                                                                                        | **3,950 passed**, 38 skipped (new: score 13, announce 8, public-night 9, runup 8, chirp-runup 4, fantasy 5) |
| `npm run build`                                                                                                                                                                                                         | ok (stack env and placeholder env)                                                                          |
| **New specs:** `announce` (2 phones, 6 steps), `public-night` (6 steps), `announce-off` (no migration)                                                                                                                  | 6/6 · 6/6 · see below                                                                                       |
| **Regression, every Hockey spec:** alive, chirp, arena-mode, finish, finish-play, mobile ×3, modules, multi-night, plan-and-results, plan-pregame, bet-button, mayhem, polish, redesign, restaurant-photos, seats, crew | all pass (36 in the main pass; the 8 whose expectations my changes moved pass on rerun)                     |
| `acceptance` (synthetic Atlas)                                                                                                                                                                                          | 1/1                                                                                                         |
| **New attack suite** `announce-attack.mjs` (PostgREST + real JWTs)                                                                                                                                                      | **30/30**                                                                                                   |
| Attacks: rls, seats, arena, crew, mayhem                                                                                                                                                                                | all pass · 35/35 · 78/78 · 93/93 · all pass                                                                 |
| `announce-migration.sql` rehearsal                                                                                                                                                                                      | preflight NOT APPLIED → apply → apply (no change) → APPLIED → rollback → NOT APPLIED → apply → APPLIED      |
| `announce-off` (stack started without `announce-migration.sql`, `HOCKEY_ANNOUNCE=0`)                                                                                                                                    | 1/1 — no Announce button, API 409, lines still post                                                         |
| `npx playwright test` (whole repo, `next start`, placeholder env, critic Atlas mock, `E2E_ATLAS=1`)                                                                                                                     | **245 passed, 10 failed, 8 skipped** — see below                                                            |

**The whole-repo run's ten failures.** Four are the recorded baseline
(core-loop:26, october:554/570, conference-mobile:23). Two were
`experiences-nav:90` (desktop and phone), which expected the Experiences
bar's Hockey link to land on sign-in; it lands on the public front door
now, whose button carries the sign-in with the way back — the test was
updated to say so and passes 12/12 on rerun (`e2e/experiences-nav.spec.ts`,
outside this lane, named in §5). Four are environmental on this machine
and not Hockey's: `card-titles` ×2 wait for a production corpus card
("Pumpkin Patch") the critic fixture serves differently, `fairview3` needs
its own SQL on a database this run does not have, and `creative:198`
looks for originals that only exist on the Mac (recorded in memory
before this mission). These four were not re-verified against a clean
tree here; none of them opens a Hockey route.

**Spec changes this made, and why.** Signed-out `/hockey` is the front
door now, so every spec's sign-up helper clicks its one button first (a
first version matched `/auth?next=/hockey` as the front door and hung two
specs; it checks the path now). The start form stopped suggesting an
opponent once 25 October passed, so thirteen specs that relied on the
suggestion now name "Wild" — they would have failed on `main` as of 26
October regardless. Score expectations say both codes; the welcome card
reads home first; "Invite" and the matchup line are matched exactly,
because the run-up and welcome cards repeat them. One known flake, not
touched: `mobile.spec` at 390 sometimes counts the hidden 1×1 photo
input as a tap target (MAYHEM §8); it passed on rerun.

## 7. Production deployment status

**Not deployed.** Production is whatever the owner last pushed
(GitHub `main` was `26b9ccf` when this started). Nothing here is live
until the owner pushes, Vercel reports the SHA, and §9's smoke passes.
**Public availability is not claimed.**

## 8. Public beta readiness and remaining blockers

Ready, on this tree: a stranger can open `/hockey`, sign up, pick any of
the league's games, start a night, invite by link, declare teams, plan,
seal picks, bet, chat, announce, call the game from the league's numbers,
see the Cup and run it back — all exercised by the specs on a real
auth/RLS stack.

Blockers and owner decisions, in order:

1. **Push and deploy** (§9) — this clone cannot.
2. **SQL in production**, in order: whatever is still unapplied from the
   2026-10-24 release record (`plan-migration.sql` data rows,
   `crew-migration.sql`, the adventure `origin` column), then
   **`announce-preflight.sql` → `announce-migration.sql` → preflight again**.
   The code is safe before any of them (announcements off, Crew off, Plan
   question absent — each proven by an `-off` spec or fallback).
3. **Chirp Bot's production model** has still never been read by a person
   (`gpt-4o-mini`; every model run here is local Ollama). Read ten lines
   before a public beta or set Quiet.
4. **Fantasy licensing** (above) before building its screen.
5. **Other arenas are unmeasured**: a public night outside Vancouver gets
   no "near the arena" offer and no Arena Mode. Honest, said on the page,
   and the next obvious investment (Atlas corpora for other cities, or at
   least arena coordinates with provenance).
6. **Email confirmation** on public sign-up: the local GoTrue auto-confirms;
   production's setting and SMTP are the owner's (OWNER-CHECKLIST steps
   2–3). A public beta with confirmation on needs the invite `next` path
   checked once by hand.
7. **A rate limit on starting nights** does not exist; a public host can
   start as many as they like. Fine for a beta; name it.

## 9. Owner release steps (Mac)

```bash
git fetch metatron:passport/main feature/hockey
git log --oneline -8 FETCH_HEAD        # this report's commit on top of 26b9ccf
git merge --ff-only FETCH_HEAD         # on main; it is a fast-forward of GitHub main
npm install --no-audit --no-fund && git checkout -- package-lock.json
npx tsc --noEmit && npx eslint . && npx prettier --check . && npx vitest run && npm run build
```

1. Supabase SQL editor (project `frllwwxesxbmmaadzfaf`), never `db push`:
   the leftovers from `docs/release/RELEASE-2026-10-24-HOCKEY-VANCOUVER.md`
   §4, then `docs/product/hockey/announce-preflight.sql` (every row OK) →
   `announce-migration.sql` → `announce-preflight.sql` (last row
   `APPLIED`). Rollback: `announce-rollback.sql`.
2. No new environment variable. `NHL_API_BASE` stays unset (the league).
3. `git push origin main` (fast-forward), confirm the Vercel deployment's
   SHA.
4. Smoke, two real accounts on phones: signed out `/hockey` shows the
   front door; sign in → the league's games list → pick one (not Vancouver)
   → the night names both teams and the arena; a Canucks night by hand →
   Arena on the bar; host announces → guest's banner on Plan and Play →
   Got it! → host sees "Everyone got it"; reply to a line; seal a pick and
   read it back as "VAN 0–5 MIN" style; call the final from the league's
   numbers; the Cup.

## 10. Doctrine and decisions

- **Recorded in the doctrine (§10, dated):** `/hockey` is public; a night
  can be any league game. §15.1 and §15.12 stay open.
- **§14 "elaborate social games"** — still a named conflict, as every
  Hockey report since MAYHEM has said.
- **Decisions taken here for the owner to confirm:** the trophy's default
  stays "Sycle Cup" for every existing night and for any night that
  does not name one; a schedule-picked night is titled "Hockey Night";
  announcements are host-only (a guest can only reply); a reply to a line
  from another night is posted as a plain line rather than refused;
  dismissing an announcement is per device, acknowledging is for the
  group.
