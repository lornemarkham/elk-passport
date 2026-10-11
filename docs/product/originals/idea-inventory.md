# Idea inventory

**Not product authority, and not a backlog.** The doctrine is the authority.
The labels (**Recovered**, **Stated**, **Proposed**) are defined in
[`README.md`](README.md).

Taken 2026-10-11 on `lane/vision`, on top of `bf8bcc7`.

---

## About the priorities

The brief asks for **"our prioritized idea inventory"**. **This repository
records no priorities.** Here is what was searched:

- the Idea Atlas (all 2,986 lines);
- the Labs wall (`ideas-to-make-pages`);
- the Secret Creative Studio (`about/vision`);
- `about/content.ts`;
- `archive/`;
- `docs/`.

None of them contains a rank, tier, score, or now/next/later. Several of them
say explicitly that they are not a backlog:

- The Idea Atlas: _"Not documentation, not a backlog."_
- The Labs wall: _"nothing here is approved, scoped, or scheduled."_
- The Treasure Chest: _"not a roadmap."_

The only status in the code is `Prototype | Idea`, and the experiment numbers
follow build order.

If the prioritised list exists, it is in conversation or the ChatGPT Library,
like the Emi originals. **Lorne needs to supply it.** It is not reconstructed
here.

So this file has two columns, and they are deliberately different:

- **State** is **Recovered**. It records how far each idea actually got:
  - `built`: there is a working product route.
  - `prototype`: there is a Labs page.
  - `sketch`: the idea appears in a content list or comment only.
  - `named`: the brief names it, and no artifact exists.
- **Proposed tier** is **this document's suggestion, and nobody has decided
  it.** The reasoning for it is given below the tables. Replace it with the
  real priorities when they are recovered.

---

## 1. The GO HAVE A DAY ideas

The ideas named in the brief. See [`go-have-a-day.md`](go-have-a-day.md).

| Idea                                          | Label                             | Where it lives                                                             | State                        | Proposed tier        |
| --------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------- | ---------------------------- | -------------------- |
| GO HAVE A DAY (`/go`): sentence → day → paper | Recovered                         | `src/app/go/`, `src/domain/day/`, `016854a`                                | built                        | — (exists)           |
| NOW GO HAVE ANOTHER: the return path          | Stated (the pieces are Recovered) | `/go` closing line, `AnalogGuide` "What actually happened", doctrine §2.10 | named                        | 1                    |
| Moments: a stop with a reason                 | Recovered                         | `archive/03-treasure-chest.md`, Emi page                                   | prototype                    | 1                    |
| Days: the unit of planning and of success     | Recovered                         | `src/domain/day/`, doctrine §1                                             | built                        | — (exists)           |
| Conversational discovery                      | Recovered                         | `GoHaveADay.tsx`, `brief.ts`; Idea Atlas Close Your Eyes                   | built (no model, no voice)   | 2 for `/api/go/read` |
| Adventure Builder                             | Recovered                         | Emi page only                                                              | prototype                    | 1                    |
| Go Offline: the six doors                     | Recovered                         | `src/components/go/modes.ts`                                               | built                        | — (exists)           |
| "Digital Detox" as a name                     | Stated                            | — (`git grep -i detox` finds nothing in the code)                          | named                        | decision, not work   |
| Printable analog guide                        | Recovered                         | `/go/print`, `AnalogGuide.tsx`; Emi packet                                 | built                        | — (exists)           |
| Paper map on the guide                        | Recovered (as a gap)              | `ANALOG_PHILOSOPHY`; `AnalogGuide.tsx` "no offline map here"               | sketch                       | 2                    |
| Boards → "make a day out of my board"         | Board: Recovered · seam: Proposed | `/boards`, `/saved`, doctrine §9; `buildDay` ignores saved items           | built (board) / named (seam) | 1                    |
| Fishing With Emi as acceptance                | Stated (page: Recovered)          | `src/app/about/experiment-07-fishing-with-emi/`                            | prototype                    | the bar, not an item |
| `/go` in the nav (front door or side route)   | Recovered (as a gap)              | `PassportNav.tsx`                                                          | —                            | decision, not work   |

---

## 2. Every other original idea found

| Idea                                                                           | Where                                                     | State              | Proposed tier                            |
| ------------------------------------------------------------------------------ | --------------------------------------------------------- | ------------------ | ---------------------------------------- |
| Wonder: a word of the day, small missions, a "Today We…" keepsake              | `about/experiment-04-wonder/`; Idea Atlas Wonder extended | prototype          | 2, as builder modules                    |
| Learn while living / Educational Adventures (sourced facts)                    | Analog `LEARN_THEMES`; Labs #8                            | sketch             | 2, as builder modules                    |
| Signals, never reviews (_"Great after rain", "Bring cash"_)                    | Analog `SIGNAL_EXAMPLES` (ADR 020, Atlas)                 | sketch             | 3                                        |
| Gear: what you own vs what you buy                                             | Emi page                                                  | prototype          | 2                                        |
| Hell Of A Day: an end-of-day recap                                             | Labs #10                                                  | sketch             | 1, the same thing as ANOTHER             |
| Everyday utility sentences (_"I've got 2 hours." "I'm hungover."_)             | Idea Atlas                                                | sketch             | 1, as `/go` parser coverage              |
| Board growth stages (1 → day → weekend → summer)                               | Idea Atlas                                                | sketch             | 2                                        |
| Puppy-dog board (it follows you everywhere)                                    | Idea Atlas                                                | sketch             | 3                                        |
| The Companion Board (shared, react rather than vote)                           | Labs #9; collaborative `/boards/[id]` exists              | sketch             | 3; group work is §15 Q12                 |
| Tomorrow (_"A story, not an itinerary"_)                                       | Labs #5                                                   | sketch             | 3                                        |
| Life Moments (birthday … random Saturday, 25 of them)                          | Idea Atlas `LIFE_MOMENTS`                                 | sketch             | 3                                        |
| Passport personalities (4 prototypes, ~38 ideas)                               | Idea Atlas                                                | prototype / sketch | blocked on doctrine §15 Q1 (Experiences) |
| "This entity sucks" (a correction loop into Atlas)                             | doctrine §15 Q15                                          | named              | open question; not scoped                |
| Discovery Space, Close Your Eyes, Constellation, Soundtrack, Living Mood Board | Labs #1–#4, #6                                            | prototype / sketch | **fenced**: Inspiration, doctrine §13    |
| Treasure Chest: stamps, local rewards, photo competitions, explorer personas   | `archive/03-treasure-chest.md`                            | named              | **fenced**: doctrine §14 / not now       |
| Group games, HELL YEAH meter, Argument Engine, Hype Man                        | Idea Atlas                                                | sketch             | **fenced**: doctrine §14                 |

---

## 3. Why the proposed tiers are what they are

These rules are **Proposed**. They follow the workspace principles: ship a
vertical slice before generalising, prefer a small real seam, and prefer
reversible steps.

- **Tier 1** covers the ideas that move `/go` towards passing
  [Fishing With Emi](fishing-with-emi.md), using what already exists:
  - a reason for each moment;
  - a builder over the stops;
  - a day built from a board;
  - a return path.

  Each one needs a **decision before any build**. ANOTHER and making a day
  from a board both touch doctrine §15 Q11 and Q14.

- **Tier 2** covers ideas that make the day or the paper better, but that the
  bar doesn't require: the paper map, Wonder and learning modules, and the
  model-assisted read.
- **Tier 3** covers ideas that are real but sit further from the day loop.
- **Fenced** ideas are ones the doctrine has already put off-limits. Being
  listed here does not lift the fence.
