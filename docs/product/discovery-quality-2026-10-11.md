# Discovery quality — Vernon and Vancouver, 2026-10-11

**Lane:** `lane/discovery` · **Builds on:** `ce1c92a` (Ask Discovery a
question) · **Code:** `src/lib/ai/ask/`

Fourteen real questions, asked from Vernon and from Vancouver, answered by
the real `readAsk → answerAsk` pipeline over a real Atlas candidates
response — before and after this change. What was wrong, what changed, and
what is still wrong and whose it is to fix.

## How it was measured

- **Evidence:** a saved `GET /discovery/candidates` body written by an Atlas
  session on Metatron at 09:23 today — 2,928 candidates, contracts
  `candidate-geography/3`, `-suitability/4`, `-environment/2`, `-schedule/2`
  and others. Read-only. Passport's default feed keeps 2,445.
- **Not measured here:** distance. A saved body carries none, so the harness
  measures it as Atlas does: straight line from stated coordinates, else from
  the centre of a stated town, else unknown. `schedule.onDate` is absent
  (it needs `on=`), so "open today" is never asserted.
- **Origins:** Vernon (50.267, −119.272, home _Okanagan_), Vancouver (49.283,
  −123.121, home _Metro Vancouver_). The pool is what Atlas places in the
  home area or nowhere, as the page's area rule leaves it.
- **Repeatable:** `ASK_CORPUS=<body.json> ASK_OUT=<file> npx vitest run
src/lib/ai/ask/corpus.eval` (`ASK_TODAY=2026-10-17` for a Saturday,
  `ASK_WET=1` for a wet forecast). Skipped in CI.
- **No OpenAI key** is configured here; every answer below is the
  deterministic reading. The model path was extended (new lenses, `pair`)
  and is unit-tested without a key.

## Headline numbers

|                                         |  before |  after |
| --------------------------------------- | ------: | -----: |
| picks across 28 answers                 |     156 |    148 |
| picks Atlas cannot place at all         |      37 |      0 |
| distinct places, Vernon (14 answers)    |      25 |     33 |
| distinct places, Vancouver (14 answers) |      22 |     29 |
| most-repeated pick, Vancouver           | 13 / 14 | 7 / 14 |
| "Date night" read as _night skiing_     |     yes |     no |
| child answers led by a non-child event  |   1 / 2 |  0 / 2 |

Same 0 unplaced in a wet-forecast run and a Saturday run.

## What was wrong, and what changed

### 1. Nearby vs. nowhere — the biggest defect

**Before**, from Vancouver: _"What can we do with three hours?"_ →
`Giving Tuesd-eh`, `PIR 010 – Wild Mushroom Identification`, `Harvest
Pumpkin Festival 2026`, `Sun Peaks Annual Turkey Sale` — four events with
**no location at all**, each carrying "Atlas can't place this". A +6 "on
today" bonus outweighed every placed thing. The same four led in Vernon.

**After:** with an origin, a pick needs a distance. Unplaced things leave the
_answer_ (never the page). One thing Atlas places only in the home area may
follow, never lead, for a question not about being close. Distance beyond the
reach now costs, so a 50 km dinner no longer outranks the park down the road
for being on.

### 2. Things happening today

New `on` lens for _"What's on today?"_, _"What's happening this weekend?"_ —
dated things on that day, closest first, **with the publisher's start time**
where Atlas holds it to the minute (`timePrecision: "minute"`, shown in
America/Vancouver as `eventTime.ts` does). Places with no published hours for
the day go after. _Saturday, Vernon:_

```
Aretha Tillotson Quartet at the Vernon Jazz Club — Today only · under 1 km
The Cheesecake Burlesque Revue — Today only · 7:30 p.m. · under 1 km
U-Pick Pumpkins — On until Oct 25 · ≈ 2 km
Watch Her Soar Gala 2026 — Today only · 5:00 p.m. · ≈ 45 km
```

### 3. Family, couples, solo, friends

| who     | before                                                        | after                                                                                                                                   |
| ------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| child   | Vancouver led with _Ultimate 90s Night_ (a party, 10:30 p.m.) | led by a source describing it for families, then parks with listed playgrounds / swimming; a stated 19+ rule is out at any age          |
| couple  | not read; "Date night" chose the verb _night skiing_          | `couple` lens: stated adults-only and evening start first. Vancouver Saturday: _Bebe Stockwell — Adults only, as stated · 7:00 p.m._    |
| friends | read, then ignored                                            | `group` lens: several doings, events, described all-ages / beginners first                                                              |
| solo    | read, then ignored silently                                   | read, said back, and the note says **Atlas holds nothing about what suits one person**, so the picks don't change — rather than pretend |

Couple and friends orderings are **Passport's judgement over Atlas's facts**,
and each answer says so. No subtype is read as romantic or social:
`suitability.ts` records that guessing about people from word lists was
retired, and this does not bring it back.

### 4. Weather

