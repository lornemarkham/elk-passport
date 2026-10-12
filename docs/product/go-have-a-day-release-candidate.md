# GO HAVE A DAY — family-test release candidate (M207, M211)

## M211 — final family release pass (2026-10-11)

One commit on top of M207's e1cba6e. **Still not merged, pushed or deployed.**

### Live Atlas: not reached, and why

This checkout has no `ATLAS_SERVICE_TOKEN`; the workspace rules forbid copying
one in or pulling one through Vercel. Production Atlas answers `/health` (200)
and 401 to everything else. **No test in this pass ran the RC against live
Atlas.** What was real:

- **Production Passport** (elk-passport.vercel.app = main without the GHAD
  integration; `/detox` and `/api/travel/legs` 404) is a public site backed by
  production Atlas. It is where the Discovery bug was found and measured, with
  real ids, and where the older builder was run on the family sentences.
- **The committed fixture** (`atlas-candidates-2026-10-11.json.gz`) is real
  Atlas data, but **from a newer Atlas than production**: it carries
  `environment.exposure` and `season`, and production's Discovery payload
  carries neither (production's mapper passes `environment` through whole, so
  production Atlas is not sending them).
- Every RC browser run used the stand-in. Its legs are labelled "estimated by
  standin"; no routed time from real Atlas was seen.

### Fixed

1. **Discovery cards opened "There's nothing at this address."** On
   production, 740 of the 3,110 cards in Discovery's pool routed to a 404: all
   290 Activities and the 450 Places that were not `detailReady` (all 17
   sampled 404'd; Caravan Farm Theatre, U-Pick Apple Orchard Tours, Fairy
   Doors). `destinationFor` sent them to `/passport/{id}`, which asks Atlas only
   for Organization, Experience and Event compositions, then fell back to an
   admin bundle production cannot read. Atlas's `/places/:id/detail` serves
   any Place (25 of 25 sampled rendered on production); Atlas has **no**
   Activity detail read.
   - Every Place now goes to `/places/{id}`.
   - `/passport/{id}` renders an Activity from its Discovery candidate (the
     same cached public read `/day/{id}` uses), with "Let's do this", and
     redirects an old Place link to `/places/{id}` with its query.
   - An Atlas failure on either detail route is now an error page with a
     retry, not a 404.
   - Tests on real ids, and against Atlas's route table in the reference
     clone: `destination.atlas.test.ts`, `passport/[id]/page.test.tsx`.
2. **Whole card clickable.** The venue-photo frame and the gaps in the
   actions row took the tap and did nothing. Hit-tested at 320 points on 40
   cards, desktop and Pixel 7, plus `e2e/release-navigation.spec.ts`.
3. **Make a day** leads the home page's buttons, in the accent, full width on
   a phone.
4. **Contrast.** The orange accent was `#C65A2E` at 4.28:1 (its own comment
   claimed 4.5); it is `#B04E28` at 5.3:1, 4.7:1 on the card tint. The nav's
   inactive grey went from about 3.4:1 to 5.7:1.
5. **"Indoors" built a day of parks.** A picnic shelter counted as indoors:
   two hours with a five-year-old, "something indoors", gave Polson Park and
   Rutland Lions Park, and said every stop stood up to rain. The builder now
   uses Atlas's `exposure` and `setting`, and the day counts the stops Atlas
   says are indoors. On the fixture the day is now Priest Valley Arena and Allan
   Brooks Nature Centre (Vernon), or an art café and a musical (Kelowna).
6. "…what you asked for. a day, 3 stops…" now starts its sentence.

### Tested

| Gate                                                                   | Result                                                      |
| ---------------------------------------------------------------------- | ----------------------------------------------------------- |
| `tsc --noEmit`                                                         | clean                                                       |
| `vitest run`                                                           | 2587 passed, 1 skipped                                      |
| `eslint .`                                                             | 0 errors, 40 warnings (none new)                            |
| `npm run build`                                                        | ok                                                          |
| full Playwright, stand-in, legs 404                                    | 106 passed, 3 failed (core-loop:26, october:554/570, known) |
| `go-release` + `go-intent` + `daybuilder` + `release-navigation`, legs | 51 passed                                                   |
| `go-intent` Atlas-down pair                                            | 2 passed                                                    |
| journeys config, desktop + Pixel 7                                     | 27 passed, 1 skipped                                        |

