# Go have a day — integration contracts and risk register

Mission 169, lane `domain`, 2026-10-11. **Evidence, not intent.** Product
authority is `docs/PASSPORT-PRODUCT-DOCTRINE.md`. The integration order is
`docs/product/GO-HAVE-A-DAY-ROADMAP.md` on `lane/vision` (INT-0 to INT-7).
This document does not replace that order. It states what crosses each seam,
what breaks, and what proves it.

Nothing here resolves an open question. Where a seam sits on one (doctrine §15,
roadmap D-1…D-15), it is named and left open.

---

## 0. What was measured

| Branch                       | Commit    | Ahead of main | State                                                                                              |
| ---------------------------- | --------- | ------------- | -------------------------------------------------------------------------------------------------- |
| main                         | `016854a` | —             | /go, /go/print (six-key day query), AnalogGuide                                                    |
| lane/domain                  | `8a01ddd` | 2             | Adventure contract (zod), feasibility, print codec, `adventureFromDay`                             |
| lane/vision                  | `22f9bc3` | 3             | Roadmap, docs only                                                                                 |
| lane/daybuilder              | `dcdabbf` | 1             | Talk-to-it /go, `keep`/`order`/`minutes`, rain plans, `carry.ts`                                   |
| lane/discovery               | `9582d62` | 2             | Ask Discovery, `?with=` → `/go`, its own `keep`                                                    |
| lane/maps                    | `d62ba73` | 2             | Travel captions, `POST /travel/legs` (proposed), `Journey`                                         |
| lane/analog                  | `16407ac` | 2             | `PrintableAdventure`, FieldGuide, own `/go/print` render                                           |
| lane/detox                   | `527c215` | 2             | Go Offline, `OfflineDay`, localStorage `ghad.offline`                                              |
| lane/boards                  | `62e9900` | 1             | Gathering, interest. **Plus uncommitted work** (plans, leave board): M168 is running there         |
| feature/go-have-a-conference | `f8b13ee` | 2             | Conferences, memory store, proposed schema                                                         |
| elk-atlas reference clone    | `e5e9ed6` | —             | GitHub main. ADR 097 seam; **no `/travel` route**                                                  |
| Atlas M144 / M145 / M147     | `32da743` | —             | `GET /travel/legs`, local Atlas main only, **not deployed**. Read from mission reports, not source |

Missions in flight while this was written: M168 (boards, shared adventures),
M170 (maps, routing quality), M172 (Atlas, entity quality), and M173 (queued).
**None of their work was modified.** `lane/boards`' working tree was only read.

### Trial integration (scratch clone, `/tmp/ghad-integration`, nothing fetched back)

Every lane was merged onto main in roadmap order. A lane was skipped if it
conflicted.

- **Merged cleanly, in this order:** domain, vision, conference, boards (committed only), detox, discovery, maps.
- **Skipped:**
  - analog: `src/app/go/print/page.tsx`
  - daybuilder: `go/page.tsx`, `go/print/page.tsx`, `DayItinerary.tsx`, `GoHaveADay.tsx`, `domain/day/build.ts`
- **On the merged result:** `tsc --noEmit` is clean. `vitest`: 2365 passed and 1 skipped (195 files).
- **Not run:** eslint, build and Playwright.

So the seven cleanly merging lanes do not break each other's types or tests.
**Every real hazard is in daybuilder, analog, and the Atlas boundary.**

Pairwise textual conflicts (`git merge-tree`). They agree with roadmap §2.2:

| Pair                   | Files                                                                 |
| ---------------------- | --------------------------------------------------------------------- |
| daybuilder × discovery | `go/page.tsx`, `GoHaveADay.tsx`, `domain/day/build.ts`                |
| daybuilder × maps      | `go/print/page.tsx`, `DayItinerary.tsx`, `GoHaveADay.tsx`, `build.ts` |
| analog × maps          | `go/print/page.tsx`                                                   |

---

## 1. The seams

```
                       Atlas knowledge (/discovery/candidates, /places, …)
                         │ unvalidated casts into src/lib/data/types.ts
                         ▼
   Discovery ──?with=ids, say, at, age, on──▶ Day Builder (/go, src/domain/day)
                                                 │ DayPlanned
            ┌────────────────────────────────────┼─────────────────────────────┐
            │ day query (/go/print?…)            │ dayLegs(day)                │ adventureFromDay
            ▼                                    ▼                             ▼
  Printables: AnalogGuide (main)       Maps: Atlas GET /travel/legs     Adventure (zod, v1)
              PrintableAdventure (analog)      (M144, not deployed)      print codec, remix
              OfflineDay (detox)                                           │
            │                                                              │ (no persistence yet)
            ▼                                                              ▼
  Shared adventures: passport_board_plans.day_query (boards, uncommitted, unmigrated)
  Conference experiences: /conferences (memory store)  ≠  /boards/conference/[slug] (boards)
```

