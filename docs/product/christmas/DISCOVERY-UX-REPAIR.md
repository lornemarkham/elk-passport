# Christmas discovery UX repair (2026-11-22)

Owner brief: _P0 — Christmas discovery UX repair_ (owner approval granted,
after live desktop testing). Doctrine read first (§2.1, §4, §7, §8, §10, §12,
§15). The decisions are recorded in the doctrine, §10 "How a person finds
them", paragraph dated 2026-11-22. No question in §15 is resolved here.

`/christmas/discover` is now **WHERE | WHEN | HOW FAR** and the results.

## What the owner saw, and why (root causes)

Measured on production (`gohaveaday.com`, 2026-11-22, Vernon, 30 km) before
the change:

| Owner observation                                                     | Root cause                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "What's happening tonight?" opened Discover with November 21 stuck    | The link wrote today's date as `from`/`to`. Nothing on the page said "tonight", the date sat inside a closed Refine form, and every category chip carried it on silently.                                                                                                                                                                       |
| Tonight listed things not on tonight                                  | `fitsDates` let every listing without a stated date range through ("unknown is not closed"). Tonight on production: 16 "within 30 km" — Centennial Outdoor Rink (twice), SilverStar, Kal Tire Place, Caravan Farm Theatre (three times), a performing arts academy — none with a date tonight.                                                  |
| Several category chips selected at once; results changed unexpectedly | Chips **toggled**: each tap added a theme to the list instead of choosing it.                                                                                                                                                                                                                                                                   |
| A performing arts academy under Holiday lights                        | A theme counted wherever its word appeared in the listing's text. The academy's organiser lists a class called "Twinkle Stars", and the lights words include `twinkl…`. The same rule filed a garage sale ("plenty of Christmas lights … to be sold"), three hockey games ("light up the arena") and a neurological association under lights.   |
| Vancouver Christmas Market under "unconfirmed locations" in Vernon    | Atlas holds no place for that listing (`geography.state: unknown`). Every unplaced listing anywhere — Vancouver, Delta, Québec, Ottawa, Alberta — went on a "Location not confirmed" shelf on a Vernon page, **and was counted in the headline**: "167 things within 30 km of Vernon" was 27 placed within 30 km plus 140 with no place at all. |
| Duplicate listings                                                    | Atlas keeps a venue and its organisation as separate records (Kal Tire Place, Centennial Outdoor Rink, Caravan Farm Theatre) and a nightly event once per night (Winter Wonderland Self-Guided Tours, 8 records). Discover printed each one.                                                                                                    |
| A giant questionnaire                                                 | Refine asked where, how far, dates, who, how many, ages, budget, time and interests in one form, in front of the results.                                                                                                                                                                                                                       |

## What it does now

- **Three controls.** _Where_ is the shared place bar (ADR 020): a city, a
  neighbourhood or a landmark from Passport's place list, _Use my location_
  (one tap, never asked unprompted, turned into the nearest town), home, or
  **Explore another destination**, which makes the place the search origin
  for Christmas only and leaves home alone. _When_ is Tonight · Tomorrow ·
  This weekend · Any date · Choose dates. _How far_ is 2 · 5 · 10 · 20 · 30
  · 50 km, thirty by default, remembered on the browser for a year (`xm-km`
  cookie, a number only). An old link's 15/60/100 km opens on the nearest
  choice.
- **No questionnaire.** Who and how many are gone from Discover (Plan My
  Route asks them). Children's ages, stated-free, time available, combining
  categories and showing unplaced listings are under a closed **More
  filters**.
- **One category at a time.** A chip _chooses_; _All_ clears. Combining is
  an explicit tick-box choice under More filters. The URL, the chips, the
  "Showing" line and the count always agree.
