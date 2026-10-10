# Passport Product Doctrine

> **THIS DOCUMENT IS PRODUCT AUTHORITY.**
>
> Before changing Passport product behaviour, read this document.
>
> Do not infer Passport's purpose solely from the current UI, routes, data
> model, tests, or implementation. The current implementation represents
> experiments and historical decisions. It is **evidence**, but it is not
> automatically **product intent**.
>
> If implementation and this doctrine appear to conflict, **stop and name the
> conflict**. Do not silently treat the implementation as truth, and do not
> silently treat the doctrine as a licence to rewrite working code.

**Established:** 2026-10-10, from roughly three months of product conversation
that existed almost entirely in chat. That is why this file exists. Future
humans and agents should stop rediscovering the product from scratch, or
inferring it from whatever UI happens to be deployed that week.

**How to change it:** when a product decision becomes canonical, update this
document. When a decision _overturns_ a point here, update the point and record
the decision separately (`docs/architecture/decisions/`). An open question
answered honestly is an edit to §15. Do not let this file drift into being a
historical artifact like the four vision documents it supersedes — see §17.

---

## 1. What Passport is for

Passport is **not primarily**:

- a directory
- a search engine
- a list of attractions
- a bookmark manager
- a trip-planning spreadsheet
- an itinerary app
- an AI chatbot
- a prettier Atlas browser

Passport can _do_ several of those things. None of them is what it is **for**.
Treating any one of them as the mission optimises for the wrong thing, and each
is an easier product to build than the real one — which is exactly why the drift
happens.

**Passport exists to help a person discover a life, a day, or an experience
worth getting excited about — and then to help them actually live it.**

Shorthand:

> Passport helps you discover a day worth getting excited about — and then
> helps you actually live it.

That wording is not final marketing copy. **The product idea matters more than
the slogan.**

### The feeling

Passport should be capable of producing, in a real person:

> "**OH SHIT.** I never thought of that."
>
> "**DO IT. DO IT. DO IT.**"
>
> "I am going to have a hell of a day."

The _generic_ Passport experience — the sober, everyday one — should already
create the confidence that **something good is about to be found**. The future
Inspiration experience (§13) should be far more emotionally powerful than that.

### The measure of success

Not "user clicked a recommendation." Not session length. Not conversion.

The measure is the moment at the end of a real day — tired, a bit dirty, sitting
by a fire — when someone says:

> _"Holy shit. That was one hell of a day."_

Every other metric is at best a shadow of that one. **Where a shadow metric and
the real one disagree, the real one wins.**

This is not new. It is the measure recorded in `archive/13-philosophy.md`,
written before Atlas existed in its current form, and restated in
`../../project-management/brand-principles.md`. Three months of thinking have
not moved it. Treat it as settled.

---

## 2. The canonical human loop

```
DISCOVER → REACT → COLLECT → SHAPE → COMMIT → LIVE → ADAPT → REMEMBER → LEARN
                                                                          ↓
                                                        (back into DISCOVER)
```

It is a **loop, not a funnel**. It has no end state. Each stage below says what
it means and what must not be collapsed into something adjacent.

Most of the product's real value is in the second half. Anyone can build
DISCOVER. Almost nobody builds LIVE and ADAPT.

---

### 2.1 DISCOVER

The person encounters **possibilities**.

This is not merely database search. See §12 — "search results" is probably the
wrong mental model entirely.

**A first-time user may provide almost nothing.** Passport can reasonably know
or derive, without asking:

- location
- current date and time
- time of day
- weather and environmental conditions

**Do not put a questionnaire between the human and possibility.** No long
onboarding before discovery starts. The person should encounter possibility
quickly, from whatever context already exists.

Over time, Passport should ideally know much more:

- that the person likes adventure
- that they previously chose things while with a five-year-old niece
- what they loved, and what they rejected
- what they saved
- previous plans
- **what they actually did**
- typical driving tolerance
- interests
- equipment and possessions, where legitimately available
- recurring companions and group context
- constraints and tendencies learned over time

The long-term aspiration is deliberately ambitious: **know as much useful,
legitimate context as possible, in order to make this person's day better.**