**The day query is the de facto interchange format.** Nobody chose it. Every
printable, Go Offline and shared plans re-derive the day from it. The
`Adventure` contract exists but nothing outside this lane reads it.

---

## 2. Contracts, seam by seam

### 2.1 Discovery → Day Builder

- **Wire:** `/go?say=&with=<ids, ≤5>&at=&age=&on=`. `with` is on lane/discovery only.
- **Contract:** `with` ids are Atlas subject ids. Day Builder **keeps** them.
- **Incompatible:** `keep` was built twice.
  - **discovery:** kept stops pass the age and schedule rules. `without` beats `keep`. Failures become unknowns. At most 5 stops. The reason given is "You picked this in Discovery."
  - **daybuilder:** kept stops go in "whatever the filters now say". There is no rule check and no cap. `without` is not consulted for kept stops.
  - Roadmap INT-3 says "unify the two `keep`s". The meaning is a product call (doctrine §2.5, "leave everything else alone"). It is not decided here.
- **Build break on merge:** lane/discovery `answer.ts` imports `defaultRadiusKm` from `build.ts`. Daybuilder's `build.ts` does not export it. Taking daybuilder's side of the conflict breaks the build.
- **Owner:** the integration mission (INT-3).

### 2.2 Day Builder → Printables: the day query

Registry and tripwire: `src/lib/domains/integration/dayQuery.ts`.

| Key                         | Meaning                | Written by            |
| --------------------------- | ---------------------- | --------------------- |
| `stops say hours age at on` | the six core keys      | main                  |
| `b`                         | carried brief (JSON)   | daybuilder `carry.ts` |
| `mins`                      | minutes the person set | daybuilder            |
| `rain`                      | chosen rain plans      | daybuilder            |
| `by`                        | travel mode            | maps                  |

Readers that keep **only the six** are:

- detox `resolve.ts` (`DAY_QUERY_KEYS`);
- boards' plan canonicaliser (`DAY_KEYS`, uncommitted);
- analog's `/go/print`;
- this lane's `readPrintQuery`.

On the integrated app, an offline day or a shared plan would silently drop the
person's set minutes, rain plans, start and home-by times, and travel mode.

There are four render shapes for one day:

- `DayPlanned` → `AnalogGuide` (main, daybuilder, maps)
- `PrintableAdventure` (analog, via `printableFromDay`)
- `OfflineDay` (detox, via `snapshotDay`)
- `Adventure` (domain)

All four start from `DayPlanned`. **No printable reads `Adventure`.**

Analog's `/go/print` renders `PrintableAdventure` with **no `travel` and no
`forecast`**. If it wins the `go/print` conflict, the routed legs (maps), rain
plans and set minutes (daybuilder) disappear from paper. This is a silent
regression and no test catches it. Roadmap INT-5 and D-7 cover it.

`printable.ts:367` takes `minutesPerStop` from `stops[0]`. That is wrong once
daybuilder gives each stop its own minutes.

### 2.3 Day Builder / Adventure → Maps → Atlas: travel

The authority is Atlas. The full comparison is in §3. Passport's side is:

- `src/lib/domains/travel/contracts.ts`:
  - `travelTimeReadingSchema`: ADR 097 plus M144's `unrouted`, `beyond` and `transient`;
  - `ATLAS_TRAVEL_LEGS`: the real GET;
  - `PASSPORT_PROPOSED_LEGS`: the maps POST, marked superseded;
  - `travelLegsQuery`: rounds the origin itself;
  - `readTravelLegsAnswer`: one state per HTTP outcome.
- `src/lib/domains/travel/legs.ts`: `adventureTravelQuestion` → Atlas → `withTravel` → the unchanged `assessFeasibility`. This joins maps' `Journey` world to the Adventure's `Leg.travelMinutes: Reading<number>` world.

The travel shapes in Passport today:

- maps: `Journey`, `PlacedLeg`;
- analog: `RoutedTravel`, a hand-copied subset of `Journey`;
- domain: `Leg` (`Reading<number>`, `source.by: "routing"`);
- daybuilder: `MOVE_MINUTES = 15`, a buffer and not a drive time.