### Still open after M211

- **Live Atlas, including `/travel/legs`, is unexercised.** Somebody with the
  token must open `/go` and a few Discovery cards of each kind against
  production Atlas before family testing.
- **Indoor days depend on `exposure` reaching production Atlas.** Without
  it (simulated by stripping it from the fixture), Vernon still gets Polson
  Park and Kelowna two farms, but the day now says "1 of 2" / "0 of 2 stops
  are indoors" instead of claiming every stop is.
- **An evening "afternoon"** (asked at 6:45 pm) schedules a 5-year-old into
  the Science Centre at 8 pm and a beach park at 9:16 pm. "Published as open
  on 2026-10-11" says the day, not the hour.
- An Activity open makes three composed reads (cached 404s) before the
  candidate read, because Discovery links carry no `?kind=` hint.
- `ComposedSubject` links its parts to `/passport/{id}`; a part that is a
  Place and not a Discovery candidate still 404s on production.
- On a phone the nav scrolls sideways and "Sign in" starts off screen.
- Production's own `/go` once took more than 180 s to load (one of six loads).

Branch `release/go-have-a-day-family-rc`. **Not merged to main, not pushed, not
deployed.** It is built on `integration/go-have-a-day-first-complete-day`
(ad9b5e1, which already holds Discovery, Day Builder and routing). It adds
`fix/ghad-understand-intent` (b59e4b1, based on the older c1751e9)
**on top**, replayed commit by commit, and then adds this mission's
integration fixes.

## How it was put together

| #   | Commit on this branch | From                       | Conflict                                                                                                                                                                                                                                             |
| --- | --------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | a304b23               | dfdaf5d (intent)           | `GoHaveADay.tsx`. Imports were merged. Both sides add state, and both were kept. The intent side's `setAside` _handler_ clashed with the Day Builder's `setAside` _list_ of removed stops, so the handler became `planWithout`.                      |
| 2   | e7072f4               | e52434b                    | none                                                                                                                                                                                                                                                 |
| 3   | 0ec23f8               | 548476d                    | `GoHaveADay.tsx`, in the tab-storage write guard. Each side had its own race fix: the hand-off remount (`memoryKey !== mountedAt`) and the hydration race (`!saved && parses(firstRead(...))`). **Both are needed**, so the effect now applies both. |
| 4–5 | 43d0548, 2907263      | b29b928, b59e4b1           | none                                                                                                                                                                                                                                                 |
| 6   | (this commit)         | integration + review fixes | below                                                                                                                                                                                                                                                |

`print/page.tsx`, `build.ts`, `brief.ts` and `carry.ts` merged without
textual conflicts. The semantic conflicts surfaced in browser runs and in an
independent review; they are fixed in commit 6.

## Fixed in commit 6

- **The paper and Go Offline said Atlas had nothing for things it does have.**
  Both rebuild the day from its stop ids alone, so "what is missing" was judged
  against 1–3 stops. `buildDay` now takes a `catalogue`, and missing activities
  are judged against it. `/go` and `/go/print` share one pool policy
  (`lib/go/pool.ts`). Regression tests run on the real fixture.
- **A request nothing offers cut a working day down to its kept stop.** The
  guard only caught a day that would end up with _zero_ stops. It now also
  refuses when only kept stops would be left. Also, the opening no longer says
  "here is the rest of what you asked for" when nothing asked for exists.
- **Set-aside and missing activities were invisible off the screen.** "Planning
  without sharks" is now in the day's unknowns, so it shows on screen, on paper
  and in text. The text export carries the opening, where missing activities
  are said first.
- **The first stop was below the fold on a phone.** Build scrolled to the top
  of the section, which on a phone means the chips and the change panel. It now
  scrolls to "not found" if there is one, else to the stops. A day arriving from
  Discovery's link is scrolled into view too. The age hand-off keeps the scroll
  position.
- **A card from Discovery with no town** now asks where the day begins and names
  the pick (ADR 003). The journey test was updated to match.
- **Remembered start:** the last town tapped is kept on this device and offered
  first ("where you started last time"). It is **never applied without a tap**.
  Within a tab, the chosen town already survives new sentences, age changes,
  reloads and Back.
- **The 48 km/h circle** now reads "a search estimate, not a drive time" on the
  chip and in the reply. Nothing else converts minutes to km
  (`kmForMinutes` has one caller).
