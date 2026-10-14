# Go Offline

**Not product authority.** The doctrine is. This file records what the
`/detox` routes do, what they deliberately do not do, and where they are
waiting on other work.

Go Offline is a step **inside** GO HAVE A DAY, not a separate product:

```
SAY IT ─► BUILD IT ─► SHAPE IT ─► PRINT IT ─► GO OFFLINE ─► COME BACK ─► NOW GO HAVE ANOTHER
  /go       /go         /go       /go/print    /detox        /detox/back     /go
                                               /detox/out
```

## The journey

```
/detox?stops=…&say=…   "That's the plan."  Planning is finished: the stops said
                       back, what this phone will keep, the optional pact,
                       "Phones away". Same query as /go/print.
/detox                 no day handed over: "Got a plan?" → one link to /go, or
                       go anyway with a plan made on paper or in your head
/detox/out             the last screen: the pact once (if any), when the phones
                       went, the day folded shut under "If the paper blows away",
                       one button
/detox/back            welcome back: who was there, the cards (if a pact), who
                       cracked (if a pact), the thing nobody planned → a postcard
  → /go                "Now go have another"
```

## What is new, and what is reused

| Piece                                | Where                        | New?                                                    |
| ------------------------------------ | ---------------------------- | ------------------------------------------------------- |
| Planning, revising                   | `/go`, `domain/day/`         | Reused, untouched                                       |
| The printed guide                    | `/go/print`, `AnalogGuide`   | Reused, untouched — linked, never re-typeset            |
| Per-stop challenges                  | `challengeFor` in `build.ts` | Reused, on the paper                                    |
| The day kept on the phone            | `lib/detox/day.ts`           | New — names, Atlas's town, minutes; nothing else        |
| Resolving the day from the query     | `lib/detox/resolve.ts`       | New — a deliberate copy of `/go/print`'s resolution     |
| The pact (phone, stake, three cards) | `lib/detox/pact.ts`          | Optional — dealt only when somebody asks                |
| The outing record                    | `lib/detox/outing.ts`        | Day snapshot, pact?, `leftAt`, return (+ who was there) |
| Postcards, "the fridge"              | `lib/detox/store.ts`         | `localStorage` only, last six                           |

The pact's cards never name or describe a place. The per-stop challenges in
`build.ts` are the ones allowed to, and only from features Atlas states.

## Why the kept day is not the guide

The paper has the reasons, hours, costs, rules and challenges. The phone keeps
**which places, in what order, in which town** — what you need if the paper
blows away — plus the query that prints the paper again. It is snapshotted at
"Phones away", so it reads from this browser with no signal once the page is
open, and the pocket screen shows it folded shut and with **no links**: a map
link is a door back into the phone.

It is **not** a service worker. A cold reload with no signal still needs the
network. Making `/detox/out` load offline is a shell/build decision (it would
touch `next.config`, `public/` and the layout) — see integration point 6.

## Deliberately absent (DTX-05, pinned by `guardrails.test.ts`)

- **No notifications, vibration, push, share sheet or ticking timer.** The
  guardrail test fails if the code under `detox/` uses any of them.
- **No screen-time numbers, streaks, points or badges.** "Phones away for 4
  hours" is said once, on the return, as a fact about the day. Past 24 hours
  it says nothing.
- **No forced pact.** Skipping it leaves no pact in storage, no stake on the
  pocket screen and no "who cracked" question on the way back.
- **No per-place lived state.** The return shows "the plan was …" as context
  and never asks which stops were done or loved (§15 Q3 / Q14).
- **Nothing is sent anywhere.** How a return flows into a person's Passport,
  or Atlas, is §15 Q11.
- **No adventure data model.** The kept day is a snapshot, not the Adventure
  contract on `lane/domain`.

## Integration notes (for other lanes)

1. **Day Builder — the hand-off (DTX-03).** After printing, `/go` should offer
   _"Planning's done → Go offline"_ linking to `offlineHref(printQuery(brief,
ids))` from `lib/detox/day.ts`. One import, one link; `printQuery` already
   exists in `GoHaveADay.tsx`. Kept out of this lane on purpose: `/go` is
   under active Day Builder integration.
2. **Day Builder — `carry.ts` keys.** `lane/daybuilder` adds order, minutes and
   rain plans to the print query. `DAY_QUERY_KEYS` in `day.ts` passes only the
   six keys on main; add the new ones there when daybuilder merges, or the
   kept day may differ from the paper in order.
3. **One resolver.** `lib/detox/resolve.ts` copies `/go/print`'s
   query → `DayPlanned` resolution. When daybuilder, analog and maps settle
   `/go/print`, extract that into one function both pages call.
4. **Print lane — the paper leads back (ANA-05).** `RETURN_PATH` in `day.ts`
   is `/detox/back`; the guide's closing line can print it.
5. **Print lane — the pact on paper (ANA-06).** Pact ids are stable in
   `pact.ts`. Until then the pocket screen says "write them on the back of your
   printed guide".
6. **Shell — truly offline.** A service worker (or a static export of
   `/detox/out`) would let the pocket screen open with no signal. Not built.
7. **Domain lane — the Adventure (DTX-04).** When an `Adventure` can be saved,
   the outing could carry its id beside (or instead of) the snapshot. §15 Q14
   must be answered before the return asks about stops by name.
8. **Shell — navigation.** `/detox` is not in `PassportNav` and doesn't need to
   be: it is reached from the end of planning.

## Conflicts named, not resolved

- **"Detox" vs "not a digital-wellness product" (D-3).** The route is named
  `detox`; every word a person reads says **Go offline**. Renaming the route
  is a one-line move for whoever decides the name. `offlineHref` and
  `RETURN_PATH` are the only places other lanes should reference it.
- **`/go`'s eyebrow already says "Go offline".** `/go` is the planner, `/detox`
  the step after it. `/detox` no longer duplicates `/go`'s six doors, so the two
  no longer compete as front doors — but the shared label is still D-3's call.
