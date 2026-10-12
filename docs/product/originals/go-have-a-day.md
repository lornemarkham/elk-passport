# GO HAVE A DAY — and then, NOW GO HAVE ANOTHER

**Not product authority.** The doctrine is. Labels (**Recovered**,
**Stated**, **Proposed**) are defined in [`README.md`](README.md).

Written 2026-10-11 on `lane/vision`, on top of `bf8bcc7`. Every path and line
number refers to that tree.

---

## 1. The idea in one paragraph

A person says what kind of day they want, in their own words. Passport builds
one out of real places, and is honest about what it doesn't know. The person
prints it, puts the phone away, and goes and has the day. Afterwards they come
back, say what actually happened, and the next day starts from that. **GO HAVE
A DAY** is the first half of that loop. **NOW GO HAVE ANOTHER** is the second
half, and it is the half that doesn't exist yet.

- The paragraph as a whole is **Proposed**, as a summary.
- Every clause before "Afterwards" is **Recovered**: §3–§8 cite each one.
- "NOW GO HAVE ANOTHER" is **Stated**.

---

## 2. Where the name came from

**Recovered.** The name is the end of a lineage, not something invented in a
brand session.

| Step | Where                                                         | What it says                                                                                                                                                                  |
| ---- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `archive/13-philosophy.md`                                    | _"The success metric is: "That was one hell of a day.""_                                                                                                                      |
| 2    | `archive/13-philosophy.md`                                    | _"Passport should help answer a different, harder question: "What kind of day would make your life better today?""_                                                           |
| 3    | doctrine §1                                                   | _"Holy shit. That was one hell of a day."_ The doctrine says to treat this as settled.                                                                                        |
| 4    | `src/components/design-lab/brand.tsx`, `b32b87d` (2026-10-10) | Round four of the design lab. **ONE HELL OF A DAY** was the wordmark, and _"Go have a day."_ was the tagline: _"Small, lowercase, and never shouted alongside the wordmark."_ |
| 5    | `src/components/ghad/Wordmark.tsx`, `6950899` (2026-10-10)    | The tagline became the name: _"**GO HAVE A DAY.** Three words, set tight and heavy … Passport is still the name of the thing that runs it."_                                  |
| 6    | `src/app/go/`, `src/domain/day/`, `016854a` (2026-10-11)      | `/go`, the first route that does what the name says: _"say it, build it, print it, leave the phone"_.                                                                         |
| —    | `docs/product/october-experience-bible.md` §27.1              | _"Now go have one hell of a day."_ The bible marks it explicitly as a candidate ending for October 31, **not canon**.                                                         |

**Passport is still the product's name** in the repository, on the domains and
in production. GO HAVE A DAY is what a person reads
(`src/components/shell/PassportNav.tsx:28`). That is how things stand, not a
decision this document makes.

### NOW GO HAVE ANOTHER

- **Stated.** The brief names it as a pair with GO HAVE A DAY.
- **Recovered: no.** `git grep -i 'have another'` finds nothing anywhere in
  this repository. The nearest string is the October bible's _"Now go have one
  hell of a day."_, which the bible itself marks as not canon.
- **Proposed reading.** "Another" is the return half of the doctrine's loop,
  REMEMBER → LEARN → back into DISCOVER (§2). It is what you say to someone
  who has just come home from a good day. It asks them to come back for the
  next day, not to spend more time in the app. The difference matters, and
  doctrine §6 is why: _"Passport succeeds when people engage more deeply with
  their lives — not when they spend more time in Passport."_ An "another" that
  counts as success when people come back to the screen would be the wrong
  thing.

---

## 3. Moments, Days, Another

**Stated:** the brief names these three together.

**Proposed:** read them as a scale, from the smallest unit to the loop.

```
MOMENT   →   DAY   →   ANOTHER
the stop      the plan    the next one, built from what actually happened
```

### Moments — recovered

- `archive/03-treasure-chest.md`: _"Product Moments (the idea that memorable
  moments matter more than attractions)"_, and _"Life is measured in moments"_.
  The file is headed _"These are ideas only. They are not features, and they
  are not a roadmap."_
