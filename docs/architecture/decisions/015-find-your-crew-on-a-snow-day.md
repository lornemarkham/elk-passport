# 015 · Find your crew: opt-in, temporary location on a snow day

**Proposed:** 2026-11-07 by lane snow (mission "Snow Day P0") · **Decided:**
the mission brief asked for it in the owner's words (_"Location sharing must
be opt-in, temporary and privacy-preserving"_); this ADR records how, and
**awaits the owner's confirmation** that ADR 011's "one case only" may widen to
a second. **Status:** implemented on `feature/snow`; migration proposed in
`docs/product/snow/location-migration.sql`, **not applied anywhere**.

## Context

ADR 011 let members of one conference show each other where they are,
"for one case only", and kept ADR 002's rule (Passport stores no position of a
person) for everything else. A group on a mountain has the same need: people
spread over a hill and a base area, with no signal for stretches, wanting to
find the others at lunch. Snow's own words-only check-in ("Chair 2 base")
stays, and is right for a one-phone day.

## Decision

Snow days get the ADR 011 shape, for **shared** snow days only:

- Nothing is shared until a person taps a length (30 min, 1 h, 2 h, 4 h); the
  phone's permission prompt comes first.
- Every share ends by itself, at most 4 h, and can only be ended or restarted,
  never lengthened (no UPDATE grant on the end time).
- **Mutual:** you see the crew only while you are sharing, and they see you.
- About 11 m (4 decimal places), rounded in Postgres; at most one update per
  10 s; updates only while the page is open (no background tracking).
- Stop deletes the row. Leaving a day, "We're done", and deleting the day erase
  it. Expired rows are unreadable, then purged on the next ask.
- Members of a snow day only; the people on the wire are the core's random
  member ids. No account id, no log of a position.
- If the table is absent the screen says so; it does not pretend.

## What it overturns, and how far

ADR 011's "for one case only" becomes two cases: a conference and a shared
snow day. Hockey Arena's self-declared places, Date Night and everything else
keep the old rule. Doctrine §15.8 (privacy and consent for richer context) is
answered for one more capability in one more kind of group, not in general.

## Rejected

- **A host who can see everyone.** Nobody is watched without also being seen,
  and the host has no more power over a position than anyone (they cannot even
  read it unless sharing).
- **Always-on or background sharing.** No service worker; doctrine §6.
- **Speed, distance, runs, vertical or a leaderboard from position.** There is
  no code path from a position to a score; challenges never reward risk.

## Still open

- Whether this should be a general adventure-core capability rather than a
  Snow table (Conference and Snow now each have one).
- Whether an organiser/host switch to turn it off for a day is wanted.
