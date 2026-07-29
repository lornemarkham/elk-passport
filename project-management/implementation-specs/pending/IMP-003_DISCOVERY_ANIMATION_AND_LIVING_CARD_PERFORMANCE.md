# IMP-003 — Discovery Animation and Living Card Performance

**Status:** Pending (not started)
**Project:** ELK Passport
**Primary surface:** `/labs/discovery-space`
**Depends on:** Campfire Living Passport Card, IMP-002 (Discovery Filter Foundation)
**Origin:** Called out as a required follow-up by IMP-002 §12 — not implemented as part of that IMP on purpose.

---

## 1. Goal

Investigate and address why Discovery's ambient animation (card drift, idle "sign of life" presets, Peripheral Temptation effects) feels chunkier since the Campfire Living Passport Card and its cursor-pan video were added, and now that IMP-002's filtering layer re-renders the field on every filter change.

This is an investigation IMP first, an optimization IMP second. Do not assume the cause before measuring it.

---

## 2. Why this is separate from IMP-002

IMP-002 explicitly deferred this: "Do not combine animation optimization into this IMP unless filtering makes the page unusable." Filtering did not make the page unusable, so animation work was not done there. The chunkiness predates IMP-002 (it was noticed during the Campfire card's own implementation) and is a distinct problem with a distinct root cause space.

---

## 3. Suspected contributing factors (unconfirmed)

- Render frequency caused by filter state changes in `DiscoverySpace.tsx` (each filter change currently re-runs `filterExperiences` and remaps every visible card via `toFieldExperience`, even though `FIELD_PRESENTATION` itself is stable).
- Whether card data (layout, presentation) is memoized enough to avoid unnecessary re-renders of unaffected cards when the filtered set changes.
- Framer Motion layout calculations — every field card uses `layout="position"` plus continuous `animate` keyframe loops; whether these compose cleanly with more cards being mounted/unmounted as filters change.
- Video decoding and compositing cost for the Campfire card, especially alongside the existing blur/opacity-heavy aura and idle-life layers.
- `requestAnimationFrame` usage: the Campfire card's `useCursorPan` hook runs its own rAF loop per video-bearing card, independent of Framer Motion's own animation scheduling.
- Off-screen animation work: cards that scroll or get filtered out of view may still be animating.
- No `IntersectionObserver` currently pauses video playback or ambient animation for cards that are off-screen or hidden by filtering.
- GPU cost of the multiple `blur-3xl` aura/life-preset layers per card, now potentially stacked with video compositing on Campfire specifically.

---

## 4. Scope

This IMP should:

- Measure before optimizing (React DevTools Profiler, Chrome Performance panel, or equivalent) to identify which of the suspected factors above actually matter.
- Only then choose targeted fixes — e.g., memoizing card lists, pausing off-screen video/animation via `IntersectionObserver`, reducing redundant re-renders on filter change.
- Report actual measurements, not assumptions, in the completion report.

This IMP should **not**:

- Rewrite the animation architecture (Framer Motion usage, the drift/life-preset system, Peripheral Temptation) wholesale.
- Change the Campfire card's visual design or interaction.
- Be used as an excuse to also add new Discovery features.

---

## 5. Acceptance Criteria

- [ ] Actual performance measurements are recorded (not assumed).
- [ ] Root cause(s) of the perceived chunkiness are identified with evidence.
- [ ] Any fixes applied are targeted at the measured cause(s), not speculative.
- [ ] Existing Discovery behavior (filtering, Mood Board, Peripheral Temptation, Campfire card) remains intact.
- [ ] Findings and any fixes are recorded in ELK Compass documentation.
