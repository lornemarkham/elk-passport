# The Experience Lab

**Status: prototype and findings. Nothing here is settled architecture.**
Hypotheses are labelled as hypotheses. Where the lab failed to answer
something, it says so rather than picking an answer.

Open it at **`/labs/experience`**.

---

## Why this exists

Passport's position is that Atlas understands the world and Passport
understands _the experience_. That sentence is easy to agree with and hard to
build, because "an experience" is not a thing anyone has defined. This lab
exists to find out what it actually is by building one, five times, with
fixtures chosen to be as unlike each other as possible.

The specific question: **what turns "I'm going to a hockey game with
coworkers" into "fuck yeah, Friday"?**

The lab's answer so far, stated as plainly as it can be:

> The escalation is almost entirely made of **questions the group answers
> about each other**, not information about the event.

Nothing Passport could tell you about Rogers Arena moves that needle. "Nathan
is the only person predicting a shutout" does. That is the finding everything
else here follows from.

---

## What an Experience appears to be

Not an itinerary. Not a page about a place. Not a chat.

> **An Experience is a shared space that changes shape over time, in which a
> group answers questions, and which becomes a memory without anyone doing
> anything.**

Four properties, each of which turned out to be load-bearing:

1. **It is shared, and everyone in it is a participant, not a viewer.** The
   host's page and a guest's page are the same page. The prototype has no
   admin view, no settings, and no "manage this experience" — every time a
   management affordance was added it immediately started feeling like
   software instead of a night out.
2. **It changes shape.** The page you open on Tuesday and the page you open
   the next morning are composed from different blocks. Not the same page with
   things greyed out — a different page built from the same material.
3. **It is not over when the thing is over.** The feed during the night and
   the memory afterwards are literally the same list, read at two different
   times. That is why "remember" cost almost nothing to build.
4. **It accumulates.** The next edition can inherit the roster, the standings
   and the running joke. That is where tradition comes from, and it is the
   only part of the loop that is genuinely valuable and genuinely cheap.

---

## Lifecycle

The prompt proposed `DREAM → ANTICIPATE → DISCOVER → COLLECT → PLAN → COUNT
DOWN → GO → EXPERIENCE → REMEMBER → TRADITION → AGAIN`.

**A fixed enum did not survive contact with the second fixture.** "We have
three hours" has no countdown; a date has no leaderboard to lock picks into;
a Christmas light-up has four "don't miss" anchors inside one evening.

What every experience _does_ have is an ordered list of moments where the page
should become about something else. So `Phase` is **declared by the fixture**,
as `{ id, label, headline, offsetMinutes }` relative to an anchor, and the
active phase is simply the last one whose time has arrived.

`headline` is the highest-value field in the whole model for the money it
costs. It is Passport's one-line answer to "what is this page for right now?",
it sits directly under the poster, and it is the single strongest reason the
page reads as alive:

- _Make Friday worse. Everyone gets a say._
- _Last call on picks. They lock at puck drop._
- _Picks are locked. Nobody can save you now._
- _The horn is not the end of the night._
- _What actually happened._

---

## Candidate primitives

Ordered by how confident the lab is in them.

### Confident

**`Prompt` — a question put to the group, and what came back.**
The primitive that mattered most. A pregame vote, a sealed score prediction,
a dare about a friend, a scavenger-hunt tick, a "where are we going now?"
decision and a date-night "pick one of these three" are all one shape. They
differ in four switches:

| switch              | absent                                 | present                                                |
| ------------------- | -------------------------------------- | ------------------------------------------------------ |
| `scoring`           | a decision                             | a competition                                          |
| `reveal`            | `immediate` — a vote you watch fill in | `onLock` — a sealed pick                               |
| `reveal: "never"`   | —                                      | private; Passport is structurally unable to narrate it |
| `openToSuggestions` | fixed options                          | the group can change the question itself               |

**Those four switches are the entire difference between Hockey Night and Date
Night.** Nothing else in the engine changed. That is the strongest evidence
the primitive is real.

**`Phase`** — see above. Declared, not enumerated.

