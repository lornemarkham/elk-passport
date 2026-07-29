# Discovery Engine (Compass)

_ELK Compass entry. Durable architectural knowledge from IMP-004 —
Discovery Interaction and Mood Board Foundation. Product surface:
ELK Passport, `/labs/discovery-space`._

## What this is

Discovery has a single source of truth — informally "Compass" — that every
input method dispatches into rather than implementing its own filtering or
save/reject logic. This entry documents that architecture so future IMPs
(voice, typed intent, Planner handoff, server persistence) extend it
instead of reinventing it.

## Core architecture

- **`src/domain/discovery/discoveryState.ts`** — `DiscoveryState`,
  `DiscoveryCommand`, and the pure `discoveryReducer`. Framework-free by
  design: no React, no storage, no side effects. Any future input adapter
  (gestures, typed query, Atlas voice) should produce a `DiscoveryCommand`
  and pass it through this same reducer rather than writing its own state
  transition logic.
- **`src/domain/discovery/selectors.ts`** — derived views (`selectActiveExperiences`,
  `selectSavedExperiences`, `selectShelvedExperiences`) over state + the
  canonical catalogue. `activeExperienceIds` from the original IMP sketch
  is treated as _derived_, not stored — there is exactly one function that
  can disagree with itself about what's currently active.
- **`src/domain/discovery/persistence.ts`** — `DiscoveryPersistence`
  interface, currently backed by localStorage
  (`createLocalDiscoveryPersistence`). Only the durable slice persists:
  saved (Mood Board) ids, shelved ids, and the last session's filters/query.
  Swapping to authenticated server persistence later means implementing
  this interface, not touching call sites.
- **`src/domain/discovery/interactions.ts`** — a capped, local
  `DiscoveryEvent` log (filter/save/reject/shelf/restore/broaden/reset).
  Recorded but **not yet acted upon** — see Open Question below.
- **`src/components/labs/discovery-space/useDiscoveryEngine.ts`** — wires
  the reducer + persistence + interaction logging into one hook. This is
  the one "Compass" instance the Discovery UI talks to.

## New domain states (this IMP)

Discovery now distinguishes four states for an experience, not two:

- **Active** — currently eligible to appear in the field (passes filters
  and query; not saved, rejected, or shelved).
- **Saved** — the Mood Board. A collected _vibe_, not a commitment.
  Survives filter changes and session reset.
- **Rejected** — "not for this discovery context." Session-scoped only —
  deliberately **not persisted** across reloads, so it can never silently
  hide a category forever.
- **Shelved** — "interesting, not now." Persisted, distinct from rejected.

A single `lastRemoved` field (last reject/shelf) backs one-step undo
without the UI tracking history itself.

## Product principles (new or reinforced by this IMP)

- **Discovery is continuous** — filtering is part of discovery, not a
  setup step before it. (Reinforces IMP-002.)
- **One engine, many input methods** — filters, card actions, typed query,
  and future voice/gesture input must all produce the same
  `DiscoveryCommand` shape rather than each owning recommendation logic.
- **The Mood Board captures a vibe, not a commitment** — saving must never
  be conflated with card-body inspection. Card-body click/tap now opens a
  focused inspect overlay; it does not save.
- **Session state and remembered preference state are separate** — this
  IMP resolved a concrete instance of that principle: session reset clears
  filters, query, rejected, and shelved, but **preserves saved** (Mood
  Board) items, since that's a deliberate collection, not session noise.
- **Autonomy over imposed action** — removing an item from the Mood Board
  is a neutral action (returns to the active pool), distinct from and
  weaker than an explicit reject. Conflating the two would punish someone
  for changing their mind about something they saved.

## New convention: always-reachable card actions

Save/Reject/Shelf are rendered as small, always-present buttons (subtle at
rest, clear on hover/focus) rather than hover-only or gesture-only
controls. This is now the expected pattern for any future card-based
surface in Passport — hover-gating an action makes it invisible to touch
and keyboard users, which the Accessibility Considerations section of
every IMP explicitly forbids.

## Deferred / open (carried forward, not resolved here)

Per the IMP's own Open Questions and Non-Goals, this build deliberately
does **not** include:

- Swipe gestures (shipped as buttons only; every gesture must have a
  visible equivalent per the IMP, so gestures can be layered on later
  without a redesign).
- Natural-language parsing of the `query` field (currently plain substring
  match against title/description/moods/activities).
- Using the interaction event log for actual cross-session
  personalization — events are recorded, not yet acted on. A follow-up IMP
  should define which signals are strong enough to influence discovery
  before this is built.
- Any Mood Board → Planner transition.
- Automatic "suggest broadening" prompts — Version 1 exposes direct
  "Clear filters" / "Bring back passed-on ideas" controls instead.

## Known limitation carried to IMP-003

Broad reduced-motion coverage for Discovery's ambient field (drift, "sign
of life" presets, Peripheral Temptation) was not addressed here — this IMP
only ensures its own new interactive elements (inspect overlay, undo
toast) respect `prefers-reduced-motion`. The ambient field's animation
architecture is explicitly IMP-003's territory (Discovery Animation and
Living Card Performance); coupling that fix into this IMP would have
violated its own "measure before optimizing" scope.

## Test-infra fix (incidental, benefits all future tests)

`vitest.setup.ts` now polyfills `globalThis.localStorage` with a small
in-memory implementation and registers `@testing-library/react`'s
`cleanup()` in `afterEach`. Neither existed before this IMP. Root cause:
this repo's Node version ships its own unconfigured native `localStorage`
global that shadows jsdom's and lacks working `removeItem`/`clear`; and
`@testing-library/react`'s auto-cleanup only self-registers when
`globals: true` is set in Vitest config, which this repo does not use. Any
future test touching localStorage or rendering multiple components per
file would have silently hit one of these.
