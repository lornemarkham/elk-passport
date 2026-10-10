# 002 · A person's location is situational, and Passport stores none of it

**Decided:** 2026-10-10 · **Status:** implemented

## The problem

Discovery told everybody the weather in Vernon.

Not because it knew anything about them — because Atlas holds 813 Okanagan
candidates and 33 from anywhere else, so Vernon was hardcoded as "the area".
The page said `Chance of showers in Vernon` to a reader in Kamloops, in
Calgary, or in a hotel in Lisbon, with nothing to indicate it was a guess
about the corpus rather than a fact about them.

That is the kind of defect that gets worse with every feature built on top. Any
future reasoning about whether a day is feasible — travel time, what is open,
whether the rain matters — would have inherited somebody else's postcode.

## What was already here

| Concept                       | Where                                   | What it means                                                                                                                  |
| ----------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `passport_profiles.home_area` | `profileService`, Account, `AreaPicker` | **Where a signed-in person lives.** One of 22 named towns, chosen deliberately, stored indefinitely. Drives October's weather. |
| `candidate-geography/2`       | `geography` on every candidate          | **Where a subject in Atlas is**, with a state of `observed`/`derived`/`conflicting`/`unknown`.                                 |
| `activeScope()`               | `domain/discovery/activeScope`          | **Which region Passport is looking at.** Admin-gated.                                                                          |
| browser geolocation           | —                                       | **Did not exist.** No `navigator.geolocation` anywhere in the repository.                                                      |

So there was no second location system to collide with, and one genuinely
different question with no answer: _where is this person, right now?_

## The decision

**Four kinds of location, and they do not collapse into each other.**

```
observed       browser coordinates, this visit only, blunted to ~1 km
default        the area the corpus is about — labelled as a default
home area      where a signed-in person says they live — stored, and not read here
Atlas geography where a subject is — Atlas's knowledge, nothing to do with the reader
```

A person who shares where they are this afternoon has **not** told Passport
where they live, and Passport does not write it down as if they had. Equally, a
stored `home_area` is not where somebody is standing, so Discovery does not
quietly use it as one.

`LocationState` (`domain/discovery/situation.ts`) carries the first of these:
`default | asking | observed | unavailable`, with a `lapse` of
`unsupported | denied | failed | no-forecast` saying why a reader is back on
the default.

**No proximity, no distance, no ranking.** Coordinates exist in this slice for
exactly one purpose — asking Environment Canada a question — and nothing sorts,
filters or scores by them. The one distance Passport computes is how far the
reporting city is from the reader, and it exists to be _shown_, as a caveat.

## Exactly where location flows

```
the person taps "Use my location"            TodayPanel
  → navigator.geolocation.getCurrentPosition  useHere        browser only
  → blunt()                                   situation.ts   → ~1 km, 2 d.p.
  → POST /api/environment/here                 request body, never a URL
  → blunt() again                              route.ts       input not trusted
  → 0.6° bounding box                          msc.ts
  → api.weather.gc.ca                                         only recipient
  ← { wet, chance, description, source, area, km }             no coordinates
  → React state                                useHere        this visit only
```

The blunted point is **kept in memory for the visit**, because the page also
asks _which of these is near me_ — answered in the browser, by arithmetic
against coordinates Atlas has already published (`proximity.ts`). No second
request, no coordinate ever leaves again, and still nothing written down.

**Not written anywhere.** No database column, no cookie, no `localStorage`, no
session, no log line, no analytics call. A reload forgets it. Nothing in
Passport other than the weather lookup ever sees it.

**Blunted before it is sent.** Two decimal places is about a kilometre. The
forecast search covers 65 km, so the discarded precision was never doing any
work — and a position that was never collected cannot leak.

**One outside recipient**, `api.weather.gc.ca`, whose entire purpose is to
answer the question being asked.

## The limitation, stated rather than worked around

Environment Canada publishes forecasts for **named Canadian cities**. So:

- the reading is the official forecast for the nearest published city, which
  can be tens of kilometres away and over a ridge — so `area` names that city
  and `km` says how far, and both are rendered;
- outside Canada, and far enough from any Canadian city, there is **no
  forecast**, and the surface says so rather than substituting anything.

Interpolating a model grid would produce a number for any point on earth and
would stop being the official forecast, which is the thing worth having.

## Consequences

- `Environment.area` may now be an ad-hoc point rather than a named October
  town. The comment claiming it is "never the device's location" was true when
  written and is now corrected.
- Discovery's default forecast is labelled **"the Vernon area"** rather than
  presented as the weather.
- Asked once. Once a reader declines, the offer is gone for the visit.
- Still open: whether a signed-in person's `home_area` should seed the default
  instead of the corpus. It would be more useful and it is a different claim —
  where you live is not where you are — so it is not being resolved silently.
- Still open: whether Discovery should ask for a town when the browser cannot
  answer. It would place a declining reader, and it would also be the first
  piece of configuration on a surface built to need none. Not decided here.
- **Not done, deliberately:** placing the 370 candidates that state a town and
  no coordinates. Passport could keep a table of town positions, or average the
  coordinates Atlas states for other candidates in the same town. Both are
  Passport deriving geography that is Atlas's to carry — and the corpus already
  contains `Sparkling Pl Vernon` and `OTTAWA` as localities. Recorded as an
  Atlas requirement instead.