**Nobody converts km into minutes.** All five branches were checked.

The semantic clash is that daybuilder's per-stop minutes are already reduced by
15-minute move buffers. maps then **adds** routed minutes on top
(`describeTravelTotal`). On a merged day, travel is counted twice, as two
different models, side by side.

maps hides the "drive times unknown" line by **exact string match** on
`DRIVE_TIMES_UNKNOWN`. Daybuilder changed that sentence, so the line survives
even when every leg is routed.

### 2.4 Atlas knowledge → Discovery

**No Atlas response is validated.** Every read in `src/lib/data/atlas-repo.ts`
casts `response.json()`.

Version drift on the candidate grounding:

| Grounding   | Atlas `e5e9ed6` | Passport cites                |
| ----------- | --------------- | ----------------------------- |
| geography   | /3              | /2                            |
| occurrence  | /3              | /2                            |
| knowledge   | /2              | /1                            |
| suitability | /3              | /1                            |
| schedule    | /2              | /1                            |
| environment | /1              | /1 (lane/discovery claims /2) |
| identity    | /1              | not typed                     |
| activities  | /2              | not typed                     |

lane/discovery reads **`visitDuration`** and **`environment.exposure`**. Neither
exists anywhere in the reference clone or its history. The branch's own
comments quote live counts ("1,076 of 2,928"), which implies a newer local
Atlas. **Unverified.** Against GitHub Atlas both fields are always undefined,
and the answers quietly lose their visit-length and exposure reasons.

### 2.5 Shared adventures

- **main:** `BoardItem` holds only an `experienceId`. There is no place for a day.
- **lane/boards (uncommitted, M168):** a shared plan is a row in `passport_board_plans(id, board_id, user_id, title, day_query, shown_as, created_at)`. It is the canonicalised day query, **≤ 5 stops**, and not an `Adventure`.
  - Going from Adventure to shared plan loses free moments, pinned moments, `remixOf`, moments 6 to 12, and all four extension keys (§2.2).
  - Interest on a plan is `item_id = "plan:<id>"`.
- **Referenced but missing:** the SQL comments point to `docs/product/shared-adventures.md`. That file exists on no branch.
- Whether a shared plan should **be** an Adventure (`adventure jsonb`) or keep being a query is the roadmap's D-9, "where data lives". It is open.

### 2.6 Conference experiences

There are two models of one gathering. A third, the uncommitted `/sycle` tree in
`~/passport/main`, is out of scope (roadmap INT-0).

|          | lane/boards `Gathering`                   | feature `Conference`                                |
| -------- | ----------------------------------------- | --------------------------------------------------- |
| Identity | public slug, code constant + env board id | random id; "no slugs" by design                     |
| Members  | Supabase users via board membership       | `user:` or `guest:` identities, codes, invite links |
| Holds    | board items (Atlas ids), interest, plans  | details only, "no plans, schedules, posts"          |
| Store    | Atlas boards + proposed tables            | **in-memory**, prod-blocked by `config.ts`          |

The conference branch already names lane/boards pieces as prototypes for its
modules. A bridge needs a conference → board mapping and a `memberId` →
`user_id` mapping, and guests have no `user_id`. This is doctrine §10 and §15
Q1/Q12 and roadmap D-10: **open, not resolved here.**

---

## 3. Atlas `/travel/legs`: the real contract against Passport's proposal

|                        | Passport proposal (lane/maps `atlasLegs.ts`)           | Atlas M144 (`32da743`, local main, not deployed)                                  |
| ---------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Method / path          | `POST /travel/legs`                                    | `GET /travel/legs`                                                                |
| Question               | `{ mode, legs: [{ from: {id?, at}, to: {id?, at} }] }` | `?stops=<id>,<id>…&mode=…[&lat&lng]`                                              |
| Who resolves points    | Passport sends coordinates                             | **Atlas**, from its own ids                                                       |
| Limits                 | ≤ 12 legs                                              | 2–10 stops, no repeats; or 1 stop + origin                                        |
| Success                | `{ legs: TravelTimeReading[] }`                        | `{ legs: [{ travel: TravelTimeReading, … }], total: { state, basis }, failure? }` |
| Whole mode unsupported | per-leg `unsupported`                                  | `200 { state: "unsupported", legs: [] }`                                          |
| Reading states         | estimated · unavailable · unsupported                  | + `unrouted` (no point) · `beyond` · `unavailable` + `transient: true`            |
| 400                    | —                                                      | bad question                                                                      |
| 404                    | "not served"                                           | **unknown stop**, and a deployed Atlas without M144 also 404s                     |
| Origin privacy         | Passport rounds to 2 dp                                | Atlas blurs a person to ~1 km and keeps a place exact                             |
| Quota                  | —                                                      | ORS free plan: **50 requests a day** (M147), not the 500 assumed                  |