- Fishing With Emi (`src/app/about/experiment-07-fishing-with-emi/`):
  - The route is _"Four moments, not a list of directions"_ (`FishingWithEmi.tsx`).
  - Each moment carries a **why**: _"Passport's job is to say why a stop is
    worth making, not just where it is."_
  - The four moments are the backroad drive, Seidner Lake as a scout stop,
    Hidden Lake, and the victory treat. See
    [`fishing-with-emi.md`](fishing-with-emi.md).
- **The word has two other meanings in this repository. Do not merge them.**
  - **The data type.** `momentSchema` in `src/lib/schemas.ts:73` is a captured
    photo or note tied to an Adventure (`/adventure/[id]`, `useAddMoment`).
    That is _remembering_ a moment, not _planning_ one.
  - **The October bible.** It uses Moment for _"a small cinematic intervention
    inside or around a surface"_ (§3).
  - **Proposed.** "A moment is a stop with a reason, and afterwards it is a
    memory of that stop" would join the first two meanings. That is a naming
    decision, and it overlaps doctrine §15 Q14 (_"Product vocabulary for Want /
    Plan / Lived states"_). It is left open.

### Days — recovered

- The day is the unit `/go` builds (`src/domain/day/build.ts`, `016854a`): two
  to five stops, each of them an Atlas subject with an id.
- The day is also the unit of the measure: _"one hell of a day"_.
- **Idea Atlas** (`src/app/about/idea-atlas/content.ts`):
  - _"One day. One season. One memory. At a time."_
  - _"Passport should help people remember a day, not just plan one."_
  - _"A day told as a scene is more exciting than a day told as a schedule."_
- The board growth stages run 1 → 5 → **10 items: "This is becoming a day"** →
  20: a weekend → 30: _"This might be your summer"_ (`idea-atlas/content.ts:1947`).
- `b026d8a`: _"A person can bring a day to Passport instead of a search query."_

### Another — stated; the pieces are recovered

- The closing line of every `/go` plan (`build.ts`): _"Put this in your
  pocket and your phone in the glovebox. Come back and tell us what actually
  happened."_
- The printed guide ends with a _"What actually happened"_ section and eight
  ruled lines (`src/components/go/AnalogGuide.tsx`).
- The last instruction in `ANALOG_PHILOSOPHY`: _"Come back later and tell
  Passport."_
- Labs experiment 10, _Hell Of A Day_ (`ideas-to-make-pages/content.ts`):
  _"Passport helps you plan a day. It's never once helped you remember one."_
- **Nothing receives any of this.** The paper has lines to write on, the
  closing line asks people to come back, and no code path takes what they
  bring. Doctrine §2.10 already says so: _"Nothing in the current architecture
  builds that return path yet."_
- **Proposed.** ANOTHER is that return path, framed as an invitation rather
  than a survey. It would take the paper back in (what we did, what we
  skipped, what we found), keep **WANTED / PLANNED / DID / LOVED** separate
  (doctrine §2.9), and open the next day from it. How feedback flows between
  a person's own Passport and shared knowledge is doctrine §15 Q11. This file
  does not answer it.

---

## 4. Conversational discovery

**Recovered.** You start with a sentence, not a form.

### In the product today

`src/components/go/GoHaveADay.tsx`, `016854a`:

- There is one box: _"What kind of day do you want?"_ The example sentence is
  _"Five hours, $100, with a five-year-old, near Vernon."_
- _"The conversation is deliberately not a chatbot: there is no assistant
  persona, no typing indicator and no thread."_ This is doctrine §3, "AI is
  not a tab", in practice.
- **You revise the day in your own words.** The buttons are _Make it cheaper,
  More outdoors, Less driving, Make it weirder, Make it more adventurous_.
  Free-text changes such as "swap the second one" go through `reviseBrief` and
  `replacedStop` (`src/domain/day/brief.ts`).
- **Reading the sentence is deterministic and needs no key.**
  - _"A model, when one is configured, fills the same `DayBrief`; it never
    chooses a place."_ (`016854a`)
  - The parser _"never guesses a town from an area code, never infers a child
    from "family""_ (`brief.ts`). That is doctrine §5 discipline: signals are
    evidence, not facts.

### In the earlier ideas

- **Idea Atlas: Close Your Eyes / Voice Discovery.** _"Passport listens, then
  reveals a completely different set of possibilities. Could repeat … Planning
  feels like imagination rather than filling out a questionnaire."_ The prompt
  is _"What kind of day do you need?"_
- **Idea Atlas: everyday utility.** _"I've got 2 hours." "It's raining." "Kids
  are bored." "I have $40." "I'm hungover." "I've already done everything."_
  The Atlas notes that _"These practical queries may become some of Passport's
  most-used experiences."_
- **Doctrine §3 and §4** give the kinds of sentence it must handle: _"Love the
  plan, but my friend is allergic to shellfish." "I have one day in Tibet. Fill
  it."_

### Gaps, recorded

- `GoHaveADay.tsx:35` refers to `/api/go/read`, which _"improves the reading of
  an unusual"_ sentence when a key is configured. **No such route exists in
  `src/app/api/`.** The model path is described and has not been built.
- Voice is a future direction (doctrine §3). It is not built.

---

## 5. Adventure Builder

**Recovered.** The idea exists in exactly one place: Fishing With Emi
(`2819edb`, 2026-08-15).

> Can Passport hold **more possibility than it shows any one person**, and
> assemble the subset that fits a specific uncle and a specific five-year-old?
> … 22 modules exist, 13 are on for Emi, and the 9 that are off stay visible
> with the reason they were not chosen. A page that only rendered her 13 would
> look identical to a page that only had 13 — which is precisely the
> difference this experiment is trying to make visible.
>
> — `FishingWithEmi.tsx:45-52`

### Rules the builder already has (recovered)

- **Unchosen modules stay visible, each with its reason.** For example, the
  forestry module: _"Deliberately off for Emi, and deliberately still here.
  Another family on this exact route would turn it on first — that is the
  whole point of the builder."_
- **An unchosen module never reaches the paper.** _"An unchosen module is a
  control, not part of the adventure — it must not reach the packet."_
- **A module with no sourced content produces nothing.** Local history is off
  because _"Turning it on would produce nothing rather than something
  invented."_
- **Modules come in four groups:** Fishing (_"The actual skill"_), Nature
  (_"What to do when the fish are not biting"_), Learning (_"Education that
  does not feel like school"_) and Games (_"For the drive and the quiet
  stretches"_).

### How `/go` relates to it (recovered)

`/go` adds one **challenge per stop**, and _"No stated feature, no challenge"_
(`build.ts`). That is the same no-invention rule. It does not yet have a
builder: there is no set of modules for a person to switch on and off.

### Proposed

The Adventure Builder could become the layer between a built Day and its
paper. The Day picks _where_. The builder picks _what you do there, and what
you learn_, for these particular people. Its modules would come from Atlas's
stated features and affordances wherever they exist. Where they don't, a
module would say plainly that it has nothing, as local history already does
for Emi. Whether this is generic Passport or part of an Experience is doctrine
§15 Q1, and it is still open.

---

## 6. Go Offline / Digital Detox

### Recovered: the principle

- Doctrine §6: _"Less phone, more life."_
- `experiment-06-analog-adventures` (`76dde5e`): _"the best Passport session
  ends with the phone being put away. Technology removes uncertainty, then it
  disappears."_
- Idea Atlas:
  - _"Passport should earn the right to be closed."_
  - _"Technology should often help people use less technology. Passport can
    help someone prepare, print what matters, put away the phone, go live the
    experience, then optionally come back and tell the story."_
- Analog Adventures, open question: _"How does an app measure success when
  success means you closed it? Every analytic we'd reach for rewards the
  opposite behaviour."_

### Recovered: the product

`/go`'s eyebrow is **"Go offline"**. The six doors are `OFFLINE_MODES` in
`src/components/go/modes.ts`. Each door is a sentence passed to the same
parser; there is no second settings system.

| Door             | Blurb                                                   |
| ---------------- | ------------------------------------------------------- |
| Two-Hour Escape  | _Out the door and back before anyone notices you left._ |
| Whole Day        | _Leave in the morning. Come back with a story._         |
| Family Unplugged | _Everyone's phone in one bag. Somebody holds the bag._  |
| Get Lost         | _Further than you'd normally go, on purpose._           |
| Meet Humans      | _Somewhere with other people in it, talking._           |
| Surprise Me      | _Something unusual. No preview._                        |

### Stated: "Digital Detox"

**This is the brief's name.** No artifact in this repository uses the word
"detox"; `docs/history/concepts.md` records it as missing.

> **Conflict to name, not resolve.** `modes.ts` says _"This is not a
> digital-wellness product and there are no screen-time charts in it."_
> "Digital Detox" is the vocabulary of exactly that category. Two things are
> undecided:
>
> - whether "Digital Detox" is a name a person should ever read;
> - whether it is an internal label for the Go Offline idea.
>
> The code's position is that the product does not become a wellness tracker.
> That position is recorded here and not overridden.

### Proposed

Treat "Go Offline" as the product noun and "Digital Detox" as the brief's
description of the intent. Never add a screen-time metric. Analog Adventures
already explains why: it rewards the opposite behaviour.

---

## 7. Analog, printable adventures

### Recovered: the philosophy

`ANALOG_PHILOSOPHY` in `src/app/about/idea-atlas/content.ts:2588`, under the
heading _"ANALOG PASSPORT — use technology to enable less technology"_:

> Encourage planning the night before. · Print it. Fold it. Put it in the
> truck. · Use a real paper map. · Circle things. Write notes. · Go somewhere
> with no cell service. · Stumble onto something yourself. · Come back later
> and tell Passport.

### Recovered: what was printed before `/go`

- **Fishing With Emi.** The page has a _"Print adventure"_ button, a printed
  packet that follows the builder, learning cards _"for the drive and the quiet
  bits"_, and a memory section: _"Fill this in at the treat stop while she
  still has opinions about it."_
- **Analog Adventures: `ARTIFACTS`.** _"Technology should create physical
  things. Paper outlasts battery."_ The list is Family Adventure Book, Printable
  Maps (_"Folded into the glovebox."_), Field Journal, Park Passport
  (_"Stamped. Collected. Kept."_), and Road Trip Binder (_"Everything, offline,
  in order."_).
- **Idea Atlas: `ANALOG_PRINTABLES`.** Adventure Card, Field Guide, Official
  Map, Trail Map, Packing List, Emergency Info, Checklist, Activities, Notes,
  Scavenger Hunts, Learning Sheets, Kid Kits, Journals.
- **Labs experiment 07, _Analog Adventure_.** _"What if the app's job is to
  disappear once you get there?"_ It counts as a success if _"Someone actually
  prints it."_ and _"Someone doesn't open the app again until they're home."_
- **Wonder.** _"A printable keepsake is the real idea here — not built yet."_

### Recovered: what is printed now

`/go/print` and `src/components/go/AnalogGuide.tsx` (`016854a`) produce:

- numbered stops and their towns;
- what is published about hours and prices, and what is **not**;
- a map link to open before leaving;
- one challenge per stop that doesn't involve a phone;
- checkboxes, eight ruled lines, and a closing line, _"so it ends like a day
  and not like a receipt"_.

The print route rebuilds over the exact stops sent to it, in that order:
_"Re-planning here could hand somebody a different afternoon between pressing
print and the paper coming out, which is a small betrayal."_

### Recovered: gaps

- **No map on paper.** _"There is no offline map here and the page does not
  pretend otherwise"_ (`AnalogGuide.tsx`). A real paper map is the second line
  of `ANALOG_PHILOSOPHY`, and it is not built.
- **Analog Adventures asked:** _"Is a printed guide a different product, or the
  same knowledge with no links? Paper can't 'load more'. Everything has to
  already be there."_ It also asked: _"What has to be true before someone
  trusts a plan enough to go offline with it? Completeness stops being a score
  and becomes a safety property."_ Neither question is answered.

---

## 8. Boards

### Recovered

- **Doctrine §9.** _"The board is potentially central, and is currently treated
  too much like bookmarks."_ The loop it gives is DISCOVER → WANT → ORGANIZE →
  DO → REMEMBER. _"Saving must lead somewhere."_
- **Doctrine §2.6.** _"A saved list that becomes a graveyard of forgotten links
  is product failure."_
- **Idea Atlas.**
  - _"The mood board is where people intentionally collect possibilities, and
    it should remain central."_
  - _"The mood board follows the traveler around Passport like a happy
    puppy."_
  - _"Do not make it feel like 'Saved Items.'"_
  - The growth stages run from a small beginning, to _"This is becoming a
    day"_, to _"This might be your summer"_.
- **Labs experiment 09, _The Companion Board_.** _"A shared board where each
  friend reacts to a place instead of voting on it."_ It counts as a success
  if _"A group chat says "just use the board" instead of pasting five separate
  links."_
- **Code.**
  - `/boards`, `/boards/[id]` (realtime, collaborative) and `/saved`.
  - `61a2853` reduced Discovery to a single **Save** action.
  - The nav's Saved link points at `/saved`, not `/boards`
    (`PassportNav.tsx`).

### Recovered: the seam that is missing

**`/go` does not read a person's Saved items or boards.** `buildDay` draws from
the whole Discovery pool. That leaves the two halves of the loop unconnected.
Saving doesn't lead to a day, and a day doesn't come from what was saved.

### Proposed

The most direct version of "saving must lead somewhere" is _"Make a day out of
my board"_. It would be the same builder, with the person's own saved
subjects as the pool. Doctrine §4 already has the sentence for it: _"You've
saved six things. Want me to turn them into an afternoon?"_ The board growth
stages (a day at 10, a weekend at 20) say when to offer it. This needs no new
contract. It does need a decision, because it starts settling Want/Plan
vocabulary (§15 Q14).

---

## 9. Fishing With Emi is the acceptance experience

- **Stated.** The brief names Fishing With Emi as the **flagship acceptance
  experience**.
- **Recovered.** The page itself calls it _"the first ELK Labs sandbox built
  from a real outing rather than a mood"_.

See [`fishing-with-emi.md`](fishing-with-emi.md) for the outing, the bar, and
what `/go` can and can't do against it today.

---

## 10. Conflicts named, not resolved

1. **Clock times against honest planning.** Doctrine §2.5 sketches _"Leave at
   8:40. You'll be home around 12:50."_ `/go` refuses to give minutes. Its
   rules are: _"travel: straight-line km — there is no routing and no
   minutes"_, and time at a stop is _"the PLAN's division of their own hours,
   never the venue's"_ (`build.ts:24-42`). The code currently favours honesty
   over the doctrine's sketch. A routing source would remove the conflict;
   until there is one, it remains.
2. **"Digital Detox" against "not a digital-wellness product."** See §6.
3. **`/go` is not in the nav.** `PassportNav.tsx` lists Discover, Places and
   Saved. The only link to `/go` in this repository is the wordmark on the
   printed guide. Whether GO HAVE A DAY is the front door or a side route is
   undecided.
4. **"Moment" means three things.** See §3.
5. **Experience or generic?** GO HAVE A DAY's `/go` lives in generic Passport,
   and Fishing With Emi was built like an Experience page. Doctrine §15 Q1 is
   still open, and nothing here settles it.

---

## 11. Not authorised by this document

The following are all ideas. None of them is a work item:

- an "another" return path;
- the Adventure Builder in `/go`;
- making a day from a board;
- a paper map;
- `/api/go/read`;
- voice;
- a "Digital Detox" label.

The doctrine's fences still hold. Inspiration (§13) and the not-now list (§14)
stay fenced, and that includes the photo competitions, stamps and social games
in the Treasure Chest.
