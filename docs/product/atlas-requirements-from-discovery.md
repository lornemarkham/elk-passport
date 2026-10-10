# What Discovery needs from Atlas

**Measured against the live corpus on 2026-10-11** (2,684 candidates from
`GET /discovery/candidates`), by dogfooding the deployed product rather than
reading schemas.

This is a standing list, not a complaint dump. Each entry says what Passport
needs, what Atlas states today, why the current evidence is insufficient, and
what Passport refuses to do about it. **Passport does not compensate.** Every
one of these could be papered over with a frontend heuristic, and each time
that happens the product tells a confident lie and Atlas never finds out.

---

## 1 · Locality — the one that is actively misleading

**Severity: highest.** This is not a missing feature; it is a card that reads
as local and is 273 km away.

Discovery's lead card under _Happening today_, on the deployed product:

```
On until Nov 1
Canyon Frights
Canyon Frights is an upcoming seasonal event at Capilano Suspension Bridge Park…
Capilano Suspension Bridge Park
```

Capilano is in North Vancouver. Nothing on that card says so, and nothing can,
because Atlas states no locality for it.

**What makes it misleading rather than merely incomplete** is the asymmetry.
Among the 24 dated cards currently on the page:

```
Sandhill Wines · Kelowna          ← Atlas states a locality
Red Bird Brewing · Kelowna        ← Atlas states a locality
Creekside Theatre · Lake Country  ← Atlas states a locality
Capilano Suspension Bridge Park   ← Atlas states none
BC Place Stadium                  ← Atlas states none
Fox Cabaret                       ← Atlas states none
UBC Museum of Anthropology        ← Atlas states none
```

A reader seeing "· Kelowna" on some cards and nothing on others reasonably
concludes the unlabelled ones are nearby. They are the opposite: **every
unlabelled venue in that list is in Metro Vancouver.**

|                                             | stated                                                 |
| ------------------------------------------- | ------------------------------------------------------ |
| Events with `location.locality`             | **68 of 377**                                          |
| Places with a locality                      | **0 of 323**                                           |
| Distinct localities across the whole corpus | 4 — Vernon 36, Kelowna 25, Lake Country 7, Armstrong 1 |

**What Atlas already has, and does not join.** For Canyon Frights it states the
edge, the venue and the venue's coordinates:

```json
{
  "placeId": "2908d116-212e-45d7-90e0-2804d1f50e7e",
  "name": "Capilano Suspension Bridge Park",
  "basis": "happens-at"
}
```

and that Place carries `coordinates: [-123.1149, 49.3429]`. **120 of 134
events** with a venue id resolve to a Place that has coordinates. `locationOf`
(`candidateLocation.ts`) reads the locality from a `GeographicObservation` **on
the event itself** and never from the venue it just resolved — so the edge is
drawn and then not followed.

**What Passport needs:** `location.locality` populated from the `happens_at`
Place, with its basis stated so a consumer can tell a venue's own town from one
a publisher wrote in prose.

**What Passport will not do:** reverse-geocode. Turning
`[-123.11, 49.28]` into "Vancouver" is Passport inventing a fact about the
world. Nor will it pick its own reference point and print a distance — the
reference would be Passport's choice, not Atlas's knowledge.

**Representative ids**

| Entity                | Id                                     | Venue Atlas states              | Locality |
| --------------------- | -------------------------------------- | ------------------------------- | -------- |
| Canyon Frights        | `2908d116-…` (venue)                   | Capilano Suspension Bridge Park | —        |
| 54-40                 | `8aa97a37-fca9-42eb-8203-09e68959b89e` | Commodore Ballroom              | —        |
| Bruno Mars            | `75e5a556-…`                           | BC Place Stadium                | —        |
| BC Lions vs. Winnipeg | `3a0fa857-…`                           | BC Place Stadium                | —        |
| UB40                  | —                                      | Commodore Ballroom              | —        |

**Category: LOCATION**

---

## 2 · Identity — 57 names held twice

Unchanged across the observation window.

```
57 names · 114 records
Gambell Farms · Kangaroo Creek Farm · Priest Valley Arena
Big White Ski Resort · Kekuli Bay Provincial Park · Prospera Place
```

Passport hides the repeat for presentation (`withoutRepeats`) and says so in
the code. That is a blindfold, not a fix: both records stay searchable, both
carry different descriptions, and a person who searches finds two of the same
farm.

**What Passport needs:** a merge, or a stated same-as edge it can follow.

**Representative ids:** Kangaroo Creek Farm
`13d9de06-646b-40ec-a5cf-067dc8bfe2f9` + `ce6c75f2-bdf5-4798-b2ea-a05e0f6f75bf`;
Priest Valley Arena `1526821e-7eb8-44ce-9e68-e6d9b524440a` +
`6fdb2d3c-8e5c-455b-a7c5-309db038c5d8`.

**Category: DUPLICATE / IDENTITY**

---

## 3 · Descriptions that restate their own title

Unchanged across the observation window, byte for byte.

