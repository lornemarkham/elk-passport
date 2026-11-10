# 016 · A day made from chosen places starts where the places are

**Decided:** 2026-11-10, by the owner's brief _P0 — Finish the real user
experience_ ("remove unnecessary location questionnaires"; "fix incorrect
geographic Discovery results"; "build a weekend from saved experiences in
different geographic regions"). **Amends** [ADR 003](003-go-day-needs-a-start.md)
narrowly. **Scope:** `/go?with=`, `/adventures/new?with=` and the Pocket.

## Context

ADR 003 made `/go` ask _"Where does the adventure begin?"_ before building,
and rejected defaulting to the nearest town **to the device** (a silent
invention of a start). Since then the Adventure Pocket (M642) made the most
common route into `/go` _"I chose these places, make a day"_ — and a person who
has just picked four places in Vernon was asked which town they were in, with a
list of 40, and told "I won't pick that for you".

Measured with the 2026-11-08 production corpus: places saved in Vernon and
Vancouver became **one day** with a 234 km move in the middle and a footnote.
A weekend made from them round-robined the places across days from one
starting town. 167 Vancouver subjects carried coordinates but no area, so
"only a stated, different area excludes" let them into an Okanagan Discovery.

## Decision

1. **Where chosen places are comes from Atlas's stated coordinates**, never
   from a guess: places within 60 km of a chain of other chosen places are one
   group (`src/domain/day/places.ts`, `groupChosen`). A place Atlas states no
   position for belongs to no group and goes with the largest, never dropped.
2. **One group → the day starts from that group's nearest named town**, said
   on the day ("From Vernon — where your picks are") and changeable in words.
   No question is asked. ADR 003's rejection stands for a start taken from the
   _device_; this start is taken from the _person's own explicit choices_.
   With **no** chosen places, `/go` still asks, exactly as ADR 003 says.
3. **More than one group → no single day is built.** `/go` says the picks are
   in N parts of BC, drops and substitutes nothing, and offers a day around
   each group or a weekend with a day for each. The Pocket says so before the
   press. The weekend sketch gives each group its own run of days and starts
   each day from that group's town; with fewer days than groups it folds
   them and the move warning says so.
4. **Discovery places an unplaced subject by its coordinates.** With no stated
   area but stated coordinates, the nearest named town within 60 km says which
   area it is in (`placedAreaOf`); nothing near a town, and nothing stated,
   still removes nothing ("silence is not distance", `area.ts`).
5. **A day whose chosen stops need more than the hours says so first**
   (`DayPlanned.conflicts`) — "this is tight" — and keeps every chosen stop.

## What this does not decide

- §15.5 (when to ask for constraints) stays open for everything but the case
  above. Discovery and the helper are untouched.
- 60 km is Passport's own reach for "one day's outing", not a drive time;
  Atlas still serves no road routes here. Revisit when it does.
- Whether a person who _has_ shared a position should be offered it instead
  of the picks' town: not decided; the picks win because they are explicit.

## Alternatives not taken

- Ask anyway, with the picks' town preselected: still a question the person
  has already answered by choosing.
- Build one day and warn about the long move (the old behaviour).
- Drop the far group silently — the one thing a person who saved it would not
  forgive.
