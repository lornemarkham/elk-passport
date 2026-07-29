# IMP-002 — Discovery Filter Foundation

**Status:** Implemented — awaiting approval (2026-07-28). Per the documented workflow (`docs/passport-vision.md`, "Development workflow"), moving this file to `completed/` is an approval step, not something done automatically as part of implementation. See the completion report delivered alongside this implementation for full details.  
**Project:** ELK Atlas / ELK Passport  
**Primary surface:** `/labs/discovery-space`  
**Depends on:** Existing Discovery Space and Passport card system  
**Reference implementation:** Campfire Living Passport Card

---

## 1. Goal

Build the first working version of the filtering foundation that will power:

- Manual Discovery filtering now
- Mood Board narrowing next
- Planner inputs later
- Atlas conversational filtering in the future

This implementation must establish the shared data and filtering contracts without overbuilding the final interface.

The manual filter experience is not disposable. Atlas will eventually manipulate the same filter state through conversation or voice.

---

## 2. Product Context

Discovery currently presents floating experience cards, including the first working Living Passport Card for Campfire.

The page is visually compelling enough to continue, but the cards do not yet share a structured data model that allows the product to narrow experiences based on what a person wants.

The intended product sequence is:

```text
Experience Library
        ↓
Discovery + Manual Filtering
        ↓
Mood Board
        ↓
Plan Request
        ↓
Suggested Day / Weekend
```

Atlas will later replace or supplement manual inputs, but it must use the same underlying filter state and selection engine.

---

## 3. Scope

This IMP includes:

- A canonical `Experience` data model
- A canonical `DiscoveryFilterState` model
- A pure filtering function
- A minimal first-pass manual filter interface
- Integration with the Discovery Space
- Clear empty and reset states
- Tests for the filtering rules
- Mandatory updates to ELK Compass and project documentation

This IMP does **not** include:

- Final visual polish of the filter interface
- Voice input
- Atlas conversation
- AI recommendations
- Personalized ranking
- Database population at scale
- Full Mood Board implementation
- Itinerary generation
- Animation optimization for the Campfire card
- Radius or travel-time calculations beyond defining fields that will support them later

---

## 4. Architecture Principle

The core filtering logic must not live inside a React component.

```text
Experience data
      +
DiscoveryFilterState
      ↓
Pure Compass filtering function
      ↓
Filtered Experience[]
      ↓
Discovery UI
```

Future consumers must be able to use the same contracts:

- Discovery
- Mood Board
- Planner
- Atlas text
- Atlas voice
- Search
- Recommendation systems

---

## 5. Canonical Experience Model

Create one source of truth for an experience.

Suggested location:

```text
src/domain/experience/types.ts
```

Initial contract:

```ts
export type ExperienceTier = 1 | 2 | 3;

export type PriceLevel = 0 | 1 | 2 | 3 | 4;

export type EnergyLevel = 1 | 2 | 3 | 4 | 5;

export interface ExperienceLocation {
  name: string;
  latitude?: number;
  longitude?: number;
  region?: string;
}

export interface ExperienceDuration {
  minMinutes: number;
  maxMinutes: number;
}

export interface ExperienceMedia {
  type: "video" | "image" | "animation";
  src: string;
  posterSrc?: string;
  alt?: string;
}

export interface Experience {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  description?: string;

  tier: ExperienceTier;
  heroMedia?: ExperienceMedia;

  moods: string[];
  activities: string[];
  seasons: string[];
  timeOfDay: string[];
  weather: string[];
  companions: string[];

  energyLevel: EnergyLevel;
  priceLevel: PriceLevel;
  duration: ExperienceDuration;

  familyFriendly: boolean;
  petFriendly: boolean;
  accessible?: boolean;
  requiresReservation: boolean;

  location?: ExperienceLocation;
  pairsWith?: string[];

  isActive: boolean;
}
```

### Data-model rules

