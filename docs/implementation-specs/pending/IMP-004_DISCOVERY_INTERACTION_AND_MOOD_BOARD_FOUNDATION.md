# IMP-004 — Discovery Interaction and Mood Board Foundation

> This IMP must follow `docs/workflow/ELK_ENGINEERING_WORKFLOW.md`.

<!-- H1 said "IMP-003" on entry into Builder Mode; corrected to match the
     filename, Status block, and every internal reference. -->

## Status

- [x] Draft
- [x] Architecture Reviewed
- [x] Ready for Build
- [x] Active
- [x] Implemented
- [x] Tested
- [x] Compass Updated
- [ ] Closed

<!-- Not Closed: the required "Manual product checks" (does discovery feel
     continuous, do card changes feel understandable, etc.) are sensory
     judgment calls for a human in a browser, not something verified here.
     See Completion Report → Known limitations. -->

---

## Executive Summary

This IMP defines the first architectural foundation for interactive discovery in ELK Passport.

Discovery must not behave like a traditional search form that collects answers and reveals results only at the end. Filtering, browsing, saving, rejecting, shelving, typing, clicking, swiping, and eventually speaking with Atlas must all participate in one continuous discovery experience.

The user should be able to narrow, broaden, inspect, dismiss, restore, and collect experiences through multiple familiar interaction methods. All interaction methods must operate on the same Compass state rather than implementing separate recommendation logic.

The first implementation should remain intentionally simple. Manual controls and direct card interactions are the immediate interface. Voice and richer Atlas guidance are future interfaces over the same engine.

The Mood Board is introduced as a collection of experiences that match the user's desired vibe. Saving an experience does not mean the user has committed to doing it.

---

## Problem Statement

Large experience catalogues create the same problem seen in services such as Netflix: too many choices, poor recommendations, and endless scrolling.

A static filter panel reduces the catalogue but can feel mechanical and disconnected from discovery. A conversational assistant alone can feel like an interview and may hide the experiences that inspire the user.

ELK Passport needs a discovery system that:

- Reduces irrelevant options quickly.
- Keeps cards visible and responsive while decisions are being made.
- Supports multiple natural ways to express intent.
- Allows users to change direction without restarting.
- Encourages playful exploration.
- Builds a meaningful Mood Board instead of forcing an early final decision.
- Learns from user behaviour across sessions without trapping users in previous preferences.

---

## Goals

- Make discovery continuous rather than sequential.
- Use one shared Compass state for filters, card actions, typed input, and future voice input.
- Support practical constraints such as activity, budget, time, and location.
- Keep the card collection visibly responsive as the user interacts.
- Support save, reject, and shelf interaction concepts.
- Treat the Mood Board as inspiration rather than commitment.
- Preserve the ability to broaden results when the Mood Board or result set feels too small.
- Design mobile-first interaction behaviour with appropriate desktop equivalents.
- Capture user interaction signals for future personalization.
- Remember user patterns across sessions while allowing immediate redirection.

---

## Non-Goals

This IMP does not require:

- Production voice interaction.
- A fully conversational Atlas assistant.
- Final recommendation ranking powered by machine learning.
- Complete experience detail pages.
- Booking or payment flows.
- Final itinerary creation.
- A production-grade long-term user profile system.
- Automatic weather integration.
- Perfect gesture animation.
- Final copywriting or final visual design.

Experience pages should be anticipated by the architecture, but they are not required for the first build.

---

## Product Principles

### 1. Discovery is continuous

Filtering is not a setup step before discovery. Filtering is part of discovery.

Cards should react as the user changes constraints, preferences, and intent.

### 2. Multiple paths, one engine

Voice, typing, filters, clicking, swiping, keyboard controls, saving, shelving, and rejecting must all manipulate the same Compass state.

No input method should own separate recommendation logic.

### 3. Reality before abstraction

Practical constraints often eliminate bad options more effectively than abstract mood questions.

Initial discovery should prioritize concrete factors such as:

- Activity
- Budget
- When
- Time available
- Location or travel distance
- Companions

Mood remains valuable, but it should refine discovery rather than replace practical constraints.

### 4. Eliminate impossible choices before recommending good ones

Compass should first remove experiences that cannot reasonably fit the user's current situation.

### 5. The cards are part of the conversation

