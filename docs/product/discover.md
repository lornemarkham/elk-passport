# Discover — what appears, and why

**Last measured 2026-09-03 against the live corpus.**

Discover reads Atlas's `GET /discovery/candidates`. This document records the
product rules layered on top of it, and the distinctions that must not collapse.

## The three questions, kept apart

```
Does Atlas know enough to consider this?      → Atlas.  189 candidates.
Should this lead the Discover page?           → Passport. 129 in the default feed.
Does it have enough for its own page?         → passportReadiness. 102 detail-ready.
```

**These are three different questions and they have three different answers.**
Collapsing the first two turned the page into a database dump — a typo'd parking
lot was the second result and an OpenStreetMap way id was the third. Collapsing
the second and third would make "has a photograph" the definition of relevance,
because `detail-ready` and `has hero` are currently the _identical_ 102 records.

- **Atlas candidate eligibility is broader than default feed inclusion.**
- **Default-feed selection is Passport presentation policy, not persisted Atlas
  truth.** Nothing is written back; there is no `discoverable`, `featured`,
  `tier`, `feedEligible`, score or rank.
- **Search and explicit browse expose candidates the default feed omits.**

## The four rules

`src/domain/discovery/defaultFeed.ts`. They decide _membership_, never order —
this is not ranking.

|       | Rule                                                                | Excluded |
| ----- | ------------------------------------------------------------------- | -------- |
| **A** | An Activity whose normalised name **is** its own subtype            | 18       |
| **B** | A subtype in the small, closed not-a-destination set                | 22       |
| **C** | `unknown` subtype **and** nothing else Atlas holds                  | 6        |
| **D** | An Activity that is specific but has nothing beyond its description | 14       |

Reported first-match, so a record is counted once rather than under every rule
it meets.

### A · Generic Activity concepts

`Snowboarding` of type `Snowboarding`; `camping` of type `camping`. Derived
structurally — **there is no activity-name list anywhere**, and there must not
be. _Generic Activity concepts remain useful Atlas knowledge even when omitted
from standalone default-feed presentation_: all 18 stay candidates, stay
searchable, and appear under an explicit **Things to do** browse.

### B · Infrastructure and institutions

`parking`, `public washroom`, `washroom facilities`, `road`, `region`, `city`,
`government`, `government agency`, `military training centre`, `transit system`,
`trust`, `sports team`, `educational institution`, `company`.

Deliberately small, explicit and closed. **This is not a tourism taxonomy and
must not grow into one.** Every entry is a subtype Atlas already states, and
every excluded record stays searchable — _"not the first thing to show a
traveller"_ is a very different claim from _"not worth knowing"_.

### C · `unknown` is incomplete classification, not a verdict

**An earlier proposal to exclude every `unknown` subtype was disproved by the
corpus.** `Big White` carries 21 photographs and `Rhonda Lake` 11; both are
unclassified and both belong in the feed. So an unclassified record is asked one
further question — does Atlas hold anything else about it? — and **no named
exception exists for either record**.

Of 45 unclassified candidates, 6 leave: `District of Coldstream`,
`Ellison Provincial Campground`, `O'Keefe Ranch`, `O'Keefe Ranch and Interior
Heritage Society`, `Vernon Regional Airport`, `Vernon city centre`. Every one has
no photograph, no context and contains nothing.

### D · Activities without substance

`night skiing` is a real candidate with a real description and nothing else — no
photograph, no place Atlas can say it happens at, nowhere to go. A candidate
waiting for context rather than something to lead with. Derived generically;
`"night skiing"` appears in no rule.

### The substance test

`heroUrl` **or** `context` **or** `containsCount > 0`. Three existing facts,
unweighted and equal, any one sufficient.

It is consulted **only** where a candidate cannot otherwise say what it is — an
unclassified record, or an Activity, which is a category rather than a specific
thing. **A classified Place never faces it**, which is why `Kekuli Bay
Provincial Park` stays in the feed with no photograph at all. Media is not
importance.

## Context is rendered only when Atlas establishes it

_Passport presents physical context only when Atlas establishes the
relationship._ One line, from the candidate's one-hop `context`:

```
The BullWheel
RESTAURANT
at Big White Ski Resort
```

Never inferred from a name, never from region membership. It is also what
explains the destination — BullWheel opens Big White's page _because BullWheel is
at Big White_. Seven such labels render today; `Hiking at Big White` gets none,
because that place lives only inside the string.

## Navigation affordance

A destination is derived from kind, readiness and context (`destinationFor`).
Cards that navigate show a chevron and a hover state; cards that do not show
neither. **A card without a destination is still a real discovery** — most
Organizations and Activities have no page yet, and a missing page is not a
missing thing. What it must never do is look clickable and do nothing.

## What was removed, and must not come back

`ENERGY`, `BUDGET`, `LENGTH OF TIME` filtered attributes `atlasMapper`
fabricated as identical constants for every record — one of which told a
traveller Ellison Park was not pet-friendly while its Atlas record confirmed
_Pets on leash_. Nothing replaces them. **Never restore fabricated attributes to
populate a rail.**

