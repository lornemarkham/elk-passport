# Motion Principles

Scope: anything that moves, transitions, or animates. Motion in Passport communicates meaning — it is not decoration layered on afterward.

## Core rule

Motion should build anticipation, reveal information progressively, celebrate meaningful choices, and confirm actions — never delay routine ones, and never move just to look alive.

## What motion is for

Passport moves people from _"I have time off, but I don't know what to do"_ to _"THIS IS GOING TO BE DOPE."_ Motion is one of the primary tools for that shift, because anticipation is not a waiting room before the real experience — it is part of the payoff (`/14-science-of-meaningful-experiences.md` §4). A well-paced reveal is doing real emotional work, not just looking nice.

That means motion has different jobs at different stages of the core loop:

- **Discovery / Plan** — invite curiosity. Slow, ambient, exploratory. The person should want to move their mouse or scroll around because something might catch their eye, not because a UI element told them where to look.
- **Reveal** — build and pay off anticipation. Paced, sequential, a little theatrical. This is the one place where a slower, more deliberate rhythm is earned.
- **Experience / Adventure Mode** — get out of the way. Fast, minimal, functional. Nobody wants a flourish between "what's now" and "what's next" while they're mid-adventure.
- **Confirmation** — the motion _is_ the feedback. See below.

## Principles

1. **Never bounce, pulse, shake, or move quickly for ambient/idle states.** Ambient motion (things drifting, floating, breathing) should feel like leaves in still air — slow, continuous, independently timed per element so nothing reads as a synchronized loop. Fast, sharp motion is reserved for direct responses to a person's own action (a tap, a swipe), never for things sitting idle on screen.
2. **Curiosity lives in a narrow band.** Enough novelty to be interesting, not so much that it's chaotic or illegible (`/14-science-of-meaningful-experiences.md` §6). A field of cards that drift is inviting; a field of cards that swap positions or flash is noise.
3. **Hover should invite, not just react.** A hover state's job is to make the next action obvious and appealing — subtle scale, sharpened focus, a brightened edge. It should never be the thing that first teaches someone the element is interactive; that should already be visually apparent.
4. **The animation is the confirmation.** When an action succeeds, its own motion — an element settling into its new place, a smooth transition into a collection — is the feedback. Do not add a toast, alert, or "Saved!" banner on top of a successful animation; doubling the feedback undercuts the first, better signal.
5. **Motion must never gate a routine action.** If someone needs to wait for an animation to finish before they can do the next normal thing, the motion has become a tax, not a feature. Reveal-stage theatricality is the deliberate exception, not the default.
6. **Reuse motion, don't reinvent it per screen.** Shared timing curves and shared motion components keep pacing and personality consistent across the product instead of every screen inventing its own feel. See [`engineering-principles.md`](./engineering-principles.md).
7. **Target 60fps, always.** A stutter breaks the exact feeling motion was added to create. If a motion idea can't run smoothly on a mid-range phone, simplify it rather than ship it janky.

## A working example

`/labs/discovery-space` (`src/components/labs/discovery-space/DiscoveryCard.tsx`) is a reference implementation of ambient discovery motion: continuous, independently-timed drift per card (varied duration/delay so nothing synchronizes), a hover state that enlarges/sharpens/brightens without ever snapping, and a click that animates the card directly into the Mood Board with no confirming toast — the shared-layout transition itself is the "saved" signal. Use it as the calibration reference for "how much motion is enough" at the discovery/plan stage specifically; Adventure Mode should look and feel calmer and faster than this, per the table above.

## Explicit anti-patterns

- Idle elements that bounce, pulse, shake, or move at anything faster than a gentle drift.
- A toast, alert, or badge confirming an action whose own animation already confirmed it.
- Motion that must complete before a routine next step (typing, tapping a primary button) becomes available.
- A different easing/timing feel on every screen because motion was implemented per-component instead of shared.
