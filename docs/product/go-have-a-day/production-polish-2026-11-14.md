# Go Have a Day — production polish, 2026-11-14 (mission 845)

Measured against **https://gohaveaday.com** (prod = GitHub `main` d9d5983,
which carries M817 and M840) on an iPhone 13 viewport, and against the
production Discovery pool read from the page's own payload (6,426
candidates). Nothing here used credentials.

## What a phone saw

| Check                         | Result                                                                                                                                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home `/` load                 | 200, 6.97 MB HTML, `load` at 3.6 s                                                                                                                                                                               |
| Cards on the page             | 72 in 9 sections; 47 with a picture, 25 with the text treatment                                                                                                                                                  |
| Broken images                 | **None.** 8 looked unloaded and were lazy images in off-screen shelf positions; each URL answered 200 `image/jpeg`. Failed loads already fall back to the venue picture and then to words (`PossibilityCard`).   |
| Internal links on home        | 156 checked, **0 broken**; one place page timed out at 20 s (the slowness below). 12 detail pages answered 200 with 0 broken images; 35 external links (official sites, maps, directions) all answered           |
| Expired events                | None presented as upcoming (M817's hygiene holds)                                                                                                                                                                |
| Event shelves near Vernon     | _Happening today_ 3 local of 8; the other 5 were Calgary, Québec, Ottawa-area events. _Coming up_ 0 local of the first 8 (Ottawa Outdoor Film Festival, Saskatoon Santa Claus Parade, Gipsy Kings at Fallsview…) |
| "Look further" offer          | "3407 more in Metro Vancouver and Calgary and Canmore and Ottawa and … Victoria" — four lines of city names on the first screen                                                                                  |
| Place page (`/places/[id]`)   | 13–14 s to first byte **on every visit**; coordinates ("49.915, -119.459") as the location line; **no Directions**; "offers hiking, hiking, and biking"                                                          |
| Event page (`/passport/[id]`) | Fast once warm (0.2 s); When, Where and Directions all present                                                                                                                                                   |

## What changed (Passport)

- **Local first, nothing removed.** Every section orders what Atlas places in
  the page's area, then what it has not placed, then what it places
  elsewhere (`homeFirst`, `area.ts`); within each page of a shelf, a
  photograph no longer lifts an unplaced card above a local one. On the
  production pool, _Coming up_ near Vernon now opens on five Okanagan events
  (CMS Winter Market, Yuletide at the Lakeside, Cannery Brewing…) instead of
  none.
- **The offer to look further is one line**: "3407 more in Metro Vancouver,
  Calgary and 13 other areas — show them too" (`namedAreas`).
- **A window is not every day in it.** An event whose interval Atlas marks as
  not actionable (`unexplained-span`, `separate-occurrences` without listed
  days) says "Some days — check dates" under its date.
- **Place pages**: a Directions button (to the stated point, else to name and
  address); coordinates are no longer printed as the location; activities are
  said once each; `listPlaces()` sits behind the same short Atlas memory as
  the candidates read, and the place detail is read once per request instead
  of twice (metadata + page).

## For Atlas (source-data defects — Atlas's to fix, not Passport's)

Atlas mission 843 is running on discovery data; these are offered as
evidence, not as a parallel fix.

1. **559 of 1,062 events carry no area and no coordinates**
   (`geography.state: "unknown"`). By their own titles about 96% are outside
   the Okanagan (Ottawa, Saskatoon, Calgary, Québec, Niagara); 22 name an
   Okanagan place and are still unplaced (Vernon ROCKS, Peachland Light-Up,
   Big White's Christmas Eve Festival, Penticton Farmers' Market 2026). An
   area or a venue on each would let Passport stop showing them to the wrong
   town.
2. **Event pictures: 1,035 of 1,062 events have no picture of any kind**
   (12 own, 15 venue). Only 21 events name a venue, and none of those venues
   has a picture either, so Passport has nothing honest to borrow.
3. **Dates that contradict themselves**: _Xmas Fusion DJ Night_ is stated as a
   run from 2025-12-25 to 2026-12-25 (a one-night event shown as "On until
   Dec 25"); _Orionid meteor shower 2026_ runs to Nov 22.
4. **Duplicate activities differing only in case** on Places ("Hiking",
   "hiking") — Passport now de-duplicates, but the source holds both.
5. **`/places` and `/places/:id/detail` are slow** — a place page waited
   13–14 s for Atlas on every visit before this change.

## The conflict this raises (owner decision)

The brief asks for **relevant** recommendations and "no events from the wrong
place". The doctrine says **"Silence still removes nothing"** (§9, ADR 016):
a thing Atlas has not placed must not be removed for being unplaced. This
change only reorders, so national events still appear at the end of
Vernon's event shelves when there are fewer than eight local ones. Holding
unplaced events out of the time-led shelves on a page with a known area
would end that, at the cost of the 22 unplaced local events above until Atlas
places them. That is a doctrine change and is left to the owner.
