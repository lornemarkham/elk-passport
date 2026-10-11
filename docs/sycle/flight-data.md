# Flight-data providers, for the Sycle pilot

Researched **2026-10-11**. **[V]** means the fact was checked against the
provider's official pricing page, spec or licence on that date. **[S]** means
it came from search results or third parties and may be out of date. No
accounts were created and no keys were used.

## Comparison

| Provider                                          | Flight no. + date, future dates                                        | Live position                           | Ocean coverage                                                                              | Price for this pilot                                                                                         | Commercial use / terms                                                                                      |
| ------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **AeroDataBox**                                   | Yes (IATA/ICAO/callsign), past and future [V]; `codeshareStatus` [V]   | `withLocation=true`, "if available" [V] | Community ADS-B, so mid-ocean gaps (inferred)                                               | Direct Starter **$19/mo for 40k units**; a status call is 2 units [V]. RapidAPI Pro $8/5k, Ultra $40/50k [V] | Allowed on paid plans. Cache at most **7 days** (Terms §5.5) [V]. Live times only at "tracked" airports [V] |
| **FlightAware AeroAPI**                           | `/flights/{ident}` covers −10 to +2 days [S]; `/schedules` beyond that | `/position` $0.010 [V]                  | Best available (Aireon satellite ADS-B) [V]. Whether Standard includes it is **unverified** | Personal: $5 credit, **no commercial use** [V]. Standard: **$100/mo minimum** [V]                            | Store raw data ≤ 30 days; attribution required [V]                                                          |
| Aviationstack                                     | Yes; future dates on paid plans only [V]                               | Sparse `live` object [S]                | Weak                                                                                        | Free 100/mo, non-commercial; Basic $49.99/10k [V]                                                            | HTTPS on all plans [V]                                                                                      |
| AirLabs                                           | Yes [S]                                                                | Yes, 5–10 min delay [V]                 | Partly model-based                                                                          | About $49/25k [S, pricing page 404'd]                                                                        | Unverified                                                                                                  |
| Flightradar24 API                                 | No future-schedule endpoint found [S]                                  | Yes [S]                                 | Unverified for the API                                                                      | Explorer $9/30k credits [S]                                                                                  | Explorer looks hobby-only [S]                                                                               |
| Cirium / OAG                                      | Best for schedules, codeshares and connections                         | Cirium yes / OAG no                     | Good                                                                                        | Sales contract                                                                                               | Enterprise. Overkill for 160 people                                                                         |
| OpenSky, ADS-B Exchange, adsb.lol, airplanes.live | **No schedules**, positions only                                       | Yes                                     | Ground receivers, so ocean gaps                                                             | Free / cheap                                                                                                 | Mostly non-commercial; adsb.lol is ODbL with attribution [S]                                                |

## Answers to the mission's questions

- **Real-time aircraft positions:** available from several providers, but
  over oceans only from satellite ADS-B (FlightAware/Aireon), and even there it
  is unverified that the Standard tier includes it. Most of these flights are
  long-haul over the Pacific or the Atlantic. **The pilot does not show live
  positions.** The board can draw one if a provider reports it (filled plane,
  less than 20 min old), but that is not the plan.
- **Pricing:** AeroDataBox, about $19–40 for the event month. AeroAPI, about
  $100–120.
- **Lookup reliability:** flight number + departure date works on both
  primary candidates for future dates. A number can match several flights
  (multi-sector, codeshares), so the person **confirms** theirs from the
  returned list instead of the code guessing.
- **International coverage:** good on both for schedules. AeroDataBox's live
  times depend on the airport being "tracked". Check the main origin airports
  once a key exists (`/health/services/airports/{icao}/feeds`).
- **Delays:** both report revised times; the board marks them as estimates.
- **Connecting flights:** no self-serve API takes an itinerary. Each leg is
  its own flight number and date. **The MVP asks for the leg that lands at
  YVR.** Multi-leg journeys are a follow-up.
- **Codeshares:** shown as "operated as …" when the provider flags them. The
  mapping of the operator's number is unverified until there is a live payload.
- **Is scheduled/estimated progress viable?** Yes, if it never looks like
  tracking. The board computes it only after a **confirmed** departure, shows
  it as "about 62% of the way, by the clock" with a hollow marker, and
  explains it in the legend. Real routes follow jet streams and oceanic
  tracks and can be hundreds of km off a great circle, which is why the
  number is a fraction and not a claim about position.

## Volume and polling

Assumption: about 160 people × 1.3 legs ≈ **210 legs**. There is one cached
record per leg, shared by every viewer, and a viewer's page load never causes
a provider call (`src/domain/sycle/refresh.ts`):

| Window                          | Interval |
| ------------------------------- | -------- |
| more than 24 h before departure | 24 h     |
| 24 h – 4 h                      | 2 h      |
| last 4 h, or late               | 15 min   |
| in the air                      | 30 min   |
| within 1 h of landing           | 10 min   |
| landed / cancelled              | never    |

That works out to about 57 calls per leg, so **12–15k calls** in total, which
is about **30k AeroDataBox units**.

## Sources

- https://aerodatabox.com/pricing/ · https://aerodatabox.com/terms/ · https://doc.aerodatabox.com/docs/openapi-rapidapi-v1.json
- https://www.flightaware.com/commercial/aeroapi/ · https://www.flightaware.com/commercial/aeroapi/AeroAPI_Standard_License.pdf · https://flightaware.com/commercial/aireon/
- https://aviationstack.com/pricing · https://airlabs.co/ · https://fr24api.flightradar24.com/docs/credit-overview
- https://developer.flightstats.com/getting-started/ · https://www.oag.com/knowledge/how-am-i-charged-for-using-flight-info-api
- https://www.adsbexchange.com/community/developer-hub/

Not verified: FR24 pricing and terms (pages need JS), AirLabs and FlightAPI.io
current pricing (404s), AeroAPI Standard satellite coverage, Aviationstack
`live` quality.
