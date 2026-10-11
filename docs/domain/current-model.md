# Current domain model — adventure, day, board, place

A map of the types that exist today, measured at `016854a` (2026-10-11). It is
**evidence, not intent** (see `CLAUDE.md`): it records what the code does so the
next domain mission can change it safely. Where it says something should change,
that is in the last section and marked as a proposal.

Product authority remains `docs/PASSPORT-PRODUCT-DOCTRINE.md`. Several of the
overlaps below sit on open questions in its §15; they are named as such and not
resolved here.

## 0. Where the domain actually lives

The lane brief points at `src/lib/schemas.ts` and `src/lib/domains/`. Only the
first holds domain types.

- `src/lib/domains/experience-domains.ts` is **hostname → Experience routing**
  (`ExperienceDomain` :29, `EXPERIENCES` :42 — one entry, `iamoctober.com`). It
  answers "which product is this request inside", not "what is an adventure".
  Consumers: middleware, the shared `/account` and `/auth` pages.
- `src/lib/schemas.ts` holds the **oldest** model: the zod `Adventure` used by
  the `/plan → /reveal → /adventure → /summary` flow.
- The live domain layer is **`src/domain/`** (`day/`, `experience/`,
  `discovery/`, `october/`, `environment/`, `passport/`, `collections/`) plus
  data types in `src/lib/data/types.ts` and `src/lib/data/boards-repo.ts`.
  `src/domain/` is not in this lane's owned-file list; that is worth settling
  before the next domain mission edits it.

## 1. Adventure (legacy plan flow) — `src/lib/schemas.ts`

All zod; the only zod domain schemas in the app.

| Type                    | Where             | Shape                                                                               |
| ----------------------- | ----------------- | ----------------------------------------------------------------------------------- |
| `TodaysIntent`          | `schemas.ts:5-19` | 10-value enum, commented "examples only"                                            |
| `AdventureDna`          | `schemas.ts:38`   | `traits: string[]`, `notes?`                                                        |
| `Constraints`           | `schemas.ts:44`   | `timeAvailable` (3 enums), `budget` (3 enums), `location: string`, `maxDistanceKm?` |
| `PlanInput`             | `schemas.ts:52`   | `intent`, `constraints`, `dna`                                                      |
| `AdventureBlock`        | `schemas.ts:59`   | free-text `time`, `title`, `description` — **no entity id**                         |
| `Recommendation`        | `schemas.ts:66`   | `title`, `tagline`, `blocks` (2–6)                                                  |
| `Moment`                | `schemas.ts:73`   | `id`, `adventureId`, `note?`, `photoDataUrl?`, `createdAt`                          |
| `adventureStatusSchema` | `schemas.ts:82`   | `planned` \| `active` \| `completed`                                                |
| `Adventure`             | `schemas.ts:84`   | the above + `status`, `currentBlockIndex`, `moments`                                |

**Persistence:** browser localStorage only — `elk-passport:adventures` and
`elk-passport:adventure-dna` (`src/lib/data/local-repo.ts:17-18`). No table.

**Consumers:**

- `src/app/api/recommend/route.ts:2` validates `planInputSchema`, returns a
  `Recommendation` from `getAiRecommendation` (`src/lib/ai/openai-recommender.ts:13`)
  or `getLocalRecommendation` (`src/lib/ai/atlasClient.ts:71`).
- `src/lib/data/hooks.ts` — `useAdventure*`, `useCreateAdventure` (:51, builds
  the `Adventure`), `useAddMoment` (:75), `useAdvanceAdventure` (:91),
  `useCompleteAdventure` (:103).
- Routes: `src/app/plan/page.tsx`, `src/app/reveal/[id]/page.tsx`,
  `src/app/adventure/[id]/page.tsx`, `src/app/summary/[id]/page.tsx`.

This is the only model with a lived-state progression (`planned → active →
completed`, `currentBlockIndex`, `moments`), and it is the one disconnected from
Atlas entities.

## 2. Day — `src/domain/day/`

