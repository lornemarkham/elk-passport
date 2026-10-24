# ADR 010 — Saved leads to adventures; Go Have a Day plans their days

**Status:** accepted, amended by [ADR 012](012-adventures-start-full.md) (2026-10-23: adventures start full and are shaped where they live) · **Date:** 2026-10-21 · **Source:** the owner's
_Complete Saved & Adventures_ mission brief. Builds on
[ADR 009](009-one-group-foundation.md) (one group foundation) and
[ADR 003](003-go-day-needs-a-start.md) (a day needs a start).

## Context

Doctrine §2.6 and §9: _save is not the end_; a saved list that becomes a
graveyard is product failure. In production, Saved (`/saved`,
`SavedReview`) ended at "Want to do" and a link to share the board. The
pieces to go further already existed and did not meet:

- **Saved** — Atlas board items, one collection per person.
- **Go Have a Day** (`/go`) — the Day Builder: a sentence, a day built from
  Atlas subjects, revised in words or by hand, Atlas's travel legs, a
  printable page. It already took `?with=<ids>`.
- **Adventures** (`passport_adventures`, lane/boards, ADR 009) — owner,
  participants, invite links, a shared list of items with a day and an
  order, answers. Not merged, not migrated.

## Decision

1. **An adventure is where saved things are planned.** A day, a weekend or
   a longer trip (`day`, `weekend`, `trip` kinds) — the same foundation as
   Hockey Night and Conference, not a new store.
2. **Saved → adventure is explicit.** _Plan with these_ chooses cards, then
   either _Make a day out of these_ (`/go?with=`, writes nothing — roadmap
   BRD-02) or _Add to an adventure_, new or existing. Chosen things arrive
   as **ideas**: items with no day. Nothing about the saved thing changes;
   adding to an adventure is not "planned" or "wanted" (§15.14 stays open).
   Passport does not offer this unasked (§15.5 stays open).
3. **Go Have a Day plans every day; there is no second planner.** Each day
   of an adventure opens `/go` seeded with its stops (or the waiting ideas),
   on that date, from the adventure's town, carrying `adventure=<id>`. The
   built day comes back with _Save to …_: its stops take that day and that
   order. **A stop the new day drops returns to the ideas; nothing is
   deleted** (§2.4). A weekend is planned a day at a time.
4. **How a day was asked for is kept** (`passport_adventure_days.ask`: the
   `/go` day query without its stops), so _Refine this day_ reopens it
   instead of starting over. Which stops and in what order stays with the
   items — one list.
5. **The owner places; everybody else suggests.** Saving a day sets every
   stop's day and order, so it is the owner's (the same person who confirms
   items). A participant's _Suggest to …_ adds the day's stops as ideas.
   Everyone answers in / maybe / out. RLS enforces all of it.
6. **The shareable page is `/go/print`.** It needs no account, re-reads
   Atlas for every stop, and is already the day interchange format
   (`dayQuery.ts`). It reveals the stops and the sentence — including a
   child's age if one was said — and nothing about who is going. Inviting
   people is the adventure's own invite links.

## Consequences

- No generative model is involved in building or refining. The Day Builder
  reads sentences deterministically (`reviseBrief`), which is the doctrine's
  "deterministic where deterministic is right" (§3). Whether a model should
  help plan a multi-day trip is not decided here.
- Travel between an adventure's stops uses the Day Builder's
  `/travel/legs` and is honest the same way: routed where Atlas routes,
  a labelled straight line where it does not, nothing where Atlas has not
  placed the thing.
- A saved board viewer (not owner) can still plan the things they see into
  their own adventures.
- Open: who besides the owner may place stops on a day; whether a group
  plan needs a commitment state (§2.6); whether the printed day should drop
  the child's age by default.