The Atlas column is taken from the M144, M145 and M147 reports
(`~/Drop/completed/read/`). Its source is in `~/atlas`, which lanes may not
read. Fields the reports do not name (anything on `legs[]` except `travel`, and
`total` except `state` and `basis`) are not relied on.

### Verified against lane/maps' code

A probe ran in the scratch clone and was deleted afterwards.

| Atlas answers                            | `journeyFromReading` / `readLegs` (maps `d62ba73`) gives | Should be                           |
| ---------------------------------------- | -------------------------------------------------------- | ----------------------------------- |
| `unavailable`, `transient: true`         | `no-route`, which blames the place                       | temporarily unavailable; may change |
| `unrouted`                               | `unknown`, "could not read"                              | this place has no point in Atlas    |
| `beyond`                                 | `unknown`, "could not read"                              | past the scope asked                |
| 404 for a stale stop id                  | `not-served`, "Atlas does not serve travel times"        | ambiguous: say so                   |
| a well-formed M144 200 (`legs[].travel`) | **every leg** "could not read"                           | the readings                        |

On top of that, maps sends `POST`, and M144 serves `GET`. So **as built, maps
would never show a routed minute against the real Atlas.** It falls back to
labelled straight lines, which is honest but useless. This is roadmap MAP-02,
and M170 is on it. Passport's reader for the real shape is
`readTravelLegsAnswer` in this lane, and its tests pin each row above.

### Requirements for Atlas (proposals; Atlas decides)

1. **Disambiguate 404.** Use a body that names the unknown stop, or 422, so "route absent" and "stale id" stop looking alike.
2. **Publish `travelLegs.ts` to GitHub main.** This lane's tripwire fails on that day, and `ATLAS_TRAVEL_LEGS` gets re-measured from source.
3. **Set `ORS_REQUESTS_PER_DAY=50`.** Persist `travel_time_readings` before live origins arrive: a per-instance cache at 50 a day will run out. That is an owner action.

---

## 4. Overlapping implementations

| Concept                             | Implementations                                                                                         | Seam to converge on (adapter, not rewrite)                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| A stop                              | `DayStop` · `PrintableStop` · `OfflineStop` · `LegEnd` · `Moment`                                       | `DayStop` while building; `Moment` once saved                                                             |
| A leg / travel                      | `Journey`, `PlacedLeg` · `PrintLeg`, `RoutedTravel` · `Leg` · `MOVE_MINUTES`                            | `TravelTimeReading` at the Atlas edge; `Journey` on screen; `Leg` in feasibility (`travelMinutesReading`) |
| Day query codec                     | main inline · daybuilder `printQuery` + `carry.ts` · detox copy · boards `DAY_KEYS` · domain `print.ts` | one codec over `DAY_QUERY` (roadmap INT-6)                                                                |
| Day resolver (`query → DayPlanned`) | main print page · detox `resolve.ts` (a declared copy) · analog                                         | one `resolvePrintDay`; detox's README asks for it                                                         |
| `keep`                              | discovery · daybuilder                                                                                  | one meaning (INT-3)                                                                                       |
| Weather on paper                    | analog `PrintForecast` (copy of `TodayWeather`) · daybuilder `PlanWeather`                              | type alias, not a copy                                                                                    |
| Money                               | analog `BudgetSummary` · daybuilder `DayMoney`                                                          | one                                                                                                       |
| Challenge decks                     | analog `SideQuest` · detox `Challenge`                                                                  | one deck, stable ids                                                                                      |
| A group                             | `/sycle` · `Gathering` · `Conference`                                                                   | D-10, open                                                                                                |
| The word "Adventure" / "Moment"     | `schemas.ts` (legacy flow) · `domains/adventure`                                                        | D-4, open                                                                                                 |

---

## 5. Missing data contracts

