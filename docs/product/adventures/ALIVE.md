# The adventure comes alive (mission 627 follow-on, 2026-11-07)

Built on [ADR 012](../../architecture/decisions/012-adventures-start-full.md) and
[ADR 014](../../architecture/decisions/014-adventure-notices-and-shared-moments.md);
no second adventure system. Journey: **choose a day → look forward → make it
yours → START → keep it → recap → another.**

| Step          | Where                                                     | Built                                                                                                                                                                                                                             |
| ------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Look forward  | `Anticipation.tsx` on `/adventures/[id]`                  | Countdown, three highlights with the builder's own reason, "Before you go" (only from recorded price/hours/rain/booking notes), directions to stop 1, **Tell someone** (titles + places only), **Add to calendar** (all-day .ics) |
| On a map      | `StopsMap.tsx` per day                                    | Numbered pins in plan order, dotted line captioned "the order, not a route"; stops Atlas cannot place are counted, not guessed                                                                                                    |
| Make it yours | existing `ChangeBox`, StopCard (Keep/Replace/Move/Remove) | Starting prompts now include "more romantic and add somewhere for dessert", "Start in Kelowna instead", "Leave at 10" (all read by the rules reader, previewed, undoable)                                                         |
| START         | `TodayPanel.tsx`                                          | On the day: one **Start your day** button; then Now / Then, directions, Done, Skip, "Running 15 min behind" (phone-only arithmetic, said so), Change the plan… (hands a sentence to the change box)                               |
| Keep it       | `Capture.tsx`, `useDevice.ts`                             | Photo, note, favourite — on the phone only                                                                                                                                                                                        |
| Remember      | `/adventures/[id]/recap`, `RecapView.tsx`                 | Built from what was marked: done / skipped / favourites / notes / photos; **Share with the group** per memory; Do it again; new adventure; Find something new                                                                     |
| Together      | `/api/adventures/[id]/moments`                            | ADR 014's handlers at the core's address (re-export). Members read; you share in your own name; 409 `off` until the migration is applied                                                                                          |

## Decisions made here (name them, don't bury them)

- **Personal memories stay on the device** (ADR 014: personal memories remain
  private). Nothing leaves unless the person presses _Share with the group_ on
  that one memory. Cost: a memory is not on another device. Cross-device
  private memories need a server table and an owner decision — not built.
- **Skipped is not done** (doctrine §2.9: do not flatten wanted / planned /
  did). It is a device mark; the Want / Plan / Lived vocabulary (§15.14) is
  still open and nothing here names it.
- **No model.** "Ask AI to improve the day" is the deterministic reader (ADR
  012, D-12 open); it says it reads by rules. No key is used.
- **Nothing ticks, counts or notifies** (§2.7, §6; §15.10 open).

## Not built

Per-stop timing edits beyond "Leave at …", a hand-typed own stop with
coordinates, push reminders, server-side private memories, live adaptive
replanning ("lunch ran late — still good for the museum?").

## Verification

`docs/product/group-adventures/verification/extraordinary.spec.ts` tests E, G
(phone and desktop) and H, on the local stack (`stack.mjs` now also applies the
ADR 014 migration; `ADVENTURES_WITHOUT_TOGETHER=1` omits it). Unit and
component tests: `companion.test.ts`, `Companion.test.tsx`. Map tiles load
from OpenFreeMap and could not be reached from Metatron, so the map canvas has
not been seen drawn — only its pins, caption and fallback.
