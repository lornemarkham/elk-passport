# GoHaveADay Christmas — One Beautiful Experience (M1128, 2026-11-26)

Owner brief: _"Christmas Home and Discover are the SAME experience."_ Built on
`feature/christmas` on top of M1127's fire (`29afc43`). Doctrine §10,
paragraph _Christmas is one page 2026-11-26_; ADR 026 (proposed). Data
quality audit: [ATLAS-QUALITY-M1128.md](ATLAS-QUALITY-M1128.md), 15 Atlas
handoffs in [proposals/m1128-atlas-handoffs.json](proposals/m1128-atlas-handoffs.json).
Screenshots: [screenshots/m1128/](screenshots/m1128/) (`before-*` = 29afc43,
`after-*` = this work; desktop 1440×900 and iPhone 13).

## What a visitor gets now

```
/christmas            welcome (the fire, unchanged)
                      → What kind of Christmas?  six photographs, one lead
                      → Christmas around <town>  WHERE | WHEN | HOW FAR, once
                          chips: Everything 41 · Christmas markets 5 · Holiday lights 4 …
                          Not on tomorrow: Christmas markets · next Sat, Nov 28
                          Don't miss (one standout, large) · This weekend ·
                          Coming up · Make an evening of it · lights map ·
                          Seasonal favourites · A little further afield ·
                          How we chose these (on demand)
                      → Surprise me · say it, get a plan
/christmas/discover   307 → /christmas?<same query>#discover
bar                   Home · Lights Map · Advent · My Christmas  (+ Suggest, ← Go Have a Day), sticky
```

| Brief item              | What was done                                                                                                                                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 Merge Home + Discover | One page; `/christmas/discover` redirects with its query; in-lane links point at `/christmas#discover` (`discoverHref`). The old "season's best" tiles, entry tiles and pills are folded into the chips and the bar. The fire is untouched.                                                                                                |
| 2 SPA                   | Category chips filter in the browser (`Finder`, ADR 026): no server trip, URL updated in place. Place/date/distance stay server navigations, with the old answer dimmed until the new one lands. Home remembers the tab's last discovery; Back/Forward return to the same scroll position (`KeepScroll`); Next prefetches the bar's links. |
| 3 Navigation            | Home · Lights Map · Advent · My Christmas, sticky. Planning from My Christmas ("Plan a Christmas day or evening") and from the ways/finds. NYE banner and pill removed; NYE appears when the days asked touch Dec 31/Jan 1, from Boxing Day, or by name (`newYearInView`). The wordmark already went to `/`.                               |
| 4 Categories            | Six ways are photographs in an editorial grid (one lead, five beside), openly licensed from Wikimedia Commons, credited, said to be inspiration (`WayStories`, `photos/`).                                                                                                                                                                 |
| 5 Filters               | Multi-select chips, OR, `aria-pressed`, each with its count for this place/days/distance; zero-count kinds never offered as chips, said apart with their next confirmed day (a link that sets that day), or "nearest 45 km", or "nothing listed nearby yet".                                                                               |
| 6 Dead ends             | `hostFor`: the next confirmed days (grouped by day), what else is on that day nearby, the same thing a little further (≤ 60 km) — and "your date and distance stay as they are". Nothing is changed for the visitor.                                                                                                                       |
| 7 Shared state          | One WHERE/WHEN/HOW FAR control on the page; ways pages keep the place bar only. Plans carry place and distance, never the browsing date.                                                                                                                                                                                                   |
| 8 Local discovery       | A host's order (`hostOrder`): confirmed → a named Christmas outing of a big kind → soon → pictured → nearer. One spotlight, "Something wonderful this weekend", seasonal (undated) places on their own shelf, swipe rows on phones.                                                                                                        |
| 9 Data quality          | Audit + handoffs (see below). Passport rules implemented.                                                                                                                                                                                                                                                                                  |
| 10 Technical copy       | Cards say _On now_ / _Upcoming_; "straight-line", "Listed N times", excluded-record counts, "Atlas" and "2 of 2 parts planned" are gone from customer screens; the evidence lives under _How we chose these_.                                                                                                                              |
| 11 Modes                | Live mode, running late, skip, done & next, moments untouched; journey D walks through them.                                                                                                                                                                                                                                               |
| 12 Responsive           | Desktop plan: timeline beside a map of the stops and the moments (`PlanMap`, map library loaded only ≥ 1024 px). Phone: swipe shelves, compact bar, no sideways scroll at 360/390/768.                                                                                                                                                     |