1. **Persistence for an Adventure.** None exists: no table and no storage key. Shared plans and offline days each built their own instead (§2.5, detox `ghad.offline`).
2. **Response validation at the Atlas boundary.** Everything is cast. A renamed field turns into an `undefined` that degrades quietly.
3. **The 404 disambiguation on `/travel/legs`** (§3).
4. **`docs/product/shared-adventures.md`**, which boards' migrations and RLS comments cite. It does not exist.
5. **Leg identity.** maps keys legs by index from `dayLegs`, analog by its own `legsFor` ids (with its own home leg), and the domain by `from`/`to` moment ids. They agree in count today (n+1 with a town), but only by coincidence.
6. **Day-query versioning.** No key says which writer produced a query, so a reader cannot tell "no minutes set" from "minutes stripped".

---

## 6. Migration requirements

None exist on any branch. Each one needs owner approval. This lane writes none
of them until the shapes are decided.

| Needed by            | Table / change                                                                                               | Notes                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| boards (committed)   | `passport_board_interest(board_id, item_id ≤200, user_id, shown_as ≤60)`, unique triple                      | RLS: members read, own rows write. The code fails as `InterestUnavailable` until this exists |
| boards (uncommitted) | `passport_board_plans(id, board_id, user_id, title ≤80, day_query, shown_as, created_at)`                    | RLS: members read, sharer insert/delete, owner delete                                        |
| boards (uncommitted) | policy on `passport_board_members`: a member deletes their own non-owner row                                 | until then "leave board" returns 503                                                         |
| boards (uncommitted) | trigger: removing a member removes their interest                                                            | named "proposed" in code                                                                     |
| conference           | `passport_conferences`, `passport_conference_members`, `passport_conference_invites` (`proposed-schema.sql`) | RLS with **no policies**, so a service-role key is needed. Prod is blocked today             |
| Atlas (not Passport) | `travel_time_readings`                                                                                       | already proposed in Atlas; relieves the 50-a-day quota                                       |
| — (D-9)              | somewhere to keep an `Adventure`                                                                             | open                                                                                         |

---

## 7. Integration risk register

Each row has a severity, then a likelihood, then evidence.

- **Severity:** P1 means the integrated product is wrong or broken. P2 means a silent loss or degradation. P3 means debt that bites later.
- **"Guard"** says what catches it today.

| #   | Risk                                                                                                                                                 | Sev / Lik                                | Evidence                                        | Guard                                        | Owner / next step                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| R1  | **No routed minute ever shows against real Atlas.** maps POSTs and Atlas serves GET. Even a correct M144 body reads as "could not read" on every leg | P1 / certain                             | §3 probe                                        | `readTravelLegsAnswer` tests (domain)        | M170 / MAP-02; port the shape from `travel/contracts.ts`                             |
| R2  | **A provider outage blames the place.** `transient` shows as "no route". With ORS at 50 a day, this will happen daily                                | P1 / high                                | §3 probe; M147                                  | domain test "keeps a failed provider apart…" | M170                                                                                 |
| R3  | **A stale stop id reads as "Atlas doesn't serve travel"**, and production Atlas (no M144) answers the same 404                                       | P2 / high                                | §3                                              | `not-found` state, ambiguous by design       | Atlas: disambiguate 404                                                              |
| R4  | **The analog `/go/print` silently drops** routed legs, rain plans and set minutes                                                                    | P1 / certain if analog wins the conflict | §2.2; `go/print` conflict                       | none                                         | INT-5 / D-7: pass `travel`, `forecast` and daybuilder fields into `printableFromDay` |
| R5  | **Shared plans and offline days drop `b`, `mins`, `rain` and `by`**                                                                                  | P2 / certain after INT-2/INT-4           | §2.2; boards `DAY_KEYS`, detox `DAY_QUERY_KEYS` | `dayQuery.test.ts` (registry + tripwire)     | M168 (boards) and detox should read `DAY_QUERY`; INT-6 codec                         |
| R6  | **Two `keep`s** with different rule semantics. The merge silently picks one                                                                          | P1 / certain at INT-3                    | §2.1                                            | none                                         | INT-3; the product meaning sits on doctrine §2.5                                     |
| R7  | **`defaultRadiusKm` is not exported on daybuilder**, so discovery's `answer.ts` breaks the build                                                     | P1 / certain at INT-3                    | §2.1                                            | `tsc` (will catch it)                        | INT-3                                                                                |
| R8  | **Travel counted twice**: the 15-minute buffers are inside stop minutes and routed minutes are added on top; two travel UIs                          | P2 / certain at INT-4                    | §2.3                                            | none                                         | INT-4: one budget model; routed minutes replace the buffer per leg                   |
| R9  | **"Drive times unknown" never clears.** maps matches an exact sentence that daybuilder changed                                                       | P2 / certain at INT-4                    | §2.3                                            | none                                         | export one constant, or match by key                                                 |
| R10 | **Discovery reads `visitDuration` and `exposure`**, which GitHub Atlas does not send. Reasons vanish silently                                        | P2 / unknown                             | §2.4                                            | none (no validation)                         | M172 or Atlas: confirm whether local Atlas serves them; add a validator              |
| R11 | **Unvalidated Atlas reads** plus grounding-version drift on six contracts                                                                            | P3 / ongoing                             | §2.4                                            | none                                         | a zod edge per read, starting with `/discovery/candidates`                           |
| R12 | **Boards features fail at runtime** until four migrations land (interest, plans, leave policy, trigger)                                              | P2 / certain                             | §6                                              | `InterestUnavailable` / 503                  | owner approval; M168                                                                 |
| R13 | **The conference is in-memory**, prod-blocked, and a second model of the same gathering as boards                                                    | P2 / certain                             | §2.6                                            | `config.ts` refuses prod                     | D-10; conference D2/D3                                                               |
| R14 | **Adventure ↔ shared plan loss**: 5 stops against 12, free and pinned moments, `remixOf`                                                             | P3 / at D-9                              | §2.5                                            | `printLosses` names some of it               | D-9                                                                                  |
| R15 | **Leg identity agrees only by coincidence** (index, `legsFor`, moment ids)                                                                           | P3 / medium                              | §5.5                                            | `legs.test.ts` pins the domain count         | name one leg key at INT-4/5                                                          |
| R16 | **The Atlas contract is known from reports, not source.** M144 fields beyond `travel`, `total.state` and `total.basis` are unverified                | P3 / —                                   | §3                                              | tripwire in `contracts.atlas.test.ts`        | re-measure when `travelTimeReading` reaches GitHub main                              |
| R17 | **The `/sycle` prototype is uncommitted** in `~/passport/main` (about 4,200 lines)                                                                   | P2 / one `git clean` away                | roadmap INT-0                                   | none                                         | a person commits it (D-14)                                                           |