- **A category is what a thing is called, not what it mentions**
  (`themes.ts`, `called`). Evidence from the name, Atlas's listed type or a
  listed activity counts; a word in a description or the organiser's facts
  counts only where the title or type is called that too. A lights display is
  never a sale, a class or a fundraiser (the planner's own rule, now shared).
  Measured on today's corpus: 27 lights members came only from descriptions —
  hockey games, a garage sale, a winery — and are no longer lights.
- **The date is always visible**: in the WHEN control, and once anything
  narrows the results, in a _Showing_ line with a one-tap ✕ and a _Reset_.
  With a category and a date both on, the page says the date stays on.
- **Tonight means tonight** (`availableFor`). A dated search offers as its
  answer only what is confirmed for those days: the listing's own dates
  confirmed and covering them, or Atlas's reading of its hours or season
  saying "on" for the day asked. A window that covers the days without
  saying which, or no dates at all, is _might be on_ — on its own closed
  shelf for other days, and **left out entirely for tonight**. An event whose
  stated end time has passed (Vancouver time) is left out as finished. The
  page counts each reason.
- **Tonight also shows** lights from the community map confirmed lit this
  season and on that day, and **dinner** — restaurants whose own published
  hours have them open after 8 pm that day. **Movies are not shown**: cinemas
  publish no showtimes to Atlas, and the page says so.
- **Results**: _Closest to you_ (within the radius, ordered: confirmed for the
  days → how plainly it is the category → distance → a real photo of it →
  how sure Atlas is of its place); _Popular nearby_ (lights families rated on
  the map, at least three ratings — the only popularity evidence Passport
  has; nothing else is called popular); _Worth the drive_ (up to six named
  Christmas markets, lights, festivals or shows with this season's dates
  confirmed, beyond the radius and within 100 km or twice it, labelled with
  both distances).
- **Nothing is near without evidence.** A listing with no confirmed place is
  not shown by default; the page says how many and offers _Show them
  separately_. A distance Atlas measured only to a town centre is not counted
  inside a radius under 10 km (Vancouver is 10 km across); it goes on an
  _Exact spot not listed_ shelf.
- **One card per thing** (`oneEach`): the same name within 10 km, in the same
  stated town, or both unplaced, is one card that says how many listings it
  stands for.

## Acceptance tests

`e2e/christmas-discover.spec.ts` (A–H), `src/domain/christmas/discover-repair.test.ts`
(the rules, with the owner's own examples). Results in the mission report.

## Decisions taken here (product judgements, said as such)

1. **10 km** is the radius below which a town-centre distance doesn't count
   as near. Vancouver's extent, not a measurement of every town.
2. **Worth the drive** = named Christmas markets, lights, festivals or shows,
   dates confirmed, not a party, class, sale, fundraiser, story time or photo
   session; up to six, nearest first, within max(100 km, 2× radius).
3. **Evening** = open after 8 pm by its own hours.
4. **Thirty** stays the default distance (the owner's 2026-11-21 choice is
   one of the new six).

## Known limitations

- **No driving time.** Atlas's routing (`/travel/legs`) answers the legs of
  one plan, at most 12 per request, rate limited; there is no route from one
  origin to every listing. The control offers kilometres only and every
  distance says straight-line.
- **Address and map-point search are not offered.** _Where_ searches
  Passport's place list (cities, Vancouver neighbourhoods, landmark aliases
  such as BC Place and the Parq). Free-text geocoding needs a provider
  decision (the lights map's Nominatim address search is still a proposal).
- **Tonight is thin where Atlas is thin.** On today's corpus with a local
  stand-in, Vernon tonight is 2 confirmed events (64 more are on "maybe"
  readings). Production Atlas also answers per-day hours readings
  (`schedule.onDate`), which the local stand-in does not, so production may
  show more. Atlas holds no cinema showtimes, and no hours for most events.
- **Atlas data gaps** surfaced, not fixed here: 110+ Christmas listings with
  no place at all (many outside BC), duplicate venue/organisation records,
  one record per night for nightly events, event dates stored at UTC
  midnight. These belong to Atlas.
- The planner shares `readChristmas`, so its theme-based stops (markets,
  shows) are stricter too.

## Outside my lane

- `src/domain/discovery/towns.ts` — **Port Moody** added (Wikidata Q776261,
  P625 49.2831, −122.832), needed for TEST E. One entry, same shape as its
  neighbours.
