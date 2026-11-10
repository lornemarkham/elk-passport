# Go Have a Day and Snow Day — finish the real user experience (M660, 2026-11-10)

Base: production release record `f7adcc8`. Decision: [ADR 016](../../architecture/decisions/016-a-day-from-chosen-places-starts-where-they-are.md).

## What changed

| Brief item                    | Change                                                                                                                                                                        | Where                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Wrong geography in Discovery  | A subject with coordinates but no stated area is placed by the nearest named town (≤ 60 km). 167 Vancouver entries no longer lead an Okanagan page.                           | `domain/discovery/area.ts` (`placedAreaOf`)                 |
| Saved across locations        | Nothing is filtered from the Pocket by place. It now says, before the press, when ideas are in different places.                                                              | `components/pocket/AdventurePocket.tsx`                     |
| Pocket → Make a day           | Picks around one town: the day starts there (no question). Picks in several places: a panel offers a day around each, or a weekend. An unplaced pick joins the biggest group. | `domain/day/places.ts`, `app/go/page.tsx`, `GoHaveADay.tsx` |
| Honour selected experiences   | Verified: all chosen stops are kept at 2, 4 and 8 hours; weekend sketch shares them by region instead of round-robin.                                                         | `build.chosen.test.ts`, `lib/adventures/propose.ts`         |
| Explain conflicts first       | "This is tight" box when chosen stops need more than the hours; every stop kept.                                                                                              | `DayPlanned.conflicts`, `DayItinerary.tsx`                  |
| Fewer location questionnaires | `/go` and `/adventures/new` take the start from the picks. Still asked when nothing is chosen (ADR 003).                                                                      | as above                                                    |
| Print / offline secondary     | Keep this day is the one primary action; Print, Copy as text, Go offline are quiet links.                                                                                     | `GoHaveADay.tsx`                                            |
| Simpler itinerary             | Only the action area was simplified. No broad redesign, as briefed. Provenance legend and "worth checking" were kept (doctrine §5).                                           |                                                             |

## Verification (what it does and does not prove)

Production build in a scratch copy, on port 3126 (3120 was held by another
mission's server), real local Supabase (GoTrue + PostgREST + RLS), Atlas
stand-in serving the **real 2026-11-08 production corpus** (5,471 entries).
`scenarios.spec.ts`, desktop and Pixel 7:

- **A** Discover near Vernon → none of the answers > 80 km away → save four →
  Pocket → Make a day → no start question, all four in the day. ✔ both
- **B** Save Kal Beach, BNA Brewing, Knox Mountain Park (Okanagan), Stanley
  Park, Capilano Suspension Bridge (Vancouver) → Pocket says "2 different
  places" → Make a day says so and drops none → day around Okanagan has its
  picks → weekend: town preselected, 2 days, every pick present, no day holds
  both regions. ✔ both
- **D** two spoken changes after the build ("Add somewhere for lunch", "Keep
  us within 30 minutes"): every pick still there. ✔ (inside A)
- **C** `e2e/snow-silverstar.spec.ts` (phone + desktop, real corpus): sentence →
  SilverStar, date, crew, Atlas picks with photos, lunch (honestly none), après
  vote and lock, change in words, start, memory, recap. ✔ 3/3.
  `snow/verification/two-phones.spec.ts` (shared day, real Supabase) ✔.

Not proved: **this is not the deployed application.** Deploying and pushing are
forbidden in this checkout, so nothing here has been run against
elk-passport.vercel.app. Atlas was a stand-in with a two-day-old corpus, and
Atlas's boards API is the stand-in's.

## SilverStar: real sources, checked 2026-11-10

Re-read from skisilverstar.com's own page data: Alpine Opening Day Nov 27 2026,
Closing Apr 4 2027, Nordic Opening Nov 20 2026, lifts 9:00–4:00 to Jan 31,
status "Currently Closed", all "Tentative". Matches `domain/snow/resorts.ts`.
The dining page still reads "Returning Winter 25/26" and "Closed until Winter
25/26" for Paradise Camp and Town Hall — SilverStar's own staleness, not ours.
Weather is an Open-Meteo model forecast, labelled, and says so when it can't be
reached; it is never filled in.

**Missing Atlas data** (unchanged from `ATLAS-REQUEST-SILVERSTAR.md`; not
re-measured because production Atlas isn't reachable from here): 0 of the
resort's 14 dining venues, no on-mountain lunch or après, no snowshoe/fat-bike/
night-ski/spa activities, resort photo is a category image. Passport shows "Atlas
has no lunch spot on the mountain yet" and never invents one.

## Remaining blockers (owner)

1. Push `main` (`git fetch metatron:passport/main main`), preview, then SHIP
   via the Forge runner — approval is the owner's. Pending migrations in
   `docs/release/RELEASE-2026-11-09-GHAD-SNOW-MIGRATIONS.md` still apply first.
2. Walk A–D on the deployed preview, desktop and phone.
3. Open-Meteo commercial terms; ADR 015 confirmation; Atlas acquisition of
   SilverStar venues (an Atlas mission).
4. Start-town naming: a day around Vernon-area picks may read "From
   Coldstream" (nearest named town to their middle). Honest, but may want a
   preferred-town rule.
