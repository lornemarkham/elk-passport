# IMP-005 --- Living Discovery Cards and Video Seduction

**Product:** ELK Passport

## Status

- [x] Draft
- [ ] Architecture Reviewed
- [ ] Ready for Build
- [x] Active
- [x] Implemented
- [x] Tested
- [x] Compass Updated
- [ ] Closed

<!-- Architecture Reviewed / Ready for Build not checked: this IMP was
     implemented directly on explicit user instruction ("take it from
     pending, the whole file is there") rather than through a separate
     formal architecture-review step per docs/workflow/ELK_ENGINEERING_
     WORKFLOW.md. Noted as a deviation, not silently skipped — see the
     Completion Report below. Not Closed: that's an approval step, not
     something this session does for itself. -->

## Objective

Transform Discovery into a living, emotionally inviting field without
changing Passport/Atlas architecture.

This IMP changes presentation only.

### Included

- Ambient floating
- Video cards
- Hover seduction
- Pointer proximity
- Dragging
- Throwing
- Settling
- Reduced-motion support
- Performance tuning

### Excluded

- Atlas
- APIs
- Database
- Experience schema
- Recommendation logic

## Videos

Place in:

```text
public/video/discovery/
```

- campfire-summer.mp4
- mountain-biking-summer.mp4
- paddle-board-summer.mp4
- steak-summer.mp4
- winery-summer.mp4

## Motion

States:

1.  Ambient
2.  Proximity
3.  Hover
4.  Dragging
5.  Settling

Priority:

Dragging \> Settling \> Hover \> Proximity \> Ambient

### Ambient

- 1--4px horizontal drift
- 2--6px vertical drift
- ±0.3° rotation
- 8--16 second duration
- independent timing

### Hover

- scale 1.02--1.03
- subtle lift
- brighter video
- stronger shadow
- slower release than entry

### Videos

Autoplay, muted, loop, playsInline.

Campfire should be the showcase.

### Drag

Cards should feel physical with pointer capture and a grabbing cursor.

### Throw

Grab → Move → Release → Continue → Slow → Settle

Use velocity limits, friction, and safe boundaries.

## Performance

- transforms only
- opacity only
- requestAnimationFrame pointer updates
- stable random motion
- graceful fallback if video fails

## Implementation Slices

A. Videos

B. Ambient Motion

C. Hover + Proximity

D. Dragging

E. Throwing

F. Polish

## Validation

Run:

```bash
npm run typecheck
npm test
npm run build
```

Inspect:

http://localhost:3100/labs/discovery-space

Goal:

Discovery should feel alive, calm, tactile, and quietly seductive---not
loud or distracting.

---

## Completion Report

### Implemented

- Priority-ordered card motion (Dragging > Settling > Hover > Proximity
  > Ambient) in `DiscoveryCard.tsx`. Ambient drift/rotation retuned to
  > this IMP's tighter ranges (1–4px / 2–6px / ±0.3° / 8–16s), rescaled
  > from the existing per-card layout values rather than hand-editing all
  > 20 field-presentation records.
- Hover: subtle relative scale bump, small lift, brighter video (scrim
  dims on hover), stronger shadow, asymmetric fast-entry/slow-release
  transition.
- Drag-to-throw via Framer Motion's native `drag` + momentum
  (`dragTransition` power/timeConstant/bounce), constrained to the
  field's own container. Ambient drift resumes from wherever a card was
  actually thrown, via explicit `useMotionValue`s captured at the
  moment dragging settles (see Deviations — the naive version glided
  every thrown card back to its origin).
- Reduced motion: dragging itself stays enabled (direct manipulation);
  only the post-release momentum glide is suppressed.
- Video fallback (`onError`) added to `DiscoveryCard` — it didn't have
  one before, unlike the standalone `PassportVideoCard` it was modeled
  on.
- Four new Living Passport videos copied from Atlas (mountain biking,
  paddle board, winery, steak) alongside the existing Campfire one, all
  reorganized under `public/video/discovery/`.

### Files changed

- New: `public/video/discovery/{campfire,mountain-biking,paddle-board,
steak,winery}-summer.mp4`, `docs/compass/discovery-living-cards.md`.
- Changed: `src/components/labs/discovery-space/DiscoveryCard.tsx`
  (motion state machine, drag/throw, hover retune, video fallback, the
  drag/inspect-click fix), `DiscoveryCard.test.tsx` (new required prop),
  `DiscoverySpace.tsx` (passes the container ref down for drag
  constraints), `fieldPresentation.ts` (video path update + 4 new
  assignments), `src/domain/experience/seedExperiences.ts` (Campfire's
  video path), `src/app/labs/campfire-card/page.tsx` (video path),
  `vitest.setup.ts` (matchMedia polyfill).
- Also changed, as an unrelated bug fix found during manual testing:
  `useDiscoveryEngine.ts`, `src/domain/discovery/discoveryState.ts` (new
  `HYDRATE_PERSISTED` command) — see Deviations.

### Tests

- All 49 automated tests pass (`npm test`): unchanged pre-existing
  suite plus the updated `DiscoveryCard.test.tsx`.
- `npm run typecheck`, `npm run lint`, `npm run build` all pass.
- Manual browser verification (this is where the two real bugs below
  were actually found, not from the automated suite):
  - All 5 videos render and play in the live field.
  - Hover shows the subtle scale/lift/brighter-video/shadow treatment.
  - Drag-and-throw tested via synthetic `PointerEvent` sequences (a
    single coarse `left_click_drag` did not generate enough granular
    pointer movement for Framer's gesture recognizer — same class of
    limitation noted in prior IMPs' completion reports); confirmed a
    card settles near its release point and ambient drift resumes from
    there, not the origin.
  - Save/Reject/Shelf/Inspect still work correctly on a card that was
    just dragged.
  - No console errors after both fixes below were applied.
- **Not done**: verification on a physical touch device; reproducing
  `prefers-reduced-motion: reduce` in a live reload (forcing it before
  first paint isn't scriptable after the fact with the tools available
  this session) — reduced-motion correctness here rests on code review
  against the already-proven `usePrefersReducedMotion` hook, not a live
  repro.

### Deviations

- **Two real bugs were found and fixed during manual verification, not
  called for by the IMP:**
  1. A pre-existing IMP-004 hydration bug (`useDiscoveryEngine` reading
     `localStorage` synchronously during the initial render, differing
     between server and client for any visitor with real persisted
     state) was blocking the very page this IMP modifies. Fixed by
     deferring persisted-state loading to a post-mount effect via a new
     `HYDRATE_PERSISTED` command.
  2. Adding `drag` to a card silently broke click-to-inspect (Framer's
     drag pointerdown handling suppressed the nested inspect button's
     native click). Fixed via `onTap` on the same draggable element,
     which correctly disambiguates a tap from a drag.
- **A throw's resting position had to be captured explicitly** — not
  anticipated when `drag` was first wired up. Ambient keyframes are an
  offset sequence through 0; without capturing where a throw actually
  landed, resuming ambient drift snapped every thrown card back to its
  pre-drag position. Fixed with explicit `useMotionValue`s read at the
  moment "settling" ends.
- **`steak-summer.mp4` was assigned to BBQ Feast.** The IMP lists the
  five video filenames without mapping them to specific experiences;
  this mapping (along with mountain-biking → Mountain Bike, paddle-
  board → Paddle Board, winery → Winery, all unambiguous) was my
  judgment call for the one genuinely ambiguous case.
- **Ambient motion ranges were retuned, not left as prototype values.**
  The IMP gives explicit new ranges (1–4px/2–6px/±0.3°/8–16s); the
  existing per-card `driftX`/`driftY`/`duration` layout values (6–14px/
  7–15px/21–34s) were rescaled into these ranges via a `remap()`
  helper rather than hand-editing all 20 field-presentation records —
  preserves each card's independent timing/variety while honestly
  reflecting the new tighter spec.
- **This IMP did not go through a separate Architecture Reviewed /
  Ready for Build gate** per `docs/workflow/ELK_ENGINEERING_WORKFLOW.md`
  — implemented directly on explicit user instruction after the file
  was confirmed complete. Noted in the Status block above rather than
  silently checked off.
- **Drag boundaries are the field's full container**, not a more
  precise "avoid the Mood Board region" exclusion zone. The IMP asks
  for "safe boundaries" without specifying the exact shape; the
  simplest literal reading (the field's own container) was implemented.

### Performance observations

Not formally profiled — that measurement is explicitly IMP-003's job,
not this IMP's (see its own "do not prematurely rewrite animation
architecture" scope note, unchanged by this work). Informally: no
dropped-frame or jank complaints surfaced during manual testing with 5
simultaneous looping videos plus the existing Peripheral Temptation/
"sign of life" layers, but this is not a substitute for IMP-003's
actual measurement pass.

### Follow-up IMPs

- IMP-003 (Discovery Animation and Living Card Performance) remains
  unstarted — still the right place to measure whether 5 videos plus
  drag plus the existing ambient/temptation layers together cause any
  real performance problem.
- A possible future IMP: precise drag boundaries that keep thrown cards
  clear of the Mood Board panel specifically, rather than just the
  field's outer container.
- A possible future IMP: extend the video/Tier-1 treatment to more of
  the 20 seed experiences, per the "~20 flagship Okanagan experiences"
  strategy in `docs/passport-vision.md`.
