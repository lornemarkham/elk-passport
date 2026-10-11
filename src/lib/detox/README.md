# Go Offline

**Not product authority.** The doctrine is. This file records what the
`/detox` routes do, what they deliberately do not do, and where they are
waiting on other work.

## The journey

```
/detox        the idea in three steps, the doors into /go, the pact, "Phones away"
  → /go?mode=…      plan it   (existing — GoHaveADay, readBrief, buildDay)
  → /go/print       print it  (existing — AnalogGuide)
/detox/out    the last screen: the pact once, what time the phones went, one button
/detox/back   welcome back: which cards, who cracked, the thing nobody planned → a postcard
  → /detox          now go have another
```

## What is new, and what is reused

| Piece                                | Where                        | New?                                   |
| ------------------------------------ | ---------------------------- | -------------------------------------- |
| Shapes of day                        | `components/go/modes.ts`     | Reused — linked as `/go?mode=<id>`     |
| Planning, revising                   | `/go`, `domain/day/`         | Reused, untouched                      |
| The printed guide                    | `/go/print`, `AnalogGuide`   | Reused, untouched                      |
| Per-stop challenges                  | `challengeFor` in `build.ts` | Reused, on the paper                   |
| The pact (phone, stake, three cards) | `lib/detox/pact.ts`          | New — place-free cards only            |
| The outing record                    | `lib/detox/outing.ts`        | New — pact, `leftAt`, return; no stops |
| Postcards, "the fridge"              | `lib/detox/store.ts`         | New — `localStorage` only, last six    |

The pact's cards never name or describe a place. The per-stop challenges in
`build.ts` are the ones allowed to, and only from features Atlas states.

## Deliberately absent

- **No adventure data model.** The outing holds no stops. The day is
  `DayPlanned`; the saved form of it is the Adventure contract on
  `lane/domain` (`src/lib/domains/adventure/`, not yet on this branch).
- **No print implementation.** Nothing here typesets paper.
- **No screen-time numbers, streaks or scores.** "Phones away for 4 hours" is
  said once, on the return, as a fact about the day. Past 24 hours it says
  nothing — somebody who forgot to press "We're back" was not offline for
  three days.
- **No per-place lived state.** The return is about the outing (cards, who
  cracked, what wasn't planned). WANTED / PLANNED / DID / LOVED is doctrine
  §15 Q3 / Q14 and stays open.
- **Nothing is sent anywhere.** How a return flows into a person's own
  Passport, or Atlas, is §15 Q11.

## Integration points (other lanes)

1. **Print lane — closing line.** `AnalogGuide`'s closing line says _"Come back
   and tell us what actually happened"_ and points nowhere. `/detox/back` can
   receive it: a printed URL or QR to `/detox/back` would close the loop.
2. **Print lane — the pact on paper.** The guide could print the pact (stake
   and three cards) if `/go/print` accepted e.g. `?pact=<phone>.<stake>.<ids>`.
   The ids are stable in `pact.ts`. Until then the pocket screen says "write
   them on the back of your printed guide".
3. **`/go` → `/detox`.** After printing, `GoHaveADay` / `AnalogGuide` could
   offer "Make it interesting →" to `/detox#pact`. Today the person returns by
   the back button; the pact is already saved, so order doesn't matter.
4. **Domain lane — the Adventure.** When an `Adventure` can be saved, an
   outing could carry its id (`adventureId?`) so the return can ask about the
   stops by name. That is the moment §15 Q14 has to be answered first.
5. **Shell — navigation.** `/detox` is not in `PassportNav`. Whether Go
   Offline is a nav destination is the shell owner's call.

## Conflicts named, not resolved

- **"Detox" vs "not a digital-wellness product."** The lane and route are
  named `detox`; `modes.ts` says _"This is not a digital-wellness product."_
  Every word a person reads says **Go offline**; the URL is the one place the
  lane name leaks. Renaming the route (e.g. to `/offline`) is a one-line move
  for whoever decides the name.
- **`/go`'s eyebrow already says "Go offline".** There are now two surfaces
  under that label: `/go` (the planner) and `/detox` (the experience around
  it). Whether they merge is open.
