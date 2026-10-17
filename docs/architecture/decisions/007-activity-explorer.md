# ADR 007 — Every activity, findable: groups, finer activities, an explorer

**Status:** accepted · **Date:** 2026-10-16 · **Source:** the owner's
_Discovery activity taxonomy and explorer_ brief. Builds on
[ADR 005](005-discovery-leads-with-a-sentence.md) and
[ADR 006](006-one-search-box.md).

## Context

Production Discovery (GitHub `main` 1d8974d, deployed 2026-10-16) offers four
activities for a whole region — _Hiking 53 · Swimming 31 · Fishing 25 ·
Playground 16_ in Vernon. That row is `directions.ts`: Atlas's raw affordance
verbs, cut at four on purpose, because past four the corpus's near-synonyms
arrive (`Hiking`, `walking/hiking`, `Hike`). ADR 005 (on `integration/release`,
not yet deployed) replaced it with `activities.ts`, 33 human activities
gathered from Atlas's affordances, subtypes and play features. Even that page
shows at most eight, hides anything out of season, and needs two places
before naming an activity. Birdwatching sits inside "Animals & wildlife". Skiing
never appears in October, and skiing picked from the row in October was
dropped again because it was not on offer.

**What Atlas has.** Activity entities (`Hiking`, `Skiing`, `Birding`…), with
subjects reaching them through asserted `offers` edges or a source's stated
activities (`candidate-knowledge`'s `affordances`, `basis: offers |
stated-activity`), plus `candidate-activities/2`, which scopes evidence to each
one. Atlas has **no** grouping above activities and no synonym table. Its
vocabulary is its Activity entity names plus the words sources use, and those
words are what Passport matches.

**Measured** (production's embedded pool on 2026-10-16, 3,028 subjects, and the
committed fixture, 2,979): Atlas holds birding routes, a migratory bird
sanctuary and bird observatories; nordic centres; bowling alleys; escape rooms;
theatres, comedy lounges and concert venues; water parks; a planetarium and
meteor showers; skateparks; dog parks. None of them could reach the row.
Evidence: `docs/product/discovery-activities/`.

## Decision

1. **Nine shelves over Atlas's vocabulary, not a second vocabulary.**
   `ACTIVITY_GROUPS`: Outdoors, Adventure, Water, Winter, Arts & Culture,
   Entertainment, Family, Food & Drink, Relaxation. Each activity has a home
   shelf and may appear on others (swimming is Water and Family). The shelf,
   like the label, is Passport's. Whether a place belongs is still only
   Atlas's: a word Atlas listed, shown on the card.
2. **Finer activities where Atlas's words are finer.** 33 → 58. New ones
   include Birdwatching, Wildlife watching, Snowboarding, Cross-country skiing,
   Sledding, Kayaking, Canoeing, Paddleboarding, Theatre, Live music, Comedy,
   Bowling, Escape rooms, Wineries, Breweries & cideries, Photography,
   Stargazing, Picnics, Gardens, Water parks, Skateboarding, Classes &
   workshops, Out with the dog, Hunting and Casinos. A narrow activity names its
   broad one (`within`): kayaking is a way of paddling, and a test over the
   real fixture holds that every kayaking place is a paddling place. `skiing`
   now means skiing (Snowboarding is separate). `snowshoeing` now means
   snowshoeing (Cross-country and Sledding are separate). `skating` is labelled
   _Ice skating_ and no longer counts inline skating.
3. **The row stays small.** It still offers the best eight _broad_ activities
   for the moment (in season, two or more places). A chosen activity now leads
   the page on its own evidence, even when it misses that cut.
4. **One way into everything: _All activities →_**, after the starters, after
   an answer's alternatives, and at the end of the activity row. It opens the
   explorer (`ActivityExplorer.tsx`). The explorer shows every shelf and every
   activity. Activities with places near here appear as chips with a count.
   Those Atlas holds only further away get a quieter chip. Those Atlas holds
   nothing for are named in a line, not offered as buttons. Out-of-season
   ones are listed with their usual months (`Dec–Mar`). "Here" is the row's
   pool plus anything Atlas puts in this area without a distance, the same
   allowance the answer makes.
5. **Picking an activity says it.** The chip hands its label to the sentence
   reader, so the answer, heading, follow-up question and conversation behave
   as if it were typed. Every label reads back as exactly its activity
   (tested). A sentence that is only an activity's name is not also a name
   search, so "Skiing" is answered by ski hills rather than by an Activity
   entity titled "Skiing".
6. **The answer, for a named activity:** a place that does it is substantial
   enough to offer, even with no photograph. Placed places lead unplaced ones.
   An unplaced one Atlas files under another area is left out. Out of season
   is said, never hidden: "Skiing usually runs December to March here — a
   general rule for BC, not something Atlas says about these places." After
   an activity, its neighbours lead the alternatives (kayaking → canoeing,
   paddleboarding), where Atlas holds places for them here.
7. **The model's closed set grows with the vocabulary.** `model.ts` lists
   `ACTIVITIES`, so the model can only name these keys.

## The text box (named conflict with ADR 006)

ADR 006 says Discovery has exactly one text box. The brief asks for a
_searchable_ explorer. The explorer's filter is a second input, visible only
inside the open explorer, and it finds an **activity name** — never a place,
never a sentence. Places, names and sentences still go only through the
sentence box. This narrows ADR 006 rather than reversing it, and it is the
owner's call whether that reading stands.

## Consequences

- Vernon (production's pool on 2026-10-16, within 50 km): 55 activities with
  places nearby and 3 only further away. Vancouver: 47 and 11. Production
  today offers 4.
- Birdwatching from Vernon: Allan Brooks Nature Centre, The Commonage, Rotary
  Marsh Park. From Vancouver: the George C. Reifel Migratory Bird Sanctuary.
  Skiing from Vernon: Silver Star, Monashee Powder Snowcats. From Vancouver:
  Mt Seymour and Cypress Mountain. Atlas places those two by locality only, and
  production Atlas measures them from the town centre.
- `?doing=` links keep working. Keys are unchanged, and narrower keys are new.
- **Not changed, flagged:** Atlas has no coordinates or area for Grouse
  Mountain Resort, so no Vancouver answer can include it. Fitness and aquafit
  classes, shopping and spectator sports (other than hockey) have no activity
  yet. Atlas's `environment.season` is not read: production Atlas does not
  send it, so out of season is Passport's calendar rule (`inSeason`).
