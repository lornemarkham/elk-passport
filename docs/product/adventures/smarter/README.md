# Smarter adventures — occasion, real places, fewer and better dares

**Status:** built on `main` 2026-11-01 (owner brief _Make Adventures Smarter
and More Fun_). Not pushed, not deployed. Product authority is
[the doctrine](../../../PASSPORT-PRODUCT-DOCTRINE.md); this page records what
changed, what it was measured against, and what is still weak.

## The problem, as it actually happened

Two adults in Vernon asked for _"a fun romantic Christmas date night with
mulled wine or hot apple cider, Christmas lights, maybe snow, something cute,
cozy, and memorable"_ on Sat Nov 7 2026. Passport built:

```
6:00 pm  Polson Park        "What is on offer: football, playground…"
7:15 pm  McDonald's         "Close to the rest of the day."
8:30 pm  The Perch Winery   "Close to the rest of the day."
```

Reproduced exactly against Atlas's corpus of 2026-10-24. The cause: the
Christmas evening shape handed the Day Builder _"this evening, good food and
drink"_, and the Day Builder read two words from the whole sentence — `food`
(McDonald's is a `fast_food_restaurant`: food) and `wine` (from _mulled
wine_: a winery). Nothing knew it was a date, that it was dark at 6 pm, or
that a winery is shut at 8:30.

## What changed

| Capability                                                                                                             | Where                                                                             | Used by                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Occasion** — moods and things named in passing, read from the person's words (closed set, deterministic)             | `src/domain/occasion/occasion.ts`                                                 | the Day Builder (`brief.ts`, `build.ts`) → `/go`, every adventure, Christmas, the snow day |
| **Stated hours on the day** — "is it still open when we get there?", from the publisher's own weekday sentence, quoted | `src/domain/occasion/hours.ts`                                                    | the Day Builder, idea finder, dares                                                        |
| **Idea → real places** — "go ice skating" finds rinks with Atlas's own words, hours, photos, directions                | `src/domain/occasion/ideas.ts`, `GET /api/adventures/[id]/find`, `FindPlaces.tsx` | every adventure page (Add something of your own; text-only idea cards)                     |
| **Saved, fitting first** — on during the dates, close by, suits the occasion; over/far set aside, never hidden         | `src/domain/occasion/saved.ts`, `src/lib/adventures/fit.ts`                       | `/adventures/[id]`, `/christmas/adventure/[id]`                                            |
| **A few dares, with real places**                                                                                      | `src/domain/christmas/challengePicks.ts`, `Together.tsx`                          | `/christmas/adventure/[id]`                                                                |
| **Presentation**                                                                                                       | `StopCard`, `Legs`, `AdventureJourney`                                            | every adventure page                                                                       |
| Place detail: the two Atlas reads run together, not one after the other                                                | `src/app/places/[id]/page.tsx`                                                    | `/places/[id]`                                                                             |

### How the occasion is allowed to act

It **ranks, composes and explains. It never removes and never states a
fact.**

- Fit comes only from what Atlas states: subtype, listed activities, the
  place's own description and published facts. **No brand list**: McDonald's
  sinks on a date because Atlas calls it fast food; say "McDonald's" and it is
  an interest like any other (test: `fitOccasion` in `occasion.test.ts`).
- **After dark is the sun's arithmetic** (`daylightAt` for the town and day).
  A park with nothing lit, or a kind that usually shuts by evening (winery,
  café, market…), sinks and carries a caution that says it is Passport's
  caution and that Atlas has no hours. A place whose **own hours** say it
  closes before you'd arrive is effectively out, and the card quotes them.
- A **venue is not a show**: a theatre building with no dated performance is
  "check the programme", not an evening's activity.
- **A Christmas thing must be on that day** by Atlas's dates; one with no
  dates for this season carries "check it's on".
- **Shape**: an occasion that sets an atmosphere (romantic, cozy, festive,
  snowy) or names things (warm drinks, lights, snow, a show) gives an outing
  one dinner and one drinks stop, orders an evening dinner → something to do
  → something warm, never fills with a stop the occasion argues against, and
  stops at two rather than add a poor third. A snow day is one mountain, then
  somewhere after, at most three stops. Party words alone ("with friends",
  "with my wife") only lean, exactly as before.
- **It says what it heard and what it couldn't find**, visibly on the day:
  _"Christmas lights — Atlas has no light display listed near Vernon for that
  day… Passport won't guess a street."_

## Before and after (Atlas corpus 2026-10-24, Vernon)

**A — romantic Christmas date, Sat Nov 7** (live, real stack, phone):