- Use stable IDs and slugs.
- Store normalized machine-readable values, not display copy.
- Avoid embedding UI layout or animation coordinates in the domain model.
- Do not add fields without an immediate or clearly documented future use.
- Prefer arrays where an experience can match multiple values.
- Keep media metadata separate from behavioural filtering metadata.

---

## 6. Experience Tiers

The data model must support the agreed three-tier system.

### Tier 1 — Living AI Scenes

- AI-generated video or highly animated media
- Reserved for approximately the top 20 flagship Okanagan experiences
- Campfire is the first reference implementation

### Tier 2 — Interactive Magic

- Strong still imagery
- CSS, pointer, parallax, particles, hover, breathing, or similar interaction
- Does not require a full generated video

### Tier 3 — Authentic Photography

- Real photography where authenticity is more valuable than animation
- Useful for venues, food, accommodations, practical details, and local proof

Tier must influence presentation, not filtering relevance by default.

---

## 7. Canonical Filter State

Suggested location:

```text
src/domain/discovery/types.ts
```

Initial contract:

```ts
export interface DiscoveryFilterState {
  moods: string[];
  activities: string[];
  seasons: string[];
  timeOfDay: string[];
  weather: string[];
  companions: string[];

  maxEnergyLevel?: number;
  maxPriceLevel?: number;
  maxDurationMinutes?: number;

  familyFriendly?: boolean;
  petFriendly?: boolean;
  accessible?: boolean;
  requiresReservation?: boolean;

  radiusKm?: number;
  origin?: {
    latitude: number;
    longitude: number;
  };
}
```

### First-release filters

The initial working UI should expose only a useful subset:

- Mood
- Activity
- Length of time
- Energy
- Budget
- Companions
- Season
- Reset all

Radius is structurally anticipated but may remain disabled or omitted until location data is reliable.

---

## 8. Filtering Semantics

Suggested location:

```text
src/domain/discovery/filterExperiences.ts
```

API:

```ts
export function filterExperiences(
  experiences: Experience[],
  filters: DiscoveryFilterState,
): Experience[];
```

Rules:

1. Inactive experiences are always excluded.
2. Separate filter categories combine using **AND**.
3. Multiple values within one category initially combine using **OR**.
4. Empty categories do not restrict results.
5. `maxEnergyLevel` includes experiences at or below the selected value.
6. `maxPriceLevel` includes experiences at or below the selected value.
7. `maxDurationMinutes` matches when the experience minimum duration can fit inside the available time.
8. Boolean filters only restrict results when explicitly set.
9. Filtering must not mutate the source experience array or filter state.
10. Results should preserve source order until ranking is deliberately introduced.

Example:

```text
Mood: relaxing OR romantic
AND
Season: summer
AND
Duration: fits within 4 hours
AND
Energy: 3 or below
```

---

## 9. Seed Data

Create a small typed seed set using the experiences already visible in Discovery.

Suggested minimum:

- Campfire
- Coffee
- BBQ Feast
- Fire Lookout
- Helicopter Tour
- Wake Boat
- Mountain Bike
- Live Music
- Paddle Board
- Hidden Beach
- Lake Cruise
- Spa Escape
- Chef Dinner
- Stargazing
- Winery
- Ice Fishing
- Snowmobile
- Sunset Dock
- Cabin
- Hot Springs

Do not attempt perfect production metadata yet.

The purpose of the seed set is to validate:

- The schema
- Filtering behaviour
- Discovery integration
- The shape of future database records

Mark uncertain metadata clearly in code comments or supporting documentation rather than presenting guesses as verified facts.

---

## 10. Manual Filter UI

The first interface should be functional, compact, and reversible.

Required behaviour:

- A control opens or reveals filters without destroying the Discovery composition.
- Selected filters are visible.
- Users can remove one filter.
- Users can reset all filters.
- The visible card set updates immediately.
- The UI reports the remaining result count.
- No-results state gives a clear reset action.
- Existing Mood Board selections must not be silently deleted when filtering hides a card.
- Keyboard interaction must remain usable.
- Mobile interaction must not depend on hover.

