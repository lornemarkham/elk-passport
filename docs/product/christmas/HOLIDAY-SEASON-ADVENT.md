# Holiday Season 2026 + Advent Adventure (M1053)

Owner brief M1053, "P0 — Holiday Season 2026 + Advent Adventure", 2026-11-23.
Doctrine §10 paragraph of the same date. Built on `main` 5981ad9 (M1046).

## What changed

### Christmas is the holiday season (November 23 – January 3)

| Brief                                     | Where                                                                                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New Year's Eve, a prominent category      | theme `newyear` in `src/domain/christmas/themes.ts`; chip second after _All_ on `/christmas/discover`; a _New Year's Eve near {town}_ banner on Discover; a pill and a card on `/christmas` |
| New Year's Day discovery                  | the same category, and _New Year's Day_ under When (`when=nyd`)                                                                                                                             |
| Tonight / Tomorrow / This weekend / NYE   | `WHEN_CHOICES` in `when.ts`; New Year's presets are offered only until their day has gone (`whenChoicesFor`)                                                                                |
| Fireworks, Boxing Day                     | words of the _Winter festivals_ theme                                                                                                                                                       |
| Atlas events appear automatically         | unchanged reading: an in-season event whose name, type or description says it is one; no list of events is kept by Passport                                                                 |
| Big White separate from Kelowna           | already a Discovery town (`big-white`); now a lights-map town too (`lights/model.ts`, `areas.ts`, tour builder)                                                                             |
| Never show expired events as upcoming     | `answer()` drops an event whose own stated end has passed, on every search (it did so for _tonight_ only)                                                                                   |
| Accurate dates, directions, price, source | unchanged cards (M1046): dates from the listing, Directions, the organiser's price words, _Details & source_                                                                                |

A New Year's event counts only when it is an **Event held in the season**
(November to Epiphany). A place counts only where its own name or listed type
says it. "Lunar New Year" and the like never do.

### Advent Adventure — `/christmas/advent`

- **25 doors**, December 1–25, then **nine New Year's days** (December 26 –
  January 3) as a strip of tokens. Before December: the doors are shut and
  _Surprise me_ gives a warm-up for today.
- **A door opens only on its day.** A future door is not in the page at all
  (nothing to peek at in the HTML); tapping it shakes and says when it opens.
