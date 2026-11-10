# 018 · The Local Insider Network is a reviewed queue in front of Atlas

**Proposed:** 2026-11-09, by mission 683 for the owner's brief _P0: Local
Insider Network_. **Status:** PROPOSED — implemented on local `main`, migration
`20261111000000_passport_insiders.sql` not yet applied to production. The
brief authorises the feature; the storage choice below is this mission's and
needs the owner's yes.

## Context

The brief asks for locals to submit events, clubs, experiences and
communities; for ambassadors and administrators to review them; and for an
approved discovery to "enter Atlas" and "appear on Go Have A Day". It also
says **"Atlas remains the source of truth for discovery data."**

Passport has exactly one write seam into Atlas's knowledge: queueing a URL as
an Atlas **candidate source** (`POST /admin/candidate-sources`, `ADMIN_TOKEN`,
the curator workbench's own route). Atlas reads it with its own fetcher,
provenance rules and review, on its own schedule. There is no Passport route
that creates an Atlas entity from structured fields, and building one is
Atlas's work, not Passport's (doctrine §17: Atlas changes are Atlas missions).

So "enters Atlas" and "appears on Go Have a Day today" cannot both mean "an
Atlas entity exists" without an Atlas change.

## Decision

1. **Submissions, the review trail and ambassadors live in Passport** as one
   versioned JSON document (`passport_insider_docs`), written by
   compare-and-swap — CourtQueue's store (ADR 017), reused, in its own table,
   reached only through SECURITY DEFINER functions keyed by a server secret
   derived from the Atlas token. No new secret, no anon access.
2. **A published listing is handed to Atlas** by queueing its organizer page
   as a candidate source (`sourceType: community-listing`,
   `discoveryBasis: first-party-url`, a reason naming the listing and its
   provenance). What happened is recorded on the listing (`queued`,
   `already-queued`, `not-configured`, `failed`, `no-url`).
3. **Go Have a Day shows published listings from the network** — on
   `/local`, `/local/[id]` and Discovery's "From the locals" section — in
   their own section, labelled as local listings, never mixed into Atlas's
   results. When Atlas holds the thing, a reviewer links the Atlas entity id
   and the card links to Atlas's page.
4. **Nothing is shown that nobody checked.** A date or registration link is
   public only once a person marked it checked against a named page; an event
   is "upcoming" only with a checked date still ahead; a past event shows as
   past with its page. Members-only or ask-first listings need the
   organizer's permission recorded. A duplicate (same page, or same name in
   the same town) joins the existing listing as a correction.
5. **Ambassadors are Passport accounts** an administrator invited by email
   (verified email required, as for the admin gate). Administrators are the
   existing `ADMIN_EMAILS` curators. Trusted ambassadors review and publish
   their own checked listings directly; others wait for review.

## The conflict, named

This makes Passport hold a small amount of discovery data (the network's
listings) that Atlas does not yet hold. That is a departure from "Atlas is the
source of truth for discovery data", bounded by: listings are shown only in
their own section; every one is queued to Atlas on publication; and an Atlas
entity, once linked, becomes what the card points to. **The owner decides**
whether that is acceptable, or whether listings should stay invisible until
Atlas has read them (the follow-up Atlas brief in
`docs/product/insiders/ATLAS-BRIEF.md` is the way to make that wait short).

## Consequences

- Reversible: the migration is additive; removing the section removes the
  feature; the queued Atlas candidates stand on their own.
- The AI reader only copies (`mergeReading` drops any value not in the text);
  without `OPENAI_API_KEY` the rules read alone and posters cannot be read.
- Photos are read and discarded; only the words read from them are kept.
- Informs §15.15 ("this entity sucks"): a listing's _Something wrong?_ is a
  note for a reviewer with a reason, never a vote, and changes no fact.
