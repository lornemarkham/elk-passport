# Christmas Lights Map 2.0 — map-first, rated, toured

**Owner brief:** "P0 — Christmas Lights Map 2.0" (2026-11-14). **Lane:**
christmas. It improves [Pin the Magic](PIN-THE-MAGIC.md); read that first.
Nothing was rebuilt. The store, privacy rules, review queue, reactions,
bingo, saved tours and planner link all carry on as before.

```
/christmas/lights            the map is the page: place chips, 🎄 ⭐ ❤️ ✨ markers, compact card,
                             Build My Lights Tour + Add; below it: your lights, Light up Vernon,
                             the community's best, every display, markets/shows/Santa
/christmas/lights/tour       three questions → route, Start Tour → one stop at a time
/christmas/lights/pin        three steps → Add to Christmas Map → optional details
/christmas/lights/[id]       + stars, "How magical was it?", your yearly question, details
/christmas/api/lights/[id]   + actions `rate`, `details`
/christmas/api/lights/find-address   address search for step 1 (OpenStreetMap Nominatim)
```

## What changed, against the brief

| Brief                    | Built                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Map-first             | Map is 68 svh on a phone, with the place chips laid over its top and the buttons over its bottom. Light displays only (`LIGHT_KINDS`). Markets and festive attractions are listed under "Markets, shows & Santa". Markers: 🎄 confirmed, ⭐ community favourite, ❤️ saved, dim = not on tonight. Markers within 40 px merge into a ✨ cluster (`cluster.ts`), and tapping one zooms in. Tapping a marker opens a compact card (≤ 45% of the map): photo, name, neighbourhood, stars, season/dates, hours, Add to Tour, Directions, ❤️. |
| 2. Build My Lights Tour  | How long (30 min, 1 h, 2 h, all evening = 4 h). Where (Best nearby, Vernon, Coldstream, East Hill, Lumby, Armstrong, Kelowna, Custom area = a 3 km circle round a tap). What kind (best rated, most displays, family favourites, hidden gems; `tour.ts` styles). Shows the route, stops, km, total time, ratings and viewing time per stop. Fits the time budget. When fewer than two displays are lit, it says so, counts the unconfirmed ones, lists the nearest confirmed ones outside the area and offers the first lit night.     |
| 3. Three-step submission | Location (my location, move the pin, search an address), photo (take or upload; name optional, with a plain default), and whose (mine, or spotted). Optional details afterwards: music, walk-through, family-friendly, hours, special features (`addDetails`).                                                                                                                                                                                                                                                                         |
| 4. Ratings               | "How magical was it?" 1–5 stars and optional tags. One per account per display per season (rating again replaces it); signed in; not your own; published only. Ranked by Bayesian average (`rank.ts`). Lists: Best in Vernon, Best in Coldstream, East Hill favourites, Worth the drive to Lumby, Hidden gems. Lists show rated displays only, and the page says so while there are none.                                                                                                                                              |
| 5. Tour navigation       | STOP n OF m, photo, name, travel and viewing time. Navigate (Google Maps to that stop), Rate Display, Next Stop. Also Skip stop, Save favourite, Change route, End tour. No in-house driving navigation.                                                                                                                                                                                                                                                                                                                               |
| 6. Light up Vernon       | Confirmed this season, community favourites, number rated, lit count by neighbourhood, Share your display. Published pins only (`lightUp`). Owners share a published display from "Your lights".                                                                                                                                                                                                                                                                                                                                       |
| 7. Yearly confirmation   | Unchanged rule: a display not confirmed this season is never active. "Your lights" and the display page ask its pinner "Are your lights on again this Christmas?": one tap for _Yes_ or _Not this year_. A homeowner's own _Not this year_ counts at once; everyone else still needs two families or a reviewer. Ratings from every season are kept.                                                                                                                                                                                   |
| 8. Passport integration  | Same store, same adventure save. New "Make it an evening" link opens `/christmas/itinerary` with `pick=lights:map:<first stop>`, the planner's own interface.                                                                                                                                                                                                                                                                                                                                                                          |

