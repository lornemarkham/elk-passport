# Arrivals — coworkers' real aircraft, live, on one map

> **Status: built on `feature/go-have-a-conference`, 2026-10-12.** Not merged,
> not deployed. Memory store only, so it is **closed outside development**
> (`src/lib/conference-arrivals/enabled.ts`) until it has a durable store; see
> [LABS-RELEASE.md](LABS-RELEASE.md).

`/conferences/{id}/arrivals` is the `arrivals` module. A member enters a flight
number, a date and (optionally) where they're flying from. If they choose to
share it, every other member sees them on a MapLibre map centred on the
conference's airport. When ADS-B shows the aircraft actually flying that flight,
their name sits on the real aeroplane, in its real position, and moves as
reports arrive.

## What it will and won't say

| The map shows                        | Only when                                                                                                                  |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| A coloured plane, "live"             | The aircraft was **identified** (below) and its last ADS-B position is current                                             |
| A plane gliding                      | Between two real reported positions, ending on the newer one. It never runs ahead of the latest report                     |
| A grey plane, "last seen 12 min…"    | It was identified, then the signal went quiet (oceans, remote land). Frozen at the last real position, with its age        |
| "Landed"                             | Reported on the ground at the airport, **or** (labelled "by the look of it") the signal ended ≤ 1,000 ft within 8 km of it |
| A dashed line, no plane              | A planned route from the departure airport. Shown for flights not yet identified and for ones on another day               |
| "Waiting to identify your aircraft." | Anything short of identification, with the reason in one sentence, and the checks behind it on tap                         |

Nothing is simulated. No position is ever computed from a timetable.

## Identification: a flight number is not an aircraft

`src/domain/conference-arrivals/` is pure and tested against payloads recorded
from the live API.

1. **Read the number** (`flight.ts`): `AC 0855`, `ac855`, `ACA855` and
   `Air Canada 855` all become `AC855`.
2. **Candidate callsigns** (`airlines.ts`, `flight.ts`): the airline's ICAO
   designator plus the number (`ACA855`). For regionals, the operators who
   usually fly that airline's numbers in that range: `AC8123` → `JZA8123`,
   `DL3584` → `SKW3584`, `EDV3584`, `RPA3584`. At most four.
3. **Search**: ADSB.lol live data for each callsign, plus the public route
   record for it (VRS standing data, published by ADSB.lol). An operator
   callsign is only looked up live if its route record ends at the conference
   airport, because it can't count otherwise.
4. **Decide** (`matching.ts`). An aircraft is identified only when **all** of
   these pass, and exactly one aircraft passes:

   | Check    | Passes when                                                                                                                        |
   | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
   | callsign | It broadcasts one of the candidate callsigns                                                                                       |
   | privacy  | It isn't in an aircraft privacy programme (FAA LADD / PIA). Those never get a name                                                 |
   | airborne | In the air, with a decoded position                                                                                                |
   | fresh    | That position is under 60 s old                                                                                                    |
   | date     | A flight on that local date could be in the air now (time zone from the departure airport's longitude, ±3 h, plus flight time)     |
   | corridor | Within max(150 km, 12% of the route) of the great circle from the departure to the conference airport, and between the two         |
   | heading  | Pointed within 70° of the airport. Within 60 km of it: descending or level, or else pointed at it (a departure climbing out fails) |
   | route    | The route record ends at the airport and includes the stated departure. **Required for operator callsigns**                        |
   | unique   | No other aircraft passes everything above                                                                                          |

   For the airline's own callsign a missing route record is acceptable. A
   record whose _destination_ differs (they go stale) is outweighed only once
   the aircraft is within 500 km of the airport and pointed at it. A record
   that contradicts the person's stated _departure_ is never outweighed: that
   is what a mistyped flight number looks like.

5. **Follow** (`tracking.ts`): once identified, the aircraft is followed by its
   transponder address (`hex`), not its callsign. If it starts broadcasting a
   different callsign, it's flying something else, and the person is let go.

### Seen on the night it was built (2026-10-12, 05:27–06:40 UTC)

| Flight                    | What ADS-B showed                                                                             | Result                                                                                                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WS 133 from YYC           | `WJA133`, C-GZWS, 2,700 ft, 18 km out, descending                                             | Identified                                                                                                                                                                   |
| B6 603 from JFK           | `JBU603`, 18,975 ft over the Fraser Valley                                                    | Identified                                                                                                                                                                   |
| UA 1580 from IAD          | `UAL1580`, route record IAD → ORD → YVR                                                       | Identified, followed on its last leg (ORD → YVR)                                                                                                                             |
| WS 133 "from YYZ"         | `WJA133` on final, route record YYC → YVR                                                     | **Refused**: right plane for the number, wrong for the person                                                                                                                |
| AC 1949 from YUL          | `ROU1949` (Rouge) 35 km south of YVR, descending; its route record says YUL → YYJ             | **Not matched**: never looked up live (an operator callsign needs a route record into YVR). Says "Nothing is broadcasting ACA1949…", which is true but doesn't mention Rouge |
| WS 322 "from YEG"         | `WJA322` at 27,225 ft, 3 km off the YEG → YVR line, pointed 172° away; route record YVR → YEG | **Refused**: "…it isn't heading for Vancouver." A departure, not an arrival                                                                                                  |
| AC 855                    | Nothing broadcasting `ACA855` in range                                                        | Waiting: "Nothing is broadcasting ACA855 within range…"                                                                                                                      |
| UAL1580 / WJA133 landings | Last reports 275 ft, 3 km out / 2,700 ft, 18 km out; then gone                                | Inferred landed / lost, last seen on approach                                                                                                                                |

### Why a flight stays unmatched

The sentence under "Waiting to identify your aircraft." is one of these:

- **Not flying yet / wrong day.** Nothing is asked of ADS-B before the date.
- **Nothing broadcasting the callsign in range.** Before departure, and over
  oceans and remote land where volunteer receivers can't hear. Long-haul
  flights into YVR are often invisible for hours, then appear over the coast.
- **Codeshare numbers.** `LH 6830` operated by Air Canada broadcasts an `ACA`
  callsign with a different number. Nothing free maps one to the other. The
  form says: use the operating airline's number.
- **Alphanumeric callsigns.** `SKW162Z`, `BAW8F`. No flight number becomes
  those.
- **Unknown airline.** The table (`airlines.ts`) covers carriers plausible
  into a North American conference. Typing the ICAO form (`ACA855`) works for
  any airline.
- **The evidence disagrees**: wrong route, wrong direction, a contradicting
  route record, a stale position, two aircraft that both fit. The checks are
  shown on tap.
- **The feed isn't answering** (rate-limited). Said as such, never as "nothing
  is flying".

## Privacy

Enforced in `board.ts` and `service.ts`, pinned by tests.

- **Members only.** Every read and write starts with the foundation's
  membership check. A stranger, a member of another conference, or anyone when
  the module is off, gets the foundation's 404 (the API answers 401 to someone
  with no identity at all, before any conference is looked at, so it reveals
  nothing).