> The ambition was expressed in conversation as wanting Passport to know your
> body temperature if that legitimately helped.

That is a statement of **ambition**, not a work item. It is recorded so nobody
mistakes the ceiling of this product for swipe gestures and a filter bar. It is
**not** an instruction to implement body-temperature tracking, now or soon.

#### Cross-ELK context

Passport may eventually benefit from other ELK products. If something like
"ELK Wrench" knows the person owns a dirt bike, a RAM 1500, an airplane, skis,
or camping equipment, that context helps Passport understand which possibilities
are **realistically available** to them.

This is long-term ecosystem thinking. **Do not tightly couple Passport to
hypothetical products now.** Preserve the idea; build nothing for it yet.

---

### 2.2 REACT

**Reactions are extremely important.** A person's interaction with possibilities
is how Passport learns.

These signals are materially different from one another:

| Reaction                                 | What it means                                  |
| ---------------------------------------- | ---------------------------------------------- |
| **FUCK YES / I want this**               | Strong desire                                  |
| Not for me                               | Taste signal — negative                        |
| Not today                                | Feasibility signal — says nothing about desire |
| Interesting, show me more                | Curiosity, not commitment                      |
| More like this                           | A direction                                    |
| Save this for later                      | Deferred intent                                |
| I already did this                       | History                                        |
| Absolutely someday, but impossible today | **Desire and feasibility disagreeing**         |

**Do not collapse desire and present feasibility into one boolean "saved"
state.** The canonical example: heli-skiing may be an absolute _fuck yes_ and
simultaneously impossible inside today's four free hours. Both facts are true,
both are useful, and a single `saved` flag destroys one of them.

**Passport cannot read minds.** The human must provide signals, through explicit
reaction or observable interaction. Over time, behaviour can improve
recommendations — see §5 on not turning observation into fact.

---

### 2.3 Visual emotion, and real-world truth

**Photos and video matter enormously.** This was named explicitly as one of the
strongest triggers of desire.

> A gorgeous waterfall or a natural hot spring may create enough desire that
> somebody is willing to _"climb mountains to get there."_

Discovery must not be treated as text-only information retrieval. **Emotional
media is a first-class part of the product, not decoration.**

And at the same time, real-world information decides whether a beautiful thing
is a _good recommendation right now_:

- cost
- weather
- open or closed
- seasonality
- accessibility
- crowds
- distance
- duration
- reservations
- age appropriateness
- who the person is with
- safety
- practical requirements

**A beautiful thing that is closed, impossible, inaccessible or inappropriate is
not a good recommendation for the current plan.** Both halves are required.
Beauty without feasibility is a tease; feasibility without beauty is a
directory.

---

### 2.4 COLLECT — let people want too much

People should be allowed to **collect possibilities before reality eliminates
them.**

Passport supports two broad discovery attitudes, and must not be permanently
forced into either:

- **CONSTRAINED** — _"I have four hours. Show me what can actually fit."_
- **BLUE SKY** — _"Show me awesome shit. I'll worry about reality later."_

Someone might collect possibilities for a year and only later say _"I have 30
minutes."_ **That is allowed.**

**Desire is useful information even when the thing cannot be done today.** A
heli-skiing experience excluded from this afternoon's plan is still something
this person wants. It belongs to them, not to the plan that rejected it.

---

### 2.5 SHAPE — turn possibility into a real day

Once enough possibilities exist, Passport helps shape reality against
constraints: available time, must-be-home time, distance and driving, geography,
weather, opening hours, reservations, cost, companions, children, accessibility,
hunger and meal timing, energy, equipment, transportation, practical sequencing,
seasonal availability — and anything else that actually bears on the day.

Passport should intelligently recommend a schedule. The shape of it:

> "You have four hours.
>
> Heli-skiing is out.
>
> The museum pulls you too far in the wrong direction.
>
> Do coffee → waterfall → brewery.
>
> Leave at 8:40.
>
> You'll be home around 12:50."

**The human remains in control.** They can drag, remove, add, reorder,
constrain, reprioritise, speak in natural language, and eventually use voice:

> "Okay, I love it, but my friend is allergic to shellfish and we have to be
> home by 9 PM. Just adjust those two things."

