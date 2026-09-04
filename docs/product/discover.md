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