Two independent models, both plain readonly TS interfaces, **neither persisted**
(no table, no localStorage, no API route). Neither reuses `schemas.ts`.

### 2a. Single-subject plan ("Let's do this")

| Type        | Where                       | Shape                                                                                                                |
| ----------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `PlanFact`  | `src/domain/day/plan.ts:47` | `label`, `value?`, `because?`, `unknown?`, `against?` (known / ruled out / unknown)                                  |
| `PlanLink`  | `plan.ts:59`                | `label`, `href`                                                                                                      |
| `DayPlan`   | `plan.ts:64`                | `id` (= Experience id), `title`, `where?`, `on?` (YYYY-MM-DD), `doing`, `facts`, `restrictions`, `unknowns`, `links` |
| `PlanInput` | `plan.ts:81`                | `on?`, `origin?: Point`, `childAge?`                                                                                 |

Built by `dayPlan(experience, input)` (`plan.ts:258`), which says it is "not an
itinerary engine" — no stops, no times. Rebuilt per request in
`src/app/day/[id]/page.tsx` from `listDiscoveryCandidates`; inputs come from
the query string. Rendered by `src/components/ghad/DayPlanView.tsx` (+
`TravelFromHere.tsx`); entered via `LetsDoThis.tsx` from
`src/app/places/[id]/page.tsx` and `src/app/passport/[id]/page.tsx`.

### 2b. Multi-stop day ("Go have a day")

| Type          | Where                           | Shape                                                                                                                       |
| ------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `DayBrief`    | `src/domain/day/brief.ts:29`    | `said`, `hours?`, `budget?`, `childAge?`, `town?`, `on?`, `withinKm?`, `interests`, `shelter?`, `appetite?`, `lessDriving?` |
| `DayStop`     | `src/domain/day/build.ts:44`    | `experience: Experience`, `minutes`, `km?`, `because`, `cost?`, `open?`, `notes`, `challenge?`                              |
| `DayPlanned`  | `build.ts:62`                   | `title`, `opening`, `stops`, `unknowns`, `brief`, `closing`                                                                 |
| `BuildInput`  | `build.ts:319`                  | `pool`, `brief`, `without?`                                                                                                 |
| `OfflineMode` | `src/components/go/modes.ts:16` | `id`, `title`, `blurb`, `says`; six hard-coded in `OFFLINE_MODES` (:25), each a seed sentence for `readBrief`               |

Functions: `readBrief` (`brief.ts:128`), `reviseBrief` (:221), `replacedStop`
(:265), `buildDay` (`build.ts:333`).

**State:** `useState`/`useMemo` in `src/components/go/GoHaveADay.tsx`. The
print hand-off is a URL: `printQuery` in `GoHaveADay.tsx` writes
`stops=id,id&say&hours&age&at&on`, and `src/app/go/print/page.tsx` rebuilds the
day from those ids (deliberately, so print matches screen). Rendered by
`src/components/go/DayItinerary.tsx` and `src/components/go/AnalogGuide.tsx`
(`window.print()`, `@media print`). Route: `src/app/go/page.tsx`, which grew out
of `src/app/about/experiment-06-analog-adventures/`.

**Detox:** the word does not appear in `src/`. The nearest thing is the analog
/ offline-mode work above; `modes.ts` describes itself as "not a
digital-wellness product". There is no detox type to map.

## 3. Board, saved, kept — `src/lib/data/`, `src/lib/collaboration/`, `src/lib/october/`

None of this uses zod.