Passport should update the plan intelligently from that. Note what the sentence
contains: a hard constraint, a soft one, and an explicit instruction to **leave
everything else alone**. Honour all three.

---

### 2.6 COMMIT — a bookmark becomes an intention

One of the largest product ideas in Passport:

> **SAVE IS NOT THE END.**

The loop is **not** `search → bookmark → forget forever`.

The current board/saved system is closer to bookmarks than it should be. Once a
person decides _"Yes. I intend to do this,"_ that must become a meaningful
**commitment / plan** state — different in kind from having saved it.

> Passport should help people **find things → want things → actually do the
> freaking things.**

**A saved list that becomes a graveyard of forgotten links is product failure.**
Not a missing feature — a failure of the thing Passport is for.

---

### 2.7 LIVE — START is a mode change

Among the biggest ideas in the product:

> **When the person presses START, Passport does not end.**

START is a **mode change**. The person is now _living_ the experience, and
Passport should remain useful while **reducing** unnecessary phone use (§7).

Live context may include: what is next, timing, directions, parking, entrances,
ticket information, current weather, delays, closures, useful hints, practical
reminders, current reviews and local knowledge, things newly discovered nearby,
the person's own notes, photos and video captured by the group, feedback,
estimated arrival, estimated duration, and whether the rest of the plan still
works.

**Passport helps a person live the day. It is not itinerary software.**

---

### 2.8 ADAPT — real life changes

**Plans are not sacred.** Humans change their minds, and reality does not
consult the schedule.

Real examples of what Passport must absorb:

- _"Lunch plans changed. We're going to be late. Are we still good for the museum at 3?"_
- _"We ran into my buddy who owns this restaurant and he's giving us free drinks."_
- _"We found a magical place you didn't tell us about."_
- _"We're hungrier than expected."_
- _"We spent two hours here instead of one."_

Passport should recompute and adjust intelligently.

> **The plan serves the human. The human does not serve the itinerary.**

**Adaptive replanning may ultimately be more valuable than initial itinerary
creation.** Most products can produce a plan. Almost none can survive contact
with the actual day.

---

### 2.9 REMEMBER

Passport should understand **what actually happened** — not merely "user clicked
waterfall."

Useful outcome context: wanted it, planned it, actually did it, skipped it,
abandoned it, loved it, hated it, would do again, too crowded, unexpectedly
great, the duration was wrong, who they were with, practical corrections,
photos, videos, notes, new discoveries, things saved for another time.

The distinction between **WANTED / PLANNED / DID / LOVED** is important. **Do
not flatten those into one interaction state.** (Naming them is an open
question — §15.)

---

### 2.10 LEARN — feedback

At the end of an experience Passport should ask for useful feedback, and the ask
is allowed to have personality. The spirit, as actually expressed:

> _"Give me feedback, asshole, so I can make this better for you next time — and
> for other Passport users. Don't be a dick. Share."_

That is not production copy. It is the **register**: feedback should feel like
**participating in making the world and the product better**, not like filling
out a corporate survey.

Good feedback can improve the person's own future Passport, real knowledge about
duration / quality / conditions, recommendations for other people where
appropriate, and Atlas's knowledge where provenance and privacy rules permit.

This closes the loop first written down in August:

> Atlas learns → Passport inspires → a traveler experiences something real →
> memories are created → Passport remembers → Atlas becomes wiser.

**Nothing in the current architecture builds that return path yet.** It is named
so that it is not accidentally designed out of existence by a series of
individually reasonable decisions.

---

## 3. AI is not a tab

**This principle is extremely important.**

Passport is an **AI-heavy product**. If someone fundamentally does not want AI
involved, Passport may simply not be the right product for them. That is an
acceptable answer.

But:

- AI should **not** feel bolted on.
- AI should **not** primarily be a chatbot tab.
- The person should **not** have to think _"now I am using the AI feature."_

**The intelligence is embedded in the experience.** Use deterministic systems
where deterministic systems are right. Use generative reasoning where it
materially improves the experience. Combine both freely.

> **AI should feel so natural and useful that the person does not care that AI
> is involved.**