- Smaller fixes: the age hand-off now carries the sentence actually typed. Undo
  no longer takes away a town the person chose. "within 45 minutes of Vernon"
  as a revision now moves the start. A reopened "this afternoon" day no longer
  keeps yesterday's clock. Kept days still show during an Atlas outage.
- ADR 003 is accepted for building a day only. Doctrine §15.5 says so and stays
  open for everything else.

## What was tested, and against what

**Atlas in every browser run is a stand-in** (`e2e/support/atlas-standin.mjs`).
It serves the committed real body `atlas-candidates-2026-10-11.json.gz`. The
places, coordinates and schedule readings are real Atlas data from that day;
the server is not Atlas. Its `/travel/legs` numbers are the stand-in's own,
**not routes**. **Live Atlas was not exercised**: this checkout has no
credentials, and production Atlas answers 401 to unauthenticated requests
(checked 2026-10-11).

Final run (2026-10-11, on the committed tree). `next start` (production
build) ran on :3120, with the stand-in on :3121:

| Gate                                                                         | Result                                                                                                                              |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `tsc --noEmit`                                                               | clean                                                                                                                               |
| `vitest run`                                                                 | 2572 passed, 1 skipped                                                                                                              |
| `eslint .`                                                                   | 0 errors, 40 warnings (none new)                                                                                                    |
| `prettier --check .`                                                         | only `public/labs/discovery-space/christmas-passport.html`, which already failed on the base                                        |
| `npm run build`                                                              | ok                                                                                                                                  |
| full Playwright suite, `E2E_ATLAS=1`, routing absent (`legs: 404`)           | 97 passed, 4 failed. The 4 are core-loop:26 and october:373/554/570, already on the known environment-only list, so not regressions |
| `go-release` + `go-intent` + `daybuilder`, routing present (stand-in legs)   | 43 passed                                                                                                                           |
| `go-intent` Atlas-down pair (`candidates: 500`), on `/go` and on `/go/print` | 2 passed                                                                                                                            |
| `playwright.journeys.config.ts`, desktop + Pixel 7                           | 27 passed, 1 skipped                                                                                                                |

The eight M200 sentences run as unit tests on the real fixture
(`intent.regression.test.ts`) and in the browser on desktop and phone
(`go-intent.spec.ts`). `go-release.spec.ts` adds:

- a kept stop through "no museums", "keep us indoors", Undo, a town change, a
  reload and the paper;
- no town → asked → kept through a new sentence and a new age → offered (not
  applied) in a new tab;
- shark diving, then "plan without sharks", then Undo;
- scuba with sharks (partly available), with "not found" above the stops and the
  paper matching the screen;
- the 48 km/h label;
- a picked place with no coordinates;
- the first stop on screen after Build.

In one stress run, the last check ("first stop on screen") failed **once in
about 100 runs** on the phone. It did not reproduce in 96 further runs, 84 of
them under load. The likely cause is content (the forecast) arriving after a
smooth scroll. Watch it during family testing.

## Not fixed — remaining risks

- **Live Atlas has not been exercised.** No credentials exist here. Before
  family testing, someone with the token should open `/go` against production
  Atlas, including `/travel/legs`.
- ~~No way into `/go` from Home or the nav.~~ Home has Make a day (M211).
- ~~Contrast (M200)~~: fixed in M211.
- **A kept day is not pinned to its stops.** Reopening rebuilds it from the
  brief and shaping, so a later corpus or builder can change it. No kept days
  exist in production yet, because `/go` has never shipped there.
- **"Within 30 minutes" is never checked against routed legs.** The circle is
  labelled as an estimate and the legs are labelled as what they are, so both
  are honest, but they can disagree on screen. Routing has a
  `withinMinutes` check that `/go` does not use.
- **Removed stops on the paper:** if the person removes the only stop offering
  an interest, the screen says Atlas offers nothing for it, while the paper
  says "not in this day". The paper is the more accurate one here; the
  difference was not reproduced on the fixture.
- **On a hard reload**, the arrival scroll can fire before the saved day is
  adopted.
- These are carried over from ad9b5e1's review and are unchanged: a 429/401 on
  travel reads as "could not get travel times"; a `not-served` answer is
  memoised for 5 minutes; anonymous clients without forwarding headers share one
  rate-limit bucket.
- The doctrine question §15.5 is answered for building a day only.
