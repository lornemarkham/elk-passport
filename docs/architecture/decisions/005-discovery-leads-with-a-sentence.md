# ADR 005 — Discovery leads with a sentence, and remembers the conversation

**Status:** accepted · **Date:** 2026-10-16 · **Source:** the owner's
_Passport Discovery 2.0 — from filtering to understanding_ brief.

> Numbered 005 because 004 is taken on the unmerged
> `feature/experience-theme-isolation` branch.

## Context

Discovery opened with five rows of pills — _what do you feel like doing,
who's coming, when, how much time, how far_ — and a sentence box beneath the
heading. It behaved like a database filter. The activity row offered Atlas's
four best-counted affordance names (`Hiking 60 · Swimming 32 · Fishing 26 ·
Cycling 17`), cut at four on purpose because past it Atlas's spellings of one
idea arrived (`walking/hiking`, `Hike`, `Walking`). Measured on the committed
fixture, only 224 of 2,979 candidates state any affordance; museums, cinemas,
wineries, rinks and concerts could never appear in that row at all.

## Decision

1. **The page asks "What kind of day are you looking for?"** and its primary
   control is the sentence box. Starting points are sentences given to the same
   reader. The five rows stay, collapsed behind one line on every screen.
2. **A conversation is the list of sentences** (`?ask=…&ask=…`, eight kept).
   Each is read alone (`readAsk`), knowing which question was on screen, then
   folded oldest-first (`foldAsk`): a later statement about one thing replaces
   the earlier one about that thing, and everything else stays. Distance is one
   answer; who replaces who; a new day keeps its part of day; "something
   completely different" keeps the constraints and drops the activity and lens;
   "start over" starts over.
3. **At most one follow-up question, under results, never before them** —
   time, then distance, then age, each only where unknown; never twice; two per
   conversation at most (`questionFor`). Answered by tapping or typing.
4. **Activities are Passport's grouping, Atlas's evidence** (`activities.ts`).
   Thirty-three activities each match Atlas affordance names, subtypes, and a
   short list of features that are a thing to do (a playground — never toilets
   or parking). A card's reason quotes the Atlas word. Counts are not shown.
   Winter and summer activities are suggested only in season; typed, they are
   always answered.
5. **Travel tolerance is a limit, not a lens.** "Within 20 minutes" keeps what
   Atlas's routed estimate puts inside it; without one, only a physical bound
   (straight line farther than 100 km/h covers) removes anything, and that
   bound is never printed as a time. "Worth the drive" stays a separate lens.
6. **"Free" is quoted, never inferred.** Atlas has no price field for
   Discovery; a description's own words ("free public skating") are quoted, and
   a conditional free ("free admission on Family Day") is not claimed.
7. **The model's role is unchanged in kind**: fill gaps in the latest
   sentence, with the earlier sentences as context, from closed sets. It cannot
   name a place.

## Consequences

- Old links with one `?ask=` and an Atlas verb in `?doing=` still work
  (`readSession`, `activityForDoing`).
- `directions.ts`'s "Passport does not group verbs" rule is superseded for this
  row; its history is kept there.
- The activity grouping is a vocabulary Passport now owns and must maintain as
  Atlas's words change. `activities.test.ts` pins that every label reads back as
  itself and that amenities never count.
- Activities with no placed subjects (Atlas holds five cinemas with no location)
  are still answered, each saying it cannot be placed — a visible Atlas gap
  rather than a hidden one.
