# Go Have a Day — loading, measured (P1, 2026-11-17)

Owner feedback: _"Changing locations took approximately 30 seconds. There was
no visible loading indicator."_ This records what was measured, what changed,
and what is still slow and why.

## Measured on production before the change (gohaveaday.com = d147175)

Phone emulation (Pixel 7, 4× CPU throttle) on Metatron's connection unless
said. Scripts are in `~/scratch/m-load/` (`switch.mjs`, `open.mjs`,
`film.mjs`).

| What                                        | Measured                                                                                            |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Christmas: Vernon → Kelowna                 | 4.4 s then 1.4 s with **nothing on screen**. The bar kept saying "Vernon" until the new page landed |
| Christmas: `/christmas?at=kelowna`, cold    | **8.3 s** to first byte (a fresh server instance reads Atlas's whole corpus)                        |
| Christmas: same, warm                       | 0.6–0.9 s to first byte                                                                             |
| Discovery: Vernon → Kelowna                 | bar updates in 0.2–0.35 s (client-side); results after the distance reading                         |
| `/api/discovery/distance` (Kelowna)         | 0.4–2.9 s, 624 KB (116 KB brotli)                                                                   |
| `/api/discovery/travel` (Kelowna)           | 1.0–2.5 s, 195 KB                                                                                   |
| Discovery opened, Slow-4G + 4× CPU          | **10.2 s** before the location bar could be used                                                    |
| A place page (`/places/:id`)                | **9.2–10.9 s** to first byte, **every visit**, the same place three times in a row                  |
| Christmas Refine form, Plan box, time edits | full page reloads (plain `<form>` / `location.assign`); the page froze with no feedback             |

The "30 seconds" was not reproduced on a warm instance. On a cold instance the
waits add up: Atlas's corpus read (8–19 s, `atlas-repo.ts`), a new town's
distance reading (up to 2.9 s), and a phone's render. With no feedback at any
point, a tap that seemed ignored invites a second tap and a second wait.

## What changed

| Requirement (brief)                         | Change                                                                                                                                                                                                                                                                                          |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Immediate feedback; a new location is clear | `ExperienceLocation` runs the town change as a transition. The bar names the picked town **at once**, with `◌ Loading…`; the old results stay, dimmed and `aria-busy` (`PendingContent`), until the new ones replace them. On Christmas home, Discover, Plan and Itinerary                      |
| Subtle navigation progress                  | `NavigationProgress`: a 3 px accent line at the top for every in-site link, GET form and held transition. Appears after 150 ms (a fast page never flashes), creeps to 85% and waits there, and finishes when the address changes. Mounted by GHAD's `ThemeProvider`; one line however many nest |
| Skeletons                                   | `loading.tsx` for `/places/[id]` and `/passport/[id]` (`SubjectSkeleton`): the page's shape in its first bytes                                                                                                                                                                                  |
| Preserve content while refreshing           | Christmas town change, Discovery day/age change (`startTransition`, `#discovery-results` dimmed), lights map area change                                                                                                                                                                        |
| No unnecessary full-page reloads            | Christmas Plan box, Refine, Re-plan and pick-a-date are `next/form` (still work without JavaScript); a stop's new time is `router.push`                                                                                                                                                         |
| Feedback where the person is looking        | `SubmitButton`: "Making your plan…", "Finding…", "Re-planning…" with a spinner, and no second submit                                                                                                                                                                                            |
| Error and retry states                      | Discovery: "Couldn't measure distances from Kelowna just now. Try again". Lights map: "Loading the map…", then "The map couldn't load just now. Try again"                                                                                                                                      |
| Cache appropriate data; fix the real cost   | `getPlaceDetail` now sits behind the same success-only, single-flight memo as `getSubjectDetail`, so a repeat visit doesn't ask Atlas again                                                                                                                                                     |
| Reduced motion                              | The line is drawn still (no creep, no animation); spinners and pulses stop (`motion-reduce:`)                                                                                                                                                                                                   |
| No intrusive overlays                       | Nothing covers the page; the map's status sits inside the map box                                                                                                                                                                                                                               |

## After, measured locally (same conditions both sides)

`before` = d147175 (= production), `after` = this change, both `next build` +
`next start`, against a slow Atlas stand-in that waits the way production does
(corpus 6 s, distance 1.5 s, place detail 8 s; `~/scratch/m-load/slow-atlas.mjs`),
Pixel 7, 4× CPU.

| Action                                     | Before                            | After                                                        |
| ------------------------------------------ | --------------------------------- | ------------------------------------------------------------ |
| Christmas Vernon → Kelowna: first feedback | none until results (1,892 ms)     | **61–71 ms**                                                 |
| Christmas: bar names Kelowna               | 1,892 ms (new town, cold)         | **94–131 ms**                                                |
| Christmas: Kelowna's results on screen     | 1,927 ms                          | 1,928 ms (the server's honest wait, now visibly in progress) |
| Christmas Kelowna → Vernon (warm)          | 238–271 ms, no feedback           | 79–85 ms to the bar, 255–289 ms to results                   |
| Place page: first thing on screen          | 8,488–8,513 ms                    | **438–474 ms** (skeleton)                                    |
| Place page: content, first visit           | 8,558 ms                          | 8,287 ms                                                     |
| Place page: content, repeat visit          | 8,587 ms                          | **559 ms** (memo)                                            |
| Atlas detail reads for 2 visits to 1 place | 8                                 | 3                                                            |
| Christmas Refine (new age): first feedback | none; page frozen 6.2 s           | **49 ms** ("Finding…"), line at 208 ms                       |
| Discovery Vernon → Kelowna                 | bar 270–293 ms, results 0.5–1.9 s | unchanged, plus "◌ Finding what's close…" beside the town    |

## Still slow, and whose it is

- **Atlas's corpus read (8–19 s cold) and place detail (9–11 s).** Passport
  memoises both per server instance, so only the first reader of a cold
  instance pays. The fix belongs in Atlas (recorded in `atlas-repo.ts` since
  2026-10-01). This change doesn't cover the wait. It shows that the wait is
  happening.
- **Discovery's first load** ships the whole pool (~1 MB brotli, ~8 MB DOM):
  10 s before the bar is usable on Slow 4G. Not touched here. Earlier missions
  own it (M760, M817).
- **A new town's distance reading** is up to 2.9 s on production and is
  per-instance memoised. Not touched.

## Tests

- `src/components/loading/loading.test.tsx`: what starts the line, the 150 ms
  quiet period, finishing on the address change, one line for many mounts, a
  GET form, held transitions, the 30 s give-up, `PendingContent`, the skeleton.
- `src/components/location/LocationBar.test.tsx`: the town on its way is
  named and said to be loading.
- `e2e/loading.spec.ts` (6): the Christmas switch and back, the plan button
  with no reload, Discovery's failed distance reading and retry, Discovery's
  bar feedback, a place page's skeleton, and reduced motion. **All six fail on
  d147175 and pass after.**
