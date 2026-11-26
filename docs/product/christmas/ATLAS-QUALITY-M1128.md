# Christmas recommendation data quality — M1128 (2026-11-25)

A customer reviewed the live site (Vernon area, 2026-11-25) and reported seven
problems. For each one, this audit found the records behind it, traced which
Passport code puts it in front of a visitor, and said whose fix it is.
Atlas-side asks are in
[`proposals/m1128-atlas-handoffs.json`](proposals/m1128-atlas-handoffs.json).

**How it was measured.** The 2026-11-25 production `/discovery/candidates`
body (`~/scratch/m1126/out.json`, 7,039 candidates) was served by the local
stand-in on `:3133`, which adds distance readings. Christmas's own code
(`candidateToExperience` → `findsIn` → `answer` / `around` / `strongest`
/ `ways.strongest` / `planItinerary`) was run over it, at today's date, for
Vernon, Silver Star and Lake Country. The scripts are in
`~/scratch/m1128/atlas/` (`run.ts`, `run2.ts`, `plan.ts`, `lights.ts`). Every
image named below was downloaded and looked at. Ids are Atlas ids (first 8
characters here; the full ids are in the JSON).

**What this could not see.** Production may place a few listings
differently from the extract (see IMAGES-M1126). Community lights-map pins and
their photos live in the production insiders store. Reading that store would
mean calling production, so it was not read.

## Summary

