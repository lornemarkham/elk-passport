# ADR 008 — A curated Vancouver list beside Atlas, for Hockey and Conference

**Status:** accepted for Hockey Night and Go Have A Conference · **Date:**
2026-10-19 · **Source:** the owner's _Vancouver Experience Release_ brief
("They should share a curated collection … We must not wait for Atlas
ingestion improvements … Preserve a clean path for Atlas integration later").

## Context

Hockey Night (Rogers Arena) and Go Have A Conference (Vancouver Convention
Centre) both need a handful of real places a walk away: where to eat, where to
drink, where to meet, something to do for an hour. Hockey's picker was
Atlas-only, so an Atlas outage, or a place Atlas has not ingested, left the
group with nothing to vote on. Conference's free-time page had only doors into
Go Have A Day. Atlas ingestion is being overhauled separately and has no date.

## Decision

- `src/domain/collections/places.ts` defines a `CuratedPlace`: a stable
  `curated:<city>:<slug>` id, kind (restaurant, bar, meeting, venue,
  activity), address, neighbourhood, `[lat, lng]`, one honest sentence, and
  its **source** — the OpenStreetMap element the address and coordinates were
  checked against, the date, and for restaurants and bars the web page that
  showed it still trading.
- `src/domain/collections/vancouver.ts` holds 28 downtown places, checked
  2026-10-19. Small on purpose; a person adds and removes entries.
- **Atlas wins.** Hockey's picker lists Atlas food and drink first and adds a
  curated restaurant or bar only where no Atlas record has the same name (or
  the entry's `atlasId`). Setting `atlasId` on an entry, once Atlas holds the
  place, is the whole integration step. The OSM reference is what an Atlas
  ingest would match on.
- Every distance is a straight line with a walking floor, labelled as such,
  exactly as Hockey's nearby already did (`walkLabel`, now shared).
- Hockey gains one template question, "Where are we meeting?", whose options
  are the curated meeting points within 1 km of the venue plus "Just meet at
  our seats"; it joins the plan beside "Eating". Nights created before this
  have no rule row for it and simply do not show it.
- Conference's `discover` module lists the curated places, grouped, measured
  from the Convention Centre West, when the conference's town is Vancouver.

## What this is not

Not a place database, not ranking, not hours or prices, and not an answer to
the doctrine's open Experience-architecture question (§10): it is a shared
_capability_ (a list), not shared UI. It does not change what Atlas is for —
"Atlas understands; Passport inspires" — it covers a gap Atlas has today, and
says so on the page ("the short list it keeps itself").

## Open

- Conference distances assume the Convention Centre. A conference held
  elsewhere in Vancouver would want a venue field on `ConferenceDetails`; that
  is a contract change for `passport-domain`, not made here.
- Whether curated entries should flow into Atlas as evidence is the doctrine's
  open question 11, untouched.