| Type              | Where                                         | Shape / meaning                                                                                                    |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `Board`           | `src/lib/data/boards-repo.ts:22`              | `id`, `ownerId`, `name`, `createdAt`, `updatedAt`                                                                  |
| `BoardItem`       | `boards-repo.ts:30`                           | `id`, `boardId`, `experienceId`, `addedAt`                                                                         |
| `LoadBoardResult` | `src/lib/data/loadBoardWithExperiences.ts:12` | `ok {board, experiences, unresolved, role}` \| signed-out \| not-found \| error; `loadSaved.ts` adds `nothing-yet` |
| `BoardRole`       | `src/lib/collaboration/boardAccess.ts:36`     | `owner` \| `editor` \| `viewer`                                                                                    |
| `BoardAccess`     | `boardAccess.ts:38`                           | `board`, `role`, `ownerId`                                                                                         |
| `BoardInvite`     | `src/lib/collaboration/invites.ts:28`         | `token`, `role`, `createdAt`, `expiresAt`, `revokedAt`                                                             |
| `PassportEvent`   | `src/lib/collaboration/eventKinds.ts:14`      | board activity; `CORE_EVENT_KINDS` (:31)                                                                           |
| `OctoberKind`     | `src/lib/october/types.ts:10`                 | Place, Organization, Activity, Event, Experience, Movie, Doing                                                     |
| `OctoberState`    | `types.ts:30`                                 | `ahead` \| `lived`                                                                                                 |
| `OctoberThing`    | `types.ts:32`                                 | `entityId`, `entityKind`, `name`, `startsAt`, `state`, `wantedAt`, `livedAt`                                       |
| `KeptOnThisPage`  | `src/lib/october/keptOnThisPage.ts:26`        | `signedIn`, `kept: Set<entityId>` (October rows only)                                                              |

**Persistence:**

- `boards` / `board_items` belong to **Atlas** (baseline migration header,
  `supabase/migrations/20260927000000_passport_baseline.sql:22`), reached
  server-side through `src/lib/data/boards-server.ts`, browser via
  `src/app/api/boards/**`.
- Passport tables (same file): `passport_board_members` :46,
  `passport_board_invites` :34, `passport_events` :55 (`resource_type = 'board'`
  only), `passport_october_things` :77, `passport_movie_reactions` :66.
- localStorage: `elk-passport:discovery-space:active-board-id`
  (`src/lib/data/activeBoardStorage.ts:7`).

**Consumers:** `src/app/boards/page.tsx` (`listBoardsFor`),
`src/app/boards/[id]/page.tsx` (`loadBoardWithExperiences`, LiveBoard,
ShareBoard), `src/app/saved/page.tsx` (`loadSaved` + `octoberThingsFor` →
`src/components/saved/SavedReview.tsx`). Client writers:
`src/components/place-detail/SaveButton.tsx`,
`src/components/discovery-list/DiscoveryListView.tsx`, BoardSwitcher,
DiscoveryListSidebar, labs DiscoverySpace / SaveToBoardDialog. October rows:
MyOctober, PlanDay, LivedOn, MovieNight via `src/lib/october/october-repo.ts`.

## 4. Place / Experience — `src/lib/data/types.ts`, `src/domain/experience/`

| Type                                     | Where                                                                      | Id / name / coordinates                                                                   |
| ---------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `Place`                                  | `src/lib/data/types.ts:40`                                                 | `kind: "Place"`, `id`, `name`, `geometry?.coordinates` (GeoJSON, lon-first)               |
| `PlaceDetail`                            | `types.ts:253`                                                             | wraps `place: Place` + relationships, nearby, events, media, temporal, practical          |
| `PlaceNearbyPlace` / `PlaceRelatedPlace` | `types.ts:99` / `:110`                                                     | `id`, `name`, `placeType`, `distanceKm` (no coordinates)                                  |
| `DiscoveryCandidate`                     | `types.ts:424`                                                             | `id`, 5-way `kind`, `name`, `coordinates?: [n,n]`, `location?`, `geography?`, `distance?` |
| `CandidateDistance`                      | `types.ts:538`                                                             | union: measured / bounded / conflicting / unknown                                         |
| `CandidateGeography`                     | `types.ts:812`                                                             | `coordinates?` + `coordinatesBasis`, `area`, `via`                                        |
| `CandidateLocation`                      | `types.ts:832`                                                             | `placeId?`, `name?`, `locality?`, `basis`                                                 |
| `ComposedSubject`                        | `types.ts:926`                                                             | `id`, open `kind: string`, `coordinates?`                                                 |
| `Experience` (canonical)                 | `src/domain/experience/types.ts:95`                                        | `id`, `kind`, `slug`, **`title`**, `location?` (`latitude`/`longitude`), `venue?`         |
| `Experience` (labs)                      | `src/components/labs/discovery-space/types.ts:8`                           | unrelated interface, same name; no location                                               |
| `OctoberPlace` / `DiscoveryTown`         | `src/domain/environment/places.ts:29` / `src/domain/discovery/towns.ts:35` | slug ids ("vernon"), flat `latitude`/`longitude`                                          |
| `Point`                                  | `src/domain/discovery/situation.ts:472`                                    | `latitude`, `longitude`; used by `useHere`, `useDistances`, `PlanInput.origin`            |

