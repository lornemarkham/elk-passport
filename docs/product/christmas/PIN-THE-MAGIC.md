# Pin the Magic — the Christmas lights map

**Owner brief:** "GO HAVE A DAY — PIN THE MAGIC!" (P0, ship before Christmas,
2026-11-10). **Lane:** christmas. **Product authority:** the
[doctrine](../../PASSPORT-PRODUCT-DOCTRINE.md); this page records what was
built, what it decides, and what it leaves open.

```
/christmas/lights               the map: town + kind filters, tap a light → its card, the list, favourites/trending
/christmas/lights/[id]          a display: photo, lit-this-season badge, reactions, add to tour, share, directions,
                                "Been by lately?" checks, "Something wrong?", remove (yours), more magic nearby
/christmas/lights/pin           📍 PIN THE MAGIC! — where, photo, name/kind, description, viewing hours, whose place
/christmas/lights/tour          Build My Christmas Lights Tour — start, drive/walk, time, stops, family leanings, night
/christmas/lights/review        reviewers' queue: waiting, hidden after a privacy report, published with reports
/christmas/lights/bingo         Christmas Lights Bingo (P1): seeded 5×5 card, shareable, printable
/christmas/api/lights[...]      GET pins · POST submit · POST [id] {action} · GET [id]/photo · POST tour (save)
```

## The journey, against the brief's success criteria

| The brief says                             | Where                                                                                     |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| I open Go Have A Day Christmas             | `/christmas` → _The Christmas lights map_ (hero button + banner)                          |
| I see a beautiful Christmas map            | dark OpenFreeMap tiles, glowing emoji markers, snow and fairy lights (CSS), night palette |
| I find a decorated house                   | a published home, or one of the 15 researched public displays                             |
| I react to it                              | 🎄 MAGICAL! ✨ WOW! 🎅 SANTA APPROVED! 🤯 UNBELIEVABLE! ❤️ FAMILY FAVOURITE! (signed in)  |
| I add it to my Christmas tour              | _Add to my tour_ on every card, sheet and page (kept on the phone, no account)            |
| I discover other displays nearby           | _More magic nearby_ on a display; _Add more magic nearby_ on the tour                     |
| I share the tour with my family            | tour link (no account to open), native share sheet, print; _Save as our adventure_        |
| I submit another one through PIN THE MAGIC | the fixed red button on the map → six steps → "waiting for a reviewer"                    |

## Rules this keeps (tested in `src/domain/christmas/lights/lights.test.ts`)

1. **A home is never shown without permission.** A pin of kind _home_, or one
   marked "someone's home", is private to its submitter and the reviewers —
   not on the map, not in the API, its photo 404s — until a reviewer records
   the owner's consent or a public listing's https link. The submitter's
   claim is shown to the reviewer, never taken as the permission itself.
2. **The owner can always take it down, without an account.** A privacy
   report on a published home hides it at once; a reviewer may restore it if
   the report wasn't the owner's. Other reports wait for a reviewer.
   Submitters remove their own pins (photo and address go too).
3. **Last year's lights are not this year's.** A season is named by its
   December (Jan 2027 is the 2026 season). A pin confirmed only in an earlier
   season shows _Last confirmed 2025 — not yet this year_, is drawn dim, and
   never goes on a tour until someone says _Lights are on!_. Two families (or
   one reviewer) saying _Not decorated this year_ marks it dark.
4. **A dated display is toured only on its days** (Frostival on Nov 27, the
   Farmstrong markets on their two Saturdays). Its badge says _Confirmed for
   2026 · starts Nov 28_ before it begins and _Finished for this year_ after.
5. **One of each reaction per account per pin;** pressing again takes it back.
   Favourites = all reactions; trending = the last seven days.
6. **Nothing invented.** The map's first pins are researched public places
   only, each with its source page, the day it was read and the source's own
   words. Atlas's Christmas finds appear only where Atlas states a coordinate
   inside the five towns' box; Passport places nothing itself.

## Storage (no new table)

Pins are one versioned JSON document (`christmas-lights`) and each photo its
own document (`christmas-lights-photo:<id>`) in the Local Insider Network's
compare-and-swap store, `passport_insider_docs` (migration
`20261111000000_passport_insiders.sql`, already in production; ADR 017's
pattern, ADR 018's table). Reasoning: pins are community knowledge about the
area, reviewed before they're public — what that store is for — and reusing
it needed no migration, no new secret and no new table before Christmas.
Server-only access through SECURITY DEFINER functions keyed by the server;
the anon key can read nothing. **No email is stored on a pin**: a person is
an HMAC of their address (`v_…`), reviewers appear by email in the trail.
Reviewers are the network's administrators (`ADMIN_EMAILS`) and ambassadors.
Saved tours are ordinary Christmas adventures on the adventures core (kind
`christmas`, ADR 009/012): stops become the day's items in order, plus a
"The route" idea holding the tour link and directions.

## Researched pins (read 2026-11-10)

Ten confirmed for 2026 (Frostival, Artsolutely, Sleigh All Day, Discover
Yuletide, SilverStar Light Up, Armstrong Downtown Light Up, Farmstrong
markets, Caravan Farm's _The Hockey Sweater_, Kelowna's Stuart Park Light Up,
the Tree of Hope) and five last confirmed in 2025 (Sparkling Hill market,
Rutland Centennial tree, Christkindl, Craft Culture, Festival of Trees).
Sources and quotes are in `src/domain/christmas/lights/seed.ts`.
**Gaps, said plainly:** Lumby has nothing sourced since 2019; Coldstream's
2025 light-up was left out because its venue couldn't be placed reliably;
some Tourism Vernon/Kelowna details came from search snippets of pages that
wouldn't render. Re-check when the 2026 organiser pages go live.

## What this does not decide

- **§15.3 (reaction states) stays open for Passport.** The five reactions
  are the owner's, for Christmas pins only. They are not REACT signals about a
  person's taste (§2.2) and feed no personalisation.
- **§15.15 / ADR 018:** "Something wrong?" here is about Passport-held pins,
  as with local listings; pins are not handed to Atlas. Whether published
  displays should become Atlas candidate sources is the owner's call.
- **§10:** one more composition on shared capabilities (insiders store,
  adventures core, Christmas finds), not an Experience contract.
- **Ambassadors review lights.** That widens what an ambassador does from
  "their town's listings" to Christmas pins. If the owner wants a separate
  reviewer list, it is one line in `viewer()`.

## Verification

- `npx vitest run src/domain/christmas` — 58 tests (lights: privacy, takedown,
  seasons, reactions, tour, bingo, dated touring, seed rules).
- `e2e/christmas-lights.spec.ts`, phone viewport, against `next start` with
  `INSIDERS_STORE=memory INSIDERS_TEST_IDENTITY=on ADMIN_EMAILS=elf@example.test`
  and `E2E_LIGHTS_IDENTITY=1`: the visitor journey (map → display → tour →
  shared link → bingo) and the family/reviewer/owner privacy journey. The
  first test runs on any server; the second skips without the test identity.
