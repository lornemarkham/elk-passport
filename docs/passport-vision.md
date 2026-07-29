# Passport — Product Vision

**Status:** Vision, not a spec. Captured from Atlas Discovery Session #001 (2026-07-25).
**Important boundary:** This document describes a _consumer product_ that reasons over Atlas. It is deliberately kept separate from `docs/architecture.md` — Atlas's own architecture must remain free of any named consumer product's concerns (see `docs/architecture.md` §1, "Purpose and scope"). This file is where Passport-specific thinking lives instead.

---

## What Passport is not

Passport is **not fundamentally**:

- a tourism website
- an itinerary builder
- a recommendation engine

Those are implementation expressions — things Passport might _do_ — not what Passport _is for_. Treating any one of them as the mission risks optimizing for the wrong thing.

## What Passport is for

**Working vision:** Help people create memorable real-world experiences. Travel is the medium. Living well is the objective.

Passport should begin from human intent, not from categories. Examples of the kind of input Passport should be able to reason from directly:

- "I want to reconnect with my wife."
- "I want to feel alive again."
- "I have kids."
- "I only have two hours."

These are goals, not filters. Activities (and the Places/Events that host them) are _possible solutions_ to a goal — Passport's job is to optimize for meaningful outcomes, not to match keywords against categories.

## Relationship to Atlas

- **Atlas is responsible for understanding reality** — Places, Organizations, Activities, Events, the relationships between them, and the evidence behind every claim.
- **Passport is responsible for understanding people** — their intent, constraints, and emotional goals, expressed in human language.
- **Passport reasons over Atlas.** It translates human goals into questions about world knowledge, traverses Atlas's knowledge graph to find candidate answers, and translates Atlas's canonical concepts back into human language the person actually used.

Neither side replaces the other. Atlas without Passport is just accurate data with no way to reach a person's actual intent. Passport without Atlas has nothing real to reason over.

## Human language vs. canonical reality

A recurring distinction from discovery: what Atlas calls something and what a person calls it are not the same, and collapsing them loses information in both directions.

| Canonical (Atlas) | Human (Passport)  |
| ----------------- | ----------------- |
| Product           | Food              |
| Activity          | "Something fun"   |
| Place             | "Somewhere quiet" |

Atlas must understand and preserve canonical reality — precise, source-independent, provable. Passport must communicate using human concepts — the fuzzy, intent-laden language people actually use. This distinction is expected to influence future design decisions on both sides and is not resolved here (see `docs/open-investigations.md` for the open questions it raises: what a "Traveler" is, and how human intent / emotional goals should be represented).

## Principles

- Atlas models reality. Passport models people.
- Recommendations emerge by connecting those two models — not by Atlas performing recommendation logic itself (Atlas explicitly does not do this; see `docs/architecture.md` §1 and §2).
- Atlas should preserve canonical truth. Passport should preserve human language. Neither replaces the other; both are required.

---

## Product Architecture and Implementation Status

**Added 2026-07-28, by IMP-002 (Discovery Filter Foundation).** Unlike the sections above, this part of the document is not vision — it records what has actually been built in the `elk-passport` Next.js application, and where it's headed next. It lives here rather than in `docs/architecture.md` because that document is Atlas's own frozen, consumer-product-unaware architecture (see its header); this is exactly the "Passport-specific thinking" this file is for.

### Product flow

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