Cards must not wait passively for the user to finish answering questions.

They should move, disappear, return, reorder, and respond as discovery progresses.

### 6. Discovery may narrow and broaden

The user must be able to reduce the result set and later ask for more.

Narrowing is not a one-way funnel.

### 7. Optimize for exploration, not a single prediction

Compass does not need to identify one perfect experience immediately.

Success is a small collection of experiences the user is genuinely excited to consider.

### 8. The Mood Board captures a vibe, not a commitment

Saving means:

> This fits the experience I am trying to create.

Saving does not mean:

> I have decided to do this.

Commitment and planning happen later.

### 9. Familiar interactions are preferred

Use interaction patterns users already understand when possible.

Examples:

- Swipe left: no
- Swipe right: save
- Swipe up: shelf or maybe
- Heart: save
- Hide or dismiss: remove from current discovery

### 10. Every interaction should help the user and teach Compass

Filters, saves, rejects, shelves, typed requests, voice requests, and card inspection should all create useful signals.

### 11. Learn, but do not lock in

Compass should remember patterns across sessions, but previous behaviour should influence rather than restrict future discovery.

Personalization must always be easy to override.

### 12. Mobile first, input flexible

The product must be designed for touch first while retaining clear mouse, keyboard, and future voice equivalents.

---

## User Experience

### Discovery entry

The user opens Discovery and immediately sees experience cards.

The user does not need to complete a questionnaire before seeing content.

The interface may present practical filter controls such as:

- Activity
- Budget
- When
- Location

Additional constraints may be introduced incrementally.

### Continuous interaction

As the user changes a filter:

- Matching cards remain.
- Non-matching cards leave the active result set.
- The result count updates.
- Existing Mood Board items remain saved unless explicitly removed.
- The user can restore or loosen constraints.

### Card signals

The first interaction model should support three intents:

1. **Save** — this matches the vibe.
2. **Reject** — this is not wanted in the current discovery context.
3. **Shelf** — interesting, but not for the current moment or not ready to decide.

The first build may use visible controls before implementing complete swipe gestures.

### Mood Board behaviour

The Mood Board contains saved experiences that fit the user's emerging idea.

It should:

- Remain visible or easily accessible during discovery.
- Show the number of saved experiences.
- Allow removal of saved items.
- Allow the user to return to discovery without losing the board.
- Support a future transition from inspiration to planning.

The system must not imply that saved experiences are booked, selected, or final.

### Broadening behaviour

When the result set or Mood Board becomes too small, the user should be able to:

- Remove a filter.
- Restore rejected cards.
- Request more ideas.
- Ask for adjacent or related experiences.
- Return shelved items.

Atlas may eventually suggest broadening, but Version 1 may expose direct controls.

### Cross-session return

When a returning user begins a new discovery session, the system may use previous patterns as a starting suggestion.

It must not silently hide large categories based only on historical behaviour.

A future Atlas prompt might say:

> You usually save outdoor experiences. Start there again?

The user must be able to decline instantly.

---

## Architecture Decisions

### Compass is the single source of discovery truth

The Compass engine owns the active discovery state and produces the current result set.

Input methods dispatch intentions into Compass.

```text
Filters ───────┐
Typing ────────┤
Card actions ──┤
Touch gestures ├──> Compass State ───> Ranked/Filtered Cards
Mouse ─────────┤
Keyboard ──────┤
Atlas voice ───┘
```

### Input adapters remain separate from domain logic

UI controls must translate user actions into domain-level commands.

Examples:

- `setBudgetRange(...)`
- `setTimeWindow(...)`
- `setLocationRadius(...)`
- `saveExperience(id)`
- `rejectExperience(id)`
- `shelfExperience(id)`
- `restoreExperience(id)`
- `clearConstraint(key)`
- `broadenDiscovery(...)`

The filtering and state transition logic must not live inside individual card components.

### Mood Board is separate from the current result set

An experience may remain saved even when later filters would remove it from the active discovery grid.

This prevents the user's collected vibe from disappearing as exploration continues.

### Rejected and shelved are different states

Rejected means the experience is not wanted in the current discovery context.

Shelved means the experience remains interesting but should not compete in the current active set.

The domain model should preserve this distinction.

### Session state and remembered preference state are separate

