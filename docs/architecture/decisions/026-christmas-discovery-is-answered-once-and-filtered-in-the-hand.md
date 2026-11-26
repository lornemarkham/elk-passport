# 026 · Christmas discovery is answered once and filtered in the hand

**Proposed:** 2026-11-26, by mission 1128 for the owner's brief _GoHaveADay
Christmas — One Beautiful Experience_. **Status:** PROPOSED — implemented on
`feature/christmas`; no migration, no new dependency, no shared contract
touched. The brief decides the product ("Christmas Home and Discover are the
SAME experience", multi-select categories, availability before choice, SPA
responsiveness); the shape below is this mission's.

## Context

Christmas had two pages competing to be the front door: `/christmas` (the
hero, six ways, four finds, a "season's best" row, a link to everything)
and `/christmas/discover` (where | when | how far, one category at a time).
Every category tap was a server navigation that re-read the corpus and
re-ranked it, so a family asking for markets _and_ lights _and_ festive food
could not, and each tap waited on the server. Categories were offered whether
or not they held anything for the day asked.

## Decision

1. **One page.** `/christmas` holds discovery as a section (`#discover`).
   `/christmas/discover` is a server redirect to it that carries every query
   parameter (but `all=`), so QR codes, shares and bookmarks keep working.
2. **One server answer per place, days and distance.** `finderData`
   (`src/domain/christmas/finder.ts`) answers the ask for _every_ category at
   once with the existing `answer` and returns: what is near (capped, with
   each category's best kept beyond the cap), what might be on, what is
   worth the drive, and — for a dated ask — what is confirmed a little
   further out that day and what is confirmed in the radius on later days;
   plus each category's count before any cap.
3. **Categories are a client filter.** `Finder` reads `?theme=` from the
   address, filters `FinderData` (`viewOf`, `hostFor`, `availability`) and
   writes the new selection back with `history.replaceState` — no
   navigation, no server work, the address still shareable. Where, when and
   how far remain navigations (they need a new Atlas read), held in the
   existing pending transition so the old answer stays visible, dimmed.
4. **Home remembers the tab's last discovery** (`sessionStorage`, key
   `xm-home`) and **Back returns to the same spot** (`KeepScroll`, per
   address, frozen when a link is followed); the Christmas bar is sticky.

## Consequences

- A category tap is instant and the result counts are always those of the
  current place, days and distance. Payload: the near list is capped (90 +
  each category's best 8), comparable to the old Discover page's shelves.
- The ranking for a single category no longer applies `answer`'s
  single-theme relevance step; `hostOrder` (confirmed → standout → soon →
  pictured → nearer) orders every view instead.
- `ask.themes` no longer changes the server's work on `/christmas`; it still
  does for the ways' pages (`/christmas/for/*`) and the planner.
- Reversible: restore `src/app/christmas/discover/page.tsx` from 29afc43
  and point the links back; `finderData` can stay as a pure function.