The count reads _"126 to explore"_, not _"186 experiences"_ — what is on screen,
not how many rows Atlas holds.

## Known product debt — board-level Passport / itinerary composition is not implemented

**Recorded 2026-09-04. Accepted for Oct 1 unless later prioritized.**

Three surfaces offered **"Start Passport"** and sent a _board_ id to
`/passport/{id}`, which resolves an **entity** id against Atlas and `notFound()`s
on anything else. It 404'd from the first commit — both routes arrived together
in `76dde5e` and `/passport/[id]` was an entity page from its first line, so this
was never a regression.

`loadBoardWithExperiences.ts` still records the original contract:

> "Shared by /boards/:id and /passport/:id, the two pages that both need a
> board's saved experiences rather than just its metadata."

That route was later repurposed into the single-entity Passport page and the
buttons were left pointing at a contract that no longer exists.

**What does not exist today:** any board-level Passport. `buildPassportPage`
composes exactly one entity, and nothing in `src/lib/passport/` references a
board. There is no itinerary model, no multi-entity composition, and no rule for
which of several saved entities a board's Passport would be _about_.

**What was done instead** — the UI stopped claiming otherwise:

| surface                | was                                      | now                                   |
| ---------------------- | ---------------------------------------- | ------------------------------------- |
| `DiscoveryListSidebar` | "Start Passport" → `/passport/{boardId}` | "Review board" → `/boards/{boardId}`  |
| `boards/[id]`          | "Start Passport" → itself, broken        | "Continue discovering" → `/discovery` |
| `MoodBoard` (labs)     | "Start Passport" → `/passport/{boardId}` | "Review board" → `/boards/{boardId}`  |

The board page deliberately does **not** link back to itself, and no surface
picks one saved entity to stand in for the board — choosing which of five saved
things "the Passport" is would be inventing the product rather than reporting it.

**Open when prioritized:** what a Passport made from a multi-item board _means_ —
an itinerary across saved entities, a cover page linking to each entity's own
Passport, or whether "Start Passport" was simply the wrong label for reviewing a
board all along.

## Answers, distance and search — Atlas Mission 084 / ADR 094

**Recorded 2026-10-11.** What each answer on Discovery does, and how firmly.

