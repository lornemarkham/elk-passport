# 003 · A built day needs a starting point — PROPOSED, needs a human decision

**Proposed:** 2026-10-11 · **Status:** implemented on `fix/ghad-understand-intent`, **not approved**

## The problem

M200 typed _"Taking my family out this afternoon"_ into `/go` with no town and
got Queen Elizabeth Theatre (Vancouver), a park 173 km away, then another 83 km
past that. The builder had no origin, so it had no circle.

## What this branch does

`/go` does not build a day until a starting town exists. It reuses one it was
told (`?at=` from Discovery, a town named in the sentence, a town already
chosen in this tab) and otherwise asks: a town picker, and — only if the
person taps it — "Use my location", which maps a rounded position to the
nearest covered town (Environment Canada is asked for a forecast with it; no
position is stored). Passport never picks a start.

## Why this is a decision and not a bugfix

Doctrine §4: _"Do not force 'How much time do you have?' before showing
anything."_ §15.5 — _when to proactively ask for constraints_ — is **open**.
This applies asking to **building a day only** (a day without a start is a
fiction, §7) and leaves Discovery untouched, but it is a judgement about an
open question and is recorded here rather than buried.

## Alternatives not taken

- Show a province-wide set of possibilities and offer a start afterwards
  (closer to §4; weaker on "never build a province-spanning day").
- Default to the nearest covered town to the device without asking (rejected:
  silent invention of a starting point).

## To resolve

A human picks one of the above, and §15.5 is then edited to say so.