- **Opt-in.** An unshared flight is visible only to its owner: not a plane, not
  a count. A shared flight also needs its owner to be _seen_ in the
  conference, so **sharing sets the foundation's `members` visibility under the
  name given**, and the checkbox says so.
- **What shared means**, in the checkbox's words: name, flight number, route,
  and the aircraft's live position. Organisers get nothing extra.
- **Stored per member:** the flight (number, date, optional departure),
  whether it's shared, and the ADS-B trail of the identified aircraft. Erased
  on leave, removal, deletion and expiry through `ConferenceLifecycle`.
- **Aircraft in privacy programmes are never named.**

## ADSB.lol: limits and licence

- **Licence: ODbL 1.0.** Attribution is on the map ("Aircraft: ADSB.lol
  (ODbL)"). ODbL's share-alike applies to a _derived database_ made public;
  Passport stores a few positions per member privately and erases them, which
  is not that. Worth a human read before anything is republished.
- **Terms**: free, no key today. The API's own description says "In the
  future, you will require an API key which you can get by feeding to
  adsb.lol" and "If you want to use the API for production purposes, please
  contact me". **Contact them before Oct 24.** Nothing was purchased.
- **Rate limits**: unpublished, no headers. Measured from this machine on
  2026-10-12: a 400 ms pace drew 429s within seconds; once penalised, even one
  call per 3 s failed; after a rest, 14 of 14 calls at one per ~5.5 s
  succeeded. The client therefore paces at one call per 2 s, backs off two
  minutes on a 429, caches live answers for 8 s, and coalesces.
- **What that means at 160 people.** One area query around the airport
  (`/v2/point`, 250 nm) serves every aircraft within ~460 km, which is the part
  of every flight anyone watches. Aircraft further out cost a call each: every
  30 s when identified, every 60 s while searching. Roughly **30 calls a minute
  is the ceiling**, so ~15–25 simultaneous in-window flights is comfortable,
  and on the busiest travel day searches will lag by minutes. Followed
  aircraft near Vancouver never lag.
- **Coverage**: ground receivers only. No mid-ocean positions.
- Routes come from `vrs-standing-data.adsb.lol` (static, GitHub Pages, cached
  12 h). The `api.adsb.lol/api/0/routeset` endpoint returned an empty 201 on
  2026-10-12. Route records are community-maintained and can be out of date.

## Recommendation: a complementary flight-status API

ADSB.lol answers "where is the aircraft calling itself X". It cannot answer
"which callsign is flight AC 855 on Oct 22", or anything before take-off. The
gaps that matter: codeshare numbers, scheduled times for "not flying yet",
delays, and identification over oceans.

**AeroDataBox, about $19/month** (direct Starter, 40k units; researched
2026-10-11 in `docs/sycle/flight-data.md` on `sycle-prototype`), is the
cheapest practical complement. Flight number + date returns scheduled and
revised times, the airports, a codeshare flag and the operating flight's ATC
**callsign**: exactly the missing bridge into the ADS-B search. The prototype's
adapter (`src/lib/sycle/providers/aerodatabox.ts`) is written and has never
seen a live response. Plugging it in would add one evidence row ("schedule
says this flight is `ACA855`"), not replace any. Spending is decision D5.

## Running it

```
CONFERENCE_SECRET=<32+ chars> CONFERENCE_STORE=memory CONFERENCE_GUEST_ORGANISERS=1 \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder \
  npx next start -p 3141
```

Create a conference in a town Passport knows, tick **Arrivals**, open a code.
`scripts/conference-arrivals/drive.mjs` drives the whole thing in Chromium
against whatever is flying and saves screenshots to `arrivals/`.

## Files

```
src/domain/conference-arrivals/  flight, airlines, adsb, geo, matching, tracking, board (pure)
src/lib/conference-arrivals/     ADSB.lol client, airports, store, tracker, service
src/components/conference-arrivals/  board, MapLibre map, your-flight form, words
src/app/conferences/[id]/arrivals/   the page
src/app/api/conferences/[id]/arrivals/  GET board · PUT/DELETE me
scripts/conference-arrivals/     build-airports.mjs (OurAirports, public domain), drive.mjs
```