**`Moment`** — a timestamped thing that happened. The feed and the memory are
one list. Reactions are stored _beside_ moments rather than inside them, so
the same gesture works on a line a fixture wrote and a line a person wrote.

**Derived standings.** The leaderboard is a pure function of resolved prompts
× responses. Nothing writes a score anywhere. Consequences worth keeping: a
fixture with no scored prompts produces _no leaderboard at all_ rather than a
table of zeroes, which is the mechanism by which a date is not a competition;
and correcting a result costs nothing.

**Authored labels over derived winners.** Who wins each award is computed;
what the award is _called_ is authored. A ski day gives out "Last Chair" and a
hockey night gives out "Passport Potato" and the engine knows neither phrase
exists.

### Promising, incompletely tested

**`Voice` — split into `observe()` and `phrase()`.** The observation is
computed from the _shape_ of the group's answers and is domain-blind:
`exactly one person chose an option nobody else chose`, `the group is split`,
`these two agree`, `this person has answered nothing`. Only the wording comes
from a tone table. The same observation produces:

- rowdy: _"Nathan is the only person going with a shutout. Bold strategy."_
- intimate: _"You both said Quiet, and long. That's either love or laziness."_

This split is the reason Date Night does not read as Hockey Night. **It is
also the seam a language model would eventually sit in — replacing `phrase()`,
never `observe()`.** A model inventing that Nathan predicted a shutout when he
did not is exactly the failure Passport cannot afford, and keeping the
_observation_ derived means the funny line can never be a fabricated one.

**`Block` — a section that declares which phases it exists in.** Deliberately
the same idea as the existing Passport page composition
(`src/lib/passport/composition.ts`): an ordered list of sections holding
decisions and no facts. The addition is a time dimension.

**`Share` as plain text.** One tap produces a pasteable standings block. Plain
text on purpose: it survives Slack, iMessage, a group chat and a screenshot,
needs no integration and no account. Building a Slack app before knowing
whether anyone pastes this would be solving the second problem first.

### Hypotheses only — do not build on these yet

- **`Participant`** is currently a name, an emoji and a hue. It is not a
  person. See _Auth implications_.
- **Awards** work, but "no one person collects every title" had to be added as
  a rule after the winner swept and it stopped being funny. That rule is a
  guess about what feels good, not a finding.
- **`Lineage`** (what a previous edition left behind) is displayed but not
  wired. "Run it back" is a button that does nothing.

### Considered and rejected

- **`Experience` as a subclass of `Place` or `Event`.** An experience is not
  an Atlas entity. It _references_ them.
- **A generic `Contribution` covering votes, photos, comments and reactions
  alike.** Attempted, and it produced a type with six optional fields and no
  meaning. `Prompt`/`Response` and `Moment` are two primitives because they
  really are two things: one is answered, the other happened.
- **A `Module`/plugin registry for "experience toys".** Not needed. A toy is a
  `Block` plus some `Prompt`s, which is data. Five wildly different fixtures
  required zero new component types after the third.

---

## Results against the fixtures

Each fixture was written to break something specific.

### 🏒 Hockey Night — the specimen

Built the engine, so it proves nothing on its own. What it did establish: the
funniest thing on the page is always the question Passport did not write.
"Will Lorne buy a $19 arena beer before puck drop?" is a `boolean` prompt
worth 10 points that a participant asked, and it is the best thing in the
prototype. **The single most valuable affordance found in the lab is letting a
person invent a question.**

### 🎿 Powder Day — no ticket, no fixed start, facts nobody wrote

**Held.** The anchor became "first chair", the interesting phase became the one
_before_ it ("is this happening?"), and conditions arrived as a `panel` block
— facts nobody in the group authored, which is exactly the shape Atlas will
eventually fill.

**What it broke:** "Run of the day" is decided by a _vote_, not by a
resolution. The engine can score a prediction against a truth; it cannot yet
treat the group's own vote as the truth. Open question 1.

### 🎄 Christmas Light-Up — many anchors in one evening, mixed ages

