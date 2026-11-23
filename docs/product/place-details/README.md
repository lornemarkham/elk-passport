# One place page for every place (M1041, 2026-11-23)

**Brief:** owner, _P0 — GoHaveADay shared place details overhaul_ (Lodge
mission 1041). _Atlas provides intelligence. GoHaveADay provides the
experience._ One excellent place-details page for every place; themes may
add to it but must not duplicate it. Acceptance: Alexander's Beach Pub, Long
John's Pub, The Roster Sports Club Bar & Grill.

## What changed

Three routes drew places three ways. All three now draw the same page,
`PlaceDetailsPage` (`src/components/place-detail/details/`), from one model,
`PlaceDetailsModel` (`src/domain/place-details/`).

| Route                | What it is                       | Before                                                                             | Now                                                                                                                                                                                                                 |
| -------------------- | -------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/passport/[id]`     | Atlas Organizations (businesses) | `ComposedSubjectPage`: a narrow column of label — value facts, sources as a list   | Shared page, from `placeDetailsFromComposed`. Events, Experiences, October and curated pages are unchanged.                                                                                                         |
| `/favourites/[slug]` | Local favourites (M1007)         | A hand-made card page that never read Atlas                                        | Shared page: the Atlas record plus the favourite's sourced facts (`withFavourite`). Atlas unreachable → the favourite's facts alone.                                                                                |
| `/places/[id]`       | Atlas Places (parks, lakes…)     | Small hero, then Overview, Quick Facts (raw coordinates), Map, Trusted Information | Shared frame; the Place's own Atlas sections (Should I come, Don't miss, Practical, Events, Keep exploring…) stay in the middle. Overview, Quick Facts, Map and Trusted Information are drawn by the frame instead. |

### The page

- **Hero:** the place's own photographs, large. Three or more become a lead
  and two beside it on a wide screen; every photo keeps its credit. None →
  a drawn landscape (one of four palettes, chosen by name) that says there is
  no photo yet. Never a stock picture (doctrine §12).
- **Identity:** badge (where editorial, e.g. _Local favourite · our pick_),
  kind · where, the name large, one line, good-for tags.
- **Actions:** **Add to My Day** (`/go?with=<id>`, the Day Builder door
  Discovery already uses), **Save** (the existing board save), **Directions**,
  **Call**. A missing address or phone is said on the button, not hidden.
  _Going on a particular day?_ keeps the old _Let's do this_ step (`/day/<id>`,
  same test id).
- **Two columns on a desktop:** the story (About, Food & drink, Things to do,
  Amenities, Menus, Good to know, More about it, photos, what's on, Make a day
  of it) beside a sticky visitor column (Hours, Location with map, Contact,
  Part of). One column on a phone.
- **Close by:** six places within 15 km from Discovery's own pool, pictured
  first; never a bed, never an unplaced thing.
- **Sources & accuracy:** folded. Every source and the day it was read, quotes
  where Passport keeps them, long passages read from the business's pages in
  full, and how many facts were left out for only repeating the page.

### How facts become sections

`classify.ts` moves each Atlas fact under the heading a visitor looks for,
from the publisher's own label, then heading, then (short facts only) value.
It never rewrites or merges. Phone and website go to Contact; hours to Hours.
A passage of website prose (`looksLikeProse`) shows only its opening
sentences (`summarise`, whole sentences, ≤ 260 characters) and is kept in
full under Sources & accuracy — never the main experience (brief item 12).

## Verified (2026-11-23, local, `next start` + `e2e/support/place-details-standin.mjs`)

`e2e/place-details.spec.ts` — desktop 1440×900 and phone 390×844: the three
examples, the Roster's sections and folded passages, Close by, and an Atlas
Place (Kalamalka Lake). `e2e/local-favourites.spec.ts` updated to the shared
page's controls with the same facts asserted. Screenshots in
[`screenshots/`](screenshots/). Unit: `src/domain/place-details/placeDetails.test.ts`.

**The Roster is a fixture.** Production Atlas held no record for it on
2026-11-23 (`/discovery?q=rooster` finds only Red Rooster Winery), and the
venue's real name is **The Roster** Sports Club Bar & Grill, not "Rooster".
`e2e/fixtures/place-details/roster.json` is shaped like a text-heavy website
read, from the venue's public listings, and is labelled as such.

## Data limitations (Atlas's to fix — Atlas mission 1040 was running)

- **The Roster:** no Atlas record in production; no photos with rights.
- **Long John's:** Atlas holds a one-line description and two Tourism Vernon
  sources — no location, phone, hours or photos. Passport's sourced overlay
  supplies them; hours conflict between sources and stay unconfirmed.
- **Alexander's:** Atlas holds a description only; no photo with rights,
  no website, no published hours anywhere checked.
- **Composed Organization reads carry one image**, no gallery: galleries
  appear only where Atlas's Place read or a sourced overlay supplies them.
- **Hours and menus are not structured in Atlas**: they arrive as labelled
  facts; the page sorts them by label, so an unusual label lands in _More
  about it_ rather than _Hours_.
- The `/passport/<id>?atlas=1` view of a favourite is the shared page from
  Atlas alone, without the overlay.
