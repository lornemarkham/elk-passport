# Arrivals — coworkers' real aircraft, live, on one map

> **Status (2026-10-20):** on `fix/conference-prod-crash` in `lanes/conference`.
> Not merged, not deployed. Durable Supabase store since 2026-10-14; on the
> durable conference store it opens only with `CONFERENCE_ARRIVALS=on`
> (`src/lib/conference-arrivals/enabled.ts`); see [LABS-RELEASE.md](LABS-RELEASE.md).
> 2026-10-20 added arrival times (scheduled, estimated, landed), the dark
> map, and the side-by-side board. Remaining blockers are at the end.

`/conferences/{id}/arrivals` is the `arrivals` module. A member enters a flight
number, a date and (optionally) where they're flying from. If they choose to
share it, every other member sees them on a MapLibre map centred on the
conference's airport. When ADS-B shows the aircraft actually flying that flight,
their name sits on the real aeroplane, in its real position, and moves as
reports arrive.

## What it will and won't say

| The map shows                          | Only when                                                                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| A coloured plane, "live"               | The aircraft was **identified** (below) and its last ADS-B position is current                                             |
| A plane gliding                        | Between two real reported positions, ending on the newer one. It never runs ahead of the latest report                     |
| A grey plane, "last seen 12 min…"      | It was identified, then the signal went quiet (oceans, remote land). Frozen at the last real position, with its age        |
| "Landed"                               | Reported on the ground at the airport, **or** (labelled "by the look of it") the signal ended ≤ 1,000 ft within 8 km of it |
| A dashed line, no plane                | A planned route from the departure airport. Shown for flights not yet identified and for ones on another day               |
| A time marked **Scheduled**            | The person typed it from their booking. Passport doesn't check it with the airline                                         |
| A time marked **~ Estimate**           | A **live** aircraft's distance to the airport at its current ground speed, straight in. Never from a stale position        |
| A time marked **Landed** / **Landed?** | The landing ADS-B saw, or (with `?`) the moment its signal ended on short final                                            |
| "Waiting to identify your aircraft."   | Anything short of identification, with the reason in one sentence, and the checks behind it on tap                         |

Nothing is simulated. No position is ever computed from a timetable.

## Arrival times: three kinds, never mixed (2026-10-20)

"Who's arriving when" is the board's first question. Before 2026-10-20 the
board couldn't answer it: it knew the date a flight leaves and, once ADS-B
had it, where the aircraft was, but never a time. Every time it shows now
carries its kind, in the same words on the list, in the details panel and in
the legend under the board (`arrivalTime` in `board.ts`, `timeCell` in
`words.ts`). That is doctrine §5 (signals, inference and stated facts stay
distinguishable), applied to flights:

| Kind          | Where it comes from                                                                                                                  | Shown as                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| **Landed**    | ADS-B: seen on the ground, or the signal ended ≤ 1,000 ft within 8 km (`Landed?`)                                                    | `14:05` · LANDED           |
| **Estimate**  | Only for a fresh `airborne` row: great-circle distance ÷ ground speed (≥ 100 kt), added to that report's own timestamp. An inference | `~14:35` · ESTIMATE, amber |
| **Scheduled** | The optional **Lands in Vancouver** field, `YYYY-MM-DDTHH:mm` at the conference's airport, exactly as typed                          | `14:20` · SCHEDULED        |
| (none)        | Nothing above: the day it leaves, said as that                                                                                       | `Oct 22` · LEAVES          |

- A **lost** signal estimates nothing; it falls back to the booking.
- The estimate tends to run early, because it is straight-line arithmetic:
  holding, the descent slowdown and the approach all make the real landing
  later. The legend says "Approaches take longer."
- With both an estimate and a booking, the details panel says "About 25 min
  behind schedule, by the estimate." Under 10 minutes: "About on schedule".
  More than six hours apart: nothing, because that's a booking for another
  day or leg, not a delay.
- The board is ordered by phase, then landing time; flights with no time go
  last on their day.
- **Date it leaves stays the identifier.** The brief asked for an _arrival_
  date. Flight numbers are dated by departure (by airlines, and by every
  schedule API checked), and identification (`flightWindow`) is built and
  tested on that. So the form asks for the day it leaves (required) and when
  it lands (optional, date and time). The landing must be within one day
  before (westbound across the dateline) to two days after the departure
  date. A human can overturn this; it is recorded here so it isn't silent.
