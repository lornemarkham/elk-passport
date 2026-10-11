# Fishing With Emi: the flagship acceptance experience

**Not product authority.** The doctrine is. The labels (**Recovered**,
**Stated**, **Proposed**) are defined in [`README.md`](README.md).

- **Stated.** In the brief of 2026-10-11, Fishing With Emi is the **flagship
  acceptance experience**. Any version of Passport that claims to do GO HAVE A
  DAY has to be able to produce this day.
- **Recovered.** The page itself says it is _"the first ELK Labs sandbox built
  from a real outing rather than a mood"_
  (`src/app/about/experiment-07-fishing-with-emi/page.tsx`, `2819edb`,
  2026-08-15).

**The original is missing.** `Fishing_with_Emi_First_Adventure.pdf` and
`001-fishing-with-emi-passport-adventure-page.md` are in the ChatGPT Library,
not on Metatron. Everything below comes from the Labs page, which was written
later (`docs/history/concepts.md`).

---

## 1. The outing

**Recovered.** From `content.ts` (`TRIP`).

- **Who:** _"Uncle + Emi, age 5"_
- **Occasion:** _"First fishing trip"_
- **From:** Vernon, B.C.
- **Route:** _"Backroads via Lumby and Trinity Valley"_
- **To:** Hidden Lake
- **When:** August, judging by the content. The sources were checked on
  2026-08-15.
- **Mission:** _"Have fun. Learn how to fish. Explore somewhere new. Maybe
  catch a rainbow trout."_

The success condition, which is the line that matters:

> Catching a fish is not the success condition. A five-year-old who casts
> once, finds a weird stick and asks to come back has had a perfect day.

That is doctrine §1's measure at child scale. _"…and asks to come back"_ is
also the earliest form of **NOW GO HAVE ANOTHER**.

**What the repository does not record:** what actually happened on the day.
The page describes a _planned_ outing. Its memory fields (_"Emi made a cast",
"Fish caught", "Funniest moment", "Would we come back?"_) are blank, and
_"Nothing typed here is saved."_ If a record of the real day exists, it is with
Lorne, and it belongs in `docs/history/originals/`.

---

## 2. The four moments

**Recovered.** The page frames them as _"Four moments, not a list of
directions"_.

| #   | Moment             | Kind                                         | Evidence tier | Why it earns its place (verbatim)                                                                               |
| --- | ------------------ | -------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | The backroad drive | Vernon → Lumby → Trinity Valley Road         | prototype     | _"The drive is not the gap between the fun parts — for a five-year-old it is one of the fun parts."_            |
| 2   | Seidner Lake       | _"Scout stop — not a fishing stop"_          | live-check    | _"Treating it as a scouting mission is more fun for a kid than treating it as a rest break."_                   |
| 3   | Hidden Lake        | _"The fishing moment — primary destination"_ | verified      | _"Somewhere to park, somewhere to stand, and a shoreline a small person can fish from without a boat."_         |
| 4   | The victory treat  | _"Unresolved — you pick"_                    | prototype     | _"The part Emi will describe first when someone asks how it went … it works whether or not a fish was caught."_ |

On the treat, the page says: _"inventing a plausible-sounding ice cream shop is
exactly the failure this project refuses."_

---

## 3. The Adventure Builder for Emi

**Recovered.** There are 22 modules, and 13 of them are on for Emi.

| Group    | On for Emi                                                                               | Off, and still visible with a reason                                                                                                                                                                                                    |
| -------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fishing  | Learn to cast · Bobber and worm lesson · Fish identification · Catch and release lesson  | If we keep one (_"a first trip does not need to end in a dispatched fish unless you decide it should"_)                                                                                                                                 |
| Nature   | Tree I-Spy · Wildlife spotting · Nature photo challenge · Rock skipping · Weirdest stick | —                                                                                                                                                                                                                                       |
| Learning | Why trout like cold water                                                                | What a watershed is (_"exactly right for an eight-year-old"_) · Tree identification · Local geography · Forestry and logging · Geology · Bird identification · Local history (_"would produce nothing rather than something invented"_) |
| Games    | Nature bingo · Fish trivia · Who spotted it first?                                       | Count the logging trucks (_"rewards watching for heavy traffic on an active forestry road"_)                                                                                                                                            |

Each module that is off has a reason, and the reasons fall into a few kinds.
This grouping is **Proposed**, as a reading of the reasons:

- **Age fit:** watershed, geology.
- **Covered more gently by a module that is on:** trees, birds.
- **Timing:** geography is _"better on the drive home"_.
- **Left to the adult:** keeping a fish.
- **Safety:** counting logging trucks.
- **Honesty:** local history.
- **Another family's priority:** forestry.

---

## 4. Rules the page holds itself to

**Recovered.** These are the page's own rules, quoted.