```
before  6:00 Polson Park → 7:15 McDonald's → 8:30 The Perch Winery
after   6:15 Midtown Bistro          "Dinner at a bistro; Atlas says it does “dinner”."
        7:30 Priest Valley Arena     "Atlas lists “public skating” here — public-skate
                                      times aren't in Atlas, so check them first."
        8:45 Okanagan Spirits Craft Distillery   "Atlas says it does “cocktail”."
heard   romantic, cozy, festive · something warm to drink · Christmas lights · snow · a good dinner
says    Something warm to drink — nowhere near Vernon that Atlas knows is both open
        that evening and lists it. · Christmas lights — Atlas has no light display
        listed near Vernon for that day… · Snow — that's usually before the snow
        season here… · Hours — Atlas has no evening hours for these stops. A quick
        call ahead is worth it.
dares   ☕ Rank the hot chocolate (cafés nearby, with their own hours) ·
        ⛸️ Get on the ice (real rinks) · ✨ Find the best lights ("Passport
        won't point at anyone's house")
```

(In one live run Centennial Outdoor Rink took the skating slot; its own Atlas
note says _closed for the season_. That is now read — `SEASON_SHUT` — and it
no longer can.)

**B — "Go ice skating"**: before, a card that said "Go ice skating". After:
_"Great idea. Here's where you could go ice skating."_ — Priest Valley Arena
(0.4 km, Atlas lists _public skating_), Centennial Outdoor Rink (0.5 km,
_"Its own note says it's closed for the season — check it has reopened"_),
Kal Tire Place (1 km, _"Open till 4 pm that day, by its own hours"_), Brewer's
Pond, Winfield Arena — each with picture, distance, Atlas's words, the
place's own hours, **Add to the day** and **Directions**. Choosing one adds
the real place, keeps "Go ice skating" as its note, and replaces a text-only
idea. Also works for bowling, snowshoeing, movies, wine tasting, spas,
swimming… — anything Discovery's activity vocabulary (ADR 007) recognises.

**C — family Christmas day, youngest 6, Sat Dec 12**: Centennial Outdoor Rink
→ Farmhouse Pizza → Big White's Twinkling Trail (_"Atlas dates it to this
day"_); no bars, wineries or distilleries; dares: get on the ice, rank the hot
chocolate, a holiday treat — no "holding hands" line, no Santa question
unless Atlas dates a Santa near.

**D — friends, snow day, generic adventure**: before (same engine):
Sovereign Lake Nordic Centre → SilverStar → pub, or a pub first; after:
SilverStar Mountain Resort first (Atlas lists skiing _and_ snowboarding: one
place for both), then a brewery and a pub. One mountain.

## What remains weak — honestly

- **Atlas has almost no evening hours.** 149 of 4,022 candidates state
  clock-time hours. Most evening stops say "check it's open". The fix is
  Atlas's (hours ingestion), not Passport's.
- **No Christmas lights near Vernon in Atlas for early November**, and only a
  handful region-wide (Canyon Lights from Nov 20, Big White Dec 12). Test A's
  lights wish cannot be met from evidence; Passport says so.
- **"Mulled wine / hot apple cider"** is met by no evening place: Atlas lists
  no menus. The plan says so instead of pretending a distillery pours cider.
- **Public-skate times** are not in Atlas for any Vernon rink.
- **A snow day's time** is still shared equally across stops (the mountain
  gets an hour on paper). Making the hill the day's length is unfinished.
- **Ratings on dares** are not a separate field: a dare is finished by a photo
  or a line (the existing memories store); "score out of ten" lives in the
  words. A structured rating needs a migration and was not added.
- The occasion reading is a deterministic closed set; anything outside it
  ("a quiet anniversary walk after the opera") is read only as far as its
  words match. No model is used.
- `/places/[id]` in production takes **10.8–13.8 s** to first byte
  (3 places × 2 runs, 2026-11-01) and ships 520–670 KB of HTML. The page's
  own Atlas reads now run together; the remaining wait is Atlas computing
  (`/places/:id/detail`, `/places`), and the HTML weight is untouched.

## Verification

```sh
# the stack: real GoTrue + PostgREST + Postgres (Christmas's, 557xx)
node docs/product/christmas/verification/stack.mjs start
node docs/product/group-adventures/verification/atlas-standin.mjs \
  docs/product/christmas/verification/atlas-candidates-2026-10-24.json.gz 55750
set -a; . ~/passport/scratch/christmas-stack/env; set +a
ATLAS_API_URL=http://127.0.0.1:55750 npm run build
ATLAS_API_URL=http://127.0.0.1:55750 node node_modules/next/dist/bin/next start -p 3132
E2E_PORT=3132 SHOTS=1 npx playwright test -c docs/product/adventures/smarter
```

`smarter.spec.ts` writes what Passport produced to `results.json` and the
phone screens to `screenshots/`. The unit-level pins on the same corpus
(no server): `npx vitest run src/domain/occasion`.