- Stored inside the existing `record` jsonb (`flight.lands`), so **no
  migration**. Older records without it read as "no time". The database
  already refuses to let a colleague change anything but `tracking` on
  somebody else's row; `arrivals-attack.mjs` now checks the landing time
  specifically.

## How it looks (2026-10-20)

- **Map-first, dark.** OpenFreeMap's `dark` style, re-tinted after load toward
  a night chart: navy water, runways in amber. Faint distance rings at 50,
  150 and 400 km from the airport (geometry only). The airport is one lit
  amber badge, `YVR · VANCOUVER`.
- **Board beside the map** on wide screens (map sticky on the left, board on
  the right), stacked on a phone. Each row: time and its kind, name, flight, a
  status word (`LIVE` only for an identified aircraft with a position under
  two minutes old; `LAST SEEN`, `LANDED`, `LOOKING`, `NOT FLYING YET`), and a
  line of plain words.
- **Celebration, quietly.** The headline already says "Dana has landed."; a
  row that landed in the last 45 minutes also gets a `JUST LANDED` pill in the
  conference's colour. No confetti, no motion beyond the aircraft gliding
  between real reports.
- The map frames the airport and real aircraft within the part of the map
  that's actually on screen, and the attribution starts collapsed so it
  doesn't cover a phone's map (ADSB.lol is still credited in words under the
  board, and one tap away on the map).

Screenshots `arrivals/04-board-desktop-stubbed.png` and
`arrivals/05-board-phone-stubbed.png` were taken with the board API **stubbed**
(invented rows in recorded shapes) to show every state at once. They are not
real flights.

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

## Flight-data providers, compared (2026-10-20)

Prices and terms read from each provider's own pages on 2026-10-20 (desk
research; nothing was signed up for or bought). "Not verified" means exactly
that. Re-check before paying.

| Provider                     | Free tier                                                     | Cheapest paid                                                             | Flight number + date                                                    | Live positions                    | Arrival times                                                                                                             | Commercial use                                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ADSB.lol** (in use)        | Free, no key yet; unpublished rate limit (measured above)     | —                                                                         | Callsign → aircraft only                                                | Yes, community ADS-B              | None                                                                                                                      | Data dumps are ODbL. Live API terms not confirmed (docs site 503/403 on 2026-10-20); asks production users to get in touch, and a feeder-key is announced |
| adsb.fi                      | 1 req/s                                                       | —                                                                         | Callsign → aircraft                                                     | Yes                               | None                                                                                                                      | **"Personal, non-commercial use only"**, with credit. See below                                                                                           |
| airplanes.live               | 1 req/s                                                       | not checked                                                               | Callsign → aircraft                                                     | Yes                               | None                                                                                                                      | Non-commercial, no SLA (search snippet; page is JS)                                                                                                       |
| OpenSky                      | 4,000 credits/day registered (OAuth2 only now), 400 anonymous | Licence by negotiation                                                    | **No** callsign/flight-number lookup                                    | Yes                               | Historical only                                                                                                           | **Any for-profit use, and any operational use in a live product, needs a written licence**                                                                |
| **AeroDataBox** (API.market) | 7-day trial, 400 units, non-commercial                        | **Pro $7.50/mo, 5,000 units, commercial OK** (RapidAPI Pro $8; Pro 2 $15) | **Yes**: `/flights/number/{n}/{date}`, 2 units/call → ~2,500 lookups/mo | Coarse last-known `location` only | Scheduled, revised, predicted, runway; status (Delayed, Canceled, Arrived, Diverted); **ATC callsign and codeshare flag** | A consumer app showing number, time, status is allowed without their derived-work licence                                                                 |
| Aviationstack                | 100 req/mo, non-commercial                                    | Basic $49.99/mo, 10k req, commercial                                      | Yes (paid)                                                              | Partial (not verified)            | Scheduled/estimated/actual (not verified)                                                                                 | Free tier non-commercial                                                                                                                                  |
| FlightAware AeroAPI          | $5/mo usage, personal/academic only                           | **Standard $100/mo minimum** for commercial                               | Yes, $0.005/result set                                                  | Yes, $0.010/result set            | Scheduled/estimated/actual (not verified)                                                                                 | Uptime SLA only at $1,000/mo                                                                                                                              |
| Flightradar24 API            | None                                                          | Explorer $9/mo, 30k credits, 10 req/min                                   | Partial; no future schedules found                                      | Yes, with ETA and callsign        | ETA + actuals; no schedule/delay status found                                                                             | FAQ: commercial use allowed. Display/attribution rules not checked                                                                                        |
| AirLabs                      | Exists, quota not checked                                     | ~$19 per 10k queries (homepage; plans not verified)                       | Yes                                                                     | Yes                               | Not verified                                                                                                              | No reselling "as is"                                                                                                                                      |
| Cirium                       | —                                                             | Enterprise sales                                                          | Yes                                                                     | Yes                               | Yes                                                                                                                       | Not at this scale                                                                                                                                         |

