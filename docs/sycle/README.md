# Sycle arrival board — pilot

`/sycle`: a private, opt-in arrival board for ~160 Sycle colleagues flying into
Vancouver for the conference, with GO HAVE A DAY waiting on the other side.

**Status (2026-10-11):** working prototype on demo flights. **Not deployed.**
Shipping it by **2026-10-24** needs the decisions and setup listed under
[Before it can ship](#before-it-can-ship).

---

## What already existed

Passport had **no conference concept**. A search for "conference" and "sycle"
across `src/`, `docs/` and `archive/` turned up only a passing mention in
`about/idea-atlas`. The relevant pieces were:

| Existing capability                                      | Used here?                                               |
| -------------------------------------------------------- | -------------------------------------------------------- |
| `/go` — GO HAVE A DAY (`readBrief` → `buildDay`)         | **Yes** — Priority 2 is `/go`'s engine and `/go` itself  |
| `listDiscoveryCandidates` + `defaultFeed` (Atlas corpus) | **Yes**, through the same path `/go` uses                |
| `destinationFor` entity pages                            | **Yes** — adventure cards link to them                   |
| `townById("vancouver")`                                  | **Yes**                                                  |
| Board invites (`passport_board_invites`)                 | No. They are per-board and need accounts (see access)    |
| Supabase auth / `currentUser`                            | No. See [access](#access-is-a-code-not-an-account)       |
| Experience domains (`experience-domains.ts`)             | No. Doctrine §10/§15.1 is open, so this is a plain route |

## The MVP — smallest thing worth shipping on Oct 24

1. **A gate.** One conference code, which gives you a signed httpOnly cookie.
2. **Your flight.** Enter the flight number and departure date, pick the
   matching flight that lands at YVR, then choose how you appear: **Just me**
   (the default), **Anonymously**, or **By name**. You can change it, remove
   the flight, or delete everything about yourself.
3. **The board.** A world map centred on YVR (azimuthal equidistant: every
   route is a straight line into the centre, and the rings are true distance).
   It shows an arrivals list, your countdown, the next colleague's countdown,
   and on-the-way / in-Vancouver / cities counts.
4. **Landing.** "You made it. Welcome to Vancouver." Then: **What do you want to
   do in Vancouver?** Four doors open `/go` with a sentence already filled in,
   plus **shared adventures**: `/go`'s own picks for Vancouver, each with an
   "I'm in" button and a who's-in line.

**Deliberately not in the MVP:** connecting itineraries (enter the leg that
lands at YVR), live aircraft positions, notifications, per-person invites,
organiser tools, chat.

## Honesty rules

The mission said _do not fabricate live aircraft positions_. The board applies
that to every claim it makes about a flight (`src/domain/sycle/flight.ts`):

| The board says                               | Only when                                                           |
| -------------------------------------------- | ------------------------------------------------------------------- |
| **In the air**                               | The provider reported an actual departure or a departed status      |
| **Landed**                                   | The provider reported an actual arrival or a landed status          |
| **Should be on the way — not confirmed yet** | Departure time has passed but nobody has reported it                |
| `14:20 est.` / `14:20 sched.`                | Every time that has not happened is marked with its basis           |
| Hollow plane + "by the clock"                | Position interpolated from times. Never called live                 |
| Filled plane                                 | A provider-reported position less than 20 min old (none in the MVP) |
| **DEMO** banner and badges                   | Any record from the demo provider                                   |
| "checked 12 min ago"                         | Always, so a stale record reads as stale                            |

## Privacy

Enforced in `boardFor` (`src/domain/sycle/board.ts`) and pinned by tests.

- **Opt-in:** "Just me" is preselected. An `off` person is not a row and is not
  counted for anybody else.
- **No roster:** the page is behind the code, `noindex`, and not in navigation.
  Anonymous rows show the city but no name, and the UI warns that a lone city
  can identify someone.
- **No itineraries:** nobody else ever receives your flight number. Others see
  your city, phase and landing time.
- **No location tracking:** the board never handles a person's location. It
  draws aeroplanes between airports. Once landed, a person is "in Vancouver".
- **Stored data:** a random id, an optional display name, a visibility, one
  flight number and date, and the Atlas ids you said "I'm in" to. No email,
  employee id or phone number.
- **Deletion:** "Delete everything about me" removes the record and the cookie.
  Not hidden; gone.
- **Expiry:** `SYCLE_DATA_EXPIRES_AT` erases every participant, enforced on
  every read rather than by a cron that could be forgotten. Flight records go
  7 days after fetch (the AeroDataBox caching limit) or as soon as nobody
  references them.

### Access is a code, not an account

A conference code is the gate, and a signed cookie is your identity. Nobody has
to sign up before seeing a single aeroplane. The trade-offs:

- Anyone holding the code is in, which is why flight numbers are never shared.
- Lose the cookie (new phone, cleared browser) and your entry is orphaned until
  expiry. **Per-person invite links** would fix this. That is the main
  follow-up if the organisers can produce 160 links.
- Wrong codes are rate-limited per address, per instance. It is best-effort.

## Flight data

The full research, with sources and dates, is in [`flight-data.md`](flight-data.md).
In short:

- **Primary: AeroDataBox** (direct Starter about **$19/mo** for 40k units, or
  RapidAPI). It covers flight number + date, future dates, worldwide coverage,
  delays, cancellations, diversions, codeshare flag, airport coordinates and
  commercial use. The adapter is written; **it has never seen a live
  response**, because there is no key in this checkout.
- **Fallback: FlightAware AeroAPI Standard** (minimum **$100/mo**).
- **Live positions: no.** Community ADS-B goes dark mid-Pacific and
  mid-Atlantic, which is where most of these flights spend most of their time.
  The board shows schedule-based progress and labels it.
- **Expected volume:** about 210 legs × ~57 polls ≈ 12–15k calls in total.
  Viewers never trigger calls (`refresh.ts`).

## Before it can ship

**Decisions a human must make**

1. **Conference dates.** These set `SYCLE_DATA_EXPIRES_AT`. The dev default
   is 2026-11-30, a placeholder.
2. **Durable store.** The memory store is correct for one process. On Vercel,
   each instance has its own memory, so people would see different boards and
   lose data on cold starts. Options:
   - (a) the Supabase tables in [`proposed-schema.sql`](proposed-schema.sql),
     accessed server-side. This needs a privileged key, which conflicts with
     `createSupabaseServerClient`'s anon-key-only rule, so it is a conscious
     exception to approve or refuse;
   - (b) Vercel KV / Upstash Redis;
   - (c) a single long-running Node host with `SYCLE_STORE=memory`.

   Production refuses to open until `SYCLE_STORE` is set, so this cannot ship
   by accident. Whichever is chosen, implementing `SycleStore`
   (`src/lib/sycle/store.ts`) is about 80 lines.

3. **Shared code vs. per-person links.** See above.
4. **Provider and spend.** Approve AeroDataBox at about $19–40 for one month.
5. **Domain.** Keep `/sycle` on the Passport host, or give it an experience
   domain. Doctrine §10 / §15.1 is open, so this pilot did not choose.

**Setup (once decided)**

```
SYCLE_ACCESS_CODE=…            # what goes in the welcome email
SYCLE_SECRET=…                 # ≥ 32 random chars
SYCLE_DATA_EXPIRES_AT=…        # e.g. 2026-11-07T08:00:00Z
SYCLE_FLIGHT_PROVIDER=aerodatabox
AERODATABOX_API_KEY=…
SYCLE_STORE=…                  # once a durable store exists
```

**First steps once a key exists:** look up one flight that is in the air right
now, diff the payload against `aerodatabox.test.ts`, and replace that test's
documented fixture with the recorded response. Then check that the main origin
airports are AeroDataBox "tracked" airports, since live times are only
available there.

## Running it locally

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder \
  npx next dev -p 3120          # placeholders only so middleware.ts boots
open http://localhost:3120/sycle  # code: sycle-dev
```

Development uses the demo provider. Any flight number works, and its **last
digit chooses the phase**: 0–1 landed, 2–5 in the air, 6 delayed,
7 cancelled, 8–9 later.

## Files

```
src/domain/sycle/      projection, flight phases/honesty, board/privacy, refresh policy (pure)
src/lib/sycle/         config, access, store, service, adventures (→ /go), providers/
src/app/sycle/         the page
src/app/api/sycle/     access · lookup · me · board · adventures
src/components/sycle/  board UI, map, words, baked coastline (world.ts)
scripts/sycle/         build-world.mjs: regenerates world.ts from Natural Earth
```
