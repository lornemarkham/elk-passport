# ADR 012 — An adventure starts full and is shaped where it lives

**Status:** accepted · **Date:** 2026-10-23 · **Source:** the owner's _Make
Adventures Extraordinary_ brief (Saved + Adventures product transformation).
Amends [ADR 010](010-saved-leads-to-adventures.md); builds on
[ADR 009](009-one-group-foundation.md) and
[ADR 003](003-go-day-needs-a-start.md). The agreed experience is written out
in [`docs/product/adventures/EXPERIENCE.md`](../../product/adventures/EXPERIENCE.md).

## Context

ADR 010 made Saved lead to adventures, and made Go Have a Day (`/go`) the
only place a day is planned. In use, that produced exactly what the brief
calls unacceptable: start a weekend and you get two boxes that say _Nothing
on this day yet_, and every change means leaving the adventure for another
page and saving back. The pieces were right; the order was wrong.

The brief asks for four things ADR 010 ruled out or left open. They are
named here and resolved by the owner's brief, not by the code.

| ADR 010 said                                                   | The brief asks                                                      | Resolved as                                                                                                                                                                                                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| _"Go Have a Day plans every day; there is no second planner."_ | Never start with a blank adventure; shape it where it lives.        | **Still one planner.** The adventure calls the Day Builder's own engine (`readBrief`, `reviseBrief`, `buildDay`) on the server. No second ranking or composer.                                                                                   |
| _"No generative model is involved in building or refining."_   | AI-assisted creation and conversational editing.                    | **Unchanged: no model yet.** The deterministic reader handles the brief's examples. A model may later fill the same `DayBrief` and never name a place (§3, D-12).                                                                                |
| _"Passport does not offer this unasked (§15.5 stays open)."_   | Proposed days at creation; "you saved X — that could fit Saturday." | **Answered narrowly for adventures:** the person asks by creating one ("sketch the days" is on by default and can be turned off), and saved places are offered inside an adventure they opened. Discovery and Saved still offer nothing unasked. |
| _"The owner places; everybody else suggests."_                 | Friends plan together.                                              | **Kept.** A participant's change request becomes suggestions (ideas) for the owner. Everyone answers in / maybe / out.                                                                                                                           |

## Decision

1. **Creating an adventure can sketch its days.** The guided start asks
   where, when, who, what kind of day and any constraints, then turns them
   into one sentence and builds each day with `buildDay`, from that town, on
   that date, excluding what earlier days already use. Saved places that
   were chosen are kept on the days first. **Manual stays possible:** turning
   the sketch off gives an adventure with its ideas and no stops.
2. **What Passport put on a day is a suggestion until someone keeps it.**
   Sketched stops are `proposed` with `origin = 'passport'`. _Keep_
   confirms one. A revision never moves a kept (confirmed) stop; it may drop
   a Passport suggestion nobody kept, which is then deleted, because nobody
   chose it. **Anything a person chose — from Saved, from `/go`, by hand —
   still goes back to the ideas and is never deleted** (§2.4, ADR 010 §3).
3. **A day is changed in words on the adventure itself.** _"Make Saturday
   more adventurous"_, _"we're bringing a five-year-old"_, _"swap Saturday and
   Sunday"_. The sentence names its day or days; Passport rebuilds only
   those, with kept stops held, and shows **before → after** with what it
   heard. Nothing is written until _Apply_. _Undo_ restores the previous day
   the same way it was applied. A request the reader does not understand
   changes nothing and says so.
4. **`/go` stays the full workbench.** _Open in Go Have a Day_ is still on
   every day, and _Save to …_ still brings a day back (owner) or suggests it
   (participant), exactly as ADR 010 describes.
5. **The day of, the adventure leads with what's next.** On a date the
   adventure covers, the page opens on _Today's adventure_: the next stop,
   its published hours, directions, and _Done_. Done marks are kept on the
   device only (where memories live is D-9, still open). It never notifies.
6. **An adventure has a guide.** `/adventures/[id]/guide` is a printable
   keepsake: cover, each day's stops with why and what is published, what
   Passport could not check, and space to write what happened — the Fishing
   With Emi skeleton (`docs/product/originals/fishing-with-emi.md`) applied to
   any adventure, with nothing invented to fill a section.
7. **Do it again** copies a finished (or any) adventure's places into a new
   one as ideas, ready to sketch on new dates.

## Consequences

- One additive migration: `passport_adventure_items.origin`
  (`person | passport`, default `person`). The store reads and writes it when
  present and **falls back to the old behaviour when it is not**, so the code
  can ship before the migration; until it is applied, a dropped Passport
  suggestion goes back to the ideas instead of being deleted.
- Clock times are shown only when the day has a stated start ("leave at 9"),
  as `/go` does (D-8 stays open). Otherwise stops carry durations.
- Travel between stops stays Atlas's `/travel/legs` or a labelled straight
  line. Opening hours are shown in the publisher's words; Passport does not
  claim a place is open unless Atlas states it for that date.
- Still open: per-stop _did / loved_ (§15.14, D-2), where memories are kept
  (D-9), a model's role (D-12, §15.13), who besides the owner may place
  stops, and whether a group plan needs a commitment state (§2.6).