Current-session decisions must not automatically become permanent preferences.

Long-term personalization should be inferred cautiously from repeated patterns or explicit user choices.

---

## Technical Design

### Suggested discovery state

```ts
export interface DiscoveryState {
  filters: DiscoveryFilterState;
  query: string;
  activeExperienceIds: string[];
  savedExperienceIds: string[];
  rejectedExperienceIds: string[];
  shelvedExperienceIds: string[];
  restoredExperienceIds: string[];
  sortMode: DiscoverySortMode;
  sessionId: string;
}
```

The exact structure may change during implementation, but the following concepts must remain distinct:

- Active results
- Saved items
- Rejected items
- Shelved items
- Current filters
- Free-text intent
- Current session identity

### Suggested interaction command model

```ts
export type DiscoveryCommand =
  | { type: "FILTER_SET"; key: string; value: unknown }
  | { type: "FILTER_CLEAR"; key: string }
  | { type: "QUERY_SET"; value: string }
  | { type: "EXPERIENCE_SAVE"; experienceId: string }
  | { type: "EXPERIENCE_REJECT"; experienceId: string }
  | { type: "EXPERIENCE_SHELF"; experienceId: string }
  | { type: "EXPERIENCE_RESTORE"; experienceId: string }
  | { type: "DISCOVERY_BROADEN"; strategy?: string }
  | { type: "DISCOVERY_RESET" };
```

This command model is intended to make future input adapters straightforward.

A swipe, button, keyboard shortcut, typed instruction, or Atlas request can all produce the same command.

### Persistence

Version 1 may use local persistence.

At minimum, preserve:

- Mood Board items
- Shelved items
- Recent session filters
- Basic repeated interaction signals

Persistence must be isolated behind an interface so that local storage can later be replaced by authenticated server persistence.

### Ranking

Filtering and ranking should remain separate.

- Filtering removes experiences that violate hard constraints.
- Ranking orders the remaining experiences using preferences and signals.

Version 1 may use deterministic ranking rules.

---

## Data Model Changes

The canonical Experience model should support fields needed for practical filtering and later ranking.

At minimum:

```ts
export interface Experience {
  id: string;
  title: string;
  activityTypes: string[];
  location: ExperienceLocation;
  estimatedCost: CostRange;
  duration: DurationRange;
  availability?: AvailabilityRule[];
  companionTypes?: string[];
  moods?: string[];
  tags?: string[];
  media: ExperienceMedia;
}
```

The exact types should align with IMP-002 and the existing Experience model rather than duplicate it.

A separate interaction record should be considered:

```ts
export interface ExperienceInteraction {
  experienceId: string;
  action: "view" | "save" | "reject" | "shelf" | "restore";
  sessionId: string;
  occurredAt: string;
  source: "touch" | "mouse" | "keyboard" | "filter" | "text" | "voice";
}
```

---

## UI and Interaction Changes

### Version 1 controls

The initial implementation should favour clarity over novelty.

Recommended visible controls:

- Heart or Save
- Dismiss or No
- Shelf or Maybe
- Undo or Restore
- Mood Board count
- Clear filter
- Broaden results

### Card body interaction

A card body interaction should inspect the experience without automatically saving it.

Because complete experience pages are not yet ready, Version 1 may use:

- Mobile: full-height sheet or focused overlay
- Desktop: side panel, dialog, or focused overlay

The detail view should preserve the discovery state and return the user to the same position.

### Gestures

Gestures are supported conceptually but may be introduced incrementally.

Target mapping:

- Swipe left: reject
- Swipe right: save
- Swipe up: shelf

Every gesture must have a visible, accessible alternative.

### Motion

Card motion should make state changes understandable without becoming distracting.

Required characteristics:

- Clear entering and leaving behaviour
- No sudden unexplained reordering
- Reduced-motion support
- Stable interaction targets
- Undo available for destructive-looking actions

---

## Mobile Considerations

Mobile is the primary interaction environment.

The first implementation must account for:

- Thumb-friendly action targets
- Safe-area spacing
- Vertical card inspection
- Touch gesture conflicts with page scrolling
- Clear visible controls for users who do not discover gestures
- One-handed use where practical
- Persistent access to the Mood Board
- Fast return from detail inspection to discovery