**Strained.** Modelling each "don't miss" moment (choir 5:20, the switch 6:00)
as a phase works, but makes the phase list long and makes `headline` carry
more than it was designed for. A light-up is one experience with four small
anchors inside it, and the model currently has no way to say that.

**What it did prove:** scored prompts do not have to be predictions. A
seven-year-old cannot predict a score but can absolutely find a brass band, and
`boolean` + `scoring` is a scavenger hunt with no new machinery.

### 🌙 Date Night — the disproof fixture

**This is the one that decides whether the engine is real, and it passed.**
Two participants, no `scoring` anywhere, `reveal: "onLock"` on what matters and
`reveal: "never"` on one, `tone: "intimate"`, no roster block and no feed. The
result reads as private and quiet. **Nothing structural changed** — only the
four switches and the tone table.

If one thing in this document is worth trusting, it is this: the engine is not
secretly a hockey engine.

### 🕒 We have three hours — no anchor event

**Partially answered, and the weakest fixture.** It does show that an
experience with nothing at its centre still has a shape, because the first
phase's job is to _produce_ the centre: the prompts are about the people, and
their answers are what a recommendation would be built from.

**What is missing:** the hand-off. Choosing "Kalamalka lookout" does not
actually make it the experience — the next phase shows a hard-coded panel. The
real version is "the group's answers become an Atlas query, and the chosen
result becomes this experience's anchor", and none of that is built. Open
question 3.

---

## What proved hockey-specific

Very little, and all of it is data:

- **Team names** — `pairLabels: ["Canucks", "Flames"]` on a `pair` prompt. The
  same shape is "Runs / Falls" on a ski day.
- **`pair` partial credit** ("right winner, wrong score") is a sports-shaped
  scoring rule. It is opt-in per prompt and no other fixture uses it.
- **The rowdy tone.** Which is the point of tones.
- **Hockey-flavoured award names.** Which is the point of authored labels.

Nothing in `core/` names a sport, a season, a mood or a venue. That was
enforced as a rule while writing it, and it held.

---

## What still feels lame

Recorded honestly, because a lab that only reports successes is not a lab.

1. **Making picks is still a stack of seven cards.** Better than it was — the
   group's progress is stated once rather than under every card — but it is
   the one part of the page that still reads as a form rather than a night.
   A one-at-a-time run, or a swipe deck, is the obvious next thing to try.
2. **Passport's voice is a phrase table.** It is genuinely derived, which is
   the important part, but it is not yet surprising, and surprise is most of
   what makes this funny.
3. **"Run it back" does nothing.** The single highest-value unbuilt thing.
4. **Nobody else is really there.** Everything is one browser. The page is
   _about_ other people and none of them can actually arrive.
5. **Photos are text.** "34 photos" is a sentence, not 34 photos.
6. **Three Hours does not discover anything.** See above.

---

## Existing Passport concepts reused

- **Page composition** (`src/lib/passport/composition.ts`) — sections in an
  order, holding decisions and no facts, with absent meaning default. `Block`
  is that idea plus a time dimension, and the "hold no facts" discipline is
  the reason a phase change can rearrange the page safely.
- **Derived destination** (`src/domain/experience/destination.ts`) — the
  principle that _undefined is a real answer_. `standings()` returning `[]`
  rather than a table of zeroes is the same move.
- **Visual language** — the app's Fraunces/Jakarta pairing and its dark
  surface. The lab pushes darker and more poster-like than the rest of
  Passport, deliberately.
- **Fixture discipline** — every ELK Labs sandbox states that its content is
  invented. This one does too, on every page.

**"OUT Passport" was searched for and does not exist in the codebase.**
`/passport/[id]` is an entity knowledge page, not a shared social object. So
this lab is not a reinterpretation of an existing implementation; if OUT
Passport is meant to be the shared object, this is a first proposal for what
it could be, not a change to something already built.

---

## Auth implications

No auth was built, and the prototype is deliberately arranged so that adding
it is a swap rather than a rewrite.

- Everything above `core/store.ts` speaks in terms of _a participant id acted
  at a time_. Nothing reads storage directly.