Mapping: `candidateToExperience` / `placeToExperience`
(`src/domain/experience/atlasMapper.ts`); routing via `destinationFor`
(`src/domain/experience/destination.ts:46`) — `/places/:id` for a detail-ready
Place, else `/passport/:id`.

**Consumers:** `src/app/places/page.tsx` and `src/components/places/PlacesDiscovery.tsx`
(`Place` via `listPlaces`); `src/app/places/[id]/page.tsx` and
`src/components/place-detail/*` (`PlaceDetail`; `PlaceMap.tsx:14` destructures
`[lon, lat]` into an OpenStreetMap iframe — no map library);
`src/app/discovery/page.tsx` (candidates → `Experience`);
`src/app/passport/[id]/page.tsx` (`ComposedSubject` → `SubjectView`,
`src/lib/passport/subjectPage.ts:68`).

## 5. Where types overlap or disagree

1. **Three "a day made of stops" shapes.** `Recommendation`/`AdventureBlock`
   (free text, 2–6 blocks, clock `time`, no entity), `DayPlanned`/`DayStop`
   (wraps a real `Experience`, `minutes` not times, unbounded), and `DayPlan`
   (one subject, no stops). They share no code.
2. **Two `PlanInput`s.** `schemas.ts:52` (zod, intent + constraints + DNA) and
   `src/domain/day/plan.ts:81` (date, origin, child age).
3. **Lived state exists only where entities don't.** `Adventure` has
   `planned/active/completed` + moments but no Atlas ids; the day models have
   Atlas ids but no saved, committed or lived state at all. Doctrine §2.6–2.9
   (COMMIT, LIVE, REMEMBER) has no single home.
4. **Two "keep" stores with different vocabularies.** An Atlas board item
   ("Saved for later") and a `passport_october_things` row in state `ahead`
   ("Want to do"). `SavedReview.tsx` stitches them by matching
   `experience.id` strings and removes both together; `keptOnThisPage` looks at
   October only. State words in play: saved, want to do, wanted, kept, ahead,
   lived, `planFor`, `didThis` — and `planned/active/completed` on Adventure.
   This is doctrine §15 Q3 / Q14 (reaction states; Want/Plan/Lived vocabulary),
   **open**.
5. **"Planned for a day" is stored in the event-start column.** `planFor`
   writes the intended day into `starts_at`, the column a dated Event's real
   start lives in; `SavedReview.tsx:43-45` gives this as the reason there is no
   "Let's do it" button.
6. **October store vs generic Passport.** The only wanted/lived persistence is
   October-named (`passport_october_things`). Whether that generalises is
   doctrine §10 / §15 Q1 (Experience architecture), **open**.
7. **Kind lists drift.** `OCTOBER_KINDS` has 7 kinds; the baseline migration's
   `entity_kind` check (:86) lists 5 (no Experience, no Doing) because it is a
   2026-09-27 capture. The live constraint was widened by Atlas migrations
   (`202609281400_october_things_experience`, `202609301000_october_things_movie`,
   `202610012100_october_doing` in the Atlas reference clone).
   `supabase/README.md` "Where the baseline is already out of date" stops at
   Movie and omits the Doing row; `keptOnThisPage.ts:43` says "six kinds".
   Candidate/Experience use a closed 5-way kind; `ComposedSubject.kind` is an
   open `string`.
8. **Board identity is fuzzy.** Atlas has no `GET /boards/:id`, so
   `boards-server.ts` lists every board to find one; `loadSaved.ts` treats
   `boards[0]` as "Saved"; `activeBoardStorage` may point at a different board.
