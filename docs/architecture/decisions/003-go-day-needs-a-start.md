# 003 · A built day needs a starting point — ACCEPTED for building a day

**Proposed:** 2026-10-11 · **Accepted:** 2026-10-11, by the human-written mission brief for M207 ("Require a known starting town before building a day") · **Scope:** `/go` only

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

## Decision (M207)

The family-test release mission states the requirement in a person's words:
_require a known starting town before building a day; remember the selected
starting town where appropriate; preserve user control over location
permissions._ So the first option above stands, for **building a day only**.

"Remember" is implemented as an **offer**, not a default: the last town
somebody tapped is kept on the device (`src/lib/go/lastStart.ts`, a town id,
no position) and shown first in "Where does the adventure begin?". It is never
applied without a tap, because the person may be somewhere else today.

§15.5 stays open for everything else (Discovery, the helper). The doctrine
says so.