- Identity is claimed, not proven: you tap a name on the invite list. That is
  the right _interaction_ for a link pasted into Slack and the wrong _security
  model_ for anything.

What auth would have to bring, in rough order of value:

1. **A participant is a real account**, so "Nathan" on one phone and "Nathan"
   on another are the same Nathan. Everything else depends on this.
2. **Private answers must be private on the server, not just in the
   renderer.** Today `reveal: "never"` is enforced by the client and by
   `commentary()` refusing to look. That is honest for a prototype and
   unacceptable the moment two people share a page.
3. **A personal Passport contributing preferences with permission.** The
   interesting version, and the one this lab did not test: Nathan wants a
   lively pregame, Sarah wants dinner, Mike must leave by eleven, and the
   group experience finds the intersection _without exposing anyone's
   profile_. The shape that seems right is that a personal Passport answers
   questions on your behalf when you allow it — which means the seam is
   already the `Prompt`, not a new sharing model. **Hypothesis, untested.**
4. **Guests without accounts.** Somebody will open the link and refuse to sign
   up. The lab's "just looking, thanks" state exists to keep that path
   visible.

---

## Atlas contracts this would eventually want

Stated as what the product needs, not as a proposed API.

- **An anchor.** A real `Event` with a real start time — Atlas already models
  this (`Experience.startTime`), and the hockey fixture's `anchorAt` is
  standing in for it.
- **Candidate options for a `Prompt`.** "Where are we going before?" wants
  three to five real places near the anchor, with a walking time, one honest
  sentence, and enough for someone to have an opinion. This is the single
  highest-value Atlas request in the lab, and note what it is _not_: it is not
  a ranked recommendation. It is **a small set of options that will start an
  argument**. Passport wants candidates; the group does the choosing.
- **Conditions and schedule facts** — the `panel` block. Snowfall, lift status,
  the choir at 5:20, sunset time, what closes at five.
- **Contextual options at a moment.** "Where are we going now?" at 9:40pm,
  outside an arena, needs what is open, close, and can take six people. That is
  a live query with a location and a time, and it is the hardest one.
- **Nothing about the group.** Atlas should never learn who Sarah is or what
  she voted for. The boundary that seems right: _Passport sends Atlas a
  situation, never a person._

---

## Privacy boundaries found

1. **`reveal: "never"` must be structural, not a UI decision.** `commentary()`
   filters private prompts out before observing them, so Passport is
   _incapable_ of narrating one rather than merely choosing not to. There is a
   test for this.
2. **A sealed answer is sealed from Passport too.** It comments only on what is
   revealed and on the page in this phase.
3. **Passport comments only on what is on the page right now.** Not a privacy
   rule exactly, but the same instinct — it kept making jokes about the pub
   vote the morning after the game, which is how a voice stops being about the
   moment.
4. **The group's intersection should not require exposing the group's
   profiles.** Asserted, not built. See _Auth implications_.

---

## Why this is not an itinerary planner

An itinerary is a plan someone made, that other people receive. Every
interesting thing in this lab is the opposite of that:

- The pregame spot is chosen by the group, and anyone can add an option nobody
  thought of.
- The picks are about each other, not about the event.
- The best question of the night is one a participant wrote.
- The postgame decision is made in three taps while standing on a pavement.
- The memory is a by-product of having been there, not a thing anyone wrote.

A planner produces a document. This produces **a reason to be excited on
Tuesday, an argument on Thursday, and something to be insufferable about on
Saturday.**

---

## Open questions — genuinely unresolved

1. ~~**Can a vote be a resolution?**~~ **Answered in round 2: yes, and cheaply.**
   `Prompt.resolvedBy: "vote"` derives the resolution from the plurality once
   the answers are revealed, and everything downstream — scoring, awards,
   `settled`, the share card — worked unchanged. A tie stays unresolved. Powder
   Day's "run of the day" is now scored this way.
2. **How does an experience with several small anchors inside it work?**
   Christmas Light-Up strained the phase model. Nested phases? Anchors as
   first-class objects a phase can point at? Unknown.