Where it earns its place: understanding fuzzy intent; interpreting behaviour;
ranking possibilities; composing a realistic day; adapting a plan; explaining
why something fits; understanding a spoken change request; learning preferences;
identifying good detours; contextual recommendations.

**Do not create AI theatre merely to demonstrate that AI exists.**

### Human-first, AI-heavy

Natural language and voice are expected future capabilities:

- _"Love the plan, but my friend is allergic to shellfish."_
- _"We need to be home by 9."_
- _"Skip the museum."_
- _"Find more like that waterfall."_
- _"Lunch ran late. Are we still good for the museum?"_

Traditional controls coexist: drag, tap, swipe, save, dismiss, reorder, filter.
**Do not force every action through a chat conversation.** The best interface
mixes deterministic controls and AI interpretation seamlessly.

---

## 4. Progressive guidance — the Passport helper

Generic Passport should neither force onboarding **nor** leave a new person
alone in a wall of 2,000 entities.

There should eventually be lightweight, progressive intelligence woven into the
interface. **Do not assume this must be a floating chatbot.** Passport itself
can offer the nudge:

> "Want me to make these better for you?"
>
> "I only know your location, the time and the conditions right now. Give me a
> little more to work with."

With lightweight context offered, not demanded:

- I've got four hours
- With my niece
- Feeling adventurous
- Keep driving under an hour

And later, as evidence accumulates:

> "You seem to be leaning outdoors. Want more like this?"
>
> "You've saved six things. Want me to turn them into an afternoon?"

**Mood boards / lightweight preference surfaces** are preserved as a possible
way for a person to hand Passport useful information without answering
questions. Exact implementation is unresolved (§15).

### Constraints are progressive

Do not force _"How much time do you have?"_ before showing anything. Begin with
useful possibilities from whatever context exists, and let the human
progressively add reality.

**But also let someone state constraints immediately when they want to:**

- _"I have one day in Tibet. Fill it."_
- _"I have 30 minutes."_
- _"I have four hours and my niece."_

**Both directions must work.** Unless constraints were provided, the human
decides when they have collected enough.

---

## 5. Signals, inference, and truth are different

Preserve this architectural principle. It is what keeps an AI-heavy product from
becoming probabilistic soup.

```
SIGNALS ARE EVIDENCE.
INFERENCE IS INFERENCE.
CONFIRMED STATE IS STATE.
```

Worked example:

- **Observed:** the person lingered on three waterfall possibilities.
- **Possible inference:** they may be interested in waterfalls.
- **Not permitted without stronger evidence:** "Lorne loves waterfalls."

AI interpretations are probabilistic. Confirmed actions and explicit statements
are a different kind of thing, and the system must keep them distinguishable all
the way down. **The underlying system must not become probabilistic soup simply
because the interface is AI-heavy.**

This is the same discipline Atlas already applies to evidence and provenance.
Passport does not get an exemption because its inputs are softer.

### Product-interaction signals

Passport should eventually understand whether a person appears engaged, bored,
lost, confused, interested, repeatedly backtracking, abandoning results,
repeatedly changing filters, lingering, opening details, saving, dismissing, or
accepting suggestions.

Collecting these can genuinely improve the product. It needs sensible privacy
and consent boundaries (§15). **This doctrine does not authorise building
telemetry** — it records the intent so the idea survives.

---

## 6. Less phone, more life

**This principle should stay prominent.**

> **Passport succeeds when people engage more deeply with their lives — not when
> they spend more time in Passport.**

Passport **loves human interaction.** It should encourage friends, family,
conversation, shared adventure, and real-world activity.

The goal is not app engagement for its own sake. **The intelligence should know
when _not_ to interrupt.** The best Passport interaction may be a single
perfectly timed suggestion after ninety minutes of silence.

Passport should ideally create stories, memories, adventures, laughs, human
interaction, spontaneous discoveries, shared challenges, and conversation.
Technology serves that outcome.

**This should inform future metrics. "Time in app" alone may be actively
misleading as a success measure.**

### Live social and playful interaction

Dream bigger than itinerary reminders. Passport can make the actual experience
more fun while people are already together:

