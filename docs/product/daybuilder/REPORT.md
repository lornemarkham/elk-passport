# Day Builder: complete the day experience — report

**Branch** `lane/daybuilder`, built on `integration/go-have-a-day` (`c1751e9`,
M178) by fast-forward. Nothing on M178, Discovery, maps, analog or detox was
rewritten. Not merged, not deployed, no paid API used.

## What was already there (not duplicated)

Say it, build it, keep/swap/time/move/remove, revise in words, rain plans,
routed legs or labelled straight lines, the field-guide paper, the Go Offline
hand-off, Discovery's `?with=`. All from M178.

## What this adds

| Focus                  | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Timing and uncertainty | `src/domain/day/timeline.ts`: a clock for each stop and for home, from the **stated leaving time** + stop minutes + **Atlas's routed minutes**. An unrouted move is the plan's flat 15-minute allowance, so every time that rests on one says _about_ (`~` in the glance) and _roads not measured_; it can only ever say _tight_ or _over_, never _fine_. "Leave now" says it is counting from now. No leaving time, no clock — the page says how to get one. |
| Unavailable places     | A place you chose that Atlas says is not on that day (or won't admit the age) is now said **first**, in "Couldn't fit these in", not buried under "worth checking" (`DayPlanned.leftOut`, additive). Sources that disagree get a per-stop "call ahead".                                                                                                                                                                                                       |
| Remove without losing  | A removed stop goes to "Not today — still yours" with **Put it back** (doctrine §2.2/2.4: not today is not not wanted).                                                                                                                                                                                                                                                                                                                                       |
| Saving                 | **Keep this day** → "Days you kept" on `/go`: reopens exactly as shaped, prints, forgettable. This device only. A "now" clock is dropped on reopen.                                                                                                                                                                                                                                                                                                           |
| Offline                | **Take it as text** (share sheet on a phone, clipboard elsewhere): the day, its times, what nobody published, what to check — works pasted into Notes with no signal.                                                                                                                                                                                                                                                                                         |
| Phone                  | 44 px targets, the day at a glance (jumps to cards), Print/Keep bar that stays in reach, shorter photos.                                                                                                                                                                                                                                                                                                                                                      |
| Bug fixed              | Hard reload dropped a shaped day's order: the not-yet-hydrated instance overwrote the saved shaping (affected the existing Back restore too).                                                                                                                                                                                                                                                                                                                 |

## Evidence

- `tsc` clean; `eslint` 0 errors (39 warnings, same as baseline); vitest
  **2491 passed**, 1 skipped; `npm run build` OK.
- `prettier --check`: one file fails, `public/labs/discovery-space/christmas-passport.html`, untouched by this work.
- New browser journeys `e2e/daybuilder.spec.ts`: 15 tests (multi-stop, one-stop,
  rearrange, remove/put back, closed place, missing routing, no leaving time,
  MOCKED routes, keep/reopen/forget, text, print A4 + Letter PDF, 4 phone
  tests). 240/240 across 16 repeated runs on `next dev`.
- Full suite on `next start`: 69 passed, 4 failed — `core-loop:26`,
  `october:373/554/570`, all in the recorded environmental baseline
  (7 by name at M178). No new failure.
- **Real vs mocked.** Real: server, planner, pages, browser, storage, print.
  Atlas is a **stand-in** serving the committed snapshot of a real
  `/discovery/candidates` body (2026-10-11): real places, readings and
  coordinates, not a live Atlas. It serves no `/travel/legs`, so "missing
  routing" is exercised for real. The one **MOCKED** test invents routed
  minutes in the browser.
- Screenshots: `docs/product/daybuilder/screens/before|after/`.
- Independent review (separate agent, read-only) found 11 issues; fixed: the
  "road can only add" claim (it is an allowance, not a floor), "now" clock
  presented as stated, stale kept clock, per-card hours noise, weak keep
  feedback, flat voice, 36 px glance links, corrupt-storage freeze, weak test
  assertions. Not changed: see below.

## Decisions this touches (not resolved here)

- **D-8 clock times.** The brief asked for realistic timing, so clocks are on,
  built only from stated time + minutes + routed legs, labelled _about_ where
  not measured. A person should confirm this reading of D-8.
- **D-2 / D-9 saved days.** Kept days are browser-only, no status field, and
  are the thing to replace when those are decided.
- **Sticky Print/Keep bar** on phones: a judgement call against doctrine §6
  (less phone). Easy to remove.

## Remaining release blockers

1. **Never run against live Atlas** (lane has no key/host). Routed times,
   closed-day readings and rain plans need one pass on real Atlas.
2. **Atlas `/travel/legs` is not deployed**, so on production every move is
   still a straight line and every clock says _about_.
3. **Clock vs opening hours is not checked**: published hours are free text
   Passport deliberately never parses, so "9:15 am" can sit beside "opens at
   11". Needs structured hours from Atlas.
4. **No true offline**: no service worker; the text and paper are the offline.
5. **Kept days live in one browser** (D-2, D-9).
6. **Hard load flashes the unshaped day** for a beat before the kept shaping
   replaces it (existing behaviour of the saved-day swap).
7. Pre-existing: 4 environmental e2e failures, the prettier file above.

## Outside my lane

`src/domain/day/build.ts` (one additive field, `leftOut`);
`src/components/go/*`, `src/lib/go/*`, `e2e/daybuilder.spec.ts`,
`docs/product/daybuilder/`. No shared contract, migration, layout or
`package*.json` touched.
