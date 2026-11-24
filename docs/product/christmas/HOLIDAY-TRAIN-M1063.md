# CPKC Holiday Train and what else Atlas missed: M1063 (2026-11-23)

Owner brief "P0 — CPKC HOLIDAY TRAIN + CHRISTMAS DISCOVERY". The brief names
the **atlas** workspace. It was dispatched to **passport-christmas**, which may
not write to Atlas (`CLAUDE.local.md`). This lane therefore did three things.
It measured what Atlas holds. It made the one Passport fix that is Passport's.
It wrote the verified research below as Atlas's worklist. **No Atlas record was
created or changed.**

Measured against the live production Discovery pool on 2026-11-23, using
`node ~/scratch/m817/tools/prod-corpus-discovery.mjs prod.json
https://gohaveaday.com`. The pool held 6,910 candidates. The pool is what
Passport is served. Atlas may hold records the pool does not expose.

## 1. Holiday Train: what Atlas has

| id       | stop (as Atlas names it)                       | Atlas start (UTC) | matches CPKC?                                    | geography                              |
| -------- | ---------------------------------------------- | ----------------- | ------------------------------------------------ | -------------------------------------- |
| 58f3a625 | CPKC Holiday Train (Leduc)                     | 2026-12-13 03:30  | yes: 20:30–21:00 MT, Dec 12                      | **unknown**: address in the text only  |
| 6935e653 | CPKC Holiday Train (Calgary, Anderson Station) | 2026-12-12 02:00  | yes: 19:00–19:30 MT, Dec 11                      | observed Calgary                       |
| a8c5986e | CPKC Holiday Train (Banff)                     | 2026-12-16 02:15  | yes: 19:15–19:45 MT, Dec 15                      | **unknown**: description is only a URL |
| c76895fc | CPKC Holiday Train (Metro Vancouver)           | 2026-12-19, day   | **no**: four stops over two nights in one record | observed "Metro Vancouver"             |
| b60eeea6 | Once Upon A Christmas & Heritage Holiday Train | 2026-12-05        | not CPKC (Heritage Park, Calgary)                | observed Calgary                       |

**Zero BC Interior stops.** Atlas has nothing for Golden, Revelstoke, Sicamous,
Canoe, Salmon Arm, Notch Hill, Chase, Kamloops, Savona, Ashcroft, Lytton or
Agassiz.

## 2. Holiday Train: the official 2026 BC schedule

The source is CPKC's own schedule PDF, headed "Canada Holiday Train Schedule /
Nov 21 - Dec 20, 2026":
<https://gis.cpkcr.com/arcgis/rest/directories/arcgisoutput/holidaytrain/canada_holiday_train_route.pdf>.
I re-read it myself with `pdftotext`. The page
<https://www.cpkcr.com/en/community/HolidayTrain> sits behind a bot challenge
and was not read; nobody tried to get around it.

Every stop has the same artists: **Sam Roberts Band and Owen Riegling**. The
PDF prints one "Event Time" window per stop. It prints no separate arrival time
and no time zone; the times read as local.

