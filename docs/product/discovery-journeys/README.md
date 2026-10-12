# Discovery → Go have a day: journeys, 2026-10-11

Lane `discovery`, on top of `integration/go-have-a-day` (`c1751e9`, fast-forwarded;
nothing there was changed or duplicated). **Not product authority** — the
doctrine is. Screenshots: `desktop/` and `mobile/` (Pixel 7) beside this file.

Run: `npx playwright test -c playwright.journeys.config.ts` (starts an Atlas
stand-in on 3123 and `next dev` on 3122; no key, no paid API, nothing deployed).
The stand-in serves the committed real candidates snapshot; its `/travel/legs`
is straight-line × 1.3 and is **not a route**.

## What changed

| Finding before                                                                                               | Change                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Phone: ~1,000 px of pill rows before one possibility (doctrine §2.1/§4: no questionnaire before possibility) | Rows sit behind one line that says what is chosen (`collapseOnPhone`); desktop unchanged                                            |
| "From where? … above" pointed at a row a screen away whose town picker scrolled off the right edge           | `OriginPicker` (town + share location) inside the answer's own gap                                                                  |
| "Worth driving an hour for?" led with a place 132 km out; "an hour" was thrown away                          | The length is read (`driveHours`). Atlas's routed estimate over it removes a place; no routed time never removes one. Nearest first |
| Empty drive answer used a generic sentence                                                                   | Says which wall it hit (the span, or the 40–200 km band)                                                                            |

No speed is invented: Passport still only repeats Atlas's routed minutes.

## Journeys covered (desktop and phone)

Arriving; refine line; from-where → measured; distant destination (Kamloops,
nearest first); empty search; short drive; Atlas answers empty; Atlas fails;
answer → day (`at`, `with` carried, no coordinate); routing 500 (day stays,
straight lines said, retry recovers); routing 404 (said once); one card → day.
23 pass, 1 skipped (the refine line is phone-only).

Gates: `tsc` clean · eslint 0 errors (39 warnings, same as baseline) · prettier
clean · vitest 2483 pass · existing e2e with `--workers=1` against a dev server
and the stand-in: nfr + adventure 20/20; core-loop:26 and october:373/405/441…
fail, all in the known environmental list (no live Atlas/account).
(Run in parallel against `next dev` the nfr budgets flake; that is load, not code.)

## Doctrine and implementation, named not resolved

1. **§2.1 says location can be derived without asking; Discovery requires an
   explicit tap** (a deliberate "Passport does not guess" choice). Left as is.
2. The drive note says "there's no routing here" while the integration branch
   has Atlas routed legs. It stays true for _Discovery's_ feed until Atlas
   serves `travel=`; the note now says a card shows Atlas's estimate where it has one.

## Remaining blockers / not done

- No real Atlas, no real `OPENAI_API_KEY`: model path (DSC-03) untested; routed
  minutes only exercised through unit tests and a stand-in.
- Picks come from a snapshot; whether places are really open is not re-checked.
- `/api/travel/legs` logs "(unreachable)" for any non-Atlas error, including a
  500 — a misleading label (not in this lane).
- Remote hero images do not load in the sandbox; blank cards in screenshots are that.
- "Make a day of it" still hands over only the first two picks.
- Outside my lane: `src/components/ghad/FeelLikeDoing.tsx` (the collapse),
  `e2e/nfr.spec.ts`, `playwright.config.ts` (ignore the journeys spec),
  `playwright.journeys.config.ts`, `e2e/support/atlas-standin.mjs`.