3. **How does discovery hand off to escalation?** Still open. "We have three hours"
   chooses an option and then... nothing. Does choosing _create_ a new
   experience, or _reconfigure_ this one? This is the biggest structural
   question in the lab.
4. **Where do experiences come from?** Every fixture here was authored. A real
   Passport has to let a person start one in about four taps, and none of that
   is designed.
5. **Should `askedBy` questions be scored at all?** The prototype lets a
   participant set the stakes on their own question. That is either delightful
   or the beginning of an arms race, and one night of use would tell you.

---

## Layout

```
src/experience-lab/
  core/          the engine. Knows nothing about sport, season or mood.
    types.ts       the primitives
    phase.ts       what time it is, in the experience's own terms
    engine.ts      definition + what people did → what the page is now
    scoring.ts     bragging rights, derived
    voice.ts       observe() and phrase()
    share.ts       the thing that leaves the building
    store.ts       persistence seam (localStorage today, a server later)
  fixtures/      five specimens. Data only.
  ui/            the page. No fixture knows how it looks.
src/app/labs/experience/
  page.tsx           the specimen shelf
  [slug]/page.tsx    one experience
```

`core/` has no React import and no knowledge of any fixture. That is the line
worth defending if any of this graduates.

**Bounded on purpose.** This sits in its own top-level folder rather than
being spread across `src/domain`, `src/lib` and `src/components`, so it can be
deleted in one command if the answer turns out to be no.

---

## Lab controls

The **Lab** button, bottom-right. It moves `now` and switches who you are —
because an experience is a function of when you open it, and that is
impossible to evaluate at the speed of real life.

It is styled as an obviously foreign object. Nothing in it is proposed as a
Passport feature, and the day it starts looking like one it should be deleted.

---

---

# Round 2 — the toy box

**What changed:** nothing was redesigned. The page, the phases, the voice, the
five fixtures and the `Prompt` primitive are all as they were. Round 2 added
_ways to make things_, and then a rhythm to stop them from being too much.

The question this round was set: **how many ways can one person set up a night
that other people then play?**

---

## The curator hypothesis

> The curator sets the stage. Passport provides the toys. The group creates the
> night.

This is a hypothesis about **authoring**, not a permission system, and the
prototype is careful about the difference. There is still no admin view, no
host controls, and no page that behaves differently because you made it. The
only thing the curator gets is _a setup that happens once, to them_, and
everything they add is then just something that exists on everybody's page.

**Verdict: it improved the night, and for a reason that was not the obvious
one.** The four taps do not make the night better by capturing preferences.
They make it better by **narrowing what Passport offers**, and a narrowed offer
is dramatically easier to act on than an open one. Coworkers-off-duty at "game
for some fun" with "a few things" produces eight toys instead of eleven, and
that is the difference between browsing and choosing.

The rule the setup was built against and should keep being judged against:
**if it ever stops visibly changing what Passport offers, delete it rather than
expand it.**

---

## The toy box

`core/toybox.ts` holds eleven **shapes**. Every fixture holds the **wording**.

That split — the same one that made the voice work in round 1 — turned out to
be the whole design. The engine knows what a secret mission _is_; only Hockey
Night knows that making Nathan say "analytics" is funny; Date Night writes no
dares at all, and therefore has none.

| family                 | what it is                          | new machinery it needed                                |
| ---------------------- | ----------------------------------- | ------------------------------------------------------ |
| prediction             | everyone calls it, everyone sees    | none                                                   |
| sealed pick            | hidden until it opens               | none                                                   |
| **secret mission**     | one person, privately               | `audience.only`                                        |
| **dare**               | opt in first, decline silently      | `requiresConsent`                                      |
| side quest             | optional, anyone                    | none                                                   |
| photo challenge        | submit, shows immediately           | `kind: "photo"`                                        |
| **sealed photo vault** | submit blind, open together, vote   | `optionsFrom`, `reveal: "onCue"`, `resolvedBy: "vote"` |
| **group quest**        | everybody scores or nobody          | `scoring.shared`                                       |
| **forfeit**            | pick a side, owe something          | `PromptOption.consequence`                             |
| **who said this?**     | one submission becomes one question | `optionsFrom: "authors"`                               |
| just ask               | no points, you were curious         | none                                                   |