The first implementation may use simple chips, buttons, checkboxes, or a compact panel. Do not over-polish this surface before the filtering model is proven.

---

## 11. Discovery Integration

Replace the Discovery page's direct rendering of an unfiltered hard-coded card list with:

```ts
const filteredExperiences = filterExperiences(
  experiences,
  discoveryFilterState,
);
```

The existing spatial card layout may remain imperfect.

Important:

- Filtering must not create new random positions on every render.
- Card identities must use stable keys.
- Existing Campfire living-card functionality must remain intact.
- Filtering should not reset video playback unnecessarily.
- Do not combine animation optimization into this IMP unless filtering makes the page unusable.

---

## 12. Performance and Animation Constraint

The Campfire video has made existing animation feel chunkier.

That issue is real but separate.

Create or update a follow-up item for:

```text
IMP — Discovery Animation and Living Card Performance
```

Potential investigation areas:

- Render frequency caused by filter state
- Stable memoized card data
- Framer Motion layout calculations
- Video decoding and compositing
- `requestAnimationFrame` usage
- Reduced off-screen animation work
- IntersectionObserver for video playback
- GPU-heavy blur and transparency layers

Do not prematurely rewrite animation architecture inside this filtering IMP.

---

## 13. Tests

Add focused tests for the pure filtering function.

Minimum cases:

- No filters returns all active experiences.
- Inactive experiences are excluded.
- One mood filter works.
- Multiple moods use OR.
- Mood plus season uses AND.
- Energy ceiling works.
- Budget ceiling works.
- Duration fitting works.
- Boolean filters work only when explicitly selected.
- Input arrays and objects are not mutated.
- No-results case returns an empty array.

Also add at least one integration-level test confirming the Discovery result count changes when a user applies and clears a filter.

---

## 14. Acceptance Criteria

- [ ] A canonical typed `Experience` model exists.
- [ ] A canonical typed `DiscoveryFilterState` exists.
- [ ] Discovery experiences use typed seed data.
- [ ] A pure, independently testable filtering function exists.
- [ ] The initial manual filters affect the cards shown in Discovery.
- [ ] Users can remove individual filters.
- [ ] Users can reset all filters.
- [ ] Remaining result count is visible.
- [ ] A useful no-results state exists.
- [ ] Campfire remains a Living Passport Card.
- [ ] Existing selected-board state is preserved when cards are filtered out.
- [ ] Filtering tests pass.
- [ ] No unnecessary AI, voice, planner, or recommendation work is introduced.
- [ ] ELK Compass and all mandatory project records are updated.

---

## 15. Mandatory ELK Compass Update

This IMP is **not complete** until ELK Compass is updated with the accumulated project knowledge from the recent implementation session.

Update the appropriate Compass roadmap, checklist, architecture, vision, and investigation documents. Do not merely mark this IMP complete.

### A. Record the product architecture

Document this product flow:

```text
Experience Library
        ↓
Compass filtering and narrowing
        ↓
Discovery
        ↓
Mood Board
        ↓
Planner
        ↓
Atlas conversational / voice interface
```

Clarify:

- Cards are the content atoms, not the entire product.
- Manual filtering is Version 1 of Atlas input, not disposable work.
- Atlas will eventually manipulate the same shared filter state.
- Mood Board captures intent and selections after narrowing.
- Planner uses narrowed and selected experiences to produce day or weekend ideas.
- Users must be able to return between Discovery and Mood Board.
- Filtering may happen at different depths as users become more specific.

### B. Record the Living Passport Card milestone

Document:

- Campfire is the first working Living Passport Card.
- It uses a generated video inside the Discovery Space.
- The interaction has been proven, although motion and page animation require optimization.
- The implementation serves as the reference prototype, not yet a fully polished blueprint.
- AI media should become a defining Passport characteristic.
- Not all experiences require video; use the three-tier system.