- Skiing: _"Last run challenge. Who gets down fastest?"_
- Hockey: _"Who scores the first goal?"_
- Group: bets, challenges, predictions, friendly competition, contextual
  prompts, shared reactions.

**It must enhance the real human experience, never pull people out of it.**

---

## 7. Time, location and environment are core

These are **top priorities** for generic Passport, not decorative filters.

A list that mixes Kelowna, Vernon, Peachland and Vancouver without contextual
relevance is not useful Discovery. It is a database with a nice font.

Passport should reason about: where I am; how far things are; time of day; day
of week; current date; available time; opening windows; seasonality; weather;
and changing conditions.

**These materially change what is possible.** They are not chips in a filter
bar; they are the difference between a possibility and a fiction.

---

## 8. "Search" is probably the wrong mental model

Generic Passport should think in terms of **POSSIBILITIES**, not _search
results_.

Human intent sounds like:

- something fun with the kids this afternoon
- gorgeous waterfall
- easy hike near me
- date night
- somewhere for lunch
- something weird
- worth the drive
- I've got four hours
- feeling adventurous

Current taxonomy — Places, Food & business, Things to do, Events, Experiences —
may reflect **Atlas's data structure more than human intent**.

**This doctrine does not delete that taxonomy.** It records the product concern:

> **Discovery should be organised around humans, not around the ontology.**

---

## 9. The board / saved loop

The board is potentially central, and is currently treated too much like
bookmarks.

The real loop should become:

```
DISCOVER → WANT → ORGANIZE → DO → REMEMBER
```

**Saving must lead somewhere.** A person's collection is raw material for a real
day, weekend, or season — not persistence for its own sake. See §2.6.

---

## 10. Experiences — an explicit open architectural question

Passport powers specialised Experiences: **I Am October**, **Christmas**,
**Skiing**, **Hockey**.

**The central unresolved question:**

> Are Experiences primarily
> **(a)** Passport + theme + a filtered/tagged corpus,
> or
> **(b)** distinct product compositions built on shared Passport capabilities?

**This has not been decided.** Do not encode the current October implementation
as the answer.

**What October is evidence of:** that Passport capabilities + seasonal knowledge

- strong theming + temporal composition can produce a genuinely good product.

**What October is not:** the Experience Contract.

### Skiing is the deliberate stress case

A good Skiing experience may have a completely different **primary loop** from
October:

```
Where should I ski today? → conditions → drive → mountain → lifts/runs
   → live day → adapt
```

rather than October's:

```
Here is October → also tonight → while it lasts
```

Christmas and Hockey may compose Passport's capabilities differently again.
Resolving this is real product and architecture work, not a naming exercise.

### Shared capability is not shared UI

Experiences may share: identity/auth, Atlas knowledge, Discovery, Places,
Events, Activities, media, saved/wanted state, planning, history, boards,
reactions, personalisation, recommendations, live/adaptive execution.

They do **not** necessarily share page composition.

> **Do not confuse shared capability with shared UI.**

### Generic Passport is a product, not infrastructure

**Generic Passport must be a coherent, useful product in its own right.** It
must not exist merely as plumbing for October.

Equally, Experiences should **not** be treated as another tab beside List / Map
/ AI / Inspiration unless product reasoning later proves that is correct.
**October is probably not simply another "view mode."**

---

## 11. Current near-term direction

Current generic Passport work focuses on making Discovery:

- visually strong
- time aware
- location aware
- environment and weather aware
- organised around activity and human intent
- better organised than a giant entity list
- better at presenting possibilities
- better at cards and hierarchy
- increasingly aware of user context
- progressively constrainable
- capable of collecting reactions
- connected to a meaningful **Want → Do** loop

This section is the near-term direction. It is **not** a backlog, and listing a
direction here is not pre-approval to build it.

---

## 12. Generic Discovery — "boring" does not mean bad

Generic Discovery is the relatively sober side of Passport. **Boring does not
mean bad.**

It should be: visually excellent, clear, immediate, intelligent, time aware,
location aware, weather aware, context aware, organised around human intent,
full of strong possibilities, easy to constrain, easy to react to — and
**obviously more useful than a directory**.

The feeling it should create:

> _"I am going to find a hell of a day here."_

