# Christmas, experience-first (M865, 2026-11-17)

Owner brief: _P0 — GOHAVEADAY CHRISTMAS: THE EXPERIENCE-FIRST REBUILD_.
"The current Christmas homepage is too long… Rebuild the Christmas homepage
around helping people decide what kind of Christmas experience they want."
The lights map, the tour builder, the planner and Christmas Discovery were
kept as they were. Only the front door changed, plus one shared fix
(`Picture`).

## What a visitor sees now

`/christmas`, top to bottom:

1. **Your Christmas Starts Here** — _Find something wonderful to do
   together._ The countdown, snow and the fire, and the shared location bar
   (ADR 020), unchanged.
2. **What are you in the mood for?** Six designed cards, two columns on a phone:

   | Way              | Opens                                                           | Asks (all optional, taps)                              | Answers with                                                                           |
   | ---------------- | --------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
   | Christmas Lights | `/christmas/lights` (the existing map and Build My Lights Tour) | —                                                      | the map itself; `/christmas/for/lights` redirects there                                |
   | Christmas Date   | `/christmas/for/date`                                           | When? · Going out or staying in?                       | 3 plans for the planner, ≤4 Atlas finds, ideas (staying in: ideas only, no Atlas read) |
   | Family Fun       | `/christmas/for/family`                                         | How old is the youngest? · When? · How far?            | 2 plans (with the age), ≤4 finds checked by Atlas for that age, ideas                  |
   | Friends & Fun    | `/christmas/for/friends`                                        | When? · Going out or staying in?                       | 3 plans, ≤4 finds, ideas                                                               |
   | Cozy Christmas   | `/christmas/for/cozy`                                           | What sounds good? (movies, baking, food, games, music) | ideas only, at home first                                                              |
   | Events & Markets | `/christmas/for/events`                                         | When? · What kind?                                     | ≤6 finds, **See all N** into `/christmas/discover` with the same answers               |

