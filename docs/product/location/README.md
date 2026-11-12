# Location — one place for every experience

Decision: [ADR 020](../../architecture/decisions/020-one-place-for-every-experience.md).
Authority: doctrine §7 (time, location and environment are core) and §2.1 (no
questionnaire between a person and possibility).

## What a person sees

`📍 Vernon, BC · Change` — or `📍 Around Vernon, BC approximate · Change` when it
is a guess. **Change** opens a picker: search a city, _Use my location_, home,
recently explored, browse all, and (inside an experience) _Explore another
destination — only for Christmas_.

## Where it is used

| Surface           | How the place reaches Atlas / the result                                           |
| ----------------- | ---------------------------------------------------------------------------------- |
| Discovery         | origin → `/api/discovery/distance` → Atlas `candidate-distance`; nearest first     |
| Go Have a Day     | the day's start town; a town in the sentence wins; chosen places far apart → apart |
| Christmas         | `?at=` → server reads Atlas distances from that town                               |
| Snow (mountains)  | nearest-first sort from the town; _How far_ widens                                 |
| Conference/Hockey | **not applied** — anchored to a venue/arena (ADR 020, _Not done_)                  |

## Code

- `src/domain/location/prefs.ts` — pure: what is remembered, order of precedence, search.
- `src/lib/location/store.ts`, `useLocation.ts` — the browser store and the launch order.
- `src/app/api/location/approximate/route.ts` — regional guess from the edge; returns a town id only.
- `src/components/location/` — `LocationBar`, `LocationPicker`, `ExperienceLocation` (URL-driven pages).
- Storage: `localStorage["ghad.location.v1"]` — town ids only.

## Tests

`prefs.test.ts`, `useLocation.test.tsx`, `DiscoveryListView.location.test.tsx`,
`e2e/location.spec.ts` (needs an Atlas that answers `lat`/`lng`; `E2E_ATLAS=1`).
Tests of a page that is about something else mock the hook with
`@/lib/location/testing` so the shared place cannot leak between them.
