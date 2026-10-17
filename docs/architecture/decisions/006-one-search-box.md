# ADR 006 — One search box, and the page listens to it

**Status:** accepted · **Date:** 2026-10-16 · **Source:** the owner's
_Passport Discovery — one search, one intelligent experience_ brief.
Builds on [ADR 005](005-discovery-leads-with-a-sentence.md).

## Context

After ADR 005 Discovery had two text boxes: the sentence box at the top and
the older name search (`DiscoveryListFilters`) above the results, each with
its own state (`?ask=` and `?q=`). People could not tell which to use. The
second box also carried four chip rows (mood, activity, season, companions)
that never rendered, because the mapper sets those fields empty — Atlas
states none of them — plus a kind filter and a "search everywhere" switch.
Measured at 1440×900 on the committed fixture, the first result card sat at
y = 1,039 px (951 px on a Pixel 7), below a heading, the box, the starters,
a summary paragraph, the today panel, a rule, an October row and the second
box.

## Decision

1. **One box, one state.** `DiscoverySession.query` is removed. An old link's
   `?q=` is read as the first sentence of the conversation and never written
   back.
2. **Names are answered in the sentence.** `findByName` (over `searchRank`'s
   tiers, unchanged) runs on the latest sentence over every subject in scope,
   inside the distance / day / age already chosen first and everywhere only
   when nothing inside matches — the card then says it is outside them. Only
   name tiers count when the sentence was also read as something; when it was
   read as nothing, a weak name or a description mention counts too (the old
   box's floor). A two-word-or-longer name said whole inside a sentence counts;
   a one-word name never leads ("near Vernon").
3. **Refine** replaces "Fine-tune it yourself" and gains the kind row. Over a
   conversation a kind narrows the answer; on its own it browses that kind
   across the whole corpus, with "Everywhere — N more" and "Back to
   everything" on the result line.
4. **The sections listen.** `fitsConversation` applies the answer's hard
   limits to the composed sections — stated drive, stated hours, adults-only
   with a child, refusals, the planning circle — plus the sky asked for where
   Atlas states exposure. Silence removes nothing.
5. **Less in front of the photographs**: smaller heading (48 px / 30 px), the
   count and the October door on the Refine line, the today panel without a
   second date, no rule, the submit button inline on a phone.

## Consequences

- First result card: 1,039 → 603 px at 1440×900; 951 → 539 px on a Pixel 7.
- The dead mood / season / companion chips are gone with
  `DiscoveryListFilters.tsx`. `filterExperiences` stays for the labs.
- **Not changed, flagged:** the _Start over_ button clears the sentences but
  leaves the rows they set (pinned by a test from ADR 005's work), while
  typing "start over" clears both. Two behaviours for one phrase; left for
  the owner to decide.