```
1526821e-…  Priest Valley Arena     "An arena located in Vernon, BC."
2709462e-…  Prestige Hotel Vernon   "A hotel located in Vernon, BC, offering a range of accommodations."
00454919-…  Pine Park               "A park located at 1605 A 39A Ave featuring a playground."
8aa97a37-…  54-40                   "A concert event featuring the band 54-40."
```

Each spends the one line on the card where a reason to care belongs, saying
what the eyebrow and the title already said.

**Passport built a detector for these and deleted it.** It caught 12 of 2,681 —
and for cards like Priest Valley Arena the weak sentence is the _only_
geography on the card, so hiding it makes the card worse. There is no frontend
fix. Generating replacement prose is forbidden outright.

**What Passport needs:** one concrete thing a person could not have guessed
from the name. `knowledgeUtility.ts` already classifies facts
`useful | low-value | uncertain` — the same judgement applied to descriptions,
and surfaced, would let a card know when its sentence is worth printing.

**Category: DESCRIPTION**

---

## 4 · Experiential affordance — absent

The thing Discovery most wants and Atlas does not hold: **what can I actually
do there.**

A park is not "a park"; it is walking, swimming, a picnic, a playground. A
winery is a tasting. An arena is a game. Atlas states `subtype` — the
publisher's noun — and nothing about the verb.

Passport refuses to derive it. "This is a park, therefore you can walk" is
exactly the fabricated affordance the doctrine forbids, and it is wrong the
moment a park is a fenced-off conservation area.

**Searched for on the read path:** no `affordance`, `canDo`, `activityOffered`
or equivalent on `DiscoveryCandidate`.

**Category: CLASSIFICATION / AFFORDANCE**

---

## 5 · Media: direct versus contextual — absent

Atlas vouches for a lead image (`productLeadImage`, ADR 023/069/074) but states
no distinction between **a photograph of this subject** and **a photograph of
the place it happens at**.

That distinction matters to a consumer: a venue photograph is useful context
for an event and must not be presented as a picture of the event. Passport
cannot honour a distinction Atlas does not make, so today it shows whatever
Atlas vouched for and says nothing — which is honest only by accident.

**Category: MEDIA**

---

## 6 · Temporal — one fixed, the class still open

```
Halloween Trick or Treat Trail   d3649ecc-…   2023-10-31 → 2026-10-31
                                              now: 2026-10-31 → 2026-10-31  ✓
events spanning a calendar year or more: 3 → 2
```

Genuinely better. The remaining two are the same shape: an interval whose ends
were read from different editions of the same annual event.

**Category: TIME**

---

## What Passport already consumes, so nobody rebuilds it

Worth stating, because the obvious reading of the list above is that Passport
is not trying. It is:

- `location.name` and `location.locality` are rendered wherever Atlas states
  them — **13 of 24** dated cards currently show a venue, and the other 11 are
  events Atlas holds no location for at all.
- `startTime`/`endTime`/`timePrecision` drive the composed page's temporal
  sections and the relative when-line.
- `heroUrl` orders every section picture-first.
- `subtype` drives the five human intents.
- `regionIds` is read by `scopeExperiences` — and is unusable today because it
  is asserted for **316 of 2,684** candidates, so excluding non-members would
  drop most of the Okanagan along with Vancouver.

---

## 7 · Coordinates — the 370 that state a town and nothing else

**Measured 2026-10-10**, and new since Passport learned where its reader is.

Passport can now lead Discovery with what is genuinely near somebody, because
it knows their position and Atlas states coordinates. The limit is coverage:

|                               | stated           |
| ----------------------------- | ---------------- |
| `geography.coordinates`       | **496 of 2,683** |
| a locality but no coordinates | **370**          |
| neither (`state: unknown`)    | **1,813**        |

What that costs, measured at a 50 km radius:

```
a person in Vernon      357 placeable within reach
a person in Kelowna     399
a person in Vancouver    29   ← and 2,187 Passport cannot place at all
```

The 370 are the cheapest win by a distance. They already carry an Atlas-stated
town — `Vernon` 244, `Kelowna` 152, `Lake Country` 50 — and Atlas separately
states coordinates for other candidates in those same towns. Joining those two
facts inside Atlas, with a basis, would roughly double what Discovery can place.

**What Passport will not do:** keep a table of town positions, average Atlas's
own coordinates to invent a locality centroid, or reverse-geocode. All three
are Passport deriving geography, and the corpus is itself evidence against it —
`Sparkling Pl Vernon` (2), `Centre Pl Vernon` (2), `SPALLUMCHEEN` (9) and
`OTTAWA` (1) are address fragments and shouting that reached the locality
field. A gazetteer built on those is a gazetteer that confidently misplaces
things.

**Also noticed:** one Place is titled `Publisher-stated location`, which is a
provenance note that became an entity name.

**Category: LOCATION**

---

## How to use this

Pick one. **Locality (1) and coordinates (7) are the same join** — following
the `happens_at` edge to the venue Atlas already resolved — and together they
are worth more than everything else on this list. (1) stops the product saying
something false; (7) is what lets it say something useful about where a person
actually is.
