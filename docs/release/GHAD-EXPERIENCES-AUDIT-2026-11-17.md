# Go Have a Day — experience audit and Labs navigation (M863, 2026-11-17)

Owner brief P1. Audited against **https://gohaveaday.com** on 2026-11-17
(Chromium, desktop 1280×720 and Pixel 7 emulation, signed out, no
credentials). Nothing was deployed; see "Deployment status".

## 1. Production audit

Verdicts are strict: **WORKING END TO END** needs a visitor to complete the
intended journey, and a signed-out audit cannot complete any journey that
begins with sign-in. Only what was exercised is claimed.

| Experience                        | Verdict           | Verified                                                                                                                                                                             | Not verified / found                                                                                                                                                                                                                   |
| --------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Christmas `/christmas`            | PARTIALLY WORKING | Loads (200, 1.0s), 55 images none broken, plan prompts render, Lights Map `/christmas/lights` loads with 4 lit places and a regional filter, phone and desktop, no horizontal scroll | "Make my Christmas plan" was pressed but a finished plan was not confirmed. Signed-out visitors get a **401 from `/api/boards`** that surfaces as a console error                                                                      |
| Hockey Night `/hockey`            | PARTIALLY WORKING | Public site loads with live NHL scores, standings, teams; Create a Night correctly sends a visitor to sign-in and back                                                               | Creating and running a night needs an account: NOT TESTABLE here                                                                                                                                                                       |
| Snow Day `/snow`                  | PARTIALLY WORKING | Loads; Find a mountain opens `/snow/mountains` with distance filters and approximate-location line                                                                                   | Starting a day, conditions for a chosen mountain and the shared day were not exercised                                                                                                                                                 |
| Sesh Wars `/snow/sesh-wars`       | PARTIALLY WORKING | The demo (`/snow/sesh-wars/demo`, 30 fictional riders) opens and renders                                                                                                             | The **real competition is not live**: the page says "Sesh Wars is warming up" until its home on Passport is switched on                                                                                                                |
| Date Night `/datenight`           | NOT TESTABLE      | Loads; "Let's find some trouble" correctly goes to sign-in                                                                                                                           | Everything after sign-in needs an account                                                                                                                                                                                              |
| Conference `/conferences`         | NOT TESTABLE      | Loads; code entry and sign-in present                                                                                                                                                | A conference needs a code or an organiser account                                                                                                                                                                                      |
| October `/october`                | PARTIALLY WORKING | Loads on its own shell with live Atlas data ("33 tonight, 216 this weekend")                                                                                                         | "Choose your October area" and opening a result were not exercised                                                                                                                                                                     |
| Badminton Game Night `/badminton` | PARTIALLY WORKING | Loads; the 25-player Test Game Night demo (`/badminton/game-night`) opens                                                                                                            | Real sign-in/queue not exercised. On a phone the first paint is a dark screen reading "Loading the courts…" for several seconds. Console error on every load: service worker scope `/badminton` is not under the allowed `/badminton/` |

Across all eight, desktop and phone: every route returns 200, no uncaught page
errors, no broken images, no horizontal scroll. Console/API errors found: the
Christmas 401 and the Badminton service-worker scope error above. **Neither
was changed** (outside this brief; proposed below).

## 2. What changed

- `src/lib/experiences.ts`: `EXPERIENCES` is now the five featured products
  (Christmas, Hockey Night, Snow Day, Sesh Wars, Date Night). New
  `LAB_EXPERIENCES` holds Conference, October and Badminton Game Night with
  status, description, status note and preview image; `LABS_HREF`;
  `currentLabsExperience`.
- `src/components/shell/PassportNav.tsx`: the Experiences row is the five plus
  one **Labs** entry. Labs (and Experiences) light while on `/labs` or inside
  any Labs experience.
- `src/app/labs/page.tsx`: an Experiences grid at the top of Labs — name,
  description, honest status pill, preview, Open Experience — above the
  existing prototypes, which are unchanged.
- `public/labs/previews/*.jpg`: captures of the live pages.
- No route, page or URL was removed or moved; bookmarks and shared links are
  unaffected (every old URL was re-requested and still answers).

### Status labels, and why

- **Conference — Experimental.** Works with a code; built around one event.
- **Badminton Game Night — Experimental.** In real use by one club; public demo works.
- **October — Archived.** Still runs on live data, but doctrine §10 calls it the
  first experiment, not the Experience Contract. This is a judgement call:
  change it if October is meant to be Experimental.
- "Coming Soon" and "In Development" are supported by the type but unused:
  nothing in this brief is honestly either.

## 3. Verification (checkout, `next start` on 3120)

- `npx tsc --noEmit`: clean. `npx eslint .`: 0 errors (94 warnings; the M122
  baseline of 39 is stale, none in touched files). `npx prettier --check`: clean.
- `npx vitest run`: 4647 passed, 55 skipped.
- `npm run build`: passes.
- Playwright (desktop + phone): `labs`, `experiences-nav`, `global-header`,
  `release-navigation` — 49 passed, 6 skipped; the whole suite was not run.
  `global-header` "menu moves between experiences" had a latent race (two
  headers mounted mid-transition); the test now waits for one header.
- Screenshots: `docs/release/ghad-labs-2026-11-17/`.

## 4. Deployment status

**BUILT, TESTED, INTEGRATED on local `main`. Not deployed, not pushed.**
This checkout cannot push or deploy (CLAUDE.local.md). Production still shows
the old eight-item menu. A person must fetch the commit
(`git fetch metatron:passport/main main`), push, and verify production. No
migration or environment change is involved.

## 5. Proposals (not done)

- Christmas: avoid calling `/api/boards` for signed-out visitors (or return an empty list rather than 401).
- Badminton: serve the service worker with `Service-Worker-Allowed: /badminton` or register with scope `/badminton/`; add a visible loading state to first paint.
- Doctrine conflict, named not resolved: `e2e/labs.spec.ts` and `experiments.ts`
  said "October is not a Labs experiment — it belongs to iamoctober.com". The
  brief overrides that, so the test was removed and the comment rewritten.