Sources: each provider's pricing/terms page (openskynetwork.github.io/opensky-api,
opensky-network.org/about/terms-of-use, aviationstack.com/pricing,
aerodatabox.com/pricing + its API.market OpenAPI, flightaware.com/commercial/aeroapi,
fr24api.flightradar24.com/subscriptions-and-credits, airlabs.co,
github.com/adsblol/api, github.com/adsbfi/opendata).

All the ADS-B sources are ground receivers: none gives mid-ocean positions,
and none can say anything about a flight **before** it flies. Those flights
stay "waiting", never simulated.

**adsb.fi fallback vs its terms.** `ADSB_FALLBACK=adsbfi` (b28d871) is off by
default and must stay off while Passport is a commercial product: adsb.fi's
open data is personal, non-commercial use. Same for airplanes.live. Turning
it on needs their written permission first.

## Costs

|                                                | Today                        | With the recommended complement                                     |
| ---------------------------------------------- | ---------------------------- | ------------------------------------------------------------------- |
| Live positions                                 | **$0** (ADSB.lol)            | $0, or FR24 Explorer $9/mo if ADSB.lol becomes key-gated or says no |
| Map tiles                                      | **$0** (OpenFreeMap, no key) | $0                                                                  |
| Schedules, delays, codeshares, callsign bridge | none                         | **AeroDataBox Pro, $7.50/mo** (5,000 units)                         |

Rough AeroDataBox budget (estimate, not measured): one lookup when a flight
is saved, then about three on the day (morning, −3 h, −1 h), **shared by
everyone on the same flight + date** and cached. 160 people ≈ 640 lookups ≈
1,280 units: about three conferences a month on Pro, before deduplication.
Spending is still decision D5; nothing here is wired to a paid provider.

## Recommendation: a complementary flight-status API

ADSB.lol answers "where is the aircraft calling itself X". It cannot answer
"which callsign is flight AC 855 on Oct 22", or anything before take-off. The
gaps that matter: codeshare numbers, airline-scheduled times (today they're
only what the person typed), delays, and identification over oceans.

**AeroDataBox Pro** (above) is still the cheapest practical complement, and
cheaper than the ~$19/month noted on 2026-10-11. Flight number + date returns
scheduled and revised times, the airports, a codeshare flag and the
operating flight's ATC **callsign**: exactly the missing bridge into the
ADS-B search, and it would turn "Scheduled (their booking)" into
"Scheduled (airline)". The prototype adapter
(`src/lib/sycle/providers/aerodatabox.ts` on `sycle-prototype`) has never
seen a live response, so it was deliberately **not** wired in here: build it
against a real response once a key exists. Plugging it in adds evidence
rows, it doesn't replace any.

## Remaining blockers (2026-10-20)

1. **Production database:** `20261014000000_passport_conference_arrivals.sql`
   and `20261016000000_passport_conference_grants.sql` must be pasted into the
   production Supabase SQL editor (not `db push`), then `CONFERENCE_ARRIVALS=on`
   set on Vercel. No new migration on 2026-10-20.
2. **ADSB.lol production use:** they ask production users to get in touch,
   and a feeder-key is announced. Not contacted from here.
3. **adsb.fi fallback** must stay off (non-commercial terms), as above.
4. **Spending (D5):** AeroDataBox Pro $7.50/mo for airline schedules,
   delays and codeshares. Until then, times are what people type.
5. **Not verified against a real aircraft today:** the estimate and the new
   board states were checked with unit tests and with screenshots from a
   stubbed board API. `scripts/conference-arrivals/drive.mjs` against the
   live sky is the remaining check, best run on a travel day.
6. **ODbL** share-alike: a human read before anything is republished
   (unchanged).

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
