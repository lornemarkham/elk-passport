# OCTOBER EXPERIENCE — PRODUCT & CREATIVE BIBLE

**Established:** 2026-09-22, from one long evening of design conversation.
**Status:** preserved direction. Nothing here is implemented, approved, or
roadmapped. It is written so that tomorrow starts where tonight stopped.

This document holds two things on purpose and refuses to separate them: the
Passport _Experience_ architecture that is starting to emerge, and the weird,
specific creative ideas that make October _October_. Sanitising the second into
the first would lose the product.

Every section is tagged with one of five kinds, so the reader always knows what
they are looking at:

- **PRINCIPLE** — something we currently believe should guide the product.
- **CANDIDATE** — a creative idea we want kept, and have not committed to.
- **MECHANIC** — a potential reusable Passport Experience primitive.
- **OCTOBER** — Halloween/horror creative material, specific to this experience.
- **OPEN** — a question that needs an experiment, not a premature answer.

---

## 0. What already exists (inspected 2026-09-22, nothing merged or ported)

Read before designing, so tonight's direction builds on real work rather than
reinventing it.

### `/about/experiment-03-october-passport` — on `main`

The ELK Labs sandbox from an earlier October pass. Real code, real route,
`noindex`. What it holds that tonight's direction wants to keep:

- **The Fear Dial already exists as a ceremony**, not a settings screen:
  `FearDial.tsx` asks "How brave are you tonight?" once, after a cinematic
  intro, four equally-weighted tiles — 🙂 Cozy Autumn · 🎃 Spooky · 👻 Creepy ·
  💀 Nightmare — with Nightmare genuinely opt-in and defined as "the ceiling
  raised, not the floor lowered." Changeable later from an in-page selector.
- **Intensity-scaled surprise pools** (`content.ts`): `COZY_SURPRISES` →
  `SPOOKY_SURPRISES` → `CREEPY_SURPRISES` → `NIGHTMARE_SURPRISES`, each tier
  _adding to_ the tiers below rather than replacing them. Nightmare's own doc
  comment is worth quoting: _"Anticipation stronger than payoff, always: most
  of these resolve into nothing, on purpose."_ Lines worth keeping:
  - _"Footsteps. Upstairs. There is no upstairs."_
  - _"Something is breathing. It isn't you."_
  - _"'Don't look behind you.' ...Nothing happens."_
  - _"A heartbeat. Not yours. Keeping pace with the page."_
- **Restraint is already the ambient rule**: `AmbientLayer.tsx` fires
  surprises at 18–45 s intervals with a 12 % trigger chance — _"Silence is the
  default state, not a gap between effects."_ Specific lines are wired to
  real effects by reference (fog hides the interface; the soundtrack ducks; a
  crow crosses; a full-screen heartbeat).
- **"The page notices you"** (`PAGE_NOTICES_LINES`): idle → _"...still
  there?"_; lingering hover → _"Thinking about it?"_; dialling up → _"You're
  getting brave."_; dialling down → _"Daylight mode is always available."_ Each
  fires once per session, tied to a real signal — _"repetition is what turns
  tension into a joke."_ This is the seed of the disobedient-UI idea.
- **A real moon phase** (`moonPhaseIndex`, synodic month from the 2000-01-06
  reference new moon) — rendered as an emoji. Phase only; no position, no
  horizon, no clouds.
- **Sourced local legends with provenance labels**: `LocalLegend.kind` is
  `"Documented" | "Local Legend" | "Concept / Example"`, every real entry has
  a `source` and `sourceUrl`, and the file's own rule is _"Passport never says
  'this is haunted' — every line here says what's actually true: that people
  tell stories, that guests report things, that nobody agrees."_ Fairview,
  Mineola, the Towne Cinema in Vernon, Three Valley Gap, the Sylvia Hotel.
  Placeholders are labelled as placeholders.