- **What is behind a door** (`src/domain/christmas/advent/pick.ts`): up to six
  options, best first; the door shows one, **Swap** moves along.
  - A real Atlas event only where Christmas Discovery's `answer()` would offer
    it as **confirmed for that day and placed within the family's distance**
    — the same rules, the same unplaced rule. A past door never offers a
    one-day event that has gone; a run still on today stays ("you can catch
    up today").
  - Otherwise, or as well, one of **Passport's ideas**
    (`advent/ideas.ts`: Christmas's 17 ideas carried by id plus 26 of
    Advent's own, several for one day — Christmas Eve, Christmas Day,
    Boxing Day, New Year's Eve and Day). Each card says _An idea, not a
    listing_, and names no venue, time or price (a unit test checks).
  - One score for both: a real event is worth more than an idea, a day's own
    idea more again, what the family loves comes first, and whatever led an
    earlier door goes to the back, so a three-week market leads once.
- **Preferences** (one sheet of optional taps): who (family / friends / the
  two of us / just me), kids' ages (bands), 15/30/60 km, free / inexpensive /
  any, indoors / outdoors / either, interests. Where is the place every
  Christmas page shares. Stored as the `xm-advent` cookie (120 days) so the
  server can pick from Atlas; no account.
  - _Free_ = stated free. _Inexpensive_ = stated free, the lowest stated
    price ≤ $25, or no price stated (the card then says _Price not listed_).
  - _Indoors/outdoors_ = Atlas's `environment.exposure`; unknown is kept.
  - Ages go to Atlas as the youngest age (`excludesAge`); children's ideas
    need children or _family_.
- **Progress**: _Mark completed_, the count ("You've completed 7
  adventures!") and a bar; opened / swapped / done live in localStorage
  (`ghad-advent-2026`), read through `useSyncExternalStore`.
- **Share**: the phone's share sheet (or the clipboard) with "Door 7 of our
  Advent Adventure: …" and the listing's Passport page, or the Advent page
  for an idea.
- **Design**: snowfall in the header, five hand-painted door colours, today's
  door glows, opened doors swing ajar on their hinge, the reveal pops with a
  burst. All motion stops for `prefers-reduced-motion`. On a 390 × 844 phone
  the whole board is on the first screen.

### Not built, deliberately

- No signed-in sync of Advent progress (localStorage only). The brief says
  "where practical"; an account would be the only way across devices.
- No push reminders.
- No change to Atlas, no migration, no shared contract.

## Real counts (production corpus, 2026-11-23)

Read from `https://gohaveaday.com/discovery`'s server render (6,872 Atlas
candidates, `~/scratch/m817/tools/prod-corpus-discovery.mjs`) and counted by
`src/domain/christmas/holiday.eval.test.ts`: from each town at 30 km,
straight-line by Atlas's coordinates (the extract has no distance readings).

| Community    | Confirmed, Nov 23 – Jan 3 | New Year's Eve | New Year's Day |
| ------------ | ------------------------- | -------------- | -------------- |
| Vernon       | 12                        | 0              | 0              |
| Coldstream   | 12                        | 0              | 0              |
| Armstrong    | 8                         | 0              | 0              |
| Lumby        | 7                         | 0              | 0              |
| Silver Star  | 8                         | 0              | 0              |
| Lake Country | 57                        | 3              | 0              |
| Kelowna      | 56                        | 3              | 0              |
| Big White    | 2                         | 0              | 0              |

Kelowna's three: _New Year's Eve 2027 Dance Celebration with Blue Collar
Band_, _East Coast New Year's Eve_, _New Year's Eve Party – Ring in 2027_.

**125 Christmas-season events have no confirmed place** and are held apart
(never "near"), among them four New Year's ones: _Silver Star New Years Eve
Celebration_ (geography `conflicting`), _New Year's Eve Slopeside
Celebrations_, _New Year's Day Celebration_, _Snow School Glow Stick Parade_.
That is Atlas venue linking (M1044) and Atlas's Big White ingest (M1051), not
Passport: the moment Atlas places them, they appear in the category, the
banner and behind Advent doors with no Passport change.

## Verification

- Unit: `src/domain/christmas/advent/advent.test.ts` (18),
  `discover-repair.test.ts` updated (a finished event is gone on Any date
  too), `lights/towns.test.ts` (Big White).
- e2e: `e2e/christmas-advent.spec.ts`, phone viewport. Doors need a pinned
  day: server `ADVENT_TODAY=2026-12-12` (server environment only; a visitor
  cannot set it) and `E2E_ADVENT_TODAY=2026-12-12`; `E2E_ATLAS=1` with
  `scripts/critic/atlas-mock.mjs` serving the production corpus.
- Screenshots: `screenshots/advent-*.png`.

## Advent Preview Mode (M1074, 2026-11-23, owner-authorised, temporary)

Owner brief M1074: "I want to PLAY WITH IT" — until **midnight Pacific on
December 1, 2026** (`PREVIEW_ENDS` = 2026-12-01T08:00:00Z) all 25 doors open
now. This overrides "a door opens only on its day" above, for that window only.

- `previewActive()` in `advent/model.ts`: true before `PREVIEW_ENDS`, never
  after it. Off sooner with `ADVENT_PREVIEW=off` in the server environment, or
  `PREVIEW_ENABLED = false`. No visitor or admin control; no auth change.
- The page labels it **Advent Preview Mode**. Each door is still planned for
  its own date (a real event only on a day it is on); Surprise me opens any
  door not yet opened.
- After the end: only doors up to today open, future doors are shut and send
  nothing. Progress is the browser's: completed adventures still count in the
  total; a door opened in preview that is shut again shows no trace of it.