9. **Movie reactions are a third store.** `passport_movie_reactions` (verdict)
   and an October row of kind Movie (ahead/lived) for the same film are
   unconnected.
10. **Four coordinate conventions.** GeoJSON `geometry.coordinates` (Place),
    bare `[n,n]` tuples (Candidate, CandidateGeography, ComposedSubject,
    SubjectView), flat `latitude`/`longitude` (ExperienceLocation, OctoberPlace,
    Point), `lat`/`lng` in Atlas query strings (`atlas-repo.ts`). Tuple order
    (lon-first) is never in a type — only in `atlasMapper.ts` and `PlaceMap.tsx`.
    A candidate can carry both `coordinates` and `geography.coordinates`.
11. **Three distance representations.** `distanceKm: number` (Place
    neighbours), the `CandidateDistance` union, and two duplicate side maps
    (`DiscoveryDistances` in `atlas-repo.ts`, `DistanceReading` in
    `src/lib/location/useDistances.ts:7`).
12. **Same shape twice, same name twice.** `CandidateLocation` ≡
    `ExperienceVenue` (`src/domain/experience/types.ts:87`); two unrelated
    `Experience` interfaces; `name` vs `title` across Place / Candidate /
    Experience.
13. **Two place indexes.** `/places` still lists `Place` via `listPlaces`;
    Discovery uses candidates → `Experience`. `placeToExperience` bridges by
    faking a candidate with `regionIds: []`.

## 6. Proposed next contract changes

**Proposals only — none is approved.** Each names the lane that needs it.
Items touching §15 open questions need a human decision first and say so.

1. **maps** — One coordinate type with the order in its name (e.g. reuse
   `Point {latitude, longitude}`), and a single adapter from Atlas tuples /
   GeoJSON. Every map surface consumes `Point`; tuples stop crossing
   `src/domain/experience/atlasMapper.ts`.
2. **daybuilder** — Decide the fate of `schemas.ts` `Adventure` /
   `Recommendation` (retire the `/plan` flow, or re-base it on
   `DayStop`), and rename one of the two `PlanInput`s. Needs a human call on
   whether the legacy flow is still product.
3. **daybuilder** — A persisted day: a serialisable `DayPlanned` snapshot
   (brief + ordered stop ids + minutes) with a status. Blocked on doctrine §15
   Q14 (Want/Plan/Lived vocabulary) — the status names must not be picked by
   this lane.
4. **analog** — A typed codec for the print hand-off (`stops`, `say`,
   `hours`, `age`, `at`, `on`) in `src/domain/day/`, shared by `printQuery` and
   `src/app/go/print/page.tsx`, so screen and paper cannot drift.
5. **boards** — One item-reference type `{entityId, entityKind, source:
"atlas" | "movie" | "making"}` used by both `BoardItem` and `OctoberThing`,
   replacing string matching in `SavedReview`. Does not decide states.
6. **boards** — Stop overloading `starts_at` for "planned for": a separate
   `planned_on` column (new migration). Blocked on §15 Q14 and on where
   Passport schema changes actually land (`supabase/README.md` "Open").
7. **boards** — Record the `202610012100_october_doing` row in
   `supabase/README.md` and fix the "six kinds" comment in `keptOnThisPage.ts`.
   Docs only.
8. **discovery** — Collapse `CandidateLocation`/`ExperienceVenue` and
   `DiscoveryDistances`/`DistanceReading` to one type each; rename the labs
   `Experience` (e.g. `LabExperience`).
9. **discovery** — Move `/places` onto candidates → `Experience` so there is
   one place index, retiring the `regionIds: []` bridge.
10. **detox** — No contract proposed. Nothing named detox exists, and
    `modes.ts` explicitly disclaims digital wellness. The lane should state what
    it means against doctrine §6 before any type is added.
11. **all lanes (domain)** — Decide whether `src/domain/` is a shared contract
    owned by this lane; today it is the real domain layer and is unlisted.