Generic Discovery serves someone who has at least some idea of what they want,
or who is willing to browse possibilities.

---

## 13. Inspiration — preserved, fenced off

Inspiration is closer to **why this project was created at all**.

It should eventually produce:

> **"HOLY SHIT."**

Adrenaline. Emotion. Cinematic excitement. Surprise. Desire. Experiences people
did not even know they wanted.

Future thinking that belongs here: high-energy skiing media personalised to the
person; beautiful immersive video; the old experimental Discovery concepts;
highly emotional presentation. The emotional response was compared to a **movie**
rather than to an app.

> ### DO NOT DESIGN OR IMPLEMENT INSPIRATION YET.
>
> Inspiration is intentionally unresolved. It is a known rabbit hole. The vision
> is preserved here precisely so that a fence can be put around the
> implementation.

The distinction between **generic Discovery (§12)** and **Inspiration (§13)**
must be preserved. They are different products of different emotional register
sharing one knowledge base.

---

## 14. Future vision — explicitly NOT current scope

Everything in this section matters and **none of it is today's backlog.** It is
recorded so a future agent does not conclude that Passport's ambition stops at
swipe gestures — and equally, so nobody reads it as approval to start.

### Multi-person and sensor vision

The long-term idea is far more ambitious than phones and clicks.

> Four people in one room. Maybe one camera sees the room, or maybe everyone's
> phone participates.

With appropriate consent and privacy, future context could include sound and
noise, movement, facial expressions, group energy, reactions, who is present,
and the physical environment — in order to understand whether the group is
excited, bored, interested, laughing, disengaged, or reacting strongly, and to
make the experience better.

### The complete not-now list

- immersive Inspiration
- multi-camera sensing
- facial-expression interpretation
- group-environment sensing
- body and environment sensors (including the body-temperature ambition, §2.1)
- elaborate social games
- full cross-ELK context
- an autonomous day companion at maximal depth
- speculative future interfaces

**These ideas matter. They must not hijack current implementation.**

---

## 15. Open questions — honestly unresolved

These are **not** answered. A clearly stated open question is better than fake
certainty. Do not invent an answer here to make the document feel finished.

1. **Experience architecture.** Theme + filtered corpus, or distinct product
   compositions on shared capabilities? (§10)
2. **Inspiration interaction model.** Entirely unresolved. (§13)
3. **Reaction states — exact set and names.** How many, and what distinguishes
   them? (§2.2)
4. **Planning UI.** What SHAPE actually looks like. (§2.5)
5. **When to proactively ask for constraints.** How Passport judges the moment.
   (§4)
6. **How the Passport helper manifests.** Inline? Ambient? Something else? Not
   assumed to be a chatbot. (§4)
7. **What telemetry and behavioural signals are appropriate.** (§5)
8. **Privacy and consent boundaries for richer context.** Especially anything
   in §14.
9. **How cross-ELK knowledge is shared.** (§2.1)
10. **How live mode should interrupt — or stay silent.** (§2.7, §6)
11. **How feedback influences personal versus shared knowledge**, and what may
    flow back to Atlas. (§2.10)
12. **How group / multi-person experiences work.** (§6, §14)
13. **Exact AI / deterministic responsibility boundaries.** (§3)
14. **Product vocabulary for Want / Plan / Lived states.** (§2.9)
15. **"THIS ENTITY SUCKS" — a human correction loop back into Atlas.**
    Passport sees knowledge defects that Atlas cannot see from the inside: a
    description that only restates its own title, two records for one farm, a
    Vancouver suspension bridge with no location at all. The person looking at
    the card is the one who knows. The idea is a way for Lorne, an admin, and
    possibly a customer to flag an entity, say **why** it sucks, and have the
    entity, its context and the stated reason preserved as evidence feeding a
    bounded Atlas repair workflow — not a vote, not a rating, a reason.

    Unresolved: who may flag; whether a customer's flag and an admin's are the
    same object; how a reason becomes an Atlas mission without becoming a
    500-item complaint queue; and **what it is called**. The working name is
    deliberately recorded as _"this entity sucks"_ rather than softened to
    _"Something wrong?"_ — the register is part of the product decision and
    conventional UX politeness is not automatically the right answer here.
    **Not scoped. Not approved. Recorded so it is not lost.**