Desktop should provide equivalent actions through:

- Mouse controls
- Hover affordances where appropriate
- Keyboard focus
- Optional keyboard shortcuts

Desktop must not depend on touch gestures.

---

## Accessibility Considerations

- Every gesture must have a button equivalent.
- Every card action must be keyboard accessible.
- Focus must move predictably when cards leave the active set.
- State changes should be announced to assistive technology.
- Save, reject, and shelf labels must be explicit.
- Colour alone must not communicate state.
- Reduced-motion preferences must be honoured.
- Undo controls must be reachable and clearly named.

---

## Analytics and Learning Signals

Version 1 should record product-learning events, even if only locally during development.

Suggested events:

- Filter applied
- Filter removed
- Result count changed
- Card inspected
- Card saved
- Card rejected
- Card shelved
- Card restored
- Mood Board opened
- Mood Board item removed
- Discovery broadened
- Session reset

These events should help answer:

- Which filters matter most?
- Which filters are rarely used?
- Which combinations reduce results too aggressively?
- How many cards are normally saved before users feel satisfied?
- How often are rejected or shelved items restored?
- Do users prefer buttons, gestures, typing, or future voice interaction?

Analytics must support product learning without prematurely treating every action as a permanent user preference.

---

## Acceptance Criteria

### Shared state

- [ ] Filters and card actions operate on one shared Compass state.
- [ ] UI components do not implement independent filtering logic.
- [ ] Saved, rejected, and shelved states are distinct.

### Discovery behaviour

- [ ] Cards are visible before the user completes any questionnaire.
- [ ] Applying a filter updates the visible cards immediately.
- [ ] Removing a filter can restore matching cards.
- [ ] The user can broaden discovery without resetting the entire session.

### Mood Board

- [ ] Saving adds an experience to the Mood Board.
- [ ] Saving does not imply planning or commitment.
- [ ] Mood Board items remain saved when active filters change.
- [ ] The user can remove an item from the Mood Board.

### Card actions

- [ ] The user can save an experience.
- [ ] The user can reject an experience.
- [ ] The user can shelf an experience.
- [ ] The user can undo or restore at least the most recent removal action.
- [ ] Card-body inspection does not automatically save the card.

### Mobile and accessibility

- [ ] All actions work with touch.
- [ ] All actions have visible non-gesture controls.
- [ ] All actions work with keyboard navigation.
- [ ] Reduced-motion behaviour is supported.

### Persistence

- [ ] Mood Board state survives a page reload.
- [ ] Persistence is behind an abstraction rather than scattered direct storage calls.
- [ ] Session state can be cleared.

### Documentation

- [ ] Product principles are added to ELK Compass.
- [ ] Discovery state architecture is documented.
- [ ] Known limitations and deferred work are recorded.

---

## Test Plan

### Unit tests

- Filter state transitions
- Save transition
- Reject transition
- Shelf transition
- Restore transition
- Broaden transition
- Saved items surviving filter changes
- Session reset

### Integration tests

- Filter control updates the card set
- Card save updates the Mood Board
- Reject removes a card from active results
- Shelf removes a card from active competition without rejecting it
- Undo restores the expected card
- Reload restores persisted Mood Board state

### Interaction tests

- Touch controls
- Mouse controls
- Keyboard navigation
- Focus after card removal
- Detail overlay open and close
- Reduced-motion mode

### Manual product checks

- Does discovery feel continuous?
- Are card changes understandable?
- Does the Mood Board feel inspirational rather than transactional?
- Is it easy to reverse a decision?
- Can users broaden results without feeling they have restarted?
- Does mobile interaction remain comfortable while scrolling?

---

## Open Questions

1. Should swipe-up/shelf ship in the first implementation or begin as a visible button only?
2. What should the first four practical filters be and in what order should they appear?
3. Should typed input ship in this IMP or a follow-up IMP?
4. What exact desktop interaction should correspond to mobile swipe gestures?
5. Should rejected cards reset automatically between sessions?
6. How long should shelved experiences remain shelved?
7. How should Compass distinguish hard constraints from soft preferences in the UI?
8. What minimum number of Mood Board items should trigger a suggestion to broaden discovery?
9. Which repeated signals are strong enough to influence cross-session personalization?
10. What is the first supported transition from Mood Board to Planner?

