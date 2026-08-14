# Living Discovery Cards and Video Seduction (Compass)

_ELK Compass entry. Durable architectural knowledge from IMP-005 —
Living Discovery Cards and Video Seduction. Product surface: ELK
Passport, `/labs/discovery-space`. Builds on the Discovery Engine
("Compass") from IMP-004 — see `docs/compass/discovery-engine.md` —
and the Living Passport Card / three-tier media system from IMP-002/
the Campfire card (see `docs/passport-vision.md`)._

## What this is

Discovery's field of cards previously felt largely static: a fixed
ambient drift, a single video (Campfire), and no way to physically
relocate a card. IMP-005 adds a small, explicit motion-priority system
and drag-to-throw, without touching the domain model, filtering,
persistence, or Mood Board architecture IMP-002/IMP-004 already
established.

## Motion priority

Each card's motion is governed by exactly one active state at a time,
in this priority order (highest wins):

```text
Dragging > Settling > Hover > Proximity > Ambient
```

- **Ambient** — a continuous, deliberately subtle drift/rotation loop
  (1–4px horizontal, 2–6px vertical, ±0.3°, 8–16s, independent per
  card). Tighter than the original prototype's ranges (up to ~14px,
  21–34s) — the earlier ranges were "still feels largely static... or
  distracting," which this IMP exists to fix.
- **Proximity** — unchanged from IMP-002/the original Discovery Lab
  work: a quiet aura bloom as the cursor approaches, before hover
  commits to anything.
- **Hover** — a subtle relative scale bump (not an absolute value —
  that would erase the per-card depth illusion), a small lift, a
  brighter video (the dark scrim dims on hover rather than the video
  itself brightening), a stronger shadow, and a deliberately asymmetric
  transition: fast to enter, slower to release.
- **Dragging / Settling** — see below. While either is active, the
  ambient keyframes are _entirely omitted_ from the card's `animate`
  prop (not just paused) — including them, even as a no-op target,
  would fight Framer's own control of the same x/y motion values
  during a drag or its post-release momentum glide.

## Drag and throw

Implemented with Framer Motion's native `drag` + momentum rather than
hand-rolled velocity/friction physics — Framer's `dragTransition`
(power/timeConstant/bounceStiffness/bounceDamping) already expresses
exactly the "grab → move → release → continue → slow → settle" arc the
IMP describes. Constrained to the field's own container (a ref passed
down from `DiscoverySpace`).

**A throw's resting position had to be captured explicitly.** The
naive version — resuming the ambient loop once a drag ends — visibly
glided every thrown card back to its _original_, pre-drag position.
Cause: the ambient keyframes are written as an offset sequence through
0 (e.g. `x: [0, driftX*0.55, ..., 0]`); once Framer's `animate` prop
includes x/y again, it interpolates from wherever the value currently
sits to keyframe 0 — snapping the card home. Fix: `x`/`y` are explicit
`useMotionValue`s (not Framer-implicit ones), read via `.get()` the
moment the post-drag "settling" timer fires, and stored in state as
the new ambient base — every subsequent keyframe is offset by that
base rather than assumed to be 0. This is worth remembering for any
future "return to a loop after a manual interaction ends" pattern:
loops anchored to a literal 0 silently discard wherever direct
manipulation left the value.

**Reduced motion and drag are not all-or-nothing.** Direct
manipulation (dragging itself) stays enabled even when
`prefers-reduced-motion: reduce` is set — the user is doing it, not the
interface. Only the _momentum glide after release_ is suppressed
(`dragMomentum={!prefersReducedMotion}`), since continuing to move
after the user has stopped touching the card is automatic motion in
exactly the sense reduced-motion preferences are about.

## A drag + nested-click conflict, found by manual browser testing

Adding `drag` to a card's outer element silently broke click-to-inspect
— Framer's drag pointerdown handling suppressed the native `click` that
would otherwise fire on the nested, absolutely-positioned inspect
button (IMP-004's card-body-inspection surface). **The existing
component test did not catch this**: it drives the button directly via
`fireEvent.click`, which never goes through real pointer events, so it
can't detect pointer-level interference from a sibling gesture
recognizer. This was only found by testing an actual click in a real
browser.

Fix: pointer/touch inspection now happens via `onTap` on the same
outer element that has `drag` — Framer's own tap gesture already
correctly disambiguates "a tap" from "a drag that happened to start
here." The inner button's `onClick` is kept, unchanged, purely for
keyboard activation (Enter/Space dispatch a click without ever going
through pointerdown, so it was never actually affected by this bug).

**Takeaway for future work in this codebase:** wherever `drag` is
added to an element that already contains its own nested click target,
verify the click path in a real browser, not just via existing
jsdom/RTL tests — this class of bug is invisible to synthetic
`fireEvent` tests by construction.

## Video

Five Living Passport videos now render in Discovery (was one —
Campfire): Campfire, Mountain Bike, Paddle Board, Winery, and BBQ Feast
(the "steak" video — a naming/experience mapping the IMP didn't specify
explicitly, resolved as a judgment call). Assets moved from a flat
`public/video/` to `public/video/discovery/`, matching the media
architecture convention already recorded in `docs/passport-vision.md`.

Every video-bearing card now has the same `onError` fallback the
standalone `PassportVideoCard` already had and `DiscoveryCard` was
missing: on failure, the video is removed from the tree and the
existing glow/text rendering underneath serves as the fallback, with no
separate fallback UI needed.

## An unrelated hydration bug, found and fixed along the way

Not part of this IMP's scope, but blocking manual verification of it:
`useDiscoveryEngine`'s `useReducer` lazy initializer read persisted
Mood Board/shelved/filter state from `localStorage` synchronously
during the first render — always empty on the server, real data on the
client for any returning visitor with something saved. This produced a
genuine server/client hydration mismatch (different active card sets,
different DOM), which is a pre-existing IMP-004 bug, not something
IMP-005 introduced. Fixed by making the initial state identical on
server and client, and applying persisted state via a new
`HYDRATE_PERSISTED` command dispatched from a `useEffect` after mount
— an ordinary post-hydration update, not a mismatch. See
`docs/compass/discovery-engine.md` for where this fix lives
structurally; recorded here because it's what this IMP's manual
testing actually surfaced.

## Deferred / not done here

- Full touch-gesture verification (this was verified via synthetic
  pointer events and a real-browser manual pass, not a physical touch
  device).
- Reduced-motion behavior for the new ambient/hover/drag work was
  verified by code review against the already-proven
  `usePrefersReducedMotion` hook, not reproduced live in a browser
  (forcing `prefers-reduced-motion` before a page's first paint isn't
  straightforward to script after the fact).
- Broader Discovery animation performance (render frequency, GPU cost
  of stacked blur/video layers) remains IMP-003's explicit, still-
  unstarted territory — not touched here.