| answer          | hard (removes)                                                                | soft (reorders)                                 | unknown                                  |
| --------------- | ----------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------- |
| Activity        | — (leads the page with that verb's places)                                    | —                                               | —                                        |
| Who's coming    | —                                                                             | decides whose evidence the suggestions read     | —                                        |
| Child age       | a stated rule against that age (`forAge` `excluded`)                          | stated welcome, family description, child price | "No age guidance found" — never excluded |
| Date            | Atlas `schedule.onDate` `not-on` (hours, season, held interval); `ruledOutOn` | stated hours covering the day                   | stays; "check before you go"             |
| Available time  | —                                                                             | how many suggestions are offered (1 / 2 / 4)    | durations are almost never stated        |
| Town / location | origin for Atlas's distance reading                                           | nearest first                                   | —                                        |
| Radius          | Atlas `distance.within`; unplaced, area-only and conflicting are never "near" | —                                               | "Explore beyond N km" shelf, opt-in      |
| Weather (wet)   | —                                                                             | sheltered up, Atlas-read "out in the open" down | untouched                                |

- **Distance is Atlas's.** `POST /api/discovery/distance` carries the origin in
  a body (never a URL), rounded to ~1 km, to `GET /discovery/candidates?lat&lng&withinKm&unplaced=drop&beyond=flag`.
  Kilometres are straight-line; a town-centre measurement reads "In Vernon".
  No drive times anywhere.
- **Search follows the answers** — same radius, day and age — and says so
  above the box. "Search everywhere" widens search only (`?all=1`) and resets
  nothing.
- **Suggestions are doors.** Each suggested verb chooses that activity for the
  page; each named place links to its page carrying the day, age and way back.
- **Pictures.** A failed image falls back to the text-first card; an event with
  no picture of its own may show its venue's (`contextualMedia`), labelled
  "Venue photo · {venue}". Atlas's media decisions are never overridden.

**Follow-up, not built:** "Something wrong with this page?" (`POST /quality-reports`,
ADR 094 §4). Atlas's migration `202610111200_entity_quality_reports.sql` is not
applied, so the endpoint answers 503. Wire a server-side proxy and the button
only once Atlas confirms it answers 202.

## Asking Discovery a question — lane/discovery

**Recorded 2026-10-11.** One sentence box under _What do you feel like
doing?_, four tappable example questions, and an answer shelf. Code:
`src/lib/ai/ask/` (read, apply, answer, model), `AskDiscovery.tsx`,
`POST /api/discovery/ask`.

**A sentence sets the rows; it does not replace them.** `readAsk` reads the
same fields the five rows hold (how long, who, which day, which town, how far,
which verb), reusing `/go`'s `readBrief` so both pages read one sentence one
way. `applyAsk` changes only what the sentence says. Exceptions, each stated
in code: a typed search / kind / intent is replaced; _worth the drive_ clears
the radius; naming non-child company drops a child's age. "Nearby" becomes
15 km only where there is an origin. The sentence lives in the URL as `?ask=`.

| question shape      | lens      | what it does                                                                                                                          | what it refuses                                                    |
| ------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| "three hours"       | `time`    | 3–4 picks, close first, inside `/go`'s stated planning circle (30 km for ≤4 h), varied; Atlas's typical visit said, and over-long out | a length of visit Atlas does not hold                              |
| "something unusual" | `unusual` | rarest **family** of kind / doing **in the home area**, counted over the area (saved included); something to do there                 | a judgement of taste; an event's filing as a kind; non-doings      |
| "take my kid"       | `kids`    | listed child evidence, the per-age verdict, or a source describing it for families / all ages; stated adults-only rules out           | an age from "kid"; "family" read as a child; a timely non-fit lead |
| "worth the drive"   | `drive`   | measured 40–200 km straight-line, ranked by **what you can do there** (doings, contains, photo); timeliness counts half               | minutes, routing, "an hour" as a distance or as the day            |
| "what's on today"   | `on`      | dated things on the day, closest first, with a start time where published; places only after                                          | a place with no hours for the day leading                          |
| "date night"        | `couple`  | stated adults-only and evening start times first; described-for-families down; says the ordering is Passport's                        | a subtype read as romantic; "a couple of hours" as a couple        |
| "friends in town"   | `group`   | several doings, events, described all-ages / beginners first; says the ordering is Passport's                                         | a subtype read as social                                           |

"On my own" is read and said back but changes no pick: Atlas holds no
evidence about what suits one person, and the answer says that instead of
inventing it. "For two" is carried as `pair` on the ask only — the who's
coming row has no couple.

Every pick carries up to three **reasons**, each a fact (listed affordances,
age verdict, stated interval, rain reading, rarity count, straight-line km),
and at most one **caveat** (no published hours for the day asked, Atlas cannot
place it, stated hours disagree). An answer also names its **gaps** — _how
old?_, _from where?_ — instead of filling them.

**Quality and repetition.** A pick must be `substantial` (dated, photo, verb,
contained places, listed features, or a description Atlas has not flagged as
restating the title). Picks are taken one at a time: same name, same spot
(~200 m) or same attraction (`partOf` / `context`) is refused; same kind, same
family of kind (`park` / `public park`) and shared verbs cost. Over and
not-on-the-day events never appear; on-today and last-day events lead **among
things that answer the question** — what fails a lens's test (not rare, not
indoors when asked, no child evidence) counts its timeliness for half and
costs 4. When nothing fits, the note says so.

**Somewhere, or not an answer.** With an origin, a pick needs Atlas's
distance. Measured 2026-10-11, 37 of 156 picks from Vernon and Vancouver were
events Atlas holds no location for — a Sun Peaks turkey sale led "three
hours" from Vancouver. Those leave the answer (never the page). One pick
placed only in the home area may follow — never lead — for a question that
is not about being close.

**The evidence it now reads** (all Atlas's, carried by the mapper):
`visitDuration` (1,076 held; 1,043 derived, said "going by what we know"),
`environment.exposure` (indoor 1,150 / outdoor 708 — used after the rain
reading, for wet days and "inside" / "outside" / "sunny"), `suitability`
statements about the whole subject (`adults-only` rule, `families`,
`children`, `all-ages`, `beginner`), and a publisher's start time where
`timePrecision` is `minute`. A short closed list of listed "affordances"
that are not doings (`community use`, `Conventions`, `guest services` …) is
kept out of rarity and the drive count.

**Measuring it.** `src/lib/ai/ask/corpus.eval.test.ts` runs fourteen real
questions from Vernon and Vancouver against a saved Atlas candidates body
(`ASK_CORPUS=…`, optional `ASK_TODAY`, `ASK_WET=1`). Skipped without one.
Findings: `docs/product/discovery-quality-2026-10-11.md`.

**The model.** `model.ts` runs only with `OPENAI_API_KEY`, fills **gaps** in
the deterministic reading (never overrules a stated number, town or day),
validates every field against closed sets (Atlas's verbs, `towns.ts`), and has
no field for a place. Any failure returns the deterministic reading. The
browser applies the words immediately; a model reading, if one arrives, fills
in afterwards and only for the question still on screen.

**Into _Go have a day_.** Every card — composed page, search results and the
answer — has _Plan a day around this →_; the answer has _Make a day of it →_
with its first two picks. `/go?with=<ids>` builds the day **around** those ids
(`buildDay`'s `keep`): taken first, allowed past the planning circle, still
removed by a stated age rule or a stated not-on-that-day, and **said** in the
guide's unknowns when removed. Never a coordinate in the URL.

While an answer is on screen `TodayPanel` is not rendered — it would answer the
same situation a second time — and the forecast still orders the answer.
