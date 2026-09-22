# ADR 001 — Devices are instruments, not mirrors

**Status:** accepted · **Date:** 2026-09-22 · **Origin:** the first physical
screening of Witching Hour v0 (`docs/product/october-experience-bible.md` §25)

## Decision

A Passport experience does not belong to a screen. It can move between and
coordinate the devices around the people participating in it. **Each device
is an instrument, not a mirror.** There is no permanently primary or secondary
device; attention and control can move between them as part of the
experience.

## Consequences we are committing to

1. **No device is structurally primary.** Any multi-device experience must be
   able to make either device the owner of attention at a given moment, and to
   let the other go dormant. Code may name a device "director" or "prop" for
   one authored cut — Witching Hour v0 does — but that is the cut's choice,
   never the framework's.
2. **A device's capabilities change the cut, not the quality.** An instrument
   the room lacks (iPhone has no vibration) means October composes with a
   different instrument (a low thump through headphones, the other device's
   speaker), not a degraded version of the same idea. Passport never shows
   "your browser does not support X".
3. **Devices share a session, not a state.** Cues and observations pass
   between them; the experience is what happens across both. Nothing about
   this requires a durable record — v0 uses an ephemeral broadcast channel
   with no table, no row and no account, and that is sufficient until an
   experience proves it needs more.
4. **The transition between devices is part of the experience**, not setup
   to be hidden. Recruiting a second device may itself carry atmosphere.
5. **Restraint is a capability.** Device dormancy and device re-entry —
   letting a device be forgotten so it can return — are only possible if the
   framework does not insist every device stay live, synced and animated.
   A "keep everything in sync everywhere" architecture would foreclose the
   most effective technique we have found.

## What this deliberately does not decide

- No generalised multi-device framework, Director, or Scene Engine. One scene
  exists. Abstractions are extracted after a second, materially different
  experience argues with the first.
- The vocabulary (Scene · Surface · Thing · Moment · Thread · Callback ·
  Director) is **provisional** and lives in the bible, not here.
- Nothing about camera, motion or any permissioned sensor. Those remain
  candidates with the boundaries stated in the bible.

## Why this is an ADR and not only a creative note

It constrains code that has not been written yet. The obvious next
implementation — a shared session object every device mirrors — is the one
this decision rules out, and it would be cheap to build and expensive to
unbuild. Recording the principle now is what stops it being built by default.

## Evidence

The desktop asked for the phone; the phone was placed face down beside the
monitor and forgotten; it thumped; the person picked it up and read "I didn't
tell you to pick it up"; while they read, the desktop's left-hand tree ceased
to exist. On real hardware this produced laughter, "oh heck yeah", and the
sense that the browser had briefly stopped being the mental model. The reverse
direction — phone holds attention, desktop returns with a sound — was not
built and is the next thing to test.
