# Discovery Lab v0.4 — Peripheral Temptation

**Status:** In Progress

Not Complete. Not yet classified Keep / Adapt / Reject — that decision happens
after it's experienced in the browser.

## Hypothesis

Tiny, unscripted events occurring away from the user's current attention will
redirect exploration more naturally than conventional hover feedback.

## Why It Matters

Tests whether Discovery can quietly invite attention while still feeling like
a world with its own life rather than an interface performing for the cursor.

## Evaluation Questions

- Did any event make me change direction?
- Did it feel witnessed rather than triggered?
- Was it subtle enough to create uncertainty?
- Did silence between events make each moment more valuable?
- Did any effect look like ordinary interface animation?
- Did any event feel like a call to action?
- Did the field remain interesting while the cursor was still?
- Did the experiment interfere with dragging?
- Did it interfere with hover?
- Did it interfere with Mood Board interactions?
- Did it interfere with idle personalities?
- Would I miss this layer if it were removed?

## Implementation

See `temptation/` for the scheduler, effect renderers, and timing constants.
Removal: delete the `temptation/` directory, drop the `usePeripheralTemptation`
call and `<CardTemptation>` render in `DiscoverySpace.tsx` / `DiscoveryCard.tsx`,
and drop the `temptation` field from `Experience` in `types.ts`. Nothing else
depends on this layer.