---

## 16. Product language and personality

**Do not rewrite this doctrine into sterile corporate language.**

Passport is ambitious. It should be fun. It should sometimes be irreverent.

Phrases from the actual product thinking, kept so the register survives:

- "hell of a day"
- "OH SHIT"
- "DO IT DO IT DO IT"
- "slick AF"
- "fuck yes, but not today"
- "give me feedback asshole"
- "don't be a dick, share"

**These are not production strings.** They communicate the intended emotional
register: **excitement, energy, humour, confidence, humanity.**

They are preserved here so that a future author — human or agent — does not
quietly turn Passport into beige travel software by writing every sentence in
the voice of a hotel booking confirmation.

---

## 17. History is evidence, not authority

Related documents exist. They are **historical artifacts**: what we previously
built and previously thought. **They are not product authority.** Where they
conflict with this document, this document wins, and the conflict should be
named rather than quietly resolved.

**Inside this repository (version controlled):**

| Path                                           | What it is                                                                                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/product/discover.md`                     | Current Discover **implementation** rules, measured against the live corpus. Operational truth about what the code does — not product intent.                             |
| `docs/product/october-experience-bible.md`     | October's product detail. Evidence of one Experience, **not** the Experience Contract (§10).                                                                              |
| `docs/passport/the-physics-of-passport.md`     | Motion and interaction doctrine for Experiences. Complementary, narrower: it governs _how things move_, not what Passport is for.                                         |
| `docs/architecture/`                           | Architecture, including `decisions/`.                                                                                                                                     |
| `docs/old-might-be-garbage/passport-vision.md` | Vision from 2026-07-25. Its core claim survives here: Passport is not a tourism website, an itinerary builder, or a recommendation engine. Folder name is a fair warning. |
| `archive/01-mission.md` … `archive/14-…`       | The original "Product Brain." `13-philosophy.md` is where _"one hell of a day"_ was first written down.                                                                   |

**Outside this repository (workspace root, NOT version controlled):**

| Path                                              | What it is                                                                                                                                                                  |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `../../docs/future/future-passport-experience.md` | The fullest prior vision (2026-08-11): the Atlas→Passport→memory→Atlas loop, serendipity, anticipation, traveler language. Compatible with this doctrine and worth reading. |
| `../../project-management/brand-principles.md`    | ELK-wide brand. _"Help people feel more alive." "Atlas understands. Passport inspires."_                                                                                    |

> **Warning about the workspace root.** `elk-passport/` is not a git repository.
> Anything at `../docs/`, `../project-management/` or `../CLAUDE.md` is
> **untracked, unbacked-up and invisible to anyone who clones this repo.** That
> is one of the reasons this doctrine lives at `app/docs/`, inside the Passport
> repository, where it can actually be committed, reviewed and pushed.

### Atlas and Passport

Atlas reasons about the world. Passport reasons about the person in front of it.
**Atlas understands; Passport inspires.** Passport consumes Atlas across a
defined boundary (see the workspace `CLAUDE.md`) and adapts what comes back into
its own product experience. Atlas's growth is only valuable here when it
eventually becomes real traveller value, rather than sitting in a schema.

---

## 18. How to use this document

**Read it before changing Passport product behaviour.** Specifically before
working on: Discovery, Inspiration, planning and itineraries, saved / wanted /
lived state, Experiences (October, Christmas, Skiing, Hockey), or AI UX.

**It is not a backlog.** Nothing here is an instruction to build anything.
Naming a direction is not approval to implement it, and it must not be read as
pre-approval later either.

**What it is for:** the next time a decision needs to be made about how Passport
should feel, what something should be called, whether a capability belongs in
Atlas or in Passport, whether an Experience is a theme or a composition, or
whether the thing being built is optimising for the real measure or a shadow of
it — **this is where to check first**, and where to honestly add to when the
thinking moves forward.

**When implementation and doctrine disagree, say so out loud.** The implementation
may be right and this document stale; the implementation may be an experiment
that was never product intent. Both happen. Neither is resolved by one side
quietly winning.
