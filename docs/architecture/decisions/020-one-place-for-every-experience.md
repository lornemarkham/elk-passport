# 020 · One place, for every experience — ACCEPTED (owner brief, 2026-11-10)

**Accepted:** 2026-11-10, by the owner's _P0 — Universal Location Experience_
brief · **Amends:** [ADR 003](003-go-day-needs-a-start.md) · **Scope:** Discovery,
Go Have a Day, Christmas, Snow (mountains), and any experience that reads a town

## The problem

Each experience asked for a town on its own, in its own way: a select in
Discovery's Refine row, a "Where does the adventure begin?" gate in Go, a row of
town pills on Christmas, a "Leaving from" select on Snow. A person who had said
"Vernon" three times still had to say it a fourth. Doctrine §2.1 says not to put
a questionnaire between a person and possibility; §7 says location is core.

## What is decided

1. **One remembered place, read by every experience** (`src/domain/location`,
   `src/lib/location`). On launch, in this order: the place they chose (this
   experience's destination, else the shared one, else their saved home); a
   browser position they have **already** granted (read silently through
   `navigator.permissions`, never prompted for); an approximate region from the
   network edge; the launch region (Vernon / Okanagan) when nothing is known.
2. **An assumed place is said, and never dressed up as precise.** The bar reads
   _📍 Vernon, BC · Change_ when they chose it, and _📍 Around Vernon, BC
   approximate · Change_ when it is a guess. The guess is re-worked every
   launch and **never stored**, so it cannot harden into a fact.
3. **Only a person pressing _Use my location_ can show a browser prompt.** A
   denied, unsupported or undecided browser is simply not asked.
4. **Only town ids are stored**, never a coordinate (ADR 002 stands): a device
   position is mapped to the nearest covered town (80 km) and the town is what is
   kept. Outside coverage, the picker says so and changes nothing.
5. **Home, the shared place, and an experience's destination are three things.**
   _Explore another destination — only for Christmas_ sets that experience's
   place and leaves the shared place and home as they were. A shared change ends
   experience-only destinations.
6. **Changing the place changes the query, not the label.** Discovery measures
   from it (`/discovery/candidates?lat&lng`, Atlas's `candidate-distance`);
   Christmas carries it in `?at=`, which its server reads to ask Atlas; Go builds
   the day from it; Snow sorts mountains from it. Nearest first, with further
   results offered rather than dropped (existing: _Near you_, _N more in Metro
   Vancouver — show them too_, the _How far_ control, Refine's _Anywhere_).

## Amendment to ADR 003

ADR 003 said Go _never picks a start_ and asks instead, and rejected "default to
the nearest covered town without asking" as _silent invention of a starting
point_. The brief overrides that for **a day that names no start and has no
chosen places that disagree**: the day begins from the shared place, **said** on
the bar above the box and in _Working from_, changeable in one tap or in words.
It is not silent, which was the objection. Two things from ADR 003/016 are kept:
a town in the sentence beats the shared place, and chosen places in different
parts of the province still get `ApartPanel` (ADR 016) instead of one assumed
start. `src/lib/go/lastStart.ts` and `StartPanel` are removed: the shared place
replaces them.

## Not done, and why

- **Conference and Hockey keep their anchor.** Their place is a venue or an
  arena (_near the Parq_, _near Rogers Arena_), a fact of the event, not of the
  person; defaulting them to someone's home town would be wrong. The shared
  place is not applied there. Whether a person's own place should ever offset a
  venue anchor is open for the owner.
- **Search is over the towns Passport covers** (Okanagan, Metro Vancouver and
  the Vancouver neighbourhoods, Revelstoke, Golden, Kamloops — `towns.ts`), each
  with Wikidata-checked or town-centre coordinates. No geocoder is called, so a
  city outside them is _said_ to be unknown, not guessed. Adding places is
  adding entries with verified coordinates.
- **The approximate region depends on the host's edge headers**
  (`x-vercel-ip-*`). Where they are absent (local, some proxies) the answer is
  the launch region, marked _default_.

## Consequences

ADR 003's "Passport never picks a start" no longer holds for Go; doctrine §15.5
is edited to say so. The doctrine's §7 is unchanged and now has a mechanism.
