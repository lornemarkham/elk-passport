# GO HAVE A DAY — first complete day: integration record

Branch `integration/go-have-a-day-first-complete-day`, built on
`integration/go-have-a-day` (c1751e9). **Not merged to main, not deployed.**
Atlas data in the browser runs is a saved real candidates body served by a
stand-in; **every travel time in those runs is the stand-in's estimate
(`standin`), not a route.** No paid API was called.

## What was merged, in this order

| #   | Source                                   | Why this position                                                                                                                               |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `routing/atlas-legs-hardening` (ed2f522) | The contract and its guards (same-origin, 20/min per client, a 5-minute server memo). Everything that asks for legs sits above it.              |
| 2   | `lane/discovery` (c45efc3)               | Mobile Discovery, "from where" in place, a stated drive as a limit, Discovery → /go. Touches `ask/*`, `discovery-list/*`, `ghad/FeelLikeDoing`. |
| 3   | `lane/daybuilder` (e12d54d)              | The clock, kept days, honesty about what is closed. Touches `components/go/*`, `domain/day/*`, `lib/go/*`.                                      |

No textual conflicts. The semantic ones were all in tests:

- **Memo vs. Discovery's journeys.** They forced a routing failure by flipping
  the stand-in, but asked the same question as an earlier test, so the memo
  (correctly) answered from cache. Each failure now asks a new question (a
  different town, per project).
- **Rate limit vs. Discovery's journeys.** One client asking for ~a dozen days a
  minute hits 429. Each test is now its own client via `x-forwarded-for`. The
  limiter is untouched and the app has no test mode.
- **Daybuilder's specs assume an Atlas with no `/travel/legs`;** Discovery's
  stand-in serves it. Run the daybuilder specs with the stand-in's
  `legs` mode at `404` (`POST /__mode {"legs":"404"}`).
- `.prettierignore` gained Atlas's `travel-legs-1.json` (kept byte-for-byte).
  `public/labs/discovery-space/christmas-passport.html` already fails
  `prettier --check` on the base; untouched.

New: one journey crossing all three lanes, run with routing present and
absent, desktop and mobile — Discovery → "Make a day of it" → clock and travel
summary → keep → reload → kept list → print → Back → Go offline → "Phones
away" with the same stops. Screenshots: `docs/product/discovery-journeys/{desktop,mobile}/2*`.

## Merge order for the planning-intelligence mission (M202)

M202 works on intent parsing and refinement; the merged lanes work on
timing, saving and travel. Suggested order:

1. **This branch first** (or M202 rebased onto it). It is what M200 audited plus
   the three lanes, so M202's before/after numbers are comparable.
2. **M202 on top**, not beside it. Expect overlap in `src/components/go/GoHaveADay.tsx`
   (refinement box, kept stops — daybuilder added keep/clock/KeptDays here) and
   `src/lib/ai/ask/*` (Discovery added origin handling to `answer.ts`/`read.ts`).
   M202 should _read_ the day through `domain/day/timeline.ts`, not recompute times.
3. Do not duplicate: "within 30 minutes" is now a drive limit Atlas can check in
   Discovery (`lane/discovery`); M202 should reuse that, not reparse.
4. M200 blockers 1–4 and 7–8 stay M202's; this branch does not fix them.

## Remaining blockers (not fixed here)

- Province-spanning days without a starting point; misread "two hours free" /
  "drive two hours"; no "nothing good" answer; Atlas down → 500 on `/go` (M202).
- No link to `/go` from Home or the nav (a product placement decision).
- Contrast: brand orange on white 4.28:1, nav grey 3.36:1 (M200).
- Real Atlas `/travel/legs`: never exercised here. Whether production Atlas
  serves it is unconfirmed (401 without a token).
- Signed-in saving, voice: not tested (no Supabase / key).
- Default e2e suite: same 7 environmental failures as the documented baseline
  (core-loop:26, october:168/284/373/482/554/570).