1. **There are three kinds of claim, and they are not equal.** They are
   **verified** (_"read off a primary source on 2026-08-15, quoted and
   linked"_), **live-check** and **prototype**. _"A legal statement and a
   suggested activity must not look alike. One of them can end a trip badly."_
2. **Live checks never show a status.** _"An unchecked box is honest, a green
   checkmark would be a lie."_ The page lists _"Five things Passport cannot
   check for you"_: regulations, wildfire, rec-site status and fees, road
   events, and the forecast.
3. **Nothing on the page may cite a source that is not listed.** There are ten
   sources, each with a checked date. _"A checked date is not a guarantee — it
   is a statement about when someone last looked."_
4. **Some things are left out on purpose.** _"No drive-time estimate, no
   distances, no chosen ice cream shop, no 'safe to go' indicator, no
   persistence. Each of those would require inventing something Atlas does not
   hold."_
5. **Legal content gets its own treatment.** It is _"bordered, quoted, linked,
   with an 'as of' date on every rule."_
6. **Gear is split in two.** _"Separating what you have from what you need is
   the pattern worth generalising later."_
7. **The page plans for having no signal.** _"Offline map downloaded before
   leaving town — Assume no cell service in the valley."_
8. **The packet is printable and follows the builder.** A module that is off
   is left off the paper.
9. **There is a place to remember the day.** _"The part of the trip worth
   keeping is not the route."_

Rules 1, 2 and 4 are the same honesty rules `/go` enforces in
`src/domain/day/build.ts`. Rule 7 is Go Offline. Rule 8 is the analog guide.
Rule 9 is the start of ANOTHER. **Proposed:** that overlap is why this page,
and not October, is the right acceptance case for GO HAVE A DAY.

---

## 5. The acceptance bar

**Proposed.** Nobody has agreed to this yet. It is drawn from §1–§4, so it is
anchored in the page's own rules rather than invented.

A version of GO HAVE A DAY **passes Fishing With Emi** if one sentence produces
a day that satisfies all of the following. The sentence: _"First fishing trip
with my five-year-old niece, from Vernon, half a day."_

| #   | Criterion                                                                                                                                | Source of the bar               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| A1  | The day is a handful of **moments with reasons**, not a list of places.                                                                  | §2; `FishingWithEmi.tsx`        |
| A2  | Every stop is a real Atlas subject. Where Atlas has nothing (the treat), the plan says _you pick_ rather than inventing one.             | §2 moment 4; `build.ts` honesty |
| A3  | Verified, live-check and suggestion **look different**, and a rule never looks like an idea.                                             | §4.1                            |
| A4  | Nothing reports open, safe, a price or a drive time unless a source states it. The unknowns are printed with the day.                    | §4.2, §4.4; `016854a`           |
| A5  | What to do there is chosen **for these two people**. The options that weren't chosen stay reachable, with reasons.                       | §3                              |
| A6  | It prints. The paper is enough without a phone, and it says so plainly where it isn't (no offline map yet).                              | §4.7–4.8; `AnalogGuide.tsx`     |
| A7  | There is somewhere to write down what happened. **Proposed beyond the page:** something receives it, and the next day can start from it. | §4.9; ANOTHER                   |
| A8  | Success is judged by the line on the page, not by any metric: _casts once, finds a weird stick, asks to come back_.                      | §1; doctrine §1                 |

**Recovered.** `/go` already has an acceptance sentence of its own, and it is
Emi's minus the fish. `src/domain/day/build.ts` (`defaultRadiusKm`) says it
was _"Dogfooded with the acceptance sentence — four hours, a five-year-old,
near Vernon"_. In `016854a` that sentence produced _"Civic Memorial Park →
Polson Park → Greater Vernon Athletics Park, all inside 3 km"_. That is an
honest day, and it is not Fishing With Emi.

### Where `/go` stands against the bar

**Recovered from code, not measured against Atlas.** There is no Atlas access
from this lane.

- **Met by design:** A2, A4 and A6, except for the paper map.
- **Partly met:**
  - A1. Stops get a title and a challenge, but not a stated _why_ per moment.
  - A3. Unknowns are shown, but there is no three-tier legend.
- **Not met:**
  - A5. `/go` has no modules.
  - A7. There is no return path.
- **Unknown:**
  - Whether Atlas holds Hidden Lake as a subject with coordinates, and whether
    the 30 km planning circle `/go` draws for four hours would reach it from
    Vernon.
  - The _"stated planning circle"_ is overruled _"by anything the person
    actually asked for"_. Whether "fishing" counts as such a request has not
    been tested.
  - Measuring this needs the sentence above run against production Atlas.

---

## 6. Open, and not resolved here

- **The day itself.** What happened on the outing is not in the repository.
- **Who owns the builder.** Should the Adventure Builder belong to generic
  Passport, or be a feature of a Fishing Experience? This is doctrine §15 Q1.
- **Where modules come from.** For Emi they are hand-written (_"Module picks,
  the 'chosen for Emi' default, the memory fields. Invented, and labelled
  so."_). How they would come from Atlas is unspecified.
- **Is this the right bar?** Whether A1–A8 is the acceptance bar at all is for
  Lorne to accept, change, or replace.
