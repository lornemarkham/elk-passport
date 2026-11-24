# Christmas enrichment audit — M1059 (2026-11-23)

Measured against the **live production Discovery pool** (6,909 candidates, 1,516
events) with `node ~/scratch/m817/tools/prod-corpus-discovery.mjs out.json
https://gohaveaday.com`, then `HOLIDAY_CORPUS=out.json HOLIDAY_OUT=towns.txt
npx vitest run src/domain/christmas/m1059.eval`. The extract carries no Atlas
distance readings, so placement here is from coordinates only; Atlas's readings
(ADR 094) win on the live site and can only make a card _more_ placed.

## What Passport fixed

- **One card for one name spelt two ways.** `4ba336eb "Silver Star Annual Light
Up"` and `d1cfd91a "SilverStar Annual Light Up"` are the same night and
  showed as two cards. `titleKey` now ignores spaces, so they fold (test:
  `discover-repair.test.ts`, "one name spelt two ways").

## What is Atlas's to fix (Passport will not guess)

Season events (Nov 23 – Jan 3) that name one of our towns but Atlas holds as
`unknown` or `conflicting`, so Christmas keeps them under "location not
confirmed" (owner rule 2026-11-22):

| id       | date       | event                                               | Atlas state | what is wrong                                               |
| -------- | ---------- | --------------------------------------------------- | ----------- | ----------------------------------------------------------- |
| 4ba336eb | 2026-12-05 | Silver Star Annual Light Up                         | conflicting | venue Silver Star Mountain Resort has observed coordinates  |
| d1cfd91a | 2026-12-05 | SilverStar Annual Light Up                          | —           | duplicate of 4ba336eb                                       |
| 35f0e55e | 2026-12-31 | Silver Star New Years Eve Celebration               | conflicting | same venue                                                  |
| 6e8ac250 | 2026-12-31 | New Years Eve (SilverStar Village)                  | observed    | same night as 35f0e55e, different name: probable duplicate  |
| bcd6b5b3 | 2026-12-21 | 12 Days of Holidays                                 | conflicting | localities "Vernon" vs "Silver Star Mountain" for one venue |
| 00280a64 | 2026-12-20 | Gingerbread House Making Nights (Dec 19)            | conflicting | same venue                                                  |
| 40feccbf | 2026-12-27 | Gingerbread House Making Nights (Dec 26)            | conflicting | same venue                                                  |
| b0b4dc04 | 2026-12-21 | Comedy Hypnosis Show                                | conflicting | same venue                                                  |
| eb21dc26 | 2026-12-27 | Salomon Rail Jam                                    | conflicting | same venue                                                  |
| b7d3712e | 2026-12-04 | Craft Culture Holiday Market at Prospera Place 2026 | unknown     | Kelowna; venue Prospera Place named in the title            |
| f9a2ccd3 | 2026-12-05 | Winterfest (City of West Kelowna)                   | unknown     | West Kelowna                                                |
| eb197518 | 2026-11-26 | Opening Weekend at Big White                        | unknown     | Big White                                                   |
| fb6b7490 | 2026-11-30 | Stories & Sweets: Gingerbread Party                 | unknown     | description names Lake Country                              |
| fb422701 | 2026-11-16 | Vancouver Christmas Market 2026                     | unknown     | Vancouver; the biggest market in the metro has no place     |
| 4757d090 | 2026-12-13 | Have a COOL YULE with Lions Gate Chorus & VanCity … | unknown     | Vancouver                                                   |
| c35b2720 | 2026-11-26 | Surrey Civic Plaza — Skating at the Plaza           | unknown     | Surrey                                                      |

Also conflicting and **not** ours: four Charlottetown/Metro Vancouver events
(`07cafb4a`, `b808e40b`, `3fecc2a7`, `616cfbe8`, `11858696`, `cefb45e9`) whose
evidence names two cities — Atlas's venue linking has crossed them.

Counts: 141 of 613 season-relevant events have no geography at all; the 9
Silver Star "conflicting" ones are one Atlas rule (a venue whose area is
Okanagan and whose locality is "Silver Star Mountain") rather than nine
mistakes. **Proposal for Atlas:** treat locality-vs-area on one venue as
agreement, not conflict, and link events to the venue's coordinates.

Passport does **not** place these itself from the venue Place: ADR 094 makes
Atlas's reading the one source, and a Passport-side join would hide the Atlas
bug rather than fix it.

## Production

At the time of this audit production (gohaveaday.com/christmas/discover?at=vernon)
does not yet carry M1046 or M1053: no "Coldstream Community Christmas Light-Up"
or "Silver Star Annual Light Up" card, no "Exact spot not listed" shelf.
Neither is merged to main from this lane; the runner ships `main`.

## Next batch (backlog, in order)

1. After M1046/M1053 ship: re-run the audit and confirm the Okanagan placed
   counts (Vernon 22 near + 6 worth the drive in the extract).
2. When Atlas reports on the table above, re-run and strike rows.
3. Events people can attend but Atlas has not got: needs organiser-page
   research (Atlas's lane); candidates are Coldstream, Lumby and Armstrong
   (the corpus has only Armstrong's Melodia Singers and a garage sale).
4. Images: of 613 season events, count those without `presentationImage`
   (Atlas subject-evidence rule).
