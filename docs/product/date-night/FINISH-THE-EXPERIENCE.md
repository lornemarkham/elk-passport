# Date Night — finish the experience (mission 487)

Monday 2 November 2026. Builds on mission 485 (`MARKHAM-ADVENTURE.md`, GitHub
`main` a47e611). The visual direction was approved and kept: the cinematic
hero, the photo cards, the type and colours. What changed is that the page is
now **one adventure, one itinerary, one editing experience**.

## The page, top to bottom

1. **Hero** — date, _The Markham Adventure_, who's coming, and the conditions:
   leave time, _Vernon, North Okanagan_, sunset (5:35 pm, BC legal time) and
   the Environment Canada forecast when the server can read it.
2. **Choose our adventure** — the photo cards: **King Eddie Lake**, **Crazy
   Creek Escape** (Jess's Pick), **Cold Water, Warm Fire** and **Surprise Us**.
   Each says where, the times, what makes it special. Once one is chosen the
   strip steps back to small cards, the chosen one first, ringed, marked
   _Chosen_, with the plan's real times. Choosing another over a plan you have
   made your own shows the new plan and asks: **Replace it** / **Keep ours**.
3. **Our adventure** — the one itinerary: time, what, where, how long, the
   drive before it, a line, **Directions** where they help. **Customize this
   adventure · how it ends** offers the endings (King Eddie: _Stay wild_ /
   _Warm ending_) — customising, not choosing another adventure. Each stop's
   pencil opens **Change · Earlier · Later · Remove**; **Add something** puts
   a stop where you say. What the times get wrong is said on the stop (a hunt
   after legal hours, a dip after sunset, a place outside its stated hours).
   _Before you go_ holds the checks, collapsed.
4. **Make it ours** — one sentence box. Passport shows before → after, time by
   time, and **Make it so** (owner) or **Suggest it to Lorne** (Jess). Undo
   after.
5. **Together** — the invitation (until somebody has joined), suggestions from
   the other person (_Show me_ / _Choose it_), and Packing, Memories & photos,
   People & invitations as one-line panels. The heading and order follow the
   day: _Before we go_ (packing first), _Out there_ (the itinerary highlights
   what's now or next), _Remember_ (memories first and open, then _Do it
   again_).

**Removed, not tucked away:** _Other trouble we could get into_ (the six
voted ideas and the mystery button — King Eddie, grouse, fire and stars are
now the King Eddie adventure itself), the second detailed itinerary (_Times,
travel, changes & the printable guide_, the shared AdventureJourney) and _Plan
it yourself, stop by stop_ (DayStory, deleted). New nights no longer seed the
loose ideas; on an existing night they are no longer shown.

`/datenight` now goes straight to the board for someone who already has the
night; the front door is for the first visit.

## One itinerary, stored where adventures already store a day

`src/domain/date-night/adventures/itinerary.ts`. The itinerary is a list of
stops; each is stored as an ordinary adventure item on the day — `label` the
title, `note` the line, `starts_at` the time, `position` the order,
`atlas_ref` where Atlas holds the place. **No new table, no migration.** Every
planning action — a card, an ending, a sentence, Change/Move/Remove/Add —
produces a new list and the owner's page writes it with one call,
`PUT /api/night/[id]/plan` (`src/lib/date-night/plan.ts`): stops it knew and
left out are removed, anything that arrived meanwhile is left alone. Jess adds
her own stops through the core's `POST /api/adventures/[id]/items` (RLS lets a
member propose on a day and change only what they proposed). The other person's
page refreshes every 15 s.

Times are laid out, not typed. An adventure's stops (`evenings.ts`) have a
length, the drive before them, and rules: the sunset stop waits for the
sunset, and the stop before it that "stretches" (King Eddie's grouse) gives or
takes the difference, so leaving earlier means more daylight hunting and the
sunset still happens at the lake. Changing the ending replaces only the
ending's own stops; everything before it, including your changes, stays.

A night chosen under mission 485 (Atlas places on the day, no times) shows its
adventure's own plan until the first change saves it in this shape. "Into the
Wild" is read as King Eddie Lake.

## Make it ours — the Day Builder's readers, no model

`src/domain/date-night/adventures/say.ts` reads the sentence in the browser,
deterministically, against the itinerary on the page:

| Said                                        | Does                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| "Let's leave earlier and get home by eight" | leave 30 min earlier (an hour if said), then trims after the sunset to be home by 8:00 pm   |
| "Let's spend more time at the lake"         | +30 min at the lake (or the amount said), protected from the home-by trim                   |
| "Find somewhere warm for dinner"            | the warm ending, lake untouched (or, on an adventure without endings, BNA)                  |
| "Let's skip the swim"                       | removes the dip                                                                             |
| "Can we leave an hour earlier?"             | leave 1:15 pm                                                                               |
| "Make it a little more romantic"            | dinner moves to a romantic Atlas place (The Edge — says Atlas has no hours); else stars +20 |
| "Find something fun along the way"          | the first checked Atlas place open on the way (Planet Bee, open till 5:30)                  |

Clock times come from the Day Builder's own readers (`startIn`, `homeIn` in
`src/domain/day/brief.ts`, now exported), with an evening's "8" read as 8 pm.
Places come only from the night's checked Atlas options (`tomorrow.ts`).
Nothing understood changes nothing and says so. No AI call; the shared
`/change` engine was not used because it rebuilds Atlas-only days, and most of
this night (the forest road, a fire, the lake) is not in Atlas.