| date           | window      | stop                | location as printed (CPKC)                                                                            |
| -------------- | ----------- | ------------------- | ----------------------------------------------------------------------------------------------------- |
| Wed Dec 16     | 14:15–14:45 | Golden              | 7-11 Store, 10 Avenue (Mountain time)                                                                 |
| **Wed Dec 16** | 18:30–19:00 | **Revelstoke**      | Victoria Road                                                                                         |
| **Thu Dec 17** | 17:15–17:45 | **Sicamous**        | Highway 1 & Silver Sand Road                                                                          |
| **Thu Dec 17** | 18:45–19:15 | **Canoe**           | 50 Street & Canoe Beach Drive                                                                         |
| **Thu Dec 17** | 20:00–20:30 | **Salmon Arm**      | 51 Lake Shore Drive NE                                                                                |
| **Thu Dec 17** | 21:30–22:00 | **Notch Hill**      | 1639 Notch Hill Road                                                                                  |
| **Fri Dec 18** | 14:45–15:15 | **Chase**           | Shuswap Avenue & Ash Drive                                                                            |
| **Fri Dec 18** | 17:00–17:30 | **Kamloops**        | Sandman Center - Lorne Street. Tourism Kamloops prints "Sandman Centre Parking Lot, 300 Lorne Street" |
| Fri Dec 18     | 19:05–19:30 | Savona              | Savona Access Road & Savona Street                                                                    |
| Fri Dec 18     | 20:45–21:15 | Ashcroft            | Railway Avenue between 4 & 5 Street                                                                   |
| Sat Dec 19     | 11:30–11:55 | Lytton              | Station Road                                                                                          |
| Sat Dec 19     | 17:45–18:15 | Agassiz             | Agra Center, 6800 Pioneer Avenue                                                                      |
| Sat Dec 19     | 20:00–20:30 | Haney / Maple Ridge | Across from Billy Miner Pub                                                                           |
| Sat Dec 19     | 21:05–21:35 | Pitt Meadows        | Harris Road & Advent Road (Atlas's Vancouver record)                                                  |
| Sun Dec 20     | 17:15–17:45 | Port Moody          | 300 Ioco Road                                                                                         |
| Sun Dec 20     | 18:45–19:15 | Port Coquitlam      | Kingsway Ave between Mary Hill Road & Wilson Ave (Atlas's Vancouver record); the last stop            |

**Free admission.** For 2026 it is printed only by Tourism Kamloops ("FREE to
watch, food bank donations encouraged") and Destination Vancouver ("Admission:
Free"). The CPKC release and the PDF do not say "free" for the other stops.

**Food bank.** CPKC's 2026-10-13 release asks people to "bring a cash donation
or non-perishable food item", and says it stays local. **No 2026 official
source names a beneficiary for any of the seven priority stops.** Earlier
years' beneficiaries, from news coverage only, are in the research file. They
are not verified for 2026.

**Coordinates: not supplied.** CPKC's ArcGIS server publishes the route only.
`HolidayTrain/CPKC_Holiday_Train_Route/MapServer/1` is a polyline with fields
`Route`, `Shape`; there is no stop-points layer. Five locations are
intersections, one is a bare street name (Revelstoke) and two are street
addresses. Placing them is Atlas's geocoding, from those printed strings. This
lane wrote no coordinates.

Detail, conflicts and every URL read are in
[`research/m1063-holiday-train-bc.md`](research/m1063-holiday-train-bc.md):

- Tourism Kamloops says "4:30pm".
- A Castanet Revelstoke piece carries 2025's time.
- kamloops.ca still shows 2023.

## 3. Why Atlas did not surface it

1. **The Shuswap and the Thompson are outside Atlas's coverage.** In the live
   pool, Revelstoke, Sicamous, Chase and Kamloops have **0 records of any
   kind**. Salmon Arm has 5 places and 0 events. Seven of the brief's seven
   priority stops are in towns where Atlas has no events at all.
2. **CPKC is not a source.** Atlas has the train only where a municipal or
   tourism calendar it already reads lists it (leduc.ca, visitcalgary.com,
   banff.ca, destinationvancouver.com). CPKC's own schedule is one machine-readable
   PDF covering every stop on both routes. Atlas does not read it.
3. **One listing for many stops becomes one record.** Destination Vancouver's
   four stops over Dec 19–20 became a single day-precision "Metro Vancouver"
   event, which no person can attend as described.
4. **An address in the description is not read as a place.** Leduc's record
   prints "4401 Rollyview Road" and stays geography `unknown`. Banff's
   description is only a URL.
5. **Passport (fixed here):** all five train records read as Christmas but
   under **no category**. "Holiday train" was not a word for any of the seven
   categories, so no category chip ever showed them. See §5.

## 4. What else is missing (North Okanagan, Shuswap, Kelowna)

An agent researched 56 events. A page printing 2026 confirms 41 of them as
VERIFIED; [`research/m1063-regional-events.md`](research/m1063-regional-events.md)
has every URL and every reason a row is UNVERIFIED. They were matched to the
live pool by name, then each miss below was checked by keyword.

**Already in the pool** (VERIFIED events):

- SilverStar Light Up, 12 Days of Holidays, Santa Ski Day, Carol Service,
  Gingerbread Nights and New Year's Eve. Most are `conflicting`; that is M1059's
  Atlas table.
- Big White Twinkling Trail, Santa's Workshop, Christmas Eve Festival, New
  Year's Eve and Fireworks.
- Downtown Kelowna Winter Street Market & Light Up, and Rutland Light Up.
- Craft Culture Holiday Market.
- Vernon: the Nutcracker (Mission Dance), Celtic Tenors, Cowboy Christmas 2, A
  1940s Radio Christmas Carol, Stars on Ice, the Swan Lake Christmas Market and
  Frostival.
- Armstrong "A Little Christmas Magic".
- Enderby Christmas Parade.
- Coldstream Light-Up.
- Kettle Valley Steam Railway's Christmas Express (Summerland).

**Not in the pool: Atlas's worklist, best first.** Every row is VERIFIED in
the research file unless it says otherwise.

| #   | event                                                                      | town                          | date (2026)                                                 | why it matters                            |
| --- | -------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------- | ----------------------------------------- |
| 1   | CPKC Holiday Train, 7 priority stops + 8 other BC                          | Revelstoke–Kamloops           | Dec 16–20                                                   | the brief; free; national tradition       |
| 2   | Parade with a Purpose                                                      | Kelowna                       | Sat Dec 5, 6–7 pm                                           | Kelowna's downtown Christmas parade       |
| 3   | Sicamous Christmas Light Up Parade                                         | Sicamous                      | Sat Dec 5, 6 pm                                             | town has 0 Atlas records                  |
| 4   | Forage General's Yuletide Village                                          | Salmon Arm                    | Nov 27–29, free                                             | Salmon Arm has 0 events                   |
| 5   | Okanagan Symphony "Freya & Friends"                                        | Kelowna / Vernon              | Dec 18 7:30 pm; Dec 20 2 pm                                 | OSO absent from the pool entirely         |
| 6   | Christmas sleigh rides, Ottercrest Farms                                   | Armstrong                     | 16 dates, Dec 11–30                                         | a real outing, bookable                   |
| 7   | NONA Lights for Kids / John Christmas Light Tour                           | Vernon, Coldstream, Armstrong | Dec 1–31                                                    | a lights tour; overlaps our Lights Map    |
| 8   | Mission Hill Festival of Trees                                             | West Kelowna                  | Nov 20 – Jan 3                                              | the pool's "Festival of Trees" is Canmore |
| 9   | Welcome to Winter (Big White)                                              | Big White                     | see file                                                    | resort's opening festival                 |
| 10  | Light Up The Ice! (SilverStar)                                             | Silver Star                   | see file                                                    |                                           |
| 11  | Eagle Valley Arts Council Christmas Market                                 | Sicamous                      | see file                                                    |                                           |
| 12  | Santa Splash / Free Holiday Skate                                          | Salmon Arm                    | see file                                                    |                                           |
| 13  | Oh Come All Ye Soulful                                                     | Lake Country                  | see file                                                    | Lake Country's only 2026 find             |
| 14  | Vernon Community Singers (Welcome Yule!), Songs of Christmas, Andrew Allen | Vernon                        | see file                                                    | VPAC season is only partly in Atlas       |
| 15  | Cars & Toys: Santa's Supercar Parade                                       | Kelowna                       | see file                                                    |                                           |
| —   | Caravan Farm Theatre "The Hockey Sweater"                                  | Armstrong                     | Dec 1 – Jan 17 (UNVERIFIED: no year printed)                | the region's signature winter show        |
| —   | O'Keefe Ranch Cowboy Christmas Dinner Show                                 | Spallumcheen                  | Dec 11–12 on Ticket Seller; the ranch says no winter events | conflict: ask the organiser               |

Mistaken name matches were checked and are not counted as present:

- the Sicamous parade matched a Big White glow-stick parade;
- Lake Country's Santa's Workshop matched Big White's;
- Big White's "Ski with Santa" matched SilverStar's "Santa Ski Day".

## 5. What Passport changed

`src/domain/christmas/themes.ts`: **Winter festivals** now recognises the words
_holiday / Christmas / Santa train(s)_, _train of lights_ and _Polar Express_,
read from the name or Atlas's type. On the live pool, those five records gain
the chip and no other record changes; The Train Station Pub stays out
(`christmas.test.ts`, "finds a Christmas train under Winter festivals").

**Integrating with main:** `main` (M1053) added `fireworks?|boxing day` to the
same `words` line and `fireworks?` to `called`. Keep both: `called` ends
`…|light[- ]?ups?|fireworks?|trains?)`, and `words` ends
`…|christmas (celebration|party)|fireworks?|boxing day|(holiday|christmas|santa) trains?|train of lights|polar express)`.

Passport did **not** add Holiday Train stops itself. Real events and places
stay Atlas's (doctrine §10, "Christmas opens on six ways", 2026-11-17), and a hand list would hide
the coverage gap rather than close it.

## 6. Atlas backlog (proposed, in order)

1. **Add CPKC's schedule PDF as a publisher source.** It is official, covers
   all of Canada, and is refreshed by CPKC. Make one Event per stop with the
   printed window and location, then geocode the printed location. Free
   admission and food bank should be stated only where printed.
2. **Split `c76895fc`** into its four stops at their printed times, using the
   Port Moody and Pitt Meadows addresses it already holds.
3. **Fill `a8c5986e` (Banff):** "CPKC Train Station on Railway Avenue".
   **Place `58f3a625` (Leduc):** "4401 Rollyview Road".
4. **Extend coverage to the Shuswap and Thompson**, at least Revelstoke,
   Sicamous, Salmon Arm, Chase and Kamloops. Use the municipal and tourism
   calendars named in the research files.
5. **Add the missing sources:** Okanagan Symphony, the full Vernon & District
   Performing Arts Centre season, Downtown Kelowna (Parade with a Purpose),
   Mission Hill, Caravan Farm Theatre, Ottercrest Farms, Shuswap Tourism and
   Lake Country.
6. Then re-run this audit (§7) and strike rows.

## 7. Re-running the measurement

```
node ~/scratch/m817/tools/prod-corpus-discovery.mjs prod.json https://gohaveaday.com
# then search prod.json candidates by name, e.g. /holiday train/i, and
# compare with the table in §2 and the worklist in §4.
```
