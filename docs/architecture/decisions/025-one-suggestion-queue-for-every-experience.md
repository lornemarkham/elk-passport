# 025 · One suggestion queue for every experience

**Proposed:** 2026-11-23, by mission 1005 for the owner's brief _PASSPORT —
UNIVERSAL COMMUNITY CONTRIBUTIONS_. **Status:** PROPOSED — implemented on
local `main`; no migration. The brief authorises the feature ("build one
reusable community contribution system … do not build separate submission
systems for each experience"); the storage and identity choices below are
this mission's and need the owner's yes.

## Context

Three ways to tell Passport about something existed, each its own queue:
the Christmas lights map's pins (reviewed by the administrator, stored as
one document in the insiders store), the Local Insider Network's listings
(reviewed by ambassadors and administrators, their own document in the same
store, handed to Atlas as candidate sources on publication, ADR 018), and
nothing at all on Hockey Night, Snow Day or Date Night. The lights map also
refused anyone's sixth pin of a day.

## Decision

1. **One suggestion type, one document, one queue.** A `Suggestion` (name,
   category, location in words with optional coordinates, when, website,
   description, photo, the experience it came from) lives in one versioned
   document (`community-suggestions`) in `passport_insider_docs`, written by
   compare-and-swap like the lights and the network. Photos are documents
   beside it. No new table, migration or secret. The administrator reviews
   it at `/contribute/review`; nothing in it is ever public.
2. **One component, mounted everywhere.** `SuggestSomething` captures the
   experience from its mount; an experience is a slug, not an entry in a
   registry, so a new one needs no change to the system.
3. **Abuse protection is pace and moderation, never a daily count.** The
   rules (`domain/contributions/guard.ts`) are shared by the suggestion queue
   and the lights map: a burst pauses with a retry time; three spam declines
   among the last five decisions pause a contributor for a day; a flood stop
   of 1000 waiting. Exact repeats by the same person return the suggestion
   already waiting. This removes the lights map's 5/10-a-day caps.
4. **A contributor is a keyed hash, and milestones count approvals across
   queues.** Signed in: a hash of the email. Otherwise: a hash of a random
   browser token shared with the lights form (`xmas-lights-device` adopted),
   else the address. Milestones (1 · 5 · 10 · 25 · 50) count approved
   suggestions plus approved lights pins under any of a person's keys.
   **An anonymous contributor is recognised on one device only**; the UI
   says so rather than inventing a cross-device count.
5. **Atlas gets facts by hand; the one write seam is shared.** Approving a
   suggestion with a website queues the page as an Atlas candidate source
   through `queueCandidateSource`, extracted from the insiders service so
   both queues use one seam. Everything else is _Copy for Atlas_. Automatic
   ingestion is deliberately not built.

## The conflicts, named

- **Three reviewed queues remain** (suggestions, lights pins, network
  listings), linked from each other. The brief forbids a second _submission
  system_ per experience, and this ADR gives every experience one; it does
  not merge the two older queues, whose flows (photo-first pins; verified
  dates and ambassador publishing) are different products. Whether the
  network's form should fold into this one is the owner's call.
- **Christmas-themed milestone titles** (Mission 1000) versus the universal
  five (this brief) for the same counts: built universal; open for the
  owner.
- **Passport holds a little more discovery-adjacent data** than ADR 018
  already conceded: suggestions nobody has checked. They are shown to the
  administrator alone, so "Atlas is the source of truth for discovery data"
  is not touched by this.

## Consequences

- Reversible: no schema; removing the mounts removes the feature; the
  document can be deleted.
- Rate limits are per server instance (`lib/server/rateLimit.ts`), the pure
  pace rule is per contributor in the document: together they bound a loop
  from one address and a loop from one person.
- The lights map's `MAX_WAITING` now reads the shared constant (1000).
- Informs §15.15 ("this entity sucks"): a suggestion is a note to a
  reviewer with facts, not a vote; the same shape could carry a correction
  about an existing Atlas entity later.