---

## Deferred Ideas

- Production Atlas voice interaction
- Natural-language parsing into Compass commands
- Automatic weather-aware discovery
- Calendar-aware time constraints
- Group voting on a shared Mood Board
- Collaborative discovery sessions
- Learned recommendation ranking
- User-controlled preference profile
- Full experience pages
- Booking and itinerary creation
- "Show me more like this"
- Serendipity or adjacent-discovery injection
- Cross-device synchronization

---

## Implementation Checklist

- [ ] Read this IMP completely.
- [ ] Read `docs/workflow/ELK_ENGINEERING_WORKFLOW.md`.
- [ ] Confirm alignment with IMP-002 data and filtering models.
- [ ] Resolve or explicitly defer blocking open questions.
- [ ] Implement domain-level discovery commands.
- [ ] Implement shared Compass state.
- [ ] Implement save, reject, shelf, and restore.
- [ ] Implement Mood Board persistence.
- [ ] Implement visible mobile-first controls.
- [ ] Add desktop and keyboard equivalents.
- [ ] Add tests.
- [ ] Complete manual product checks.
- [ ] Update ELK Compass.
- [ ] Produce completion report.

---

## Completion Report

### Implemented

- A framework-free `DiscoveryState`/`DiscoveryCommand`/`discoveryReducer`
  ("Compass") in `src/domain/discovery/discoveryState.ts`, plus derived
  selectors for active/saved/shelved experiences.
- Four distinct experience states: active, saved (Mood Board), rejected
  (session-only), shelved (persisted) — previously only "saved" existed.
- `useDiscoveryEngine` hook wiring the reducer to React, localStorage
  persistence (behind a `DiscoveryPersistence` interface), and a capped
  local interaction/event log.
- Card-body inspection is now separate from saving: clicking/tapping a
  card body opens a focused overlay (`DiscoveryInspectSheet`); it no
  longer saves on its own.
- Always-present, individually focusable Save/Reject/Shelf buttons on
  every card — not hover-gated, so touch and keyboard users have the same
  access as mouse users.
- One-step undo (`lastRemoved` in state) surfaced as a toast after
  reject/shelf.
- Mood Board extended with a Shelved tab and "broaden" controls (clear
  filters; restore rejected ideas).
- A free-text `query` field wired into the shared Compass state, with a
  simple substring-match search input added to the filter panel.
- Focus is moved to a stable anchor (the Filters toggle) after a card
  leaves the active field, so keyboard focus never silently drops to
  `<body>`.
- Result-count, filter, save/reject/shelf/restore, Mood Board, broaden,
  and session-reset events are logged locally (recorded, not yet acted on
  — see Deviations).

### Files changed

- New: `src/domain/discovery/discoveryState.ts`,
  `src/domain/discovery/selectors.ts`, `src/domain/discovery/persistence.ts`,
  `src/domain/discovery/interactions.ts`,
  `src/domain/discovery/discoveryState.test.ts`,
  `src/domain/discovery/persistence.test.ts`,
  `src/components/labs/discovery-space/useDiscoveryEngine.ts`,
  `src/components/labs/discovery-space/DiscoveryInspectSheet.tsx`,
  `src/components/labs/discovery-space/DiscoveryCard.test.tsx`.
- Changed: `src/components/labs/discovery-space/DiscoverySpace.tsx` (rewired
  to the new engine), `DiscoveryCard.tsx` (save/reject/shelf controls,
  inspect-vs-save separation), `MoodBoard.tsx` (shelved tab, broaden
  controls), `DiscoveryFilters.tsx` (+ query input, + ref for focus
  management), `DiscoveryFilters.test.tsx` (updated for the new props).
- Incidental test-infra fix: `vitest.setup.ts` (localStorage polyfill +
  RTL `cleanup()` — see Known limitations in the Compass entry for why).

### Tests

- 49 automated tests passing (`npx vitest run`): reducer unit tests
  (filter/save/reject/shelf/restore/broaden/session-reset, including
  "saved survives filter and broaden changes"), persistence round-trip
  tests, and DiscoveryCard interaction tests (inspect vs. save/reject/shelf
  independence, no cross-triggering).
- Existing Playwright regression suite (Adventure/Plan core loop, unrelated
  to Discovery) re-run and passing — confirms this change didn't affect
  the rest of the app.