Atlas's rain reading covers 154 subjects. Its **exposure** reading covers
2,088 (indoor 1,150, outdoor 708, mostly derived). The answer now uses it
after the rain reading: _"It's raining, what can we do inside?"_ from
Vancouver went from `Ultimate 90s Night`, `Canyon Frights`… to _The Sunday
Service (comedy)_, _Roedde House_, _Dr. Sun Yat-Sen Classical Chinese
Garden_, _Every River Has a Mouth_ — each "Indoors, going by what we know".
"Sunny" / "nice day" now reads as outdoors, as "raining" already read as
indoors.

### 5. Time available

Atlas now holds `visitDuration` for 1,076 candidates — the earlier rule "no
duration claims" was written when it held almost none. With hours stated, a
pick Atlas says **usually takes longer than the whole window** is left out
(its shortest typical visit is longer than the hours), and the rest say how
long, as firmly as Atlas holds it: _"Usually 30 min–2 h, going by what we
know"_ (derived) or the source's own words (_"Hike duration: 60 - 90 minute
round-trip"_).

### 6. Interesting, unusual, hidden gems

**Before**, Vancouver: _"Stanley Park — the only public park in Metro
Vancouver"_ (Atlas also holds `park`, `municipal park`…), _"Sun Peaks Turkey
Sale — the only Retail Event"_, _"Greater Vernon Athletics Park — the only
place listing community use"_.

**After:** rarity is counted by **family** of kind (last word: `park`), never
for events (a publisher's filing), never for listed non-doings, and only for
somewhere you would go to do something (a place, a doing, or a typical visit
— so the hostel and the outfitter are out). Vernon: _Okanagan Skydive_,
_Paraglide Canada_, _Tube Town_. Vancouver: _Grouse Mountain_, _H.R.
MacMillan Space Centre (the only planetarium)_, _Capilano Suspension Bridge_,
_George C. Reifel Migratory Bird Sanctuary_.

### 7. Worth the drive

It counts what you can **do** there. _Penticton Trade and Convention Centre —
Conventions, Trade Shows, Meetings_ was a pick; it is gone. Being on today
counts half: a craft workshop 45 km away is not worth the trip because it is
today.

### 8. Repetition and honesty

What fails a lens's own test (not rare, not indoors when asked to be, no
child evidence) counts its timeliness for half and costs 4, so an event no
longer wins every question by being on. When **nothing** fits — date night in
Vernon on Sunday — the note says _"Nothing Atlas holds here clearly answers
that for today, so these are the nearest things to it."_

## Still wrong — and whose it is

| what                                                                                                                    | whose                         |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **Okanagan Lake is "41 km" from Vernon** and worth the drive: a 135 km lake measured from one centroid                  | Atlas (areal features)        |
| **Bloedel Conservatory reads "outdoors"** — a domed conservatory, exposure derived from the subtype `Garden`            | Atlas (exposure rule)         |
| 1,901 of 2,928 candidates have no geography; most of today's events among them                                          | Atlas                         |
| Vancouver's "worth the drive" is thin (4 picks; Kettle Valley Rail Trail at 192 km with only "Hiking")                  | Atlas coverage                |
| Rarity is a fact about Atlas's knowledge, not fame: Grouse Mountain is "the only mountain", hardly a hidden gem         | Passport — no popularity data |
| On a wet day Vernon leans on few sheltered places: Polson Park appears in 12 of 14 wet answers                          | Atlas coverage                |
| A matinee isn't "tonight" only when its start time is published; date-only events can't be told apart                   | Atlas / publishers            |
| `childEvidence` still uses the `CHILD_DOABLE` word list `suitability.ts` calls retired — pre-existing, not changed here | Passport — named, not fixed   |

## Conflicts named, not resolved

- **Earlier lane rule vs. new evidence.** The `time` lens previously refused
  any duration claim ("Almost nothing here publishes how long a visit
  takes"). Atlas now serves `visitDuration`; this uses it, saying derived
  ranges as readings. That reverses a lane decision, not the doctrine.
- **No doctrine edit.** Nothing here settles a §15 question. The
  AI/deterministic boundary (§15.13) is untouched: the model may now fill
  `pair` and the new lenses, still validated against closed sets.

## Outside my lane

- `src/lib/data/types.ts` — `CandidateVisitDuration`,
  `DiscoveryCandidate.visitDuration`, `CandidateEnvironment.exposure`
  (types for fields Atlas already serves).
- `src/domain/experience/types.ts` — `Experience.visitDuration`.
- `src/domain/experience/atlasMapper.ts` — carries `visitDuration`
  (`basis`, `minutes`, `text` only). Adds ~62 KB raw to the Discovery page's
  serialised pool (1,076 small objects; compresses well) — named because
  page weight was cut deliberately before.

`lane/maps` also touches `src/domain/experience/types.ts`; both additions are
additive and should merge cleanly.

## Proposals, not made

- **A "the two of us" answer on the who's-coming row.** `Company` is
  `alone | child | group`; "for two" lives only on the ask. A row option
  would let it be tapped as well as said (doctrine §4, both directions).
  `src/domain/discovery/situation.ts` and the rows are outside this lane.
- **Ask Atlas for `bounded` distance on areal features** (lakes, valleys,
  geographic areas) instead of a centroid `measured`.