## Facts, checked 2026-11-01/02

| Fact                                                                                                | Source                                                                        |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| King Edward Lake is at 50.1508, −119.2187, Central Okanagan RD, south-east of Coldstream            | OpenStreetMap (Nominatim)                                                     |
| About 1,357 m elevation                                                                             | Open-Meteo elevation API                                                      |
| Vernon → lake 21.9 km, ~41 min; Coldstream → lake 18.8 km, ~37 min (via King Edward FSR, gravel)    | OSRM; the plan allows 40 min plus 10 to the shore, 50 home in the dark        |
| Grouse open in Region 8 to Nov 30, 5/day; no hunting of game from 1 h after sunset (6:33 pm Monday) | 2026–2028 BC Hunting & Trapping Regulations Synopsis                          |
| Category 1 campfires allowed in the Kamloops Fire Centre since noon 3 Sept 2026                     | BC Wildfire Service notice (as reported by Lillooet / Logan Lake, 2026-09-03) |
| Vernon, Mon 2 Nov: cloudy, clearing near noon, high 8, evening cloud, low +2                        | Environment Canada, issued 4:00 pm Sun 1 Nov                                  |
| Sunset 5:33 pm (UTC−7, BC's permanent time from 1 Nov 2026)                                         | NOAA algorithm, `conditions.ts`                                               |
| BNA Brewing open Sun–Thu 4–10 pm                                                                    | Atlas + BNA's site                                                            |
| Planet Bee store Mon–Fri 8:30 am–5:30 pm                                                            | Atlas                                                                         |
| Crazy Creek pools 9 am–10 pm daily, no food in November                                             | crazycreekresort.com                                                          |

**Not verified, and said so on the page:** the lake's water (temperature,
ice) — the dip is optional, short and never after dark; whether a fire is
allowed _on the night_ — the check says to look again; the road's condition
at 1,357 m in November; the exact Management Unit and No Shooting Areas near
Coldstream; the weather at the lake (the forecast is for the valley). The
forecast isn't written into the plan, because it changes.

## Named, not resolved

- **Leave time.** Mission 485's brief said "around 5 PM". A grouse hunt needs
  daylight (sunset 5:33, legal until 6:33, too dark well before that), so King
  Eddie leaves at **2:15**. The front door says _Afternoon into the stars_
  instead of _Around 5 PM_. If Monday really starts at 5, say "leave at 5": the
  plan moves and the hunt is flagged as too late to be more than scouting.
- **Doctrine §15.4 (planning UI).** This is one more narrow answer — for one
  night, an itinerary edited in place, in words or by hand — not the general
  one.
- The `/api/night/[id]/mystery` route is no longer called by the page; kept,
  unused.

## Verification

`docs/product/date-night/verification/markham.spec.ts` — two phones
(390×844), a real local stack (GoTrue, PostgREST, Postgres with every
adventure migration), the 2 November production corpus stand-in, a
**production build**. Tests A–F of the brief: adventures before any
itinerary; King Eddie's eight stops at the right times with no warnings; the
warm ending keeps the first five stops and survives a reload; the sentence
gives _Leave 1:45 pm · Home about 8:00 pm_ on the same seven stops; Add,
Earlier and Remove survive a reload; another adventure over a customised plan
previews and is refused; Jess joins on her own phone, sees the same stops,
adds her own, sends a sentence; Lorne sees both, applies hers, Jess sees the
change; packing ticks cross; a second account is refused; nothing scrolls
sideways and every button on the plan is at least 44 px. Unit rules:
`itinerary.test.ts`, `evenings.test.ts`.

## Release

No migration. Packing and memories still need the two adventure migrations
listed in `MARKHAM-RELEASE.md`; without them those panels say they "aren't
switched on yet".
