# GO HAVE A DAY — family-test release candidate (M207)

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
- **No way into `/go` from Home or the nav.** This is a product placement
  decision.
- **Contrast** (M200): the brand orange on white is 4.28:1, and the nav grey is 3.36:1.
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