- Cards (Discovery's floating experience cards) are the content atoms, not the entire product — Discovery is one surface that reads from a shared Experience Library and a shared filter contract.
- Manual filtering (built in IMP-002) is Version 1 of Atlas input, not disposable prototype work. Its contracts — the canonical `Experience` model (`src/domain/experience/types.ts`) and `DiscoveryFilterState` (`src/domain/discovery/types.ts`), narrowed by the pure `filterExperiences` function (`src/domain/discovery/filterExperiences.ts`) — are meant to be the same ones Mood Board narrowing, Planner inputs, and eventually Atlas conversational/voice filtering all drive and consume.
- Mood Board captures intent and selections after narrowing, and must survive filter changes: a saved experience stays saved even if a later filter would have excluded it from Discovery's field (implemented in `DiscoverySpace.tsx` by looking selections up from the full, unfiltered experience list).
- Planner (existing `/plan` flow) is expected to eventually consume narrowed + selected experiences to produce day/weekend ideas — not yet wired to the new domain model as of IMP-002.
- Users must be able to return between Discovery and Mood Board freely; nothing about filtering should make that one-directional.
- Filtering may happen at different depths as users become more specific — the current manual UI (chips/buttons for Mood, Activity, Season, Companions, Energy, Budget, Length of time) is intentionally the coarsest version of this.

### Living Passport Card milestone

- **Campfire is the first working Living Passport Card** — `src/components/passport/PassportVideoCard.tsx`, also integrated directly into a Discovery Space card (`src/components/labs/discovery-space/DiscoveryCard.tsx`) via the shared `src/components/passport/useCursorPan.ts` hook.
- It uses a generated video (`campfire-summer.mp4`) inside the Discovery Space, cropped and cursor-panned via `object-position`, not a literal video player UI.
- The interaction (cursor-driven horizontal pan, reduced-motion aware, no React re-renders during mouse movement) has been proven in the browser, although Discovery's overall motion and page animation need optimization — tracked separately as IMP-003, precisely so this milestone isn't blocked on that work.
- This implementation is the reference prototype for what a Living Passport Card is. As of IMP-005 (2026-07-28), five cards use it (Campfire, Mountain Bike, Paddle Board, Winery, BBQ Feast) — see `docs/compass/discovery-living-cards.md`; 15 of the 20 seed experiences are still Tier 2/3 with no video.
- AI-generated media is intended to become a defining Passport characteristic over time, not a one-off effect on a single card.
- Not every experience needs video — see the three-tier system below.

### Three-tier media system

1. **Tier 1 — Living AI Scenes.** AI-generated video or highly animated media. Reserved for roughly the top 20 flagship Okanagan experiences. Campfire is the first reference implementation.
2. **Tier 2 — Interactive Magic.** Strong still imagery plus CSS/pointer/parallax/particle/hover/breathing-style interaction (e.g. Discovery's existing Peripheral Temptation effects — ember, steam, ripple, glint, shooting-star, window-glow). Does not require a full generated video.
3. **Tier 3 — Authentic Photography.** Real photography, where authenticity matters more than animation — venues, food, accommodations, practical details, local proof.

Current strategy: approximately 20 flagship Okanagan experiences may become Tier 1; supporting experiences use Tier 2 and Tier 3. **Tier represents how alive the presentation should feel, not whether the experience is important** — a Tier 3 experience is not a lesser one. The canonical `Experience.tier` field (`src/domain/experience/types.ts`) is typed `1 | 2 | 3` and is explicitly documented there to influence presentation, not filtering relevance, by default.

### Media architecture decision

Canonical public media structure (established during the Campfire card work, reaffirmed in IMP-002):

```text
public/
  assets/
    video/
    images/
    animations/
    audio/
```

Rules:

- Large public media is referenced with root-relative URLs — e.g. `/video/campfire-summer.mp4` (the `elk-passport` app currently serves this specific file from `public/video/`, not yet reorganized under the `public/assets/...` convention above; a real reorganization is future cleanup, not yet done).
- Generated videos must not use build-time JavaScript imports (`import x from "./video.mp4"`) — Next.js/Turbopack has no built-in loader for that, unlike Vite/CRA-style bundlers. Reference the file as a plain string path served from `public/` instead.
- `src/assets` is reserved for assets that genuinely need to be bundled or imported by the build — not for large video/image media.
- Asset path and filename checks must be part of implementation verification for any future media-bearing IMP — check the actual HTTP response (`curl`, or the served file's `Content-Type`), not just that a file exists somewhere on disk.
- The Campfire debugging session (prior to IMP-002) revealed both a path mismatch (the spec's suggested `src/assets/video/...` import path doesn't work in this Next.js app) and, separately, that the real asset file existed in a _different sibling project_ (`elk-atlas/public/assets/video/`) than the one being built (`elk-passport`) — a full project/repo mismatch, not just a folder typo. Future IMPs spanning both repos should verify which repo an asset actually needs to live in early, not assume.

### Development workflow

```text
Idea
  ↓
IMP (implementation specification)
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

- "IMP" means implementation specification.
- Future instructions may be as compact as: "New IMP in pending. Go."
- Claude must report deviations and reasons — not silently deviate.
- An IMP is not complete until project tracking (this document, `docs/open-investigations.md`, and any relevant checklist) is updated. Moving an IMP file from `pending/` to `completed/` is an _approval_ step, not something Claude does unilaterally as part of implementing it — see the workflow diagram above; approval comes before archiving.

### The `/labs` convention

- Experimental and reference interactions are viewable through dedicated `/labs/...` routes in `elk-passport` — currently `/labs/discovery-space` and `/labs/campfire-card`.
- Labs allow isolated testing before production integration, without needing to wire a new interaction into the real product surfaces first.
- Labs should not become a second product architecture. Promoted work (like the Campfire card, which moved from its own `/labs/campfire-card` prototype into a real Discovery Space card) must have a clear path into the real product rather than living in `/labs` indefinitely.

### Roadmap and checklist

- [x] First Living Passport Card prototype (Campfire, `/labs/campfire-card` and Discovery Space)
- [x] Public media convention established (`public/video/`, root-relative URLs; full `public/assets/...` reorganization still pending)
- [x] Experience data model (`src/domain/experience/types.ts`, IMP-002)
- [x] Discovery filter state (`src/domain/discovery/types.ts`, IMP-002)
- [x] Compass filtering function (`src/domain/discovery/filterExperiences.ts`, IMP-002)
- [x] Manual Discovery filter UI (`src/components/labs/discovery-space/DiscoveryFilters.tsx`, IMP-002)
- [x] Discovery filtering integration (`DiscoverySpace.tsx` now filters via the domain layer, IMP-002)
- [x] Discovery Compass engine — save/reject/shelf/restore, one shared `DiscoveryState`/`DiscoveryCommand` reducer, local persistence behind an interface, card-body inspection separated from saving (IMP-004; see `docs/compass/discovery-engine.md`)
- [x] Mood Board — Saved + Shelved tabs, broaden controls (clear filters / restore rejected), one-step undo (IMP-004). Still local-storage-backed, not a full standalone product surface with its own route.
- [x] Living card motion — ambient/hover/proximity/drag/throw priority system, drag-to-throw with Framer momentum, 5 Living Passport videos in Discovery (was 1) (IMP-005; see `docs/compass/discovery-living-cards.md`)
- [ ] Experience database/repository integration (seed data is still a static in-repo file, not Supabase-backed)
- [ ] Planner (existing `/plan` flow predates the domain model and is not yet wired to it)
- [ ] Atlas text/voice input (Discovery already has a plain substring `query` field wired into Compass, from IMP-004, ready for a real input adapter to drive)
- [ ] Discovery animation and video performance (IMP-003, still pending — not resolved by IMP-005's motion work, which was scoped to the priority system and drag, not render/compositing cost)
- [ ] Populate initial high-quality Okanagan experience dataset (current 20 seed records are editorial placeholders, not verified data — see `src/domain/experience/seedExperiences.ts`)
- [ ] Identify approximately 20 Tier 1 flagship experiences (only Campfire is Tier 1 so far)

---

_This document was a captured vision, not an implementation plan, when first written (2026-07-25). As of IMP-005 (2026-07-28), a real `elk-passport` Next.js application exists with working Discovery Space, filtering, a full Compass interaction engine (save/reject/shelf/restore), Mood Board, living card motion (ambient/hover/drag/throw), and five Living Passport Cards — see "Product Architecture and Implementation Status" above and `docs/compass/` for what's actually been built. Open questions this vision surfaces are tracked in `docs/open-investigations.md`, not answered here._