No branch adds October branding. The only matches are dates in fixtures and
analog's test that asserts _absence_. Daybuilder imports `OCTOBER_PLACES` for
dev-only simulated weather, which is not branding but is worth knowing at INT-2.

---

## 8. Tests added in this lane

All run under the normal `npx vitest run`. They need `../atlas`, the reference
clone, exactly as `src/lib/october/types.test.ts` already does.

| File                                             | Proves                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/domains/travel/contracts.atlas.test.ts` | It **runs Atlas's own `OsrmTravelTimeProvider`** (from the reference clone) over a fake OSRM, and every reading it produces parses with Passport's schema. An estimate without provider, `calculatedAt`, limitations or whole minutes is refused. **Tripwire:** it fails when GitHub Atlas gains `/travel/legs`. It also checks that Atlas authenticates before routing and 404s an unknown path                                                                                |
| `src/lib/domains/travel/legs.test.ts`            | An Adventure asks by Atlas id, in order, with the origin rounded to 2 dp even when the question is hand-built. Atlas's refusals are named before sending. Free time is never asked about. Each HTTP outcome maps to one state (transient, unrouted, unsupported, 404, 401, 400, 5xx). Wrong-length answers are refused. A wrong-mode leg is refused alone. A total passes only when estimated. **Routed minutes decide feasibility; `accessCaution` and straight lines do not** |
| `src/lib/domains/integration/dayQuery.test.ts`   | The six core keys are exactly what main's `GoHaveADay` writes and `/go/print` reads; it is a **tripwire** when a lane's key reaches main. A six-key reader drops `b`, `mins`, `rain` and `by`, and so does this lane's own `readPrintQuery` (INT-6)                                                                                                                                                                                                                             |

Not added, deliberately:

- tests inside other lanes, whose missions are live;
- an e2e test, because no surface consumes these contracts yet and there is no Atlas in lanes.

---

## 9. Open questions touched, not resolved

- Doctrine §10 / §15 Q1 (Experience architecture), Q12 (groups): the two conference models.
- Doctrine §15 Q3 / Q14 (Want / Plan / Lived): whether a shared plan is a state of an Adventure.
- Roadmap D-4 (the names Adventure / Moment), D-7 (the print surface), D-9 (where data lives), D-10 (board vs conference), D-11 (who owns `src/domain/`).
- The meaning of `keep` (doctrine §2.5). It is a product sentence before it is a merge.