**A toy is never a component.** It compiles to `Prompt`s and joins
`addedPrompts`, the same array round 1 already had for "ask the group something
stupid". Everything downstream — the deck, the cards, scoring, the voice, the
recap — has no idea a toy box exists. Adding a twelfth toy is a data change.

### Reroll beat blank box, and both lost to editing

The three actions on any idea are **take it**, **another one**, **write my
own**. Round 1's finding was that the best question is the one Passport did not
write, and that survived: the good ones are still the edited ones. But an idea
you can edit is a much better starting point than an empty field. The starter's
job is to be _replaced_.

---

## The primitive round 2 discovered

**A question can be built out of other people's answers.** `optionsFrom` has
two shapes and they behave completely differently:

- **`submissions` maps.** Everybody's answer becomes an option on one new
  question. This is the vault: submit blind, open together, vote.
- **`authors` multiplies.** Every answer becomes _its own_ question, carrying
  that answer as the briefing and its writer as the correct answer. This is
  "who said this?".

The second one was the surprise of the round. A curator adds one toy, and it
silently becomes one question per person, generated entirely by the group, with
no further authoring at all. It is the first mechanic in the lab where **the
group's content is the product**, and it is the cheapest content Passport has
ever had.

The privacy rule it comes with is absolute and structural: **Passport never
harvests this.** A person types the thing themselves, knowing exactly what it
is for. The future "this story would make a great question tonight, use it?"
behaviour is deliberately not built.

---

## Attention — the thing that surprised us most

`Phase.attention` is `open` | `quiet` | `burst`, and it is the round's most
important addition despite being one optional field.

During a `quiet` phase the entire page is replaced by the score, your position,
and the words **"Put your phone away."** Nothing to answer, nothing to scroll,
nothing that rewards looking. It is the only screen in the lab designed to be
closed, and it felt wrong to build and immediately right to use.

The rhythm now runs: **before → 1st period (quiet) → intermission (burst) → 2nd
period (quiet) → intermission (burst) → 3rd (quiet) → final horn → morning →
next one.**

**The existing Phase/Block system expressed this with no new architecture.**
That was the explicit thing to check and it passed — the only addition was the
one field, because "which blocks exist right now" was already phase-driven.

And the generalisation is the interesting part. Every fixture has downtime, but
it is a different physical thing each time:

- hockey — the intermission;
- powder day — **the chairlift** (seven minutes up, gloves off);
- light-up — the gaps between the choir, the switch and the fireworks;
- date night — there is no burst at all, only quiet.

---

## Consent, and why it is a scale rather than a flag

Two ceilings, and **the lower one always wins**:

- the **curator's**, set once for the night;
- **each participant's own**, set by them, changeable at any moment.

Nothing above your line is ever _aimed_ at you — missions, dares and forfeits
above it are not offered at all, so there is no public decline. Group questions
stay on the page and you simply need not answer. **Nobody is told what anybody
set.**

The consent record needed no new storage, which is the part worth keeping: the
engine will not let you answer a `requiresConsent` question until you have
opted in, so _having an answer at all is the consent_. A person who never opted
in has no answer and therefore owes nothing. That is structural rather than a
check somebody has to remember.

And the forfeit's consequence lives on the **option**, not the question — so
you cannot end up owing something you did not personally pick.

---

## Points are seasoning — confirmed, and sharply

The most anticipated block in the whole prototype is **the receipts** — who
owes what, in their own words, because a side they chose lost. It contains no
points at all.

Meanwhile the leaderboard is the block nobody looks at twice.

Keep scoring optional. Date Night has none and is the best-feeling fixture in
the lab.

---

## What each fixture did with the toys

