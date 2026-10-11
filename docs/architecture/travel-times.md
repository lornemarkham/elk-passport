# Travel times — what Passport needs from Atlas

**Status:** Passport's side is built and tested (lane `maps`, 2026-10-11).
Atlas serves nothing yet, so every surface below shows straight lines, labelled
as straight lines, until it does.

**Authority on the Atlas side:** elk-atlas ADR 097, _A travel time is a
routing provider's estimate, or nothing_ (proposed). Passport reads its
`TravelTimeReading` verbatim and adds no travel time of its own.

---

## ⚠ The `/travel/legs` contract does not exist yet

The mission brief referred to "Atlas's documented `/travel/legs` contract".
On 2026-10-11, elk-atlas `main` (e5e9ed6, the only branch on GitHub) has **no
such endpoint and no document describing one**. What Atlas does publish:

- ADR 097's `TravelTimeReading` (`estimated | unavailable | unsupported`) and
  `TravelDestination` (`{ id?, at: { lng, lat } }`);
- `TravelTimeProvider.matrix(origin, destinations, mode)`: one origin, many
  destinations;
- a recommendation to serve `travel` beside `distance` on
  `/discovery/candidates`.

So Passport's legs wire is a **proposal**. It lives in one file
(`src/lib/routing/atlasLegs.ts`: `LEGS_PATH`, `legsBody`, `legsAnswerFrom`).
If Atlas defines a different shape, only that file changes.

If the contract exists in an unpublished Atlas workspace, compare it with the
proposal below before anyone wires the two together.

---

## The two wires Passport speaks

### 1. Origin → many places (Discovery): `travel` on the candidate feed

Built in da6f007; unchanged here.

```
GET /discovery/candidates?lat=&lng=&unplaced=drop&travel=driving
  ← { candidates: [{ id, distance, travel?: TravelTimeReading, … }] }
```

- `lat`/`lng` are rounded to 2 decimals (~1 km) by Passport.
- A non-empty feed where **no** candidate carries `travel` is read as
  _not served_, never as "no route anywhere".
- Query parameter name `travel=` is Passport's proposal (`travelQuery()`).

### 2. Leg by leg (a day on `/go`): `POST /travel/legs`, PROPOSED

```
POST /travel/legs
Authorization: Bearer <ATLAS_SERVICE_TOKEN>
{ "mode": "driving" | "walking" | "cycling" | "transit",
  "legs": [ { "from": TravelDestination, "to": TravelDestination } ] }

200 { "legs": [ TravelTimeReading, … ] }   exactly one per leg, same order
404 / 405 / 501                             endpoint absent → Passport: not served
401 / 403                                   token problem   → Passport: failure
429 / 5xx / timeout                         temporary       → Passport: failure, retry offered
```

- A `TravelDestination` **with** an `id` is an Atlas subject, sent at 5
  decimals. **Without** an `id` it is a start point (a town centre, or a
  person) and is always sent at 2 decimals (~1 km). That rounding is enforced
  in `legsBody()` and again in the browser, so callers cannot skip it.
- A reading whose `mode` differs from the asked mode, or which lacks
  `provider`, `calculatedAt`, `limitations` or whole `minutes`, is shown as
  _unknown_ for that leg only.
- An answer whose `legs` array length differs from the question is refused
  outright: a time on the wrong leg is worse than none.
- At most 12 legs per request (a day has at most 5 stops, so 6 legs).

---

## Requirements for Atlas, in priority order

1. **Serve one of the two wires.** For `/go`, Passport needs leg-by-leg
   answers including **place → place**. ADR 097's `matrix(origin, …)` can
   answer each leg as a one-destination matrix whose origin is the previous
   stop. Confirm or replace the proposed path and envelope.
2. **Answer 404 (not 200 with nothing) while legs are not served**, and keep
   ignoring unknown query parameters on `/discovery/candidates`. Passport's
   "not served" detection depends on both.
3. **Send `unavailable` for a leg that cannot be routed**, never omit it.
4. **State attribution.** Passport credits by provider name: `osrm*` → OSRM +
   OpenStreetMap (ODbL); `ors*` / `openrouteservice*` → "© openrouteservice.org
   by HeiGIT · map data © OpenStreetMap contributors". Any other provider is
   credited by name, plus any `limitations` line containing "©" or "ODbL".
   Either keep provider names in those families or put the copyright line in
   `limitations` (as `OsrmTravelTimeProvider` already does). A dedicated
   `attribution` field would be cleaner; that is a proposal, not an
   assumption the code makes. **Confirm the ORS wording against the terms of
   the key Atlas registers.**
5. **Privacy at the provider.** A place-to-place sequence is an itinerary.
   Atlas should send the provider coordinates only (never Passport's request
   context), and should answer from its cache (`CachedTravelTimes`) where it
   can. Passport sends no user, session or name.
6. **Rate limits.** ORS's free plan is 500 matrix requests a day and 40 a
   minute. A `/go` day costs one Passport request per mode switch (cached
   privately for 5 minutes). Discovery costs one candidate-feed request per
   origin. Atlas's cache is the defence; Passport does not retry on its own.
7. **`/discovery/candidates?travel=` should be cheap when unserved.** Today
   Atlas ignores the parameter and returns the full feed, so Discovery makes
   one extra full corpus read per origin and learns only "not served". This
   is acceptable while the feed is cached, and is worth a flag or a fast
   path once Atlas serves travel.

---

## What Passport does with an answer

| Atlas says                                   | Passport shows                                                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `estimated`                                  | "14 min drive · 12 km by road (estimated by _provider_)"; limitations once under the day's total; attribution wherever shown |
| `estimated` + `accessCaution`                | the minutes with the caution on `/go`; **straight line** on a Discovery card, which has no room for the caveat               |
| `unavailable`                                | "No driving route found", with Atlas's reason; the total becomes _at least_ and names the leg                                |
| `unsupported`                                | "No walking times available"                                                                                                 |
| not served (404, or a feed without `travel`) | straight lines, each saying it is not a travel time, and a note that Atlas does not give travel times yet                    |
| failure (5xx, 429, timeout, unreachable)     | straight lines, "could not get travel times just now", and a **Try again** button                                            |

A day's total is summed **only** over routed legs. Nothing in Passport
converts kilometres to minutes.

---

## Testing locally without production Atlas

- Unit and component tests mock Atlas at `fetch`. Fixtures live in
  `src/lib/routing/fixtures.ts`:
  - `DRIVING_FROM_VERNON` comes from Atlas's real OSRM probe (except
    `monashee-backcountry`, which is labelled as constructed).
  - `LEGS_*_MOCK` contain place-to-place legs that **nobody measured**. Their
    provider is `MOCK-not-a-real-route` and they say so in `limitations`.
- To see real routes end to end, point `ATLAS_API_URL` and
  `ATLAS_SERVICE_TOKEN` at a **local** Atlas that has a provider configured
  and serves one of the wires above. No production Atlas is needed.
- With no Atlas at all, `/api/travel/legs` answers `503` with
  `Retry-After: 30`. `/go` itself cannot render, because its corpus read
  needs Atlas (that predates this work).
