# Christmas events from Atlas (M1046, 2026-11-23)

Owner brief: _P0 — Christmas event discovery integration_. Make the Vernon and
Silver Star events Atlas published in mission 1042 discoverable on GoHaveADay
Christmas, without a Passport copy of any record.

## Why they were not visible

Measured on gohaveaday.com on 2026-11-23, from the page's own Discovery
payload (no credentials):

| Cause                                                                                                                                                                                           | Whose                        | State                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All 17 records are in `/discovery/candidates`, but every one has `geography: unknown`, no venue and no coordinates. Christmas never calls an unplaced listing near (2026-11-22).                | Atlas (venue linking, M1044) | Open. Until it lands they are counted behind "N listings don't say where they are" and shown only with `place=all`, among ~130 other unplaced listings. |
| 6 of the 17 never said "Christmas" — Stars on Ice _Holiday Tour_, _12 Days of Holidays_, the holiday rail jam, the hypnosis show "to kick off the holiday season", New Year's Eve, Paint & Sip. | Passport (`readChristmas`)   | Fixed for 5: in-season holiday words now count (`themes.ts`). Paint & Sip holds no holiday word and stays out.                                          |
| `?at=silverstar` was not a town Passport knew, so it silently meant Vernon.                                                                                                                     | Passport (`towns.ts`)        | Fixed: Silver Star village is a Discovery town, at the lights map's point and id.                                                                       |

Vernon, Coldstream, Armstrong, Lumby, Lake Country and Kelowna were already
towns.

## What the card says

Name, when (date and clock time as Atlas states them), where (venue and town,
else the organiser's stated location, else "Location not confirmed"),
description, price in the organiser's words, Directions (to Atlas's point,
else venue and town, else the stated address), and _Details & source_, which
opens `/passport/<id>` with Atlas's source link. The candidates feed carries no
official URL, so the card does not invent one.

No photograph → the text card (doctrine, 2026-11-13). M1042 deliberately did
not attach Tourism Vernon's generic stock image.

## Tests

- `src/domain/christmas/events.test.ts`: the 17 real records
  (`e2e/fixtures/christmas-events/m1042-as-published.json`, from production
  2026-11-23) and the same records with their town stood in for venue linking
  (`m1042-placed.json`).
- `e2e/christmas-events.spec.ts`: rendered cards on `/christmas/discover` for
  Vernon, Silver Star, Christmas Eve and the category chips. Recipe in its
  header (`E2E_CHRISTMAS_EVENTS=1`, atlas-mock on the placed fixture).
  Measured: 14 cards near Vernon (12 on opening, the rest behind _Show all_),
  9 within 5 km of Silver Star.