### C. Record the three-tier media system

Add:

1. Tier 1 — Living AI Scenes
2. Tier 2 — Interactive Magic
3. Tier 3 — Authentic Photography

Also record the current strategy:

- Approximately 20 flagship Okanagan experiences may become Tier 1.
- Supporting experiences can use Tier 2 and Tier 3.
- Tier represents how alive the presentation should feel, not whether the experience is important.

### D. Record the media architecture decision

Canonical public media structure:

```text
public/
  assets/
    video/
    images/
    animations/
    audio/
```

Rules:

- Large public media is referenced with root-relative URLs.
- Example: `/assets/video/campfire-summer.mp4`
- Generated videos should not use build-time JavaScript imports.
- `src/assets` is reserved for assets that genuinely need to be bundled or imported.
- Asset path and filename checks must be part of implementation verification.
- The Campfire debugging session revealed both a path mismatch and a filename typo; future IMPs should verify the actual HTTP URL early.

### E. Record the development workflow

Document the standard flow:

```text
Idea
  ↓
IMP
  ↓
docs/implementation-specs/pending/
  ↓
Claude implementation
  ↓
Testing and deviations report
  ↓
Approval
  ↓
Reference or completed archive
```

Vocabulary:

- “IMP” means implementation specification.
- Future instructions may be as compact as: “New IMP in pending. Go.”
- Claude must report deviations and reasons.
- An IMP is not complete until project tracking is updated.

### F. Record the `/labs` convention

Document:

- Experimental and reference interactions should be viewable through dedicated `/labs/...` routes.
- Labs allow isolated testing before production integration.
- Current examples include Discovery Space and Campfire Card.
- Labs should not become a second product architecture; promoted work must have a clear path into the real product.

### G. Update the roadmap and checklist

Add or update the following sequence:

- [x] First Living Passport Card prototype
- [x] Public media convention established
- [ ] Experience data model
- [ ] Discovery filter state
- [ ] Compass filtering function
- [ ] Manual Discovery filter UI
- [ ] Discovery filtering integration
- [ ] Experience database/repository integration
- [ ] Mood Board
- [ ] Planner
- [ ] Atlas text/voice input
- [ ] Discovery animation and video performance
- [ ] Populate initial high-quality Okanagan experience dataset
- [ ] Identify approximately 20 Tier 1 flagship experiences

### H. Record open questions

Add unresolved decisions to the appropriate investigation document:

- Which filters are hard exclusions versus preferences?
- Should multiple selected values within a category use OR permanently?
- How will radius be calculated and what is the origin source?
- How should unavailable, seasonal, weather-dependent, or reservation-only experiences behave?
- When should ranking replace source-order results?
- How will Mood Board selections influence recommendation weights?
- Which experience metadata is verified, editorial, partner-provided, or inferred?
- What is the minimum useful experience count before database population becomes a priority?
- How will real-time availability eventually integrate without blocking the first release?

### I. Record implementation discoveries

Add:

- Next.js public assets map literally from `public/...` to root-relative URLs.
- A missing video can trigger `onError`, set fallback state, and remove the `<video>` node after hydration.
- Server-rendered HTML can prove whether the element existed before the client error.
- Directly checking the media URL should be an early diagnostic step.
- The browser extension can disconnect and is not a reliable single source of truth.
- Use server-side checks such as `curl`, filesystem inspection, and rendered HTML when necessary.
- Avoid interpreting the absence of a post-error DOM node as proof it never rendered.

---

## 16. Mandatory Completion Report

When implementation is complete, report:

1. Files created and changed
2. Exact filter categories implemented
3. Filtering semantics used
4. Test results
5. Any deviations from this IMP and why
6. Performance effects observed
7. ELK Compass files updated
8. Follow-up IMPs discovered
9. Whether this implementation is ready to become a reference

Do not declare completion without the ELK Compass update.
