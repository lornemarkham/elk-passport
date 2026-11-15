# Christmas Experience 2.0 — describe it, get a plan

**Owner brief:** "P0 — CHRISTMAS EXPERIENCE 2.0: MOBILE-FIRST PLANNING +
INTELLIGENT ITINERARIES" (2026-11-14). Lane christmas. Authority: the
[doctrine](../../PASSPORT-PRODUCT-DOCTRINE.md) (§2.5 SHAPE, §2.7 LIVE, §2.8
ADAPT, §4 progressive constraints, §5 said vs inferred).

```
/christmas              screen one: "Plan your Christmas adventure." — one box,
                        five quick starts, then real Christmas by kind (Around You)
/christmas/itinerary    screen two: the plan — stops at times, Edit Plan, Share, Start Day
/christmas/api/itinerary  POST: save the plan as a Christmas adventure (signed in)
```

## The failure it fixes

"Romantic night of lights, dinner and a movie." used to become the planner
shape _evening_ and the Day Builder sentence "a Christmas evening, good food
and drink" — so the answer was three restaurants. Now the sentence is read
into **parts** (`src/domain/christmas/request.ts`) and each part becomes one
stop that is either a real place for _that part_ or **unresolved, with the
reason** (`src/domain/christmas/itinerary.ts`). Nothing is ever substituted
because Atlas happened to have it.

| Part                           | Satisfied from                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| dinner, lunch, breakfast       | Atlas places Discovery's _Restaurants_ activity recognises (`activityEvidence`)                                          |
| hot chocolate / coffee, drinks | _Coffee & cafés_, _Bars & pubs_                                                                                          |
| movie                          | _Movies_ (cinemas). **Showtimes are never shown** — "check the cinema's own listings"; the time is "~ about"             |
| skating                        | _Ice skating_                                                                                                            |
| lights                         | lit, published displays on the community lights map on that day, and Atlas finds _named_ as lights (a tour of up to 3–5) |
| market, Santa, show, festival  | Atlas Christmas finds (`readChristmas`) **on that day** by Atlas's dates; market/festival pins from the map              |

Checks per stop: distance from the town (25 km driving, 2.5 km walking, or
what was said), the place's **own published hours** that weekday
(`statedCloseOn` — closed places are never chosen; unknown hours are said),
event dates (`readWhen`: only dated or "check the days" finds on that day),
an event's own start time, seasonal closure notes, real pictures only
(`cardPictures` minus stand-ins). Ranking: intent → availability →
geography (from the previous stop) → evidence → experience (a pub counter
is a weaker match for a _romantic_ dinner). Unresolved stops offer the
honest ways on: the nearest real option outside the circle (offered, not
chosen), the first day it can happen (lights before Nov 28), or taking it out.

## Minimal questions

Everything said is used and never asked again (who, how many, children, ages,
$ budget, day, start time, home-by, walking, town). The **one** question is
the day, when none was said: the plan is made for this Saturday and the page
asks "Which day?" above it. Parts Passport adds when none were named (a
romantic evening → dinner + lights) are marked _Passport's idea_ (§5); a
suggested part that can't be found is a single line, not a card.

## Before · during · after

- **Before** — Edit Plan: replace (alternatives), change time, remove, add a
  stop, "Nearby" (real places within 1.5 km). Every change is in the address
  (`edits.ts`), so the link _is_ the plan. **Share**: signed out, the link;
  signed in, the plan becomes an adventure of kind `christmas`, so invites,
  in / maybe / out, announcements, challenges, memories and the recap are the
  existing ones (unresolved parts go in as a "Still to find" note).
- **During** — Start Day: _What's next_ — the current stop, Directions, the
  next stop and the drive, Running late (+15 min shifts every time), Skip
  this, Done → next. Kept on the phone.
- **After** — How was it?: love and rate each stop (on the phone); rate the
  lights map's displays for other families; keep photos and memories on the
  adventure.

## Contextual moments (`moments.ts`)

Romantic: three quiet, optional moments — never dares. Family: Christmas's
kid-friendly challenges that fit the plan first. Friends: vote on the plan,
then a friendly ranking. A lights tour: rate the displays, Lights Bingo.

## What was preserved

Christmas Around You's sections (now under "Christmas around <town>", below
the planner), the theme cards, the lights map and its tour, the five-shape
planner for a weekend or more (`/christmas/plan`, with the picks tray and the
no-account Day Builder path), adventures and everything on them. `SayIt` is
gone: the planner box replaced it.

## Measured (real corpora, committed)

`itinerary.test.ts` runs the brief's scenarios on Atlas's stand-in of
2026-10-24 (full records with hours) and the production pool read from
gohaveaday.com on 2026-11-14 (`atlas-candidates-2026-11-14.json.gz`, from
M845's `/discovery` read; the browser pool carries no opening hours).

- **Vernon** has 41 Atlas restaurants within 40 km and **no cinema** — the
  nearest is Bernie's Supper Club & Cinema, Kelowna, 45 km. A Vernon movie is
  unresolved and says so.
- **No display is confirmed lit near Vernon before Nov 21–28** (the map's
  researched pins). A lights night tonight is unresolved with "try Sat, Nov 28".
- **Kelowna, Dec 12**: dinner 5:30 PM → lights tour 7:05 PM → movie ~8:30 PM,
  all three real.
- Santa in Vernon on Nov 14: nothing dated within 25 km.

## Not done / open

- **Atlas gaps are Atlas's to fill:** no Vernon cinema; very few restaurant
  hours in the production pool; no showtimes anywhere. Passport says so.
- **Real driving times** are estimates (straight line × 1.35 at 35 km/h,
  the lights tour's rule); the map app has the route.
- Prices: only where Atlas states one; a budget is said back, not enforced.
- Ratings and "loved" after the day stay on the phone; the adventure's
  memories are where a group keeps them. Nothing feeds Atlas (§2.10 open).
- Okanagan expansion: the lights map's towns and Discovery's town list decide
  reach; no Vernon/Coldstream-only rule is hard-coded.

## Verification

`vitest src/domain/christmas` (request + itinerary scenarios) ·
`e2e/christmas-planner.spec.ts` (phone, 390 px, signed out, `E2E_ATLAS=1`
on the critic mock serving the 2026-10-24 stand-in) · `e2e/christmas.spec.ts`.