**🏒 Hockey Night** got everything: a forfeit, a group quest, a vault, a
who-said-this, one secret mission aimed at Mike, and the picks moved into a
deck. Interaction count went **up** and page length went **down** (roughly
4,600px → 3,100px).

**🎿 Powder Day** — the lift is the intermission. "Run of the day" is now
scored by vote, which answers round 1's open question in the fixture that
raised it. **No forfeit bank**: a forfeit needs a losing side and a powder day
has no opposing team. The absence is data.

**🎄 Light-Up** — the switch at 6:00 is `quiet`, which is the most obviously
correct use of the whole mechanism. No dares, no vault, no forfeits, everything
at edge 0; scavenger prompts prove that **a scored question need not be a
prediction** — a seven-year-old cannot call a score but can find a brass band.

**🌙 Date Night** — the guardrail held, and it is now _demonstrable_ rather
than asserted. Open the toy box on a date and it offers exactly three things:
a small secret surprise, one photo, and a question. No predictions, no vault,
no forfeit, no leaderboard. **Nothing forbids any of that.** The fixture simply
wrote no starters for those families, and a family with no wording does not
exist. A structural absence beats a rule.

**🕒 Three Hours** — still the weakest, and deliberately not solved. It gained
a deck and two starter banks. The hand-off from "we chose one" to "that is now
the experience" is still not built. Open question 3 stands.

---

## Bugs found and fixed

1. **Seeded and local answers were never deduped.** Becoming somebody the
   fixture had already answered for produced two answers: their vote counted
   twice, their avatar duplicated its React key, and — worst — `standings()`
   scored the _seeded_ answer and silently ignored the one the human had just
   given. Answering and seeing nothing change is about the most corrosive bug
   this prototype could have had. Fixed in `mergeResponses`, with a test.
2. **"Who said this?" printed the answer above the question.** A generated
   question knows its own author from birth, so the card cheerfully said
   _Sarah — that's what happened_ before anybody guessed. `revealed` and
   `showResolution` are now separate.
3. **The feed leaked every secret mission on creation.** The toy box announced
   _"added a secret mission: get Nathan to say analytics"_ to everybody. It now
   says somebody was slipped something and does not name the target either —
   which is funnier.
4. **`settled` could never become true.** Round 1 defined it as _every scored
   question has an answer_, which broke the moment a question could be answered
   by people rather than by the world: a vault nobody voted in and a mission
   nobody completed held the trophy hostage for ever. Now: _nothing is still in
   play_ — pending on the world until its moment, pending on people only until
   it locks.
5. **A sealed thing nobody opened stayed sealed for ever.** `onCue` prompts now
   also open by themselves once their moment has passed. Somebody can open it
   early; nothing is lost by accident.
6. **Deck and section both reported progress.** Said the same thing twice.

---

## What became clutter

- **`GroupProgress` above a deck.** Removed.
- **The per-card "4 in, hidden".** Already removed in round 1; the deck made it
  redundant twice over.
- **The leaderboard during an intermission.** Still there, still ignored. It is
  the first thing to try cutting.
- **Eleven toy families in one sheet** is close to too many. The brief's
  filtering is what keeps it usable, which is a slightly uncomfortable
  dependency: the toy box is only pleasant _because_ something narrows it.

---

## Open questions after round 2

1. **How does discovery hand off to escalation?** Unchanged and still the
   biggest structural question. (Round 1, #3.)
2. **How does an experience with several small anchors inside it work?**
   Light-Up still strains the phase model. Attention helped; nesting did not
   get built. (Round 1, #2.)
3. **Where do experiences come from?** Round 2 made a _second edition_ nearly
   free — it is the same definition with a later anchor — which hints that
   creating an experience may mostly be deriving one from another. Nothing
   creates a _first_ one yet.
4. **Should a person be able to set the stakes on their own question?** Still
   unknown, and one real night would settle it.
5. **Is `burst` one thing or two?** An 18-minute intermission and a 7-minute
   lift are both "a gap", but one of them has gloves off in the cold. Duration
   may need to be part of it.
6. **Does the vault work when the photos are real?** Everything about it was
   validated with coloured tiles and captions.