- **Two camera features, honest about the mechanism**: `GhostPortrait`
  (canvas filters, nothing leaves the browser) and `ScareCam` (3-2-1
  countdown, a faint procedural shape composited into the _scene_ photo,
  "was that actually there?", share label _"Passport caught me."_). A
  `GROUP_SCARE_CAM_CONCEPT` is written down and explicitly not built.
- **A synthesized soundscape** (`useSoundscape.ts`): one noise engine reshaped
  per layer — wind, rain, fire, breathing, silence — with `duck()` and
  `fadeOut()` so sound has an arc. No recorded samples exist in the project.
- **Small authored scenes**: Three Valley Gap (lightning, rain, a window light
  that turns off, then _"Would you stay here... alone... until sunrise?"_ with
  three real answers), Flashlight Mode as a nine-item find-game with
  discovery-first fragments, History-or-Folklore as a guessing game, Find the
  Raven, a Group Mode headcount (_"How many of you are here?"_), and an ending
  (_"Some stories are better experienced than explained."_ 😈 _"See you next
  October..."_).

What it is that tonight's direction is **not**: it is one long scripted page,
gated by persona × weather × intensity _filters_, with invented discovery
cards. Its structure is a "Director's Cut arc" baked into a single component
(`OctoberPassportExperiment.tsx`, ~1,150 lines). Its tension mechanics are
real but front-loaded — the Fear Dial is asked before anything has been
earned — and there is no persistence, no history, no learning, no world
context beyond a hand-picked weather toggle and a city selector.

### `/labs/experience` — on local branch `feature/passport-experience-lab` (read-only)

Not on `main`; 25 commits behind it; never merged. Five fixtures (Sycle Hockey
Night, Powder Day, Christmas Light-Up, Date Night, We Have Three Hours) and a
README that is the best existing thinking about what a Passport Experience
_is_. Findings worth carrying into October verbatim:

- _"An Experience is a shared space that changes shape over time, in which a
  group answers questions, and which becomes a memory without anyone doing
  anything."_
- **Phases are declared by the experience, not enumerated by the engine.** A
  fixed lifecycle enum did not survive the second fixture. `Phase.headline` is
  _"Passport's one-line answer to 'what is this page for right now?'"_ and the
  single strongest reason the page reads as alive.
- **`Prompt`** is the confident primitive (a question to the group and what
  came back; four switches — scoring, reveal, private, open-to-suggestions —
  are the entire difference between Hockey Night and Date Night).
- **`Moment`**: the feed during the night and the memory afterwards are _one
  list read at two times_. "Remember" cost almost nothing.
- **Voice is split into `observe()` and `phrase()`**: the observation is
  derived from the shape of the group's answers and is domain-blind; only the
  wording comes from a tone table. _"It is also the seam a language model would
  eventually sit in — replacing `phrase()`, never `observe()`."_
- **`Phase.attention`** (`open` | `quiet` | `burst`): the "Put your phone
  away" screen — _"the only screen in the lab designed to be closed, and it
  felt wrong to build and immediately right to use."_
- **Consent is a scale, not a flag**, and the lower ceiling always wins.
  _Having an answer at all is the consent._
- **Points are seasoning.** The receipts block (who owes what, in their own
  words) is the most anticipated thing on the page and contains no points.
  Date Night has no scoring and is the best-feeling fixture.
- **Privacy is structural**: `reveal: "never"` filters out before observing,
  so Passport is _incapable_ of narrating a private answer. And: _"Passport
  never harvests this."_
- **Lineage / "run it back"**: a second edition is the same definition with a
  later anchor — _"creating an experience may mostly be deriving one from
  another."_
- Its own open questions, still open: how discovery hands off to escalation;
  where a _first_ experience comes from; experiences with several small
  anchors inside one evening.

### Other `/about` experiments on `main`

`experiment-05-christmas` (seasonal, ported from a standalone HTML
prototype), `experiment-04-wonder` (a sketchbook of small interactions),
`experiment-06-analog-adventures` (_"the best Passport session ends with the
phone being put away"_), `experiment-07-fishing-with-emi`. They matter here as
proof that seasonal experiences recur and that "close the app" is already a
Passport value, not a contradiction of one.

### Related durable docs on `main`

`docs/passport/the-physics-of-passport.md` (experiences as living objects
sharing a world; restraint; think like Apple/Pixar/Nintendo at once),
`docs/architecture/user-state.md` (`currentUser()` is the one identity seam;
durable state is owned by the Supabase user id), `src/lib/passport/composition.ts`
(sections in an order, holding decisions and no facts).

---

## 1. The core idea — PRINCIPLE

**October is a DIRECTOR.**

It is not a Halloween-themed recommendation page, not a questionnaire followed
by generated picks, not one giant scripted scroll, not an LLM inventing
experiences, and not points and badges.

It assembles high-quality _authored_ scenes using real context:

location · date and time · sunset, darkness, sunrise · weather · moon state ·
the Fear Dial · a gradually learned Fear Profile · the person's history · what
they have saved, completed, watched, made · their group and friends · previous
scenes · real events, places and activities from Atlas · Halloween approaching.

**The user learns October by experiencing it.** Do not front-load questions
Passport can already answer.

The loop:

```
scene → discovery → tiny choice or action → reaction → learning → better next scene
```

**The user's actual October becomes the story.** There is no overarching
fictional plot. October itself may have personality — and increasingly
confident behaviour — but the narrative is made from what the person really did.

---

## 2. The pressure-cooker principle — PRINCIPLE

**October earns its scares.**

It does not open by announcing _"THIS IS SCARY. YOU SHOULD BE SCARED."_ Early
October and early sessions may barely be spooky at all. The experience first
establishes normal behaviour, trust, familiar controls, a visual grammar,
recurring places and mechanics, expectations. Then, gradually, it violates them.

Fear accumulates like pressure:

- A normal control behaving strangely after obeying you for two weeks is
  scarier than a glitch on the first visit.
- A doorway that appears after several sessions is scarier than starting with
  a haunted doorway.
- A sound after thirty seconds of quiet is scarier than constant scary audio.
- A local place becomes unsettling _after_ you learn its story.

**October 3 should not feel like October 30.** October gets darker, stranger
and more confident as Halloween approaches, as the person opts into higher
Fear Dial levels, as Passport learns what scares them, as they show they are
willing to continue, and as specific contextual moments qualify.

Restraint is part of the horror design. Never exhaust the user with tricks.

The existing experiment already knows this in miniature (18–45 s intervals,
12 % chance, one-shot notices). The new thing is applying it across _days and
sessions_, not seconds.

---

## 3. The three-layer model — PRINCIPLE / MECHANIC

```
DIRECTOR   chooses what should happen now, from context and history
   ↓
SCENES     authored cinematic, useful experiences — modular, swappable,
           individually killable; a failed scene is removed without breaking October
   ↓
THINGS     the useful real-world ingredients — movies, events, places, recipes,
           activities, stories, challenges, memories
```

**Scenes make Things feel magical.** Every scene must pass two tests:

1. Is it delightful or memorable enough that someone would want to show it to
   another person?
2. Does it help them discover, decide, do, remember or share something?

Beautiful but useless → fix or remove. Useful but feels like ordinary filters
or search → fix or remove.

This maps onto the Experience Lab's finding that a fixture's content is data
and the engine knows no domain: a scene is authored wording and staging; the
Director is domain-blind eligibility; Things are Atlas entities the scene
references and never owns.

---

## 4. The fear system — OCTOBER (with a reusable shape)

Two distinct objects. Do not merge them.

**FEAR DIAL — how far October has permission to go.**

🙂 Cozy · 🎃 Spooky · 👻 Creepy · 💀 Nightmare

(Already built as a ceremony in the existing experiment; keep the four tiers
and the "ceiling raised, not floor lowered" definition of Nightmare.)

**FEAR PROFILE — what psychologically scares this particular person.**

Fear is not linear intensity. Candidate dimensions:

anticipation · uncertainty · ambiguity · unseen presence · feeling watched ·
isolation · loss of control · violation of familiarity · supernatural fear ·
realistic/local fear · startle · dread · uncanny wrongness · trapped/lost ·
reality bleed · personal relevance · imagination (what is _not_ shown)

Example: someone chooses Nightmare while gore barely affects them, jump scares
moderately, unseen presence strongly, and reality bleed _really_ affects them.
Nightmare for that person must not mean more blood, more skulls, louder noises.
It might mean **less visual information, more silence, more ambiguity, more
anticipation.**

**CORE DESIGN RULE: every scary mechanic begins with a psychological fear
mechanism, not a Halloween trope.** We must be able to explain _why_ a scare
should work before building it.

---

## 5. Organic learning — PRINCIPLE / MECHANIC

October learns through use, not interrogation.

After a movie: loved / good / meh, and how scary: Cozy / Spooky / Creepy /
Nightmare. Occasionally — not every time — _"What got you?"_ with lightweight
answers: what I couldn't see · jump scares · feeling watched · realistic stuff ·
being trapped · supernatural · dread.

Users should understand, generally, that **"October remembers what scares
you."** They do not need to know exactly when or how it will come back. The
surprise is how intelligently October uses _voluntarily provided_ information —
never secret surveillance.

Optional personal prompts, only if the person wants to answer: _"What's the
worst nightmare you remember?"_ Answers may later shape experiences within
clearly understood personalization boundaries.

The Experience Lab's rule applies unchanged: _Passport never harvests this._ A
person types the thing themselves, knowing exactly what it is for.

---

## 6. Fear Dial behaviour — OCTOBER / CANDIDATE

The dial is more than a filter. Persist a **fear journey**: starting level,
manual changes, accepted challenges, rejected challenges, completed scary
experiences, repeated requests for scarier or easier content.

October can occasionally challenge: _"We think Spooky might be getting easy
for you."_

**The theatrical idea to preserve** — during an _earned_ scene, the dial
appears to move itself:

```
👻 Creepy
   →
💀 Nightmare
```

The user tries to drag it back. It refuses. _"You've been doing very well."_

This is **temporary theatre**. October gives control back. Recovery: _"Okay.
That was rude."_ — and the dial returns to Creepy. Never permanently hijack a
user's settings.

---

## 7. The contextual world — PRINCIPLE / MECHANIC / OCTOBER

October feels alive because the real world changes it. Use, when available:
local time · sunset · dusk and darkness · sunrise · temperature · weather ·
cloud cover · approximate moon phase · approximate moon position and whether
it is above the horizon · Halloween countdown · real events opening and
closing · event age restrictions · availability and status when evidenced.

Lines worth keeping:

- _"It's miserable outside. Perfect."_
- _"The vampires are going to bed."_ — Sunrise in 18 minutes.
- _"Go outside. Look at the moon."_

**The moon must not always be a fake Halloween full moon.** Prototype a
real-ish moon in JS/SVG/canvas: correct-ish phase, approximate orientation and
position, above or below the horizon, cloud interaction. The existing
`moonPhaseIndex` is the starting point; position and horizon are new.

Generated video may provide atmosphere _around_ deterministic contextual
elements. **The visual world itself becomes contextual UI.**

Contextual weather/time is a reusable mechanic; the horror reading of it
(_"miserable. Perfect."_) is October's.

---

## 8. Local relevance and reality bleed — PRINCIPLE / OCTOBER

Local relevance is one of October's strongest fear tools. A generic haunted
forest is weak. A recognizable public place near the user, plus a real
documented story or folklore, is potentially powerful.

The mechanism: tell someone a memorable story about an ordinary local place.
Days later they pass it during normal life. Passport is not open. Passport did
not track them. But _they remember the story_. **The experience escaped the
screen through memory.** That is reality bleed.

Design for it intentionally **without** pretending to track anyone.

Provenance is non-negotiable, and the existing experiment already has the
right labels — extend, do not weaken: **documented history · documented
folklore · legend · user-submitted story.** Never present folklore as
historical fact. This is Atlas's job (evidence over invention; provenance on
every claim) and Passport must not launder it.

Presentation candidate: _"There's a story people tell about a place 4 km from
you."_ — _"Want to hear it?"_

---

## 9. Scene candidates — CANDIDATE (not a roadmap)

### 9.1 Witching Hour — the likely first experiment

Late-night contextual scene. Possible sticky-scroll treatment: normal UI
recedes; a local-ish sky; real-ish moon, weather and time; silence and
atmosphere; useful choices eventually emerge.

```
11:47 PM
Coldstream is quiet now.

Most people are done with October for tonight.

You aren't.
```

Useful choices: take a night walk · hear a local story · put something scary
on · make something warm · let October decide.

**Lorne is not yet sold on this scene. That is the reason to prototype it
early.** It must earn its place — it is a test of whether the scene philosophy
can produce something compelling out of skepticism.

### 9.2 Movie Night

Movie selection _is_ the scene, not ordinary filters. Rainy window, television
glow, restrained cinematic animation. The Fear Dial shapes recommendations;
friends can vote.

_"Nobody is going anywhere."_ — _"So what kind of mistake are we making
tonight?"_ Choices: something fun · something disturbing · make me regret
asking.

Afterward persist WATCHED and ask for a lightweight reaction and scare rating.
Movie feedback feeds the Fear Profile and crowdsourced fear.

### 9.3 Local Legend

Nearby sourced history, folklore or user-submitted story, with provenance
shown. Can deliberately create reality bleed around recognizable public places.

### 9.4 Storm / Stay Inside

Triggered by bad weather. _"You weren't going outside anyway."_ **LOUD DOOR
SLAM.** Click. Lock. Outdoor options disappear. Then useful indoor Things:
movies, recipes, pumpkin carving, games, indoor events, stories.

Rare joke. Do not overuse.

### 9.5 Fear Shift

October challenges the dial, or theatrically and temporarily moves it (§6).

### 9.6 Behind You

**Only** for appropriately opted-in Creepy/Nightmare users, with explicit
camera permission. Never claim Passport can detect ghosts or entities. The
theatrical setup may suggest the camera is useful for the experience; the user
participates voluntarily.

**Correction from tonight, preserved:** the scare happens around the
interaction, and then the _front_ camera captures the _user's scared
reaction_. The reveal is the reaction photo. _"Got you."_ Then: keep · share
with friends · delete. The reaction photo can become an October memory — an
artifact made _from_ the scare.

Use extremely sparingly. Provide a reduced-startle / accessibility control.
Not for family mode. (The existing `ScareCam` is the opposite idea — a shape
added to the scene photo — and should not be mistaken for this.)

### 9.7 Secret Room

A rare 3–5 minute mystery / escape-room-like experience, possibly not visible
in navigation, foreshadowed over days or weeks:

```
Oct 12:   "Not yet."
later:    a locked door briefly appears.
later:    "Six nights."
finally:  the door opens.
```

The anticipation may be scarier — and more engaging — than the room.

### 9.8 Tonight

Real local events and places available tonight, from Atlas. Not an event
directory: the scene should make going out feel like entering the night.

### 9.9 Moon Call

A small, beautiful scene using real-ish celestial context. May literally
invite the user outside to see the moon, and connect that to an activity.

### 9.10 Broken October / 404

Rare meta-scene. _"404 — YOU WEREN'T SUPPOSED TO FIND THIS."_ The interface
appears to break or route somewhere unintended; may reveal hidden content.
Rare enough to stay surprising.

### 9.11 Additional scene bank — preserve, do not roadmap

Dawn / Vampires · October Dare · Friends Tonight · October Memory · Halloween
Countdown · Recipe / Kitchen · Costume Night · Scary Story · Pumpkin Night ·
Fire Night · group planning · photo moments · weather transitions.

---

## 10. Attention and spatial audio — PRINCIPLE / OCTOBER

Headphones can be part of higher-fear experiences. Explore high-quality stereo
or binaural-style spatial audio. The goal is not constant noise — **use sound
to direct attention.**

A subtle sound from the RIGHT. The user attends right. Something may appear on
the right. Or: train the user that sound predicts where something appears, then
exploit it — sound right, subtle visual event left. Fear comes from
expectation violation. Silence is part of the sound design.

**CORE PRINCIPLE: we are designing ATTENTION, not merely animation.**

(The existing experiment's `useSoundscape` is mono synthesized noise with
layers and ducking — a real arc, but not spatial. The "sound predicts
position" grammar is new.)

---

## 11. Animation and cinematic quality bar — PRINCIPLE

Animation quality matters enormously. Be extremely picky about timing, easing,
scroll progression, typography, transitions, sound timing, restraint,
atmospheric movement, scene entry and exit, tiny interaction details. It is
acceptable to spend substantial effort on small details.

"Cinematic" must not mean excessive motion, generic horror clip-art, skulls
everywhere, constant glitch effects, loudness, or clutter. Subtle motion can be
more effective.

Generated video may be used for large atmospheric scene backgrounds — poster
frame first, compressed and responsive assets, lazy loading, preload the
upcoming scene, unload distant scenes, reduced-motion and reduced-data
fallbacks. Do not plaster video everywhere; video creates atmosphere.
Deterministic JS/SVG/canvas handles contextual elements (moon, weather, time).

This sits directly on `the-physics-of-passport.md`: living objects, restraint,
personality through physics rather than effects.

---

## 12. Friends and groups — MECHANIC

Group mechanics matter and are reusable beyond Halloween: invite friends ·
shared night · voting · veto · each person's own Fear Dial · group fear
intersection · see what friends completed · lightweight reactions · shared
memories.

_"Matt did this tonight."_ — _"Way scarier after dark."_

The initial community may be ~20 known local people. Tiny numbers are fine if
real. **Never fake social activity.**

The Experience Lab's consent model carries straight over: two ceilings, the
lower always wins, nobody is told what anybody set — for October, each
person's Fear Dial is their ceiling and the group's intersection is what a
shared night may aim at.

---

## 13. Crowdsourced fear — MECHANIC / OCTOBER

Users rate movies, events and experiences for _actual_ fear, not generic
stars.

```
Movie:
  Passport expectation:            💀
  People who actually watched it:  👻
```

Friend ratings may be especially meaningful. Eventually: _"People who scare
about as easily as you usually rate this Creepy."_

This improves recommendations, Fear Profile inference and scene composition.
Do not expose it as a clinical scoring system. Keep it playful.

---

## 14. Persistent experience state — MECHANIC

No RPG inventory, no points, no badges. Persist meaningful actions:

| state         | meaning                                                                     |
| ------------- | --------------------------------------------------------------------------- |
| DID           | event / place / activity completed                                          |
| WATCHED       | movie watched                                                               |
| MADE          | recipe, craft, carving completed                                            |
| SAVED         | wants to do later                                                           |
| REACTION      | lightweight quality / fear response                                         |
| FEAR JOURNEY  | dial changes, challenges, rejections, completions                           |
| MEMORIES      | photos and moments the user chooses to keep                                 |
| FRIENDS       | shared nights, votes, reactions                                             |
| STORIES       | optional submitted stories and nightmares                                   |
| SCENE HISTORY | enough for the Director to avoid repeating tricks and to build anticipation |

The experience gradually becomes **"Your October."** A checklist may exist as
history, never as score:

```
Pumpkin patch               ✓
Haunted attraction          ✓
Halloween movie             ✓
October fire                ✓
Something after midnight    ○
Something genuinely creepy  ○
```

**NO POINTS.** No _"Congratulations, Level 7 Pumpkin Master."_

The end-of-October recap can be a beautiful, shareable scrapbook. _"You had a
good October."_ (The Lab's `Moment` finding applies: the feed and the memory
are one list read at two times.)

---

## 15. User-submitted stories — MECHANIC / OCTOBER

Users can submit local stories, folklore, personal weird experiences. _"My
grandmother always said..."_ _"Something strange happened near..."_

Provenance clearly labelled as user-submitted. Options: tell it plainly · make
it creepy · turn it into an October scene. Selected submissions could become
authored scenes experienced by other local users — the cheapest content
Passport will ever have, and what makes a tiny local community meaningful
immediately.

---

## 16. Personalized Easter eggs — CANDIDATE, with a hard boundary

Funny when Passport legitimately knows context the user _understands it has_.
For someone knowingly identified as working at Sycle:

```
Something went wrong.
Sycle appears to be down.
        (beat)
You checked, didn't you?
```

Or a harmless joke aimed at a known friend or boss.

**Boundary:** do not secretly identify a person from a typed name and mine
private bios or context they would not reasonably expect Passport to use.
Funny, never surveillance-creepy. The better future mechanic: group hosts
intentionally author harmless Easter eggs for their friends (the Lab's curator
hypothesis — _the curator sets the stage, Passport provides the toys, the
group creates the night_).

---

## 17. Broken / disobedient UI — OCTOBER / PRINCIPLE

Loss of control is a fear mechanism. Rare behaviours: the Fear Dial refuses to
move; the page seems to scroll back; a door reopens; a familiar control behaves
differently; the interface briefly appears broken; a 404 becomes part of a
scene.

These work **only because normal UI first establishes trust**. Use very
rarely. Never cause data loss. Never permanently override settings. Always
return control.

---

## 18. Photo and memory mechanics — MECHANIC

Photos connect the digital experience to the user's real October: reaction
photos, event memories, moon photos, pumpkin and costume photos, group
photos. Users choose what to keep and share. Photos feed the recap. The Lab's
open question stands: _does the vault work when the photos are real?_

---

## 19. Reusable Passport Experience mechanics — MECHANIC

Explicitly reusable across Hockey Night, Powder Day, Christmas, Date Night and
future seasonal or event experiences:

- Director / context eligibility
- authored scenes (the Lab's `Phase` + `Block` with a time dimension)
- Save / Want to do
- Did / Watched / Made
- reactions
- group invites, voting, veto (the Lab's `Prompt`)
- memories and photos (the Lab's `Moment`)
- social activity — real only
- user submissions (the Lab's `optionsFrom: "authors"` — the group's content is the product)
- scene history
- contextual weather and time
- experience recap and lineage ("run it back")

**Fear Dial and Fear Profile are October/horror-specific.** Analogous
experience-specific controls may exist elsewhere (the Lab's consent scale is
the same _shape_ — a ceiling each person sets — with different content).

---

## 20. Source of truth and factual safety — PRINCIPLE

```
Atlas knows the world.
Passport understands the person and the context.
The Experience Director chooses scenes.
Scenes perform authored moments.
```

Generative AI may provide constrained connective language — the Lab's
`phrase()`, never `observe()`. It **must not** invent factual event, place or
history claims. Local legends and history keep their provenance.

Never pretend Passport tracked someone somewhere, detected a supernatural
entity, secretly knows information it does not legitimately have, or has real
social activity when it does not. The theatre can be scary without lying about
danger or surveillance.

---

## 21. The 20-day product attitude — PRINCIPLE

Roughly 20 days maximum for the initial push. Be ambitious. Do not build every
scene. A handful of exceptional scenes plus genuinely useful real-world content
beats dozens of mediocre scenes.

Working rhythm: one strong scene per night. Experiment aggressively. Kill
scenes that feel cheesy. Keep scenes that make us immediately want more.

**Do not prematurely create a generalized framework.** Build one real scene.
Build a meaningfully different second scene. Only then extract shared
abstractions that have earned their existence. (This is exactly how the
Experience Lab found `Prompt`.)

---

## 22. Likely first experiment — CANDIDATE

**Witching Hour**, because Lorne is skeptical of it. Route concept:

```
/labs/october/scenes/witching-hour
```

Fixture-driven context with dev controls that simulate: time · weather · moon ·
fear level · location label · group context · prior history.

**No implementation in this mission.** Implementation is authorized only after
this document is reviewed.

---

## 23. Conflicts between what exists and tonight's direction

Named so nobody reconciles them silently.

1. **Front-loading vs earning.** The existing experiment asks the Fear Dial
   _before_ anything, then filters. Tonight's direction: don't front-load
   questions Passport can answer; the dial is a permission ceiling, and the
   early days are barely spooky. The ceremony is worth keeping; _when_ it is
   asked is not settled.
2. **One page vs a Director.** The existing experiment is one scripted arc in
   one component. Tonight's model is Director → killable scenes → Things. The
   existing scenes (Three Valley Gap, Flashlight, History-or-Folklore) are
   candidates to be _re-cut_ as standalone scenes, not ported wholesale.
3. **Invented Things vs Atlas Things.** The existing discovery cards, movie
   moods and personas are invented fixtures (disclosed as such). Tonight's
   direction requires real Things from Atlas with provenance, and a real
   contextual world rather than a weather toggle.
4. **Personas vs Fear Profile.** The existing ten personas (Haunted History,
   Fog Walks, Brave Mode, …) are taste categories chosen up front. The Fear
   Profile is psychological, learned, multi-dimensional. These are different
   objects; personas may survive as _interest_, not as fear.
5. **ScareCam vs Behind You.** Opposite mechanisms (§9.6). Both may exist;
   they are not the same feature.
6. **The Lab's `Prompt` model vs a Director.** The Experience Lab is
   group-question-shaped and phase-driven by _time offsets from an anchor_.
   October is context-driven by _the world_ and by history. Both say "the page
   becomes about something else at moments"; whether a Director is a
   generalisation of `Phase` eligibility or a different thing is an open
   question (§24).
7. **Points.** The Lab keeps optional scoring ("seasoning"). October has none.
   Not a conflict to resolve — a difference to respect.
8. **Group Mode.** The existing experiment simulates a group on one device;
   the Lab is also one browser. Real multi-device presence exists nowhere yet
   and both say so.

---

## 24. Open questions — OPEN

Things that need experiments, not answers written tonight.

1. Can Witching Hour be made compelling at all? (First experiment.)
2. What does the Director actually consume — a scene declares its own
   eligibility (context predicates + history predicates), or the Director
   holds a plan? Do not decide before two real scenes exist.
3. Is a Director a generalisation of the Lab's `Phase` (time-anchored) or a
   sibling (context-anchored)? Can Hockey Night's "intermission" and October's
   "storm" be one eligibility model?
4. When is the Fear Dial first asked, if not up front? Can it be inferred from
   the first tiny choices?
5. Which Fear Profile dimensions are real — i.e. produce measurably different
   scene decisions — and which are just a nice list?
6. How much silence can a scene hold before a person leaves? (Attention design
   needs numbers.)
7. Does the real moon (position, horizon, clouds) read as "real" on a phone,
   or does it need to be more theatrical than accurate?
8. Does a reaction photo (Behind You) feel like a gift or a violation, even
   with consent? Test with people who trust us.
9. How does a story become a scene — what is the minimum authored staging that
   makes a user-submitted story feel like October rather than a text box?
10. How does discovery hand off to escalation? (Inherited from the Lab, still
    the biggest structural question: does choosing a Thing _create_ a scene or
    _reconfigure_ the current one?)
11. What is the smallest persistence that lets the Director avoid repeating a
    trick — is scene history a list of scene ids with timestamps, or more?
12. Generated video: does a poster-first, lazy, unload-on-distance pipeline
    stay under the animation quality bar on a mid-range phone?

---

_Nothing in this document is code. When the code disagrees with it, the code is
right and this document should be corrected — or the code should be killed,
because that is what scenes are for._