| #   | Observation                      | Verdict                                                                                                                                                                                                             | Owner                                      |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | Identical Silver Star listings   | Mostly **real duplicates**: Light Up ×2, New Year's Eve ×2, the resort ×5. Other Silver Star records are different things and stay separate. Passport also repeats a duplicate across shelves.                      | Atlas (merge, locality); Passport (dedupe) |
| 2   | Two "RANGE Restaurant"           | **Real duplicates**: 3 records for one restaurant at Predator Ridge (Pallino's ×2 is the same problem)                                                                                                              | Atlas (merge); Passport (planner dedupe)   |
| 3   | Important events without photos  | **True gap**. Passport shows them correctly as text cards. One of them (Silver Star New Year's Eve) has a photo on its duplicate.                                                                                   | Atlas                                      |
| 4   | Unconfirmed mixed with confirmed | **Passport ranking/shelving**, plus a stale Passport seed pin, plus missing Atlas dates                                                                                                                             | Passport (main); Atlas (dates)             |
| 5   | Summer patio photo for a date    | **Confirmed**: RANGE's picture is a summer patio photo that Atlas itself marks "not verified to show" RANGE. The planner shows it.                                                                                  | Passport (planner picture rule); Atlas     |
| 6   | Driveway photo on a lights stop  | **Not in Atlas** (no pictured lights find within 60 km of Vernon shows a home). Most likely a community pin photo of a home display, which the planner and tour use as the lead picture. Not checked in production. | Passport                                   |
| 7   | Generic lights recommendations   | **Confirmed**: 3 winery wine tastings are named "Holiday Light-Up" and share one stock tree photo marked `exact`. Vernon has no Atlas lights display you can visit, only two one-night ceremonies.                  | Atlas (classify, images); Passport (rules) |

---

## 1. Silver Star listings

**Evidence**

| Group            | Records                                                                                                                                                                                                                                                                                                                                  | Verdict                                                                                                                                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Annual Light Up  | `d1cfd91a` "SilverStar Annual Light Up" (venue "SilverStar Village", locality **Vernon**, no point, distance `town` **0 km** from Vernon, hero **404**) · `4ba336eb` "Silver Star Annual Light Up" (venue Silver Star Mountain Resort `d3116035`, geography `conflicting`, unplaced, real crowd photo from silverstarstays.com)          | Same night (Dec 5, 2026). **Duplicate.**                                                                                                                                                                                      |
| New Year's Eve   | `6e8ac250` "New Years Eve" (SilverStar Village, locality Vernon, 0 km, **no photo**) · `35f0e55e` "Silver Star New Years Eve Celebration" (resort venue, `conflicting`, photo)                                                                                                                                                           | Same night, same snow-globe NYE. **Duplicate.**                                                                                                                                                                               |
| The resort       | Places `d3116035` "Silver Star Mountain Resort" and `714b0061` "Silver Star Resort" (about 1 km apart). Organizations `231c7ff6` "Silver Star Mountain Resort", `3ed75c47` "SilverStar Mountain Resort" (subtype **bike resort**, carries the winter affordances, placed at Vernon's town centre) and `77aa8cc5` "SilverStar Ski Resort" | One resort. **Duplicate.** Atlas's normal pattern is one Place and one Organization; these are 2 Places and 3 Organizations. `251f42b7` "Silver Star Mountain Resorts Ltd." is the company that runs it: keep it and link it. |
| Brewery          | `9eab8cb1` "Silverstar Brewing Co." · `d1008cb9` "SilverStar Brewing Company"                                                                                                                                                                                                                                                            | **Duplicate** (not a Christmas find).                                                                                                                                                                                         |
| Different things | Provincial Park `d9e50732`, Foothills `65c5da2d`, Elementary `4e575e43`, Motel `5ae27313`, B&B `54379a84`, Spirit Lodge `aadb17c3`; the resort's events (Gingerbread Dec 19 `00280a64` and Dec 26 `40feccbf`, Santa Ski Day `0f379143`, 12 Days `bcd6b5b3`…)                                                                             | **Different things.** Do not merge.                                                                                                                                                                                           |

**How a visitor sees them**

- On `/christmas/discover?at=vernon`, `answer()` puts `d1cfd91a`, `6e8ac250`
  and `3ed75c47` on the "Closest to you" shelf at **0 km**. Atlas measures
  them from Vernon's town centre; the village is about 18 km away.
- Opening "location not confirmed" (`place=all`) adds `4ba336eb` and
  `35f0e55e` on the `unplaced` shelf. **`oneEach` only runs within one
  shelf** (`answer` → `shelf()`), so the Light Up shows twice on the same
  page.
- `oneEach` would not fold the two New Year's Eve records even on one shelf:
  `titleKey` gives `newyearseve` and `silverstarnewyearsevecelebration`,
  which do not match.
- With `at=silverstar`, the Light Up is "18 km" away: Atlas measured it from
  Vernon again.
- The Light Up leads Vernon's front-page four
  (`around.ts strongest`, `inTown` is true at 0 km).

**Passport rule changes**

1. `discover.ts answer()`: fold twins **across shelves**. Before shelving,
   drop any `unknown` (unplaced) find that has the same `titleKey` as a find
   already on `near`, `town`, `maybe` or `drive`, and add 1 to that card's
   `others` count. A missing place is no evidence that two listings are
   apart. Also run `borrowPicture`, so the placed card can use the unplaced
   twin's working photo.
2. `discover.ts oneEach()`: add an event twin rule. Two Events are one when
   all of these hold:
   - they start on the same local day;
   - one `titleKey` contains the other (`newyearseve` ⊂
     `silverstarnewyearsevecelebration`);
   - they are within `SAME_PLACE_KM`, or one of them is unplaced.

   This is a HYPOTHESIS. Check it with a test against the eval corpus for
   false folds, for example two different "Christmas Market" events on the
   same day in different towns. Those must stay apart: both placed, more
   than 10 km apart.

3. Do **not** move the Silver Star records in Passport. ADR 094 makes Atlas's
   reading the only source of place. The handoff covers it.

**Atlas handoffs:** `m1128-silverstar-event-twins`, `m1128-silverstar-resort-merge`,
`m1128-silverstar-village-locality`, `m1128-silverstar-brewery-twins`.

## 2. Two "RANGE Restaurant" listings

**Evidence.** There are three records:

- `2c1ec539` "RANGE Restaurant, bar + patio";
- `531fc394` "RANGE Restaurant";
- `3ef023a6` "Range Lounge & Grill" (the description says "near Predator Ridge").

The first two sit on exactly the same point (−119.3876076, 50.1891336). That
is also the point of Predator Ridge Resort's Organization `0139448c`, so the
point probably came from the resort. The third is 15 m away. All three are
one restaurant at Predator Ridge, 301 Village Centre Pl: **real duplicates**
(Atlas should confirm whether "Range Lounge & Grill" is the old name).
Pallino's is the same pattern: `b67aab15` "Pallino's Italian Bistro" and
`0d78b45f` "Pallino's", 270 m apart.

**How a visitor sees them.** The planner. `planItinerary` →
`candidatesFor("dinner")` picks every Atlas record whose words match the
dinner activity. Nothing removes duplicates, and the `alternatives` list is
`ranked.slice(0, 4)`. Reproduced from Lake Country
("A romantic Christmas evening — dinner and the lights", Nov 27 and Dec 5):
the alternatives are Chaos Bistro, **Pallino's Italian Bistro, Pallino's,
RANGE Restaurant, bar + patio**. `531fc394` is the next one down. From
Vernon on those days, Eatology wins and RANGE ranks below the four shown;
on days when Vernon restaurants are closed by their own hours it moves up.
RANGE is not a Christmas find, so it never shows on the Discover or way
pages.

**Passport rule change.** In `itinerary.ts`, before ranking alternatives
(inside `planItinerary`, where `ranked` is built, or at the end of
`candidatesFor`), fold candidates that are the same place: points within
0.5 km **and** one `titleKey` is a prefix of the other
(`rangerestaurant` / `rangerestaurantbarpatio`, `pallinos` /
`pallinositalianbistro`). Keep the better-evidenced one. Export `titleKey`
from `discover.ts` rather than writing a second copy. Different names on one
point stay separate (Predator Ridge Resort and RANGE share a point and are
different things).

**Atlas handoff:** `m1128-predator-ridge-restaurant-twins`.

## 3. Important Christmas events without a photograph

Passport is right to show these as text cards. It never uses a venue or stock
photo instead (doctrine §12; launch QA finding 32). The fix is Atlas getting
a photo of the event itself. Researched candidates for several of these are
already in `proposals/m1126-image-candidates.json`. That includes Frostival's
real Tourism Vernon photo, which Atlas has not attached yet.

**The 10 most important events without a photo within 30 km of Vernon, Nov 25 – Jan 3** (ranked by community draw and how much they are Christmas):

| #   | Atlas id   | Date (local)     | Event                                                                 | Venue (Atlas)                    | Note                                              |
| --- | ---------- | ---------------- | --------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------- |
| 1   | `1c99bcd7` | Nov 27           | Frostival 2026 Downtown Vernon                                        | Downtown Vernon (no point)       | Photo researched in M1126, not attached           |
| 2   | `0d2e52bb` | Nov 29           | Coldstream Community Christmas Light-Up                               | 9904 Kalamalka Rd, Coldstream    |                                                   |
| 3   | `6e8ac250` | Dec 31           | New Years Eve (SilverStar Village)                                    | SilverStar Village (no point)    | **Twin `35f0e55e` has a photo**: merging fixes it |
| 4   | `80db9cc6` | Dec 5 – 19 (Sat) | Downtown Vernon Christmas Saturdays                                   | Downtown Vernon (no point)       |                                                   |
| 5   | `087d19a8` | Dec 18           | Stars on Ice – 2026 Holiday Tour                                      | Kal Tire Place                   | Only a venue photo, withheld                      |
| 6   | `feda1667` | Dec 5 – 6        | Christmas Market at Swan Lake Market                                  | 7920 Highland Rd                 | Photo researched in M1126                         |
| 7   | `7ffb145c` | Nov 19 – 29      | A 1940s Radio Christmas Carol                                         | 2901 35 Ave (Powerhouse Theatre) | Poster researched in M1126                        |
| 8   | `d71b16fe` | Nov 28           | The Celtic Tenors: A Celtic Christmas                                 | 3800 33 St (VPAC)                | Poster researched in M1126                        |
| 9   | `dc4d9825` | Dec 19           | A Coast to Coast Cowboy Christmas 2 – George Canyon & Aaron Pritchett | 3800 33 St (VPAC)                | Poster researched in M1126                        |
| 10  | `859dca51` | Nov 28           | A Little Christmas Magic (Armstrong downtown light-up)                | Spirit Square, Armstrong         | 21 km                                             |

Next in line: `28cae397` Artsolutely Holiday Artisan Market (Nov 28 – Dec 24),
`17f6cc23` Sleigh All Day, `5fc1735b` A Golden Celebration, `be7d6201`
Hometown Christmas with the Armstrong Melodia Singers, `daac75c0` Métis
Crafters, `60a6e596` NYE Double Bill, `22dadaa4` Shoparama, `7d407439`
Unwrapped 26'. Also missing from Atlas altogether: Caravan Farm Theatre's
2026 winter sleigh-ride show ("The Hockey Sweater"). Passport's lights map
has it only as a seed pin.

**Passport rule change:** none of its own. Fix 1.1 (fold across shelves, then
`borrowPicture`) gives `6e8ac250` its twin's photo once both are on one card.

**Atlas handoff:** `m1128-vernon-event-pictures`, `m1128-caravan-winter-show-event`.

## 4. Unconfirmed seasonal activities next to confirmed experiences

**Evidence (Vernon, no dates asked)**

- The "Closest to you" shelf (`answer()` → `near`) ends with seven
  `unconfirmed` winter places, sorted after the 33 dated events on the same
  shelf: Caravan Farm Theatre `f54d6acc`, Centennial Outdoor Rink
  `575e8e59`, Kal Tire Place `3504202a`, Brewer's Pond `50d828b9`, Priest
  Valley Arena `1526821e`, SilverStar Mountain Resort `3ed75c47` (the
  "bike resort" record) and Winfield Arena `a8f012f0`.
- On the front page, the **Santa & family** row (`around()` → `inThemes`)
  shows Caravan Farm Theatre `f54d6acc` (undated) next to the dated
  Christmas Sleigh Rides `d0ff9df1` (Ottercrest Farm). Caravan is counted as
  `christmas` only because its affordance "Winter Sleigh Ride Show" matches
  the shows theme.
- `ways.ts strongest()` lets `unconfirmed` finds through whenever
  `reading.christmas` is true.
- **A stale Passport seed.** The lights-map seed pin "Coldstream Community
  Christmas Light Up" (`lights/seed.ts`, `season: 2025`) shows _Not yet
  confirmed this year_. Atlas `0d2e52bb` has it dated **Nov 29, 2026**. One
  site says the same light-up is both confirmed and unconfirmed.

**Passport rule changes**

1. `discover.ts answer()`: move `when.confidence === "unconfirmed"` finds off
   `near` onto their own shelf, shown after the dated ones (for example id
   `anytime`, "Any winter day — no dates listed, check first"). The shelf
   order already says "confirmed first"; this makes the boundary visible.
   Places stay in the results, so §2.4 still holds.
2. `around.ts around()`: `inThemes` (the Santa and Festive rows) should
   require `dated` or `check`. Unconfirmed places can go in the new shelf
   from fix 1, not in the front-page rows.
3. `ways.ts strongest()`: drop the `reading.christmas ||` branch, so a way's
   few finds are only `dated` or `check`.
4. `lights/seed.ts`: confirm the Coldstream pin for 2026. The source is Atlas
   `0d2e52bb` (coldstream.ca). When a seed pin and an Atlas event are the
   same thing, the dated Atlas reading should win on the map. Check the
   Armstrong ("A Little Christmas Magic", Atlas `859dca51`) and Silver Star
   Light Up pins the same way.

**Atlas handoffs:** `m1128-caravan-winter-show-event`,
`m1128-outdoor-rink-season` (season and opening for outdoor rinks and the
resort), `m1128-silverstar-resort-merge`.

## 5. Summer patio photograph for a Christmas date

**Evidence.** `2c1ec539` "RANGE Restaurant, bar + patio" and `531fc394`
"RANGE Restaurant" both carry this picture:

- URL: `https://www.predatorridge.com/wp-content/uploads/FMA_Dining-on-Patio-1928x1078-1.jpg`
- `relationship: "organization"`, `confidence: "medium"`
- attribution: _"representative, not verified to show RANGE Restaurant, bar + patio"_

**Viewed:** a couple eating dessert with rosé at an outdoor patio table at
dusk. They are in short sleeves, with green summer golf-course hills behind.
It is a resort dining-patio marketing photo, not a winter or Christmas scene,
and Atlas itself does not claim it shows RANGE.

There are 121 pictures of this kind in the pool (organization or venue,
medium confidence, "not verified"). The Roster Sports Club's ("racquetball
courts / daily specials" slider) shows on Vernon's drinks stop the same way.
A related case is `575e8e59` Centennial Outdoor Rink. Its picture is marked
`exact` / `high`, but it is vernon.ca's **spring banner** for Kal Park
(`banner/hb-spring-kal-park`: yellow balsamroot flowers, a hiker carrying a
child). The planner offers it as the "skating" stop's photo, while its twin
`235ca44a` holds the rink's real photo.

**How a visitor sees it.** `itinerary.ts realPictures()` only filters
_illustrative_ pictures (representative or category). Organization and venue
pictures stay, labelled "From the organizer". `atlasPlace` puts them on
dinner and drinks stops and in their `alternatives`/`nearby` lists. The
Christmas cards elsewhere use `christmasPictures` (unlabelled only), so this
affects the planner only.

**Passport rule change.** `itinerary.ts realPictures()`: also drop a
`presentationImage` whose relationship is not `exact` and whose `confidence`
is not `high`. That is exactly the set Atlas calls "not verified to show".
The stricter option is to use `christmasPictures` (unlabelled only) for Atlas
places, as the cards do. That would also remove the organiser photos Atlas
does vouch for (high confidence). Owner's call; the medium-confidence cut is
the minimum. `score()` then stops giving those places +2 for evidence.

**Atlas handoffs:** `m1128-unverified-organization-images`,
`m1128-page-banner-as-exact`, `m1128-image-season-metadata`.

## 6. A residential driveway photo as a lights stop's main image

**Evidence.**

- All 12 lights-theme Christmas finds within 60 km of Vernon were listed, and
  their pictures were downloaded and viewed. None shows a home or driveway:
  - Silver Star Light Up: a village crowd with fire spinners;
  - Kelowna tree: a couple under the Stuart Park tree;
  - Bee Merry & Bright: a lit star with bokeh;
  - Winter Wonder Lights: a fox in a Santa hat;
  - Lantern Light Up `feb9c153`: a paper lantern with a deer cut-out
    (a workshop's example piece).
- The researched seed pins carry no photos.
- The only other source of a lights photo in Christmas is a **community pin
  photo** (`/christmas/api/lights/{id}/photo`). The planner uses it:
  - `itinerary.ts pinPlace()` makes it the stop's only picture, alt text the
    pin's name, no label;
  - `PIN_KINDS.lights` includes `"home"`;
  - `score()` gives +2 for a picture, so a pictured home outranks an
    unpictured public display.
- The tour does the same: `TourGo.tsx` puts the photo full width at the top
  of each stop.
- A pin of kind `home` is by definition residential (`model.ts`), and its
  photo is a family's house and drive.

This is UNVERIFIED in production, because the pin store was not read.

**Owner: Passport** (community content, Passport's own store).

**Passport rule changes**

1. `itinerary.ts pinPlace()`: for `p.kind === "home"` (or `residential`),
   label the photo "Photo by a local · private home". Do not let it lead a
   **romantic / couple** plan's lights stop.
2. `itinerary.ts score()`: do not count a home pin's photo as evidence.
   When `request.romantic` or `party === "couple"`, rank `public-display`,
   `neighbourhood` and `community-tree` ahead of `home`.
3. `TourGo.tsx`: the same label for a home's photo.
4. Reviewers (`/christmas/lights/review`): add a "photo shows the display,
   not just the house" check before a home's photo is published. This
   changes moderation, so it needs an owner decision.

Atlas handoff: none.

## 7. Generic, poorly differentiated Christmas lights

**Evidence.**

| Record                                                                                                   | What it really is                                                                 | Picture (viewed)                                             |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `a392c1ac` Holiday Light-Up "On Till It's Gone" (Black Swift Vineyards, West Kelowna, Nov 28)            | Library wine tastings and a food-bank drive                                       | none                                                         |
| `b14f871a` Holiday Light-Up "Turn It On" (3225 Boucherie Rd, Nov 28)                                     | Black Friday wine offers, mulled wine                                             | **Same photo**: the Downtown Kelowna Christmas tree, `exact` |
| `508caaa2` Holiday Light-Up "Pin the Dingle on the Kringle" (Crown & Thieves, Nov 28)                    | Tastings, cocktails, games                                                        | Same tree photo, `exact`                                     |
| `52a90790` 2026 Christmas Lighting Ceremony (2306 Hayman Rd, West Kelowna, Dec 5)                        | A business's light-up with charcuterie                                            | Same tree photo, `exact`                                     |
| `4c415f0e` Downtown Kelowna Winter Street Market & Light Up · `312c8668` Winter Street Market & Light Up | The same Stuart Park event, Nov 28. **Duplicate.** The tree photo is honest here. | tree (4c415f0e only)                                         |
| `dc9597a9` Bee Merry & Bright Holiday Light Up (June Springs Rd, Kelowna, Dec 4–20)                      | Unclear: Atlas's description is just "$8e"                                        | Generic star-bokeh image, `exact`                            |
| `8a9bf50f` Winter Wonder Lights (Kelowna museum, Nov 28)                                                 | A flashlight hunt in a museum: real, but not a lights display                     | A fox in a Santa hat                                         |

All three tree uploads have byte-identical content (md5 `c240861c…`), stored
under different Simpleview upload ids
(`Couple-in-front-of-Christmas-Tree-Downtown-1-1-_<id>`). So Atlas sees three
different "exact" pictures of three different wineries.

Near Vernon itself, Atlas holds **no lights display you can visit**, only two
one-night ceremonies: the Silver Star Light Up `d1cfd91a` and the Coldstream
Light-Up `0d2e52bb`. Vernon's lights row and the Christmas Lights way rest on
those two, community pins, and one Vernon seed public display (Carnival of
Lights, last dated 2022). From Lake Country and Kelowna, the planner's lights
stop and the "Holiday lights" theme are filled by the winery "light-ups".

**How a visitor sees it.** `readChristmas` gives the lights theme from the
name ("Holiday Light-Up"), and the title is `called` lights. `NOT_A_DISPLAY`
does not match. The planner's `candidatesFor("lights")` accepts them because
`LIGHTS_NAME` matches. `christmasPictures` passes the shared tree photo,
because Atlas says `exact`.

**Passport rule changes**

1. `pictures.ts`: add a shared-picture rule, alongside the existing
   `withoutRepeatedIllustrations`. A picture whose normalised name (Simpleview
   upload id removed: `/_[0-9A-F-]{20,}_[0-9a-f-]+(?=\.\w+$)/`) appears on
   finds at **different venues** cannot show each of them, so treat it as a
   stand-in and drop it from `christmasPictures`. Same venue or twins stay
   (`oneEach`'s rule). This needs the pool, so apply it where finds are
   gathered: `findsIn`, or in `answer` before shelving.
2. `themes.ts readChristmas`: the lights theme should not come from
   "light-up" in the name alone when Atlas's description is about a tasting.
   One option: add `tasting|wine|winery|vineyard|cocktails?` to the planner's
   display test (`itinerary.ts candidatesFor`, next to `NOT_A_DISPLAY`) and
   leave the theme reading alone. That keeps them as festive finds but off
   "Christmas lights tour" stops. HYPOTHESIS: measure with `themes.eval`.
3. `around.ts` / the Lights way: when the lights row holds only one-night
   ceremonies, say so ("light-up nights") instead of calling the row
   "Christmas lights near Vernon". A copy change; owner's call.

**Atlas handoffs:** `m1128-westside-winery-lightups`,
`m1128-kelowna-market-lightup-twins`, `m1128-shared-upload-not-exact`,
`m1128-vernon-lights-displays`.

## Open questions (not resolved here)

- Should a labelled organiser photo with high confidence still appear on the
  planner? (§5: the medium-confidence cut is the minimum.)
- Should a community home's photo be shown at all on a plan, or only on its
  own pin page? (§6.)
- The event twin rule in `oneEach` (§1.2) needs an eval before it ships.
