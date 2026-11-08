# Snow Day — make the mountain come alive

Mission "SNOW DAY — MAKE THE MOUNTAIN COME ALIVE" (P0), 2026-11-08, on
`feature/snow`, fast-forwarded first to `main` `09f1891` (which carries the
Go Have a Day overhaul: four-part bar, Adventure Pocket). Read with
[`README.md`](README.md), [`SHARING.md`](SHARING.md) and
[`MOUNTAIN-EXPERIENCE.md`](MOUNTAIN-EXPERIENCE.md).

**Ladder state: TESTED.** Committed on `feature/snow`. Not pushed (pushing is
disabled in this clone), not deployed, no SQL applied anywhere.

## 1. What changed for a person

> "We're going to SilverStar opening weekend. Four people. Two skiers, one
> snowboarder and someone who doesn't ski. Make us an awesome day."

- **Start a snow day** takes that sentence. It is read by rules, not by a
  model (`domain/snow/ask.ts`), and echoed back before anything is made:
  _SilverStar · Opening weekend · 4 people (2 skiing, 1 snowboarding, 1 not
  skiing)_. The mountain it names is locked in and the date is set. On a
  one-phone day, the people it describes are added with placeholder names
  ("Not skiing 1") at the most careful level, and can be renamed in Crew. An
  opening weekend the resort hasn't published is never guessed.
- **Plan is an adventure dashboard**, no longer a stack of forms. It has nine
  cards: Mountain · Date · Crew · Getting there · Lift tickets · Activities ·
  Lunch · Après · Gear. Each card says where that thing stands (✓, Leading,
  Open) and opens onto the same votes and lock-ins as before. Only one opens
  at a time. When no mountain is chosen yet, the Mountain card opens by itself
  because that is the one question that matters. Above the cards is the
  mountain illustration, with Atlas photos of things on the mountain.
- **The mountain is intelligent and honest** (`domain/snow/resorts.ts`). The
  resort's own published facts are quoted word for word, linked, and shown
  with the date Passport read them: opening day, closing day, Nordic opening,
  lift hours, and what the status said on the day it was read. Each official
  page (snow report, lift status, hours, tickets, events) is one tap away.
  Passport never shows live lift or run status. It says "Not live".
- **Dates**: _Opening weekend_ appears only from a published opening day; then
  _This weekend_, _Next weekend_ and _Pick a date_ (a native, accessible
  picker). For the chosen date the screen says whether it falls inside the
  resort's published season, repeating the resort's own caveat
  ("Tentative"), and shows the published lift hours. The forecast card is
  unchanged and still off unless `SNOW_FORECAST=on`.
- **Around the mountain** (`domain/snow/nearby.ts`,
  `GET /snow/api/nearby`) shows real Atlas entities only, sorted for a snow
  day: lunch, après, skating, tubing, snowshoe and Nordic, spa, family, and
  dated events. Each card shows Atlas's own words for why it is there, the
  straight-line distance, and a photo only when Atlas says the photo is of
  that thing. Filters: distance, for someone not skiing, with kids, and the
  day's date (for events). "Add to our day" puts the place on the crew's vote.
  Budget is not filterable: Atlas holds no prices, and the screen says so.
- **The day, laid out** (`domain/snow/itinerary.ts`): meet, lifts open, ride,
  an activity for whoever isn't skiing, lunch, a second activity, last run,
  après, any dated Atlas event, and home. Every stop carries a badge for what
  it rests on: _Locked in_, _Crew's pick_, _Published_, _Suggested · Atlas
  place_ or _Suggested_. Where Atlas holds nothing, the stop says _Not in
  Atlas yet_ and links the resort's own list. **Lunch is always on the
  mountain**: a 30-minute drive down and back is not lunch on a ski day.
- **Change it in words**, with a preview first and an Undo after: _Add
  somewhere for lunch · Find something for the non-skier · Make après more
  interesting · Keep us on the mountain · Move lunch earlier_, plus "lunch at
  1", "lunch later" and "into town". A locked decision never moves; the
  reader says "Après is locked in (X). Reopen it to change it." Anything it
  can't read, it says so and lists what it can.
