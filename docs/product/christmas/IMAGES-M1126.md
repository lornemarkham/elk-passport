# Christmas image coverage — M1126 (2026-11-25)

Owner brief: _Christmas Image Coverage & Quality_ — make GoHaveADay Christmas
visually compelling for real visitors arriving from business cards in local
shops; Vernon and Coldstream first, then the Okanagan, then Metro Vancouver.

Passport consumes Atlas's pictures; it does not hold its own (doctrine §17,
CLAUDE.local "Atlas owns knowledge, evidence and discovery data"). So this
mission did three things: measured what Christmas actually shows, fixed what
Passport itself was losing, and handed Atlas a ranked list of what only
Atlas can fix.

## How it was measured (repeatable)

```sh
node ~/scratch/m817/tools/prod-corpus-discovery.mjs out.json https://gohaveaday.com
IMAGES_CORPUS=$PWD/out.json IMAGES_OUT=$PWD/images.json IMAGES_TODAY=2026-11-25 \
  npx vitest run src/domain/christmas/images.eval
node docs/product/christmas/verification/image-urls.mjs images.json image-urls.json
```

`images.eval` runs Christmas's own code (`findsIn`, `answer`, `around`,
`strongest`, `christmasPictures`) over the live production pool (7,039
candidates, 662 Christmas finds) for 15 priority towns and records, per card,
whether a picture of this very thing can be shown and what Atlas holds that
Christmas withholds (a venue's photo, a stand-in). `image-urls.mjs` fetches
every picture and records status, type, bytes and pixel size. The extract
carries no Atlas distance readings (ADR 094), so placement is from
coordinates; production can differ by a card or two (it places "Frostival
2026 Downtown Vernon", which the extract holds unplaced).

## Before and after

"Front page" = the four _Happening near you_ cards on `/christmas?at=…` (the
featured surface). "Season" = every find Discover shows for the town from
today to 3 January.

| Region                                         | Front-page cards pictured | Season finds pictured |
| ---------------------------------------------- | ------------------------- | --------------------- |
| Vernon & Coldstream                            | 2/8 → 2/8                 | 19/40 → 21/40         |
| North Okanagan (Armstrong, Lumby, Silver Star) | 0/12 → 11/12              | 14/35 → 16/35         |
| Central/South Okanagan (5 towns)               | 11/20 → 17/20             | 77/111 → 79/111       |
| Metro Vancouver (5 towns)                      | 5/20 → 5/20               | 5/28 → 5/28           |

All 662 Christmas finds in the pool: 336 have a picture Christmas can show (51%).

**Vernon itself did not move, and that is the honest result.** Vernon's own
upcoming events (1940s Radio Christmas Carol, A Golden Celebration, Sleigh
All Day, Frostival, Métis Crafters) have no photograph in Atlas. Ranking a
pictured Lake Country winery market over the town's own Friday night would
have shown 4/4 and misled the visitor; that version was built, measured, and
rejected (see Decisions).

## What Passport fixed

1. **The front page's four lead with pictured finds — within the town first**
   (`strongest` in `around.ts`, used by `_parts/near.tsx`). Order: a long run
   never leads; finds within `TOWN_SPREAD_KM` (10 km) before those beyond;
   then pictured before text-only; then `around`'s order. This is the
   "pictured" step Christmas's recommendation order already takes
   (`byStrength`), applied to the one surface that ignored it.
2. **A folded card borrows its twin's own photo** (`borrowPicture` in
   `discover.ts`). Atlas holds Caravan Farm Theatre three times and Kal Tire
   Place twice; `oneEach` shows one card, and it was sometimes the listing
   without a photo. The twin's _own_ picture only — never a venue's or a
   stand-in.
3. **…and falls back to it when its own fails.** Silver Star Annual Light Up
   is two Atlas listings; one picture (`skisilverstar.com/…/light_up_desktop_hero.jpg`)
   answers 404 in production today, the other loads. The card now shows the
   working one instead of going text-only.
4. `CardPhoto` decodes images off the main thread (`decoding="async"`).

Tests: `strongest.test.ts` (4), `discover-repair.test.ts` "one card, the
thing's own picture (M1126)" (4).

## Production rendering (gohaveaday.com, iPhone 13 emulation, 2026-11-25 ~06:30Z)

| Discover page                      | Cards | With picture | Loaded | Broken drawn | Failed image requests         |
| ---------------------------------- | ----- | ------------ | ------ | ------------ | ----------------------------- |
| `/christmas/discover?at=vernon`    | 18    | 9            | 9      | 0            | 1 (Silver Star Light Up, 404) |
| `/christmas/discover?at=kelowna`   | 18    | 15           | 15     | 0            | 1 (same)                      |
| `/christmas/discover?at=vancouver` | 16    | 3            | 3      | 0            | 0                             |

No broken-image icon is ever drawn (`CardPhoto` gives way to the next picture,
then to a text card). Screenshots: `screenshots/m1126/` — `prod-*.jpg` is
production today, `local-*.jpg` is this branch on today's production pool.

## Picture quality on what is served (316 pictures Christmas shows)

- **Broken: 1** — the Silver Star Light Up 404 above (Atlas `d1cfd91a`).
  Five more are served with a wrong or missing content type
  (`binary/octet-stream`, AVIF with none, a `.tmp` file); browsers sniff and
  draw them, so they render, but Atlas should record them properly:
  `2b64118a`, `843cd8d3`, `993a8ef4`, `a45d9852`, `f022be50`.
- **Too small for a card (< 600 px wide): 13**, the worst `8e467ffc` Write to
  Santa (250×139), `993a8ef4` CYO Holiday Concert (284×178), `c7ceeb04`
  Christmas in Oak Bay (306×241).
- **Heavy for a phone (> 1 MB): 24**, up to 3.9 MB (`ce9c2348` Parapapam
  2400×1036, `dc20bc0f` NYE at The Malcolm Hotel 3.8 MB, `68f301fa`,
  `53422a06`, `3a4cd4fd` 5349×3566). Every picture is hot-linked from the
  publisher's own host at full size; neither Atlas nor Passport resizes.
  A phone loads ~1.6 MB of pictures for Vernon's Discover page.
- **Possibly generic, not of the event** (served by Atlas as the event's own,
  `exact`): `9b4cff69` 4th Annual German Christmas Market (Santa holding a
  dog), `dc29498f` Tabletop Grinch Tree Workshop (stock-style "person
  hanging lights"), `8e467ffc` Write to Santa (a scroll). All come from
  Tourism Kelowna's listing CDN, uploaded by the lister — plausibly the
  organiser's choice, not proven misleading. Flagged to Atlas, not hidden by
  Passport.
- Posters and title graphics lead several cards (Nutcracker, Penticton
  Concert Band, Holiday Hideaway, Sleigh Rides). They are the organiser's own
  art for this very event, so they are honest; Atlas ADR 074 prefers
  photographs to lead.

## What only Atlas can fix — ranked gap list

Ordered by region priority, then date. "Withheld" is what Atlas has that
Christmas deliberately does not show (launch QA finding 32: a venue's photo
is a picture of somewhere else).

### Vernon & Coldstream (19)

| Atlas id   | Kind  | Starts     | Name                                                                                 | What Atlas holds that Christmas won’t show |
| ---------- | ----- | ---------- | ------------------------------------------------------------------------------------ | ------------------------------------------ |
| `1c99bcd7` | Event | 2026-11-27 | Frostival 2026 Downtown Vernon (production places it; the extract holds it unplaced) | nothing                                    |
| `7ffb145c` | Event | 2026-11-19 | A 1940s Radio Christmas Carol                                                        | nothing                                    |
| `5fc1735b` | Event | 2026-11-27 | A Golden Celebration: 50 Years of Music and the Magic of Christmas                   | nothing                                    |
| `d71b16fe` | Event | 2026-11-28 | The Celtic Tenors: A Celtic Christmas - SPOTLIGHT Special Presentation               | nothing                                    |
| `53b5dd13` | Event | 2026-11-28 | Christmas Garage Sale Fundraiser                                                     | Venue photo · O'Keefe Ranch Historic Site  |
| `17f6cc23` | Event | 2026-11-28 | Sleigh All Day                                                                       | nothing                                    |
| `daac75c0` | Event | 2026-11-28 | Métis Crafters Holiday Pop-Up Market                                                 | nothing                                    |
| `0d2e52bb` | Event | 2026-11-29 | Coldstream Community Christmas Light-Up                                              | nothing                                    |
| `5612b051` | Event | 2026-11-29 | Rutland Light Up 2026                                                                | Venue photo · Rutland Centennial Park      |
| `5e7eb386` | Event | 2026-12-04 | Craft Culture Holiday Market 2026                                                    | Venue photo · Prospera Place               |
| `3fbf923b` | Event | 2026-12-05 | Festive Saturday Science                                                             | Venue photo · Okanagan Science Centre      |
| `feda1667` | Event | 2026-12-05 | Christmas Market at Swan Lake Market                                                 | nothing                                    |
| `22dadaa4` | Event | 2026-12-05 | Shoparama Holiday Gift Sale                                                          | nothing                                    |
| `be7d6201` | Event | 2026-12-12 | A Hometown Christmas with the Armstrong Melodia Singers                              | nothing                                    |
| `087d19a8` | Event | 2026-12-18 | Stars on Ice - 2026 Holiday Tour                                                     | Venue photo · Kal Tire Place               |
| `dc4d9825` | Event | 2026-12-19 | A Coast to Coast Cowboy Christmas 2 - George Canyon & Aaron Pritchett                | nothing                                    |
| `7d407439` | Event | 2026-12-27 | Unwrapped 26'                                                                        | nothing                                    |
| `60a6e596` | Event | 2026-12-31 | New Year's 'Eve Double Bill                                                          | nothing                                    |
| `8ac76276` | Event | 2027-01-01 | Dance Dance Party Party (DDPP) Vernon - Jan 1 session                                | nothing                                    |
| `50d828b9` | Place | —          | Brewer's Pond                                                                        | nothing                                    |

### North Okanagan (1)

| Atlas id   | Kind  | Starts     | Name                            | What Atlas holds that Christmas won’t show |
| ---------- | ----- | ---------- | ------------------------------- | ------------------------------------------ |
| `65ab7ef4` | Event | 2026-12-17 | CPKC Holiday Train (Notch Hill) | nothing                                    |

### Metro Vancouver (23)

| Atlas id   | Kind         | Starts     | Name                                                | What Atlas holds that Christmas won’t show |
| ---------- | ------------ | ---------- | --------------------------------------------------- | ------------------------------------------ |
| `6224e11c` | Event        | 2026-11-12 | ELF: THE MUSICAL                                    | nothing                                    |
| `607e65c0` | Event        | 2026-11-14 | Christmas Craft Market                              | nothing                                    |
| `61a9f336` | Event        | 2026-11-20 | Peak of Christmas                                   | nothing                                    |
| `84362a59` | Event        | 2026-11-25 | Festive Village                                     | nothing                                    |
| `7c7bcc07` | Event        | 2026-11-28 | The Storybook Nutcracker                            | nothing                                    |
| `bb9760ca` | Event        | 2026-12-12 | Christmas Dinner Dance                              | nothing                                    |
| `a5ae8696` | Event        | 2026-12-18 | Jason Stevens: A Christmas Carol by Charles Dickens | nothing                                    |
| `0c15694c` | Event        | 2026-12-21 | Holiday Break Skates                                | nothing                                    |
| `dc097cdd` | Event        | 2026-12-22 | Winter Wonderland 2026 - A Holiday Skating Event    | nothing                                    |
| `eea212ef` | Place        | —          | Vancouver Christmas Market                          | nothing                                    |
| `f645b889` | Place        | —          | Brush With Illumination                             | nothing                                    |
| `d2a6db18` | Place        | —          | Shipyards Christmas Market                          | nothing                                    |
| `020bffc5` | Organization | —          | Deville Coffee                                      | nothing                                    |
| `33a1a224` | Organization | —          | Arc                                                 | nothing                                    |
| `88955bf2` | Organization | —          | Leopold's Tavern                                    | nothing                                    |
| `7d6141f7` | Organization | —          | Starbucks                                           | nothing                                    |
| `6b4d60f6` | Place        | —          | Robson Square Ice Rink                              | nothing                                    |
| `35e6a45d` | Place        | —          | West End Ice Rink                                   | nothing                                    |
| `dc0e0f14` | Place        | —          | Kitsilano Ice Rink                                  | nothing                                    |
| `b59b9ccb` | Place        | —          | The Shipyards Skate Plaza                           | Venue photo                                |
| `7284bae9` | Place        | —          | Vancouver Curling Club                              | nothing                                    |
| `b22c24a0` | Place        | —          | Hillcrest Rink                                      | nothing                                    |
| `bd99e813` | Place        | —          | PNE                                                 | Venue photo                                |

### Researched candidates for Vernon and Coldstream

A research pass over organiser, venue, ticketing and tourism sites
(2026-11-25; every URL fetched and decoded) is in
`proposals/m1126-image-candidates.json`, shaped for Atlas's `curate-media`
route:

- **Frostival 2026 Downtown Vernon — one real photograph, high confidence.**
  Tourism Vernon's own 1024×655 photo of Frostival 2025 on 30th Avenue,
  captioned by them for 2026. The town's biggest event this week.
- **Swan Lake Christmas Market** — the market's own photo collage
  (2014×984, past market, carries its logo). Medium.
- **Organiser key art (posters)** for 1940s Radio Christmas Carol, the Celtic
  Tenors, Stars on Ice (Vernon) and Cowboy Christmas 2 — honest and about
  this very show, but ADR 074 keeps posters from leading. Owner's call
  whether a poster beats a text card.
- **Nothing usable anywhere** for Sleigh All Day, Métis Crafters, Coldstream
  Light-Up, Festive Saturday Science (okscience.ca refuses every request),
  Shoparama, or the VCMS gala (text graphic only). These stay text cards;
  the only remaining route is asking the organisers.

No page stated usage terms; none is claimed. The dates the research flagged
as "one day off" were the brief's own UTC dates; Passport shows the local
dates, which match the ticket pages.

Atlas's own image work stands as follows (from Lodge reports, not re-checked
here): M1118 attached 8 publisher photos (Enderby parade, Big White, Kelowna
Winter Street Market, Mission Hill Festival of Trees…) and found no official
photo for most Vernon events; M1125 (the `event-pictures` continuation,
775 imageless served events) changed nothing and is waiting on owner
decisions.

## Making it continuous

Atlas already runs image enrichment continuously: the continuation engine
(ADR 125/128) measures `event-pictures` (775 today) and
`vernon-christmas-visibility`, and submits missions when it is idle. A
second media system in Passport would be the parallel system the brief
forbids. What Passport adds:

- **The audit is a committed tool** (`images.eval.test.ts` +
  `verification/image-urls.mjs`); any Christmas mission re-runs it in two
  commands against production.
- **Proposed for Atlas** (Atlas missions, not done here):
  1. Weight the `event-pictures` continuation by what Passport features:
     Christmas front-page and Discover finds in the priority towns first.
     The gap list above is that ranking for today.
  2. A served-picture health check: fetch every served hero, mark 404s,
     wrong content types and sub-600 px images, and fall back to the next
     media item rather than serve a dead URL (today's `d1cfd91a`).
  3. Record pixel size on served pictures, so a surface can prefer one big
     enough for a card.
  4. Resized renditions (or a sized proxy) so phones are not sent 2–4 MB
     originals.

## Decisions

- **HYPOTHESIS — pictures reorder the front page's four, but only within the
  town tier.** A first version let any pictured find within the radius lead
  (Vernon 4/4: Lake Country winery markets over Vernon's own events) and was
  rejected: a photo must not lift a find out of "here first" (doctrine §12,
  2026-11-14). Reverse: drop the `inTown` / `hasPicture` keys in `strongest`
  (`around.ts`), restoring M865's order.
- **HYPOTHESIS — a same-thing twin's own picture is this thing's picture.**
  It relies on `oneEach`'s existing "same name, same place" rule. Reverse:
  make `borrowPicture` return `card`.
- **ESTABLISHED — venue and organiser photos stay off Christmas cards**
  (launch QA finding 32, 2026-11-21). Showing them labelled would add ~6
  pictured cards in Vernon (Stars on Ice at Kal Tire Place, Festive Saturday
  Science at the Science Centre…); that is the owner's call, not this
  mission's.
- **ESTABLISHED — never an unrelated stock photo** (doctrine §12, 2026-11-13).
