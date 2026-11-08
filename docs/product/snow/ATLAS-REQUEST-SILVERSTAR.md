# Atlas acquisition request: SilverStar Mountain Resort

From Passport Snow Day, 2026-11-08 (mission "Make the mountain come alive").
For the **atlas** workspace. Passport consumes Atlas and never writes to it.
This request asks; it changes nothing.

## Why

A crew planning a SilverStar day needs somewhere for lunch on the mountain and
an après spot. Passport only suggests places Atlas holds, so today the plan
says _"Atlas has no lunch spot on the mountain yet"_ and links the resort's
own list instead. That is honest, and it is the weakest moment of the day.

## Evidence

Production Atlas as served to `elk-passport.vercel.app/go` on 2026-11-08
(5,471 candidates; the SilverStar slice is
`docs/product/snow/verification/atlas-silverstar-2026-11-08.json.gz` in the
Passport repo). Measured with `src/domain/snow/nearby.ts`
(`acquisitionRequest`). "On the mountain" means within 4 km of 50.359,
-119.062.

- **On the mountain, Atlas holds:** Brewer's Pond (outdoor skating rink),
  Tube Town (tubing), Silver Star Provincial Park (snowshoeing), Sovereign
  Lake Nordic Centre and Sovereign Lake (Nordic, snowshoe), Silver Star
  Mountain Resort (ski resort, image is `category`, not the resort), and two
  events.
- **Food and drink on the mountain: none.**

## Requested: dining venues SilverStar lists (Atlas holds 0 of 14)

Source: <https://www.skisilverstar.com/mountain-dining-shopping/restaurants-cafes/>
(read 2026-11-08; the content is in the page's `/page-data/…/page-data.json`).

The Red Antler · Paradise Camp (the page said "Returning Winter 25/26") · The Den ·
d'argento · Town Hall (the page said "Closed until Winter 25/26") · Tube Town
Café & Bar · Bear Bites Food Truck · La Plata · Bugaboos Bakery Café · Black
Pine · Pizza Gratta · Francuccino's Gelato and Frank's Fries · The Bulldog
Grand Cafe · Long John's Pub.

Each needs, at least: a location in the village, a subtype Passport's food
activities recognise (restaurant, café, pub, bar), and, where the venue
publishes them, seasonal hours as schedule statements, never inferred.

## Requested: winter activities with no Atlas entity

Source: <https://www.skisilverstar.com/events-activities/winter-activities/>.
Atlas already covers Cross Country Skiing (Sovereign Lake Nordic Centre), Ice
Skating (Brewer's Pond) and Winter Tubing (Tube Town).

Missing: Snowshoeing (16 km of resort trails; Atlas has the provincial park
only) · Fat Biking · Night Skiing · Elevate Spa · Guided Mountain Tours ·
Mini Snowmobiles (at Tube Town) · Snowmobile Tours · Paradise Camp Dinner
Tours (snowcat) · Ravenwood Snowshoe Dinner Tours · Bear Byway Scavenger
Hunt · Yoga.

## Also useful

- An `exact` photo of the resort itself. Today Silver Star Mountain Resort
  carries a `category` image, so Passport shows its illustration instead.
- Season statements for the resort (opening and closing days as the resort
  publishes them, with its caveat). Passport keeps these itself for now
  (`src/domain/snow/resorts.ts`), dated, and would rather read them from Atlas.
- The same pass for Big White and Sun Peaks, which Passport also has
  published opening days for.

## Acceptance (Passport side, no Passport change needed)

With the venues in Atlas, `nearby.test.ts`'s "has NO lunch or après on the
mountain" fails by design (rewrite it to expect them). The SilverStar plan's
Lunch stop then shows a real place, and the request on screen shrinks to
what's still missing.