## Privacy

- **These are my lights** sends `consentClaim: i-live-here`. It is still
  private and still reviewed. The reviewer records the owner's consent, as
  before. A homeowner is _not_ published on their own word. That safeguard
  was kept on purpose: anyone can claim a house.
- **I spotted someone else's lights** is a home with no claim, so it is a
  private suggestion. The review queue labels it "A neighbour's suggestion —
  the homeowner hasn't said yes. Publish only once they have." `approve()`
  still refuses a home without recorded consent.
- A spotter who ticks "It's not a home — a park, shop or town display"
  sends a public display. It is reviewed and then shown.
- Ratings, counts and lists are computed only from what a visitor may see.
  A private pin can't be rated (published only) and can't be counted.

## Researched pins added (read 2026-11-14)

- **Coldstream Community Christmas Light Up**: coldstream.ca, Dec 7 2025. It
  is placed at the church at 9904 Kalamalka Rd (OSM node 1387836373, identified
  by the neighbouring addresses). Last confirmed 2025, so it is drawn dim and
  kept off tours.
- **Carnival of Lights, Spirit Square**: Vernon Winter Carnival Society. The
  latest dated source is 2022 (infotel). It is placed at City Hall beside the
  square. Not confirmed, so it is drawn dim.
- **Not added:** Lumby Light-Up (Dec 5 2026). The only source is an
  aggregator that names no venue. Also not added: Predator Ridge, the NONA
  centre, Enderby and Lake Country, because there was no reliable point or
  date. The NONA tour is of private homes and is never seeded.
- The quotes were relayed through a page reader. Re-read both pages before
  the season.
- The Vernon neighbourhood centres (East Hill, Downtown, Mission Hill,
  Harwood, Middleton, Foothills, Okanagan Landing) and Lavington are OSM
  `place` nodes. The towns reuse October's Wikidata centres. A neighbourhood
  is a rough circle, used for labels and choosing. It is never stored on a
  pin.

## Proposed decision (owner)

**Address search uses OpenStreetMap Nominatim** through
`/christmas/api/lights/find-address`. It is server-side, bounded to the map's
area, limited to one call a second for the server plus per-client limits,
cached for a day, and sends an identifying User-Agent. The result only moves
the person's own pin, which they then see and can drag. Nothing from it is
stored. It is a new external service, and
`domain/environment/places.ts` argues against a geocoder for weather. Here
the person confirms the point on the map, which answers that argument's
"plausible wrong place" worry. **PROPOSED, not an ADR yet.** If the owner
prefers no geocoder, delete the route and the search box; the pin and
my-location still work.

## Open questions (not resolved here)

1. **How does a homeowner approve a neighbour's suggestion?** Today the
   reviewer records consent after contacting them (or the homeowner adds
   their own lights, and the near-duplicate notice joins them up). A
   homeowner-claim link was not built. It needs a way to prove the address
   that doesn't exist yet.
2. **§15.3:** stars are a community rating about a display, like the
   reactions. They are not a taste signal and feed no personalisation.
3. **Ratings need sign-in.** That costs friction in the car, and buys one
   person, one rating. This is the owner's call if they want device-keyed
   ratings instead.

## Verification

- `npx vitest run src/domain/christmas`: 113 pass, 1 skip. The new tests are
  in `lights2.test.ts`: ratings, fair ranking, light-only map, clusters, tour
  styles and time budget, privacy of counts, the three-step privacy, details,
  yearly confirmation, areas and the new seeds.
- `e2e/christmas-lights.spec.ts` on `next start` with the memory store and
  test identity: 3 pass at 390×844 and 360×640. They cover the visitor
  journey (map → card → too-little-lit message → three questions → Start
  Tour → shared link, map to Start Tour under 60 s), a neighbour's suggestion
  (private → reviewer refused → consent → rating replaced → takedown), and a
  homeowner by address in under 60 s.