## Atlas data and recommendations

Passport rules changed (all with tests in `quality-m1128.test.ts`,
`finder.test.ts`):

- A planner stop's picture is the place's own or one Atlas is sure of
  (`exact` or high confidence) — RANGE's "not verified" summer patio is gone.
- A place whose description says breakfast/brunch/lunch and never dinner is a
  weak dinner and no date's (the "Eatology" romantic dinner).
- One place listed several times is one alternative (`samePlace`: RANGE ×3).
- A winery's "Holiday Light-Up" tasting is not a lights stop.
- A home's photo never stands as a plan's picture; on a date, public displays
  lead.
- An unplaced listing whose placed twin is in the answer is not counted again.
- Seasonal places with no listed days have their own shelf; way pages show
  undated listings only when almost nothing dated exists.

Atlas-owned (handed off, not done): merge the Silver Star Light Up/NYE twins
and the five resort records; Silver Star village measured from Vernon's
centre (0 km); RANGE/Pallino's merges; unverified organisation photos served
as presentation images; a city banner marked `exact`; a season on photos; 10
key Vernon events without pictures; Caravan's winter show as an event;
outdoor rink season; West Kelowna "light-up" tastings and their shared stock
photo; Kelowna market twins; Vernon has no visitable lights display in Atlas.

## Verified

- Unit: 5,109 pass (all), 298 Christmas incl. 14 finder + 4 quality tests
  (the quality tests fail with their rule removed — checked).
- E2E (next start + critic fixture, `E2E_ATLAS=1`): all Christmas specs, the
  new `christmas-journeys.spec.ts` (A–F) and location/local-favourites: 95
  pass, 2 fail — the same two that failed before this work
  (`christmas.spec.ts` six-ways way-finds and way-empty, data drift in the
  fixture). Full suite 373 pass / 47 fail against M1127's 359 / 53 on the same
  setup; by name, one more (insiders 3–4) fails identically on the
  pre-mission build, two (discovery-one-search:58, nfr:345) pass when re-run
  alone.
- Journeys A–F also walked by hand in screenshots (`screenshots/m1128`).

## Performance (local, production-corpus stand-in, median of 3)

|                                         | before (29afc43) | after                                |
| --------------------------------------- | ---------------- | ------------------------------------ |
| Phone, slow 4G + 4× CPU: FCP / LCP      | 1,852 ms         | 1,892 ms                             |
| Phone: first event card in the page     | 3,471 ms         | 3,617 ms (with far more on the page) |
| CLS                                     | 0.002            | 0.002                                |
| Bytes transferred (load)                | 1,614 kB         | 1,559 kB                             |
| Category change (desktop)               | 217 ms (server)  | 58–66 ms (in the hand)               |
| Home → Lights Map (client nav)          | 41 ms            | 36 ms                                |
| Back to the landing page: scroll off by | ~2,000 px        | 0 px                                 |

The first measurement after merging put the first card at 4.7 s: the six
photos downloaded beside the discovery stream. They now load only near the
screen (`WayPhoto`), and finds are slimmed before they go to the phone
(`slim`, cap 48 + each kind's best 6).

## Limitations and open items

- Not deployed; production not checked. The photos load from the lane's own
  build; the event photos are Atlas's.
- The date photo is a winter walk under lights, not candles — Commons had no
  good candlelit dinner; the family photo has no festive cue. Both are
  honest inspiration; better licensed photography would be the owner's call.
- The global Passport bar above the Christmas bar is unchanged (shared
  contract; `proposals/shell-nav.patch` still stands).
- Scroll memory is per address: visiting the same address twice keeps the
  latest position.
- Live mode, moments and the planner's own UI were not redesigned, only
  placed beside a map on desktop.
- Doctrine conflicts recorded rather than left: one-category-at-a-time,
  the 2026-11-21 bar, NYE "said first", the season's-best tiles, the band
  under the fire, and photographs on the ways — all superseded by this owner
  brief in the doctrine paragraph.