- **Group fun with real places**: Activities is a new voted topic. Lunch,
  après and activities can be voted on as real Atlas places (proposals with
  `source: "atlas"` and Atlas's words as the detail). Invitations,
  announcements, chat, predictions, challenges, Start, the companion, memories
  and the recap are unchanged.

## 2. Evidence: what is real

### Official resort facts (read 2026-11-08)

| Resort     | Fact                       | Quote                                                                                                          | Page                                                                                |
| ---------- | -------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| SilverStar | Alpine opening             | "Alpine Opening Day: November 27, 2026"                                                                        | skisilverstar.com/the-mountain/hours-of-operation/                                  |
| SilverStar | Closing                    | "Alpine Closing Day: April 4, 2027"                                                                            | same                                                                                |
| SilverStar | Nordic opening             | "Nordic Opening Day: November 20, 2026"                                                                        | same                                                                                |
| SilverStar | Caveat                     | "Tentative Winter 2026/27 Operation Dates"                                                                     | same                                                                                |
| SilverStar | Lift hours                 | "Opening Day to January 31: 9:00am - 4:00pm"                                                                   | same                                                                                |
| SilverStar | Status when read           | "Currently Closed"                                                                                             | same                                                                                |
| SilverStar | Dining (14) / winter (14)  | names listed in `resorts.ts`                                                                                   | /mountain-dining-shopping/restaurants-cafes/, /events-activities/winter-activities/ |
| Big White  | Opening / closing / caveat | "OPENING DAY THURS, NOVEMBER 26, 2026", "CLOSING DAY SUN, APRIL 4, 2027", "Opening is snow permitting"         | bigwhite.com/explore/mountain-info/winter-hours-operation                           |
| Sun Peaks  | Opening / season           | "…scheduled to begin on Saturday, November 21, 2026.", "Operating Season / November 21, 2026 to April 4, 2027" | sunpeaksresort.com …/winter-opening-day, …/winter-hours-of-operation                |

How it was read: SilverStar's site is a Gatsby app whose content is not in
the HTML, so its quotes came from the site's own `page-data.json` for each
page. Big White's quote came from its HTML. Sun Peaks' came from a web read
of the two pages named. The other 12 mountains have no published facts in
Passport, and their Mountain card says so ("won't guess an opening date").

Refreshing: these are hand-entered facts with a `checked` date. After 14 days
the card flags them as old. There is no scraper, deliberately: the resorts'
pages are theirs to serve, and their terms were not reviewed.

### Atlas around SilverStar

From **production Atlas as of 2026-11-08**, read from the public `/go`
payload (`docs/product/hockey/verification/prod-corpus.mjs`, 5,471
candidates). The 493 within 45 km are committed as
`verification/atlas-silverstar-2026-11-08.json.gz`, and the unit tests and
the browser spec run on them.

- **On the mountain (within 4 km): Brewer's Pond (skating), Tube Town
  (tubing, real photo), Silver Star Provincial Park (snowshoeing, real
  photo), Sovereign Lake Nordic Centre and Sovereign Lake (Nordic and
  snowshoe), two dated events.**
- **No lunch, café or après spot on the mountain.** Atlas holds 0 of the 14
  venues SilverStar lists. The nearest food Atlas holds is 13–18 km away in
  a straight line (Lumby, Armstrong, Vernon), which is plenty for après in
  town and wrong for lunch.
- The acquisition request is in [`ATLAS-REQUEST-SILVERSTAR.md`](ATLAS-REQUEST-SILVERSTAR.md)
  and on screen under "What Atlas doesn't know about SilverStar yet".

## 3. Requirements → tests (at the committed sha)

| #     | Brief                                                                    | Proved by                                                                                                            | Result         |
| ----- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | -------------- |
| P0    | Resort, official site, opening info, status, sources and freshness       | `alive.test.ts` "resort facts" (4); spec steps 2–3                                                                   | pass           |
| P0    | Never invent dates, conditions, lifts, hours or venues                   | `alive.test.ts` opening weekend only when published; lift hours not before opening; lunch gap; `nearby.test.ts` gaps | pass           |
| P0/P3 | Restaurants, après, skating, tubing, snowshoeing, events from Atlas      | `nearby.test.ts` (5, production corpus)                                                                              | pass           |
| P1    | Dashboard of 9 cards, progressive disclosure, existing votes preserved   | spec steps 1–8; `snow.spec` and `snow-mountain.spec` (unchanged assertions, cards opened)                            | pass           |
| P2    | Opening weekend (verified only), this or next weekend, accessible picker | `alive.test.ts` dateChoices (2); spec step 3                                                                         | pass           |
| P3    | Filters: distance, date, non-skier, kids; budget                         | `nearby.test.ts` non-skier; spec step 5. Budget: **not built** (Atlas holds no prices; said on screen)               | pass / partial |
| P3    | Missing coverage becomes an acquisition request                          | `nearby.test.ts` request names 14 missing venues                                                                     | pass           |
| P4    | Itinerary from mountain, date, crew, real places, hours, decisions       | `alive.test.ts` "the suggested day" (7)                                                                              | pass           |
| P4    | The five conversational changes; locked decisions preserved              | `alive.test.ts`; spec step 9–10                                                                                      | pass           |
| P5    | Vote on Atlas lunch, après and activities                                | spec steps 6, 7, 10 (one phone)                                                                                      | pass           |
| P5    | Same on a shared day                                                     | activities need `activity-migration.sql`; lunch and après use existing topics (shared stack **not rerun**, see §6)   | not run        |
| P7    | Start, memory, done, recap                                               | spec steps 12–14                                                                                                     | pass           |
| P8    | SilverStar, 14 steps, phone 390×844 and desktop 1280×900                 | `e2e/snow-silverstar.spec.ts` (2 + the Atlas-down case)                                                              | 3/3 pass       |

## 4. Not done, and why

- **Live operating status, snow depth, lift and run status, restaurant
  hours.** No licensed feed exists, and the resorts' pages were not scraped.
  Status is "what it said on the date read", plus the official link.
  _Decision for the owner:_ whether to license a feed or to read the resorts'
  pages on a schedule (terms review needed).
- **Lunch on SilverStar.** It is a gap until Atlas has the village venues.
  See the request.
- **Budget filter.** Atlas holds no prices for these places. Shown as such.
- **Drive times.** Distances are straight lines and labelled that way. Atlas's
  travel legs are not used here.
- **Shared days and activities.** Voting on activities on a shared day needs
  `supabase/migrations/20261108000000_passport_snow_activity.sql` (one CHECK;
  promoted from `docs/product/snow/activity-migration.sql` at integration,
  M646, which also dropped the code's refusal: apply the SQL before the code
  deploys). Timing tweaks (lunch time, staying on the mountain) live on
  the phone that made them. Picks put to the crew are shared.
- **Opening facts for the other 12 mountains.** Not read. Their card says so.
- **Forecast**: still behind `SNOW_FORECAST=on` (Open-Meteo terms, owner).

## 5. Outside my lane

- `e2e/snow-silverstar.spec.ts` (new), `e2e/snow.spec.ts` (opens the cards;
  assertions unchanged).
- `docs/PASSPORT-PRODUCT-DOCTRINE.md`: one "Informed 2026-11-08" note in §15.12.
- No shared contract changed. **Proposed for `passport-domain`** (done at
  integration, M646):
  `git mv docs/product/snow/activity-migration.sql supabase/migrations/20261108000000_passport_snow_activity.sql`,
  and drop the `activity` exclusion in `STORED_TOPICS` (`src/domain/snow/shared.ts`) in the same change.

## 6. Gates (this tree, Metatron, 2026-11-08)

| Gate                                                                         | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                                                           | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `npx eslint .` (ignoring playwright-report, test-results)                    | 0 errors, 43 warnings, none in Snow files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `npx prettier --check src e2e docs/product/snow` + doctrine                  | clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `npx vitest run`                                                             | 4,309 passed / 46 skipped / 0 failed (Snow domain alone: 104; +1 shared-refusal test after the run, 16/16 in `shared.test.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Snow real-stack unit tests (`SNOW_STACK_ENV=…`)                              | `shared.stack.test.ts` + `location.stack.test.ts`: 4/4                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `npm run build`                                                              | ok; `/snow/api/nearby` in the route table                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `e2e/snow-silverstar.spec.ts` (`next start`, SilverStar Atlas slice)         | 3/3: phone 390×844 and desktop 1280×900 through all 14 steps, plus Atlas down                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `e2e/snow.spec.ts`, `e2e/snow-mountain.spec.ts`                              | 6/6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Shared days, two real accounts, real local Supabase (`-c verification`)      | `two-phones.spec` 1/1, `hill.spec` 1/1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Whole Playwright suite (`E2E_ATLAS=1`, Atlas stand-in, placeholder Supabase) | 244 passed / 24 failed / 8 skipped. **The same 24 fail by name on `main` `09f1891` built alone** (card-titles ×4, christmas:14, conference-mobile:23, core-loop:26, creative:198, daybuilder:127, discovery-conversation:36, discovery-one-search:58, experiences-nav:28 ×2, fairview3:31, go-release:216 ×2, gohaveaday-door:34, labs:28 ×2, nfr:278, october:554/570, release-navigation:94 ×2). Environmental, or from the GHAD overhaul (experiences-nav and labs expect Places and Labs on the bar, which `09f1891` removed). None is Snow's. |

Recipe: `node scripts/critic/atlas-mock.mjs docs/product/snow/verification/atlas-silverstar-2026-11-08.json.gz 3134`;
build and `next start -p 3132` with `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder ATLAS_API_URL=http://127.0.0.1:3134`;
`E2E_PORT=3132 E2E_ATLAS=1 TMPDIR=~/scratch/tmp npx playwright test e2e/snow-silverstar.spec.ts`.
Shared days: `node docs/product/snow/verification/stack.mjs start`, build a
scratch copy with the stack's env, `next start`, `npx playwright test -c
docs/product/snow/verification`. The whole suite rewrites the Discovery PNGs;
restore those three folders afterwards.

**Not run:** anything on production; a real phone; the resorts' pages
re-read by code (they are hand-entered facts with a check date); Big White and
Sun Peaks against Atlas (the stand-in holds only the SilverStar area).
