# Hockey Night — the public hockey website (mission 486, 2026-11-01)

**Asked (High):** turn `/hockey` into a public NHL hockey destination — scores,
schedules, standings, teams, statistics — with Hockey Night built in, so that
the people who come for the hockey stay to make a night of it. Keep every
existing night, invitation, prediction, Chirp Room, challenge, Cup,
leaderboard, memory and permission. Mobile-first, dark, premium. Real data
only, with graceful fallbacks; check the provider's terms. The Calgary Flames
are featured as an editorial preference without bending league coverage.
Keep the domain portable. Measure whether public pages drive participation.
Release, or say exactly why not.

**Where:** `feature/hockey` on Metatron, fast-forwarded first onto GitHub
`main` `137def4` (which already contained every earlier Hockey commit and the
Date Night / Lorne & Jess release), then GitHub `main` `a47e611`
(Christmas improvements, the rebuilt Markham Adventure) merged in on
2 November — no conflicts, no Hockey file touched; on the merged tree
tsc, prettier, eslint (0 errors) and vitest (4065) are clean and a fresh
production build passes public-site, public-night, acceptance and mobile.
**Not pushed, not deployed:** this clone
cannot push and never deploys (`CLAUDE.local.md`). §8 is the owner's path.

---

## 1. What a visitor gets

