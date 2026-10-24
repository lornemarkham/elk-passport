# Saved + Adventures — the agreed experience

**Status:** canonical for Saved and Adventures as of 2026-10-23 (owner's
_Make Adventures Extraordinary_ brief). Product authority is still
[the doctrine](../../PASSPORT-PRODUCT-DOCTRINE.md); the decisions behind this
page are [ADR 010](../../architecture/decisions/010-saved-leads-to-adventures.md)
and [ADR 012](../../architecture/decisions/012-adventures-start-full.md).
This file exists so the vision is never reconstructed from chat again.

## The journey

```
DISCOVER → SAVE → DREAM → BUILD → GO → REMEMBER → DO IT AGAIN
```

It is the doctrine's loop (§2: discover → react → collect → shape → commit →
live → adapt → remember → learn) said the way a person would say it. Every
screen below exists to move someone one step along it.

| Step        | Doctrine                          | Where it happens                                             |
| ----------- | --------------------------------- | ------------------------------------------------------------ |
| Discover    | §2.1, §12                         | `/discovery` (unchanged here)                                |
| Save        | §2.4 _let people want too much_   | Save on any card → Saved                                     |
| Dream       | §2.6 _save is not the end_, §9    | Saved: your next adventure, your adventures, your places     |
| Build       | §2.5 SHAPE, §3 _AI is not a tab_  | `/adventures/new` → a sketched itinerary; change it in words |
| Go          | §2.7 _START is a mode change_, §6 | The adventure on its day: _Today's adventure_, what's next   |
| Remember    | §2.9                              | The guide's _Afterwards_ page; done marks on the device      |
| Do it again | §2.9 _would do again_             | _Do it again_ on any adventure                               |

## What the original documents asked for, and where it went

- **Saved should not feel like "Saved Items"** (Idea Atlas, Treasure Chest) —
  it _"follows the traveler around Passport like a happy puppy"_ and grows
  from _"this is becoming a day"_ to _"this might be your summer"_. Saved now
  opens on the person's adventures and treats places as raw material for them.
- **"You've saved six things. Want me to turn them into an afternoon?"**
  (doctrine §4) — _Plan with these_ → a guided start seeded with what was
  chosen.
- **Composing a realistic day is where AI earns its place, never a chatbot
  tab** (§3, `originals/go-have-a-day.md` §4) — one sentence box on the
  adventure, no persona, no thread, a preview and an undo.
- **"Just adjust those two things" — and leave everything else alone**
  (§2.5) — a revision rebuilds only the day it names, and never moves a stop
  someone kept.
- **Fishing With Emi** (`originals/fishing-with-emi.md`, the GHAD acceptance
  bar A1–A8, labelled _Proposed_) — the adventure guide applies its skeleton:
  mission line → moments with reasons → what Passport could not check →
  practical notes → space to remember. A section with no sourced content is
  left out rather than invented (A2, A4). Builder modules (A5) are not built.
- **Adventure mode: "what is happening now · what comes next · …support the
  experience rather than compete with it"** (`archive/12-…`) — _Today's
  adventure_. No notifications, no timers (Go Offline, DTX-05).
- **"Create memories, not checklists"; "This is what I did. You should do it
  too."** (`archive/08`, `archive/12`) — the guide's _Afterwards_ section and
  _Do it again_. Recording did / loved per stop is still open (§15.14).

## Saved

1. **Create an adventure** — the largest action on the page.
2. **Your next adventure** — the soonest upcoming (else the most recent
   draft): picture, dates, place, people, status, _Continue planning_.
3. **Your adventures** — every other one as a card: upcoming, drafts, done.
4. **Places you've saved** — search by name, filter by kind, _Plan with
   these_ → a new adventure with them, or add them to one already started.

## The vocabulary (what each thing is)

| Word           | Means                                                   | Stored as                                   |
| -------------- | ------------------------------------------------------- | ------------------------------------------- |
| Saved place    | On the person's board                                   | Atlas board item                            |
| Idea           | On an adventure, not on a day                           | item, `on_day` null                         |
| Suggested stop | On a day, not decided — Passport's sketch or a proposal | item, `status = proposed`                   |
| Kept stop      | On a day, decided                                       | item, `status = confirmed`                  |
| Done           | Ticked off on the day (this device)                     | `localStorage`, never the server (D-9 open) |

_Want / Plan / Lived_ as product states (§15.14) remain open; nothing here
marks a saved place planned or wanted.

## Building an adventure

`/adventures/new` asks five things, all optional except a name being
derivable: **where** (a town Passport knows), **when** (this Saturday, this
weekend, or dates), **who** (just me, two of us, friends, family + a child's
age), **what kind of day** (outdoors, food & drink, culture, easy-going,
something different, adventurous) and **anything important** (free words:
_"home by 6"_, _"within 30 minutes"_). They become one sentence the Day
Builder reads. With _Sketch the days for me_ on, each day is built from real
Atlas subjects; off, the adventure starts with its ideas and no stops.

## Shaping it

- Each stop: what, where, how long, why (the builder's own reason), what is
  published (hours, price, rules), Atlas's word on the chosen date where it
  has one. **Keep · Replace · Move · Remove.**
- Between stops: Atlas's routed time, or a straight line said to be one.
- One sentence box: _"Make Saturday more adventurous"_, _"we're bringing a
  five-year-old"_, _"find somewhere better for lunch"_, _"keep everything
  within 30 minutes"_, _"make it cheaper"_, _"give us a rainy-day
  alternative"_, _"swap Saturday and Sunday"_, _"less demanding"_. Preview,
  then Apply; Undo after.
- **From your saved places** — saved things not on the adventure yet, one tap
  onto a day.

## Trust rules (non-negotiable)

- Every stop is an Atlas subject or the group's own words; Passport invents
  no business, hour, price, reservation or drive time (doctrine §2.3; A2, A4).
- Suggestion and decision look different; Passport's suggestion says it is one.
- Nothing claims open unless Atlas states it for that date; published hours
  are quoted, never parsed.
- No reservations are made or implied.
- Atlas down: the adventure still loads, every manual control works, and the
  page says the sketch and the change box are unavailable (Scenario F).