- Manual smoke check: production build, `/labs/discovery-space` returns
  200 with no error markers and the new UI (Filters, Mood Board) present
  in the rendered HTML.
- **Not done** (see Known limitations): the Test Plan's full touch/mouse/
  keyboard interaction matrix, reduced-motion visual verification, and all
  "Manual product checks" (does discovery feel continuous, do card changes
  feel understandable, etc.) — these need a human in an actual browser.

### Acceptance criteria

Shared state, Discovery behaviour, Mood Board, Card actions, and
Persistence sections: met. Mobile and accessibility section: met at the
structural level (every action is a real, labeled, keyboard-reachable
`<button>`; reduced-motion is respected for this IMP's new UI) but **not
verified on an actual touch device** — only via code review and DOM
structure, not physical touch testing. Documentation: this Compass entry
plus this report.

### Deviations

- **`activeExperienceIds` is derived, not stored.** The spec's suggested
  `DiscoveryState` shape lists it as a field; it's implemented as a
  selector (`selectActiveExperiences`) instead, per the spec's own
  allowance ("the exact structure may change during implementation").
  Avoids a second source of truth that could desync from filters/saved/
  rejected/shelved.
- **Rejected items are not persisted**, even though the spec's Persistence
  section is ambiguous on this point. Chosen because the same section's
  "at minimum, preserve" list omits rejected items, and persisting them
  would risk silently hiding a category forever across sessions — which
  Product Principle 11 ("learn, but do not lock in") explicitly warns
  against.
- **Session reset preserves saved (Mood Board) items.** The spec doesn't
  fully specify this; resolved using the "session state vs. remembered
  preference state" architecture decision already in the spec — Mood Board
  is a deliberate collection, not session noise.
- **Interaction event log is recorded but not acted on.** Open Question 9
  (which signals should influence cross-session personalization) is
  explicitly deferred rather than guessed at.

Open Questions 1–8 and 10 were resolved conservatively in favor of the
simplest version consistent with the spec's own hints (see inline code
comments in `discoveryState.ts` and `useDiscoveryEngine.ts`): buttons
before gestures, the four filters already shown in the UX section, query
as a plumbing-only substring match, no swipe-to-desktop mapping needed
(buttons-only), indefinite shelf duration, all filters treated as hard
constraints for now, manual (not automatic) broaden prompts, no Mood
Board → Planner transition yet.

### Known limitations

- Full touch-gesture and exhaustive keyboard-navigation-through-the-whole-
  flow tests were not written — deferred to whoever does the manual
  product pass, or a follow-up hardening IMP.
- Broad reduced-motion coverage for Discovery's _ambient_ field (drift,
  "sign of life" presets, Peripheral Temptation) was intentionally left
  alone — that's IMP-003's explicit territory, and this IMP only covers
  the reduced-motion behaviour of what it newly added (inspect overlay,
  undo toast).
- The interaction event log has no viewer/dashboard yet — it's inspectable
  only via `readDiscoveryEventLog()` in a console.
- `DiscoveryFilters` gained a `ref` prop using React 19's ref-as-prop
  (no `forwardRef`) — consistent with the rest of this codebase's React 19
  usage, noted here only because it's a newer pattern.

### Follow-up IMPs

- A hardening pass covering the full touch/keyboard/reduced-motion
  interaction test matrix and the Test Plan's "Manual product checks."
- Deciding which interaction signals (if any) should influence
  cross-session personalization (Open Question 9), and building that on
  top of the event log this IMP already records.
- The first Mood Board → Planner transition (Open Question 10).
- IMP-003 (Discovery Animation and Living Card Performance) remains
  unstarted and unrelated to this work — still pending.

---

## ELK Compass Updates

When this IMP is implemented, ELK Compass must be updated with:

- Continuous discovery as a core product behaviour
- Multiple input adapters over one Compass engine
- Shared discovery command model
- Mood Board as vibe, not commitment
- Save, reject, shelf, and restore domain states
- Session state versus remembered preference state
- Mobile-first gesture model with accessible alternatives
- Cross-session learning without lock-in
- Separation of filtering from ranking
- Discovery narrowing and broadening as reversible operations
- The product principles defined in this IMP