| Page                   | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/hockey`              | **Public for everyone, signed in or not.** A score ticker of the league's day; the **featured matchup** (team colours on a diagonal over rink lines, records, puck drop or score, venue, networks) with **Create a Hockey Night** on the first phone screen; tonight's games or the day's finals; the next day's games once today is over; the **Flames spotlight** (record, place in the Pacific, last five, next game, "Make a night of it"); the Flames' division table; league leaders (points, goals, assists); what Hockey Night is; one more Create button. Signed in, a "Your next night" row links to it. |
| `/hockey/games`        | One day's games, live first, with previous/next day and a week strip (`?date=YYYY-MM-DD`). Each card: status (live with period and clock, intermission, final/OT/SO, postponed, local puck-drop time), both teams with records, scores and shots, venue, networks — and **Make a night of it** on every game not yet started.                                                                                                                                                                                                                                                                                      |
| `/hockey/standings`    | The league's table by division (playoff line under third), conference or league (`?view=`): GP W L OT PTS P% GF GA DIFF L10 STRK. A sticky team column so a phone can slide the numbers.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `/hockey/teams`        | All 32 clubs by division with record and points; alphabetical by city if the table can't be read. The Flames tile says "Our team".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `/hockey/teams/[slug]` | One club (`calgary-flames`, `montreal-canadiens`, `st-louis-blues` …): record, points, last 10, streak, place; next game with **Make a night of it**; the next eight with a Make-a-night link each; the last eight results; skater and goalie statistics; the division table. A title and description written from the live record, a canonical URL, Open Graph, and schema.org `SportsTeam` with its next five `SportsEvent`s.                                                                                                                                                                                    |
| `/hockey/my-nights`    | **What `/hockey` used to be for a signed-in person** — the same shelf, Cup roll, past nights and start form, unchanged. Signed out, it asks you to sign in and comes back. `?game=<league id>` opens the start form with that game chosen; `?via=` says which public page sent you.                                                                                                                                                                                                                                                                                                                                |
| `/hockey/sitemap.xml`  | The 36 public URLs. Nothing private.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

**Nothing about Hockey Night itself changed.** `/hockey/[id]`, `/hockey/[id]/arena`, `/hockey/join/[token]` and every API route keep their code, their permissions and their data. What moved: every in-night link or redirect that meant "your nights" (the hero's back link, the expired-invitation page, Leave, host Cancel, the "that night isn't yours any more" bounce from the night and from Arena Mode) now goes to `/hockey/my-nights` instead of `/hockey`.

The design is the night's own register, made bigger: the same Archivo
condensed-black display face, the same two-colour team kits, a near-black
arena, gold for the one action. **Team graphics are colours and codes, cut
like a shoulder patch — no logos** (§3).

### Screens

`docs/product/hockey/website/` holds the 390 px and 1280 px pages against the
real league on 1 November 2026 (Flames at Sharks on 2 November as the hero)
and the stand-in run's full pages.

## 2. The data — what it is, how it's read

Everything is read live from the NHL's public web API, `api-web.nhle.com`
(no key):

| Body                                  | Used for                                 | Cached (Next data cache) |
| ------------------------------------- | ---------------------------------------- | ------------------------ |
| `/v1/score/{now\|date}`               | Ticker, today, next day, scores page     | 30 s                     |
| `/v1/standings/now`                   | Tables, records beside names, team tiles | 5 min                    |
| `/v1/club-schedule-season/{abbr}/now` | Team schedule, results, Flames spotlight | 5 min                    |
| `/v1/club-stats/{abbr}/now`           | Skater and goalie statistics             | 30 min                   |
| `/v1/skater-stats-leaders/current?…`  | League leaders                           | 30 min                   |

- **Read, never guessed.** `src/domain/hockey/league.ts` is pure readers;
  `league.test.ts` pins them on the league's own bodies from 1–2 November
  2026 (committed, trimmed of logo and headshot URLs, in
  `src/domain/hockey/fixtures/league-2026-11-01/`) — Carolina 7–0 Winnipeg
  with S. Walker's goal at 5:16 of the 1st, the Flames 6–8–0 and sixth in
  the Pacific, Farabee leading them with 15 points, McDavid leading the
  league with 39. A body we don't understand reads as nothing.
- **Graceful when the league isn't there.** Every fetch has a 5 s timeout
  and returns nothing on failure; the page says "The league's scoreboard
  can't be reached right now. Nothing is shown rather than something stale
  or made up", and **Create a Hockey Night still works** (the start form
  already falls back to setting a game by hand).
- **Load on the league.** One request per body per cache window however
  many readers — a handful of requests a minute. Live pages refresh every
  30 s only while a game is live and the tab is visible.
- **Times** render in the reader's own zone (server renders Eastern,
  labelled, then the browser rewrites it).
- **One seam.** `app/hockey/_server/league.ts` is the only file that knows
  the provider (base URL `NHL_API_BASE`, shared with the night's own live
  score). A licensed feed replaces that file and keeps the shapes.

## 3. Terms, attribution and the open licensing question — **owner decision**

Measured, not assumed (nhl.com/info/terms-of-service, read 2026-11-01):

- §7: _"You may access, use, and display the Services, but only for
  non-commercial, informational, personal use"_; content may not be copied,
  distributed or _"enter[ed] into a database"_ without written permission.
- §2 prohibits _"unauthorized spidering, scraping, or harvesting"_ and
  _"any other unauthorized automated means to compile information"_, and
  unreasonable load.
- "NHL", the Shield and the Stanley Cup marks may not be used commercially
  without NHL Enterprises' consent.
- `api-web.nhle.com` is **undocumented**: no published licence, no rate
  limit, no SLA. Its CDN caches about 20 s.

What this build does about it:

- **No marks.** No team logos, crests, wordmarks, headshots, video or
  photographs, though the API hands us their URLs. Teams are named in words
  and their colours; "NHL" appears only to say whose numbers these are.
- **Facts only**, as published: scores, times, venues, standings, player
  statistics. Nothing editorial is copied.
- **Attribution and disclaimer** under every page: _"Scores, schedules,
  standings and statistics are the NHL's, read from its public data and
  shown as published. Hockey Night is not affiliated with or endorsed by
  the NHL or any club. Team names and colours are used only to say which
  team is which."_
- **Light load** (§2), and nothing is stored: no database of league data.

**What it cannot settle.** Whether a free public site run by Go Have a Day
is "non-commercial, informational" use is a legal judgement, not an
engineering one, and the terms do not grant redistribution. Hockey Night
has already displayed live scores from this API in production since 23
October; this release widens that to whole public pages meant to attract
traffic. **The owner must decide before release** between (a) shipping on
the factual-data basis above, accepting the risk; (b) shipping and applying
for permission from NHL Enterprises; or (c) licensing a feed (e.g.
Sportradar, the NHL's official data partner) — which would replace one file
(§2). If ads or paid features ever arrive, (a) stops being defensible.

## 4. Calgary, featured — and neutral

`HOCKEY_SITE.featuredTeam = "CGY"` (`src/domain/hockey/site.ts`). The rule
(`pickHero`, tested): the Flames' game today in any state leads the home
page; otherwise what's live or still to come today; once today is over, the
next day — the Flames first again. The Flames spotlight is labelled "Our
team · an editor's pick". Their row is tinted in tables and their tile says
"Our team". **Nothing else moves:** every game is on the same scoreboard in
the same type, tables are in the league's order, every team has the same
page.

## 5. Portable domain

`src/domain/hockey/site.ts` holds everything that changes on the day the
site gets its own domain: `base` ("/hockey" → ""), `origin` (canonical URLs,
sitemap, structured data; `HOCKEY_SITE_ORIGIN` overrides), the name, the
featured team. Every public link is built with `hockeyPath()`. The move is
then this file plus a host mapping — **not built**: `src/lib/domains/` is a
shared contract this lane does not change. The components in
`src/components/hockey/site/` (team mark, game card, standings table,
ticker, local time, live refresh) are hockey components, reusable across
hockey pages; no multi-sport abstraction was built.

## 6. Measurement

Reuses Vercel Web Analytics (`Measurement`, already first-party,
cookieless, query strings stripped):

| Question                   | How it's counted                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| Public homepage visits     | page views of `/hockey` (automatic)                                                                   |
| Team-page visits           | page views of `/hockey/teams/*` (automatic)                                                           |
| Game-page engagement       | page views of `/hockey/games` + **`Hockey: scores browsed`** `{to: previous\|next\|week}`             |
| Create Hockey Night clicks | **`Hockey: create click`** `{from: header\|hero\|home\|spotlight\|games\|team, game: bool}` (browser) |
| Hockey Nights created      | **`Hockey: night created`** `{via: <from>\|direct, league: bool, runBack: bool}` (server)             |
| Invitations sent           | **`Hockey: invitation created`** (server) and **`Hockey: invitation accepted`** (server)              |

`via` rides from the button to the start request (`?via=` → the form →
`POST /hockey/api/occasions`), so "nights created via a public page" is
countable against "create clicks". **Never** a user id, night id, name,
email or declared team. Server events (`_server/measure.ts`) only fire on
Vercel and never fail a request. **Custom events need a Vercel plan that
includes them (Pro or above);** on Hobby, page views still count and the
events are dropped silently — owner to confirm the plan.

## 7. Test results

All on Metatron, 2 November 2026 (UTC), a production build (`npm run
build` + `next start` on 3130) against the real local stack (Postgres +
GoTrue + PostgREST with production's grants and every Hockey migration),
`~/scratch/m486/{suite,rerun,repo-e2e}.sh`.

| Gate                                           | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                             | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `npx eslint .`                                 | 0 errors (45 warnings, none in Hockey files)                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `npx prettier --check .`                       | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `npx vitest run`                               | **4050 passed**, 41 skipped (340 files) — including `league.test.ts`, 23 tests on the league's real bodies                                                                                                                                                                                                                                                                                                                                                                    |
| `npm run build`                                | ok                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **`public-site.spec`** (new)                   | **4/4** — every public page 200 at 390 px with no sideways scroll; team title/description/SportsTeam JSON-LD; unknown team 404; sitemap 36 URLs, nothing private; My Hockey Nights and a night still ask a stranger to sign in; **featured matchup → Create a Hockey Night (inside the first 844 px) → sign up → My Hockey Nights with that game chosen → Start it → the night**; signed in, `/hockey` names "Your next night"; the night's "Your nights" is My Hockey Nights |
| Hockey regression (every spec in the config)   | **all pass** after the spec updates below: announce, mobile ×3, plan-and-results, plan-pregame (11), bet-button, mayhem, alive, chirp, modules, multi-night, polish, redesign, restaurant-photos ×2, seats, arena-mode, crew, finish, finish-play, public-night (6), acceptance                                                                                                                                                                                               |
| Attacks (RLS, permissions)                     | rls all passed · seats 35/35 · arena 78/78 · crew 93/93 · mayhem all passed · announce 30/30                                                                                                                                                                                                                                                                                                                                                                                  |
| Real league, production build, 390 and 1280 px | home, scores, standings, teams, Calgary Flames: no console errors, no sideways scroll (`website/`)                                                                                                                                                                                                                                                                                                                                                                            |
| Whole-repo e2e                                 | see §7.1                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

**What the first run caught, and what changed:**

- The shelf's new "Scores & standings →" link was a 20 px tap target
  (mobile spec) — now 44 px.
- Specs that meant "your nights" said `/hockey`: the signed-out entry
  (`goto("/hockey/my-nights")` → sign-in), `/auth?next=/hockey/my-nights`,
  leaving a night (`/hockey/my-nights`), being removed
  (`/hockey/my-nights?gone=1`), and the CTA's name ("Create a Hockey
  Night"). The behaviour each asserts is unchanged.
- A trap, not a bug: Next's fetch cache (`.next/cache/fetch-cache`)
  survives builds; an earlier run's synthetic stand-in schedule (other
  ids on other days) answered the start form for 15 minutes. Clear it
  before a stand-in run (`rerun.sh` does).

### 7.1 Whole-repo e2e

`npx playwright test` against a production build with placeholder Supabase
env and the critic Atlas mock (the recipe of the earlier Hockey releases):
**244 passed, 14 failed, 8 skipped.** `experiences-nav` (the bar's Hockey
link → the public site → Create a Hockey Night → sign-in back to My Hockey
Nights) passes. None of the 14 is a Hockey page: card-titles ×2,
conference-mobile, core-loop, fairview3, discovery-natural ×2,
discovery-one-search ×2, nfr shelves, creative originals (`/labs/experience/*`
and `/discovery` "threw" — `/hockey` opened), october 554/570,
release-navigation. This change touches no file those pages render (outside
the Hockey directories it changes only `e2e/experiences-nav.spec.ts` and the
doctrine), and several are on the recorded environmental list (Atlas mock
from 2026-10-11, no Upstash for Fairview); **they were not re-run on the
base commit in this mission**, so "pre-existing" is an inference from that,
not a measurement. The run rewrote four committed Discovery PNGs; they were
restored by name.

## 8. Owner release steps (Mac)

No SQL. No new environment variables (optional `HOCKEY_SITE_ORIGIN`).

1. **Decide §3** (the NHL's terms). If the answer is "not yet", do not
   release this; nothing else depends on it.
2. Fetch and check it is a fast-forward of GitHub `main`:
   `git fetch metatron:passport/main feature/hockey` then
   `git merge-base --is-ancestor origin/main FETCH_HEAD && git log --oneline origin/main..FETCH_HEAD`.
   It contains Date Night / Lorne & Jess unchanged (it is built on
   `137def4`); if `main` has moved, merge `main` into it rather than
   rebasing, and re-run the Hockey specs.
3. `git push origin FETCH_HEAD:main`, then deploy as production is deployed
   today (if the push does not deploy by itself: `npx vercel deploy --prod`).
4. **Smoke on gohaveaday.com, signed out:** `/hockey` shows tonight's (or
   the next day's) real games and the featured matchup with Create a Hockey
   Night; `/hockey/games`, `/hockey/standings`, `/hockey/teams`,
   `/hockey/teams/calgary-flames` load with real numbers; `/hockey/my-nights`
   asks you to sign in. **Signed in:** an existing night opens from My Hockey
   Nights; an invitation link still joins; "Make a night of it" on a game
   opens the start form on that game.
5. Vercel → Analytics → Events: `Hockey: create click` appears after step 4
   (needs a plan with custom events).

## 9. Doctrine

§10 "How a person finds them" gains a dated paragraph: `/hockey` is a public
hockey site with Hockey Night built in; nights stay invitation-only. It does
not answer §15.1 or §15.12. No conflict with the doctrine found; the one
tension named is §3 above (licensing), which is a business decision.