3. **Happening near you** — _Christmas around Vernon_: the four strongest
   Atlas finds (the old page's `around` order: soonest dated first) and up to
   three community lights-map listings, still shown apart and labelled.
4. **Surprise me** (`/christmas/surprise`) and the planner's sentence box
   (_What would you love to do?_), side by side on a desktop.
5. **Browse everything** — Find Christmas (the full directory), the lights
   map, _A weekend, or a few days_ (`/christmas/plan`), Saved; then the
   visitor's own Christmas adventures when signed in.

The domain is `src/domain/christmas/ways.ts` (ways, questions, dates, asks,
plans, the few strongest, Surprise) and `ideas.ts` (17 hand-written ideas).
Pages: `src/app/christmas/page.tsx`, `for/[way]/page.tsx`, `surprise/`,
`_parts/near.tsx`. Cards: `src/components/christmas/ways.tsx`.

### What is real and what is an idea

- **Events, markets and places** are only Atlas's, read through the same
  cached `christmasFinds` call as before. No second store.
- **Plans** are sentences handed to the existing planner
  (`/christmas/itinerary?say=…`). It makes each part a real place or says
  it couldn't. For example, Vernon has no cinema in Atlas, and the plan says so.
- **Ideas** are Passport's own, and every card says _An idea, not a listing_.
  None names a venue, time, price, hill or streaming service. Unit tests hold
  this: no digits, `$`, "open now" or service names. Where an idea needs a
  place we don't list, it says so: _We don't list what's streaming where yet_,
  _We don't list sledding hills yet_, _Only where fires are allowed_.
- **Category artwork** is designed (gradients, a string of lights, an emoji).
  Real photographs appear only on real finds, as before.

Screenshots (390 px unless named): before
[viewport](screenshots/30-before-home-390.png) and
[whole page](screenshots/30-before-home-390-full.png); after
[viewport](screenshots/31-after-home-390.png),
[whole page](screenshots/32-after-home-390-full.png),
[desktop](screenshots/33-after-home-desktop.png), and the ways:
[date tonight](screenshots/34-way-date-tonight.png),
[cozy](screenshots/35-way-cozy.png), [events](screenshots/36-way-events.png),
[family](screenshots/37-way-family.png), [surprise](screenshots/38-surprise.png).

## Measured (local build, Atlas stand-in on the committed 2026-11-14 corpus)

| `/christmas`, 360 px phone         | Before (9112d5f) | After                    |
| ---------------------------------- | ---------------- | ------------------------ |
| Page height                        | 13.8 screens     | 4.6–4.8 screens          |
| Event cards on the page            | 39               | 4 (+ ≤3 lights listings) |
| Sideways scroll (360/390/768/1280) | none             | none                     |
| Broken images                      | 0                | 0                        |

At 390 px it is 4.4–4.5 screens, at 768 px 3.1, and on desktop 3.3. A way's
page runs 1.3–4.4 phone screens.

**Loading.** Phone timings: Pixel 7 emulation, 4× CPU, 1.6 Mbps with
150 ms latency. Atlas stand-in with production-like waits (corpus 6 s,
distance 1.5 s), at `~/scratch/m-load/slow-atlas.mjs`.

| Moment                                   | Before | After  |
| ---------------------------------------- | ------ | ------ |
| Cold town: the page's heading on screen  | 6.3 s  | 0.22 s |
| Cold town: the choices on screen         | 6.4 s  | 0.22 s |
| Cold town: the first Atlas find          | 6.4 s  | 6.6 s  |
| Warm: first Atlas find (throttled phone) | 0.27 s | 2.05 s |
| Warm: first Atlas find (unthrottled)     | 0.23 s | 0.19 s |
| Town switch named on the bar             | 0.08 s | 0.07 s |
| Warm town switch, unthrottled            | 0.13 s | 0.11 s |
| Opening a way (throttled)                | —      | 0.85 s |

What changed, and why. Before, the whole page waited for Atlas. Now only
_Happening near you_ (and a way's finds) does: it is a Suspense boundary, so
the six ways are on screen while a cold Atlas is still answering. On a
throttled phone with everything cached, the streamed section is revealed
only once the page's scripts have loaded (≈1.8 s). That is the 2.05 s in the
table: a regression for warm visits on slow phones, traded for the cold
case, which is the one production reports (8.3 s cold town, M845). Changing
the place keeps the old answer dimmed and labelled _Loading_ until the new
one replaces it. A town-keyed boundary was tried first and dropped: it made
a warm switch 0.81 s instead of 0.11 s.

The slowness itself is Atlas's cold `/discovery/candidates` read. Passport
already caches it; making the read faster is Atlas work.

## Missing images

- **Fixed (Passport):** `Picture` (`src/components/adventures/Picture.tsx`,
  shared with Discovery's adventure cards) left a **broken-image icon** when a
  picture failed before the page hydrated, because `onError` never fires for
  those. The test that aborts every external image found 4 on
  `/christmas/for/events`. It now checks on mount and falls back to the next
  picture, or to the warm name tile.
- Category cards have no images to break.
- **Atlas defect** (pass to Atlas): _Xmas Fusion DJ Night_ (Revelry,
  Kelowna, `7399fa28-…`) is held as one run from 2025-12-25 to 2026-12-25
  (`occurrence.because: "a fact states 2025-12-25 to 2026-12-25 as one
range"`), so it reads as dated and current all year. Passport now ranks a
  "dated" run longer than 60 days below real dates in the few
  recommendations (`longRun`). It still appears in the directory.

## Kept, moved or dropped from the front page

| Was on `/christmas`                                                              | Now                                                                                                     |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Six rows of event cards (soon, lights, markets, Santa, festive, worth the drive) | the four strongest on the front page; all of them on Find Christmas, the ways' pages and the lights map |
| Seven theme tiles                                                                | Events & Markets → _What kind?_; every theme is still a `/christmas/discover?theme=` URL                |
| The sentence box                                                                 | kept, beside Surprise me                                                                                |
| Five quick-start chips                                                           | **dropped** — the six ways cover them; the sentences still work as `?say=` links                        |
| _A weekend, or a few days?_ shapes                                               | one Browse-everything link to `/christmas/plan` (the shapes are there)                                  |
| _Small dares_ challenge cards                                                    | **dropped from the front page**; every Christmas adventure still carries them                           |
| _How Passport knows_ counts and legend                                           | one closing sentence; the confidence label is still on every card                                       |
| The pictured lead find in the hero                                               | dropped, so the hero no longer waits on Atlas                                                           |

No URL was removed. `/christmas/for/*` and `/christmas/surprise` are new.

## Tests

- `src/domain/christmas/ways.test.ts`, 20 tests. The six ways are the owner's
  six, in order. Something is shown before any question is answered. Choices
  round-trip through the address. Weekend dates are right. The age reaches
  the ask. Every plan sentence reads back as said through the planner's own
  `readRequest`. The honesty rules for ideas hold. On the real corpus, the
  strongest finds are near and surest-first, and Surprise draws both kinds.
- `e2e/christmas.spec.ts` rewritten for the new front page, plus the Lights
  way → map, a date tonight → a real itinerary, staying in (ideas, no Atlas,
  no streaming claims), family age → Atlas → directory, an empty answer
  (Delta, festivals, this weekend), Surprise me, 360/390/768 px layout
  (two columns, no sideways scroll, < 6.5 screens, keyboard focus), and every
  picture failing.
- `e2e/christmas-planner.spec.ts`: the front-page test now expects the six
  ways in place of the quick starts.

## Not decided here

- Whether the front page should keep the quick starts or the challenge
  cards (dropped as noise; trivially restored).
- The 17 ideas are Passport's writing; the owner may want to edit the list.
- `/christmas/discover` itself is unchanged: still the long directory, by
  design ("for people who prefer browsing").
