# OCTOBER EXPERIENCE — PRODUCT & CREATIVE BIBLE

**Established:** 2026-09-22, from one long evening of design conversation.
**Amended:** 2026-09-22, after the first physical screening of Witching Hour
v0 (§25), and again after the second, of v0.1 (§26–§29). One scene is
implemented as a lab and has been screened twice; everything else remains
preserved direction, not roadmap. It is written so that tomorrow starts where
tonight stopped.

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

### 3.1 Not everything is a scene — CORRECTION (2026-09-22 screening)

The first screening exposed a drift in our own language: "Scene" was
becoming the word for every screen. It must not. October needs directed
cinematic experiences **and** excellent functional product surfaces, and the
Director's most important skill is knowing when to do nothing.

**Provisional vocabulary** — working words, deliberately not yet architecture:

| word         | meaning                                                                               |
| ------------ | ------------------------------------------------------------------------------------- |
| **Scene**    | a directed cinematic experience. Witching Hour.                                       |
| **Surface**  | a functional place: browse, choose, plan, save, rate. Movie Night may mostly be one.  |
| **Thing**    | the useful object — movie, place, event, activity, recipe, story.                     |
| **Moment**   | a small cinematic intervention inside or around a surface.                            |
| **Thread**   | continuity across experiences and time.                                               |
| **Callback** | a later payoff of something planted earlier.                                          |
| **Director** | decides when October steps forward — and when Passport simply lets the person use it. |

**Evolved after the v0.1 screening (§27.2):** two words joined the table.
**Your October** — the real story made of what the person actually did, and
_the product_. **Side Story / Mystery** — an optional authored narrative
threaded through the month. The table above is unchanged so the addition is
visible; the model with all of it in place is in §27.2.

**The Director must know when NOT to direct.** If everything is cinematic,
October is exhausting. Browsing movies is a surface; picking one scary movie
might trigger a moment; rating it afterwards is product learning; a later
Witching Hour may call back to what October learned. _Scene creates feeling.
Surface lets the person do something with it._

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

**Evolved 2026-09-22, from three real animals and a garage (§26.4):** after
the first screening an ordinary cat outside startled Lorne badly; during
later brainstorming real coyotes joined the atmosphere uninvited; during the
v0.1 screening ordinary garage noises were scarier than some of the headphone
effects. _October does not always need to provide the scary thing. Sometimes
it only needs to change how attentively you experience the ordinary world._
Reality bleed is not only memory carrying a story out of the screen; it is
**conditioning** carrying attention into the room.

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

**Lorne was not sold on this scene, which is why it was prototyped first.**
It has now been built as v0 at `/labs/october/witching-hour` (commits
`5f5b518`, `dffc2b6`; deployed at `elk-passport.vercel.app`) and physically
screened. The verdict, in full, is §25. The short version: the concept is
emphatically validated and the execution is very rough — _the parts that
work are already unusually compelling; there is simply far too much nothing
between them._

**v0.1 was built (`da6b323`) and screened (§26). The pacing goals below were
met on the clock — doorway at 82 s instead of 115 — and the screening still
read as too slow, with stretches of "is anything happening?" The conclusion
is the important part: _stop iterating this sequence as v0.2 through timer
and polish tweaks. The problem is now narrative and premise_ (§27). The
goals are kept as the record of what was tried.**

**Candidate v0.1 directing goals — recorded, and now built:**

- substantially compress dead time; keep atmosphere and restraint
- more event density **without** constant effects
- keep "I didn't tell you to pick it up" — the first proven beat
- make intentional silence read as waiting, not as broken
- give Stay Inside an earned ending: latch/creak → one hard door slam →
  silence → immediately into useful Stay Inside content (§25.2)
- investigate real iPhone screen sleep / Wake Lock on hardware
- desktop and phone remain _equally capable_ attention owners (§25.5)
- do not add dozens of effects; do not generalise architecture yet

### 9.2 Movie Night

Movie selection _is_ the scene, not ordinary filters. Rainy window, television
glow, restrained cinematic animation. The Fear Dial shapes recommendations;
friends can vote.

_"Nobody is going anywhere."_ — _"So what kind of mistake are we making
tonight?"_ Choices: something fun · something disturbing · make me regret
asking.

Afterward persist WATCHED and ask for a lightweight reaction and scare rating.
Movie feedback feeds the Fear Profile and crowdsourced fear.

**Current thinking on what a movie _is_ (2026-09-22):** a screening at a
theatre can honestly be an Atlas Event. A movie itself is not a Place, an
Organization, an Activity or an Event, and must not be forced into one. For
Movie Night, start from a small curated Passport fixture catalogue and let the
experience expose what information it actually needs before any long-term
knowledge model is decided — Movie, Work, Media, Content, or something else is
**unresolved**. The experience discovers the requirement; the ontology follows.

**Directed trailer moments — CANDIDATE.** Where officially hosted, embeddable
trailers or teasers are permitted, October could use one carefully chosen
moment from promotional media to _demonstrate a fear mechanism_ — unseen
presence, dread, startle, isolation — rather than autoplaying previews. Never
pirated clips. Never a Netflix autoplay wall. Restraint.

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
position" grammar is new — and as of v0 it is built and screened: left tick →
left window lights; right tick → branch stirs; then right tick, four seconds
of nothing, and the _left_ light goes out, unmentioned. With headphones the
directional ticks were "very cool".)

### 10.1 Attention handoff, device dormancy, device re-entry — MECHANIC

Three techniques, named after the screening because they were _felt_ before
they were named:

- **ATTENTION HANDOFF** — deliberately transfer ownership of the person's
  attention from one participating device to another.
- **DEVICE DORMANCY** — let a participating device go quiet long enough that
  the person stops considering it part of the experience.
- **DEVICE RE-ENTRY** — bring the dormant device back unexpectedly, spending
  the attention they forgot to guard.

The one that makes the other two possible is **restraint**: if every device
constantly flashes, speaks, vibrates and updates, re-entry is impossible.
_Forgetting creates the possibility of surprise._

The v0 beat, preserved in its specific form: _the phone sits face down and
forgotten beside the monitor; October makes it thump; the person picks it up
and reads "I didn't tell you to pick it up"; while they are reading, the
desktop's left-hand tree ceases to exist, with no animation to catch. When
they look back, the world is simply different, and October does not mention
it._

### 10.2 The room becomes the soundstage — MECHANIC / OCTOBER

Desktop and phone are physically separated sound sources in the person's real
room. October may compose with: desktop speakers · phone speaker · headphones ·
Android haptics where present · screen light · orientation and motion · touch ·
camera when explicitly invited · multiple displays · the physical distance
between devices.

Candidate techniques: a sound originates from the phone _beside or behind_ the
person while they look at the desktop, steals attention, and the desktop
changes while they look; the reverse; a creak that _begins_ on the desktop and
_finishes_ on the phone somewhere else in the room.

**Do not demonstrate every capability at once** — that is a technology demo.
Condition first, violate later. A sound may belong to the desktop for several
visits before, one night, it comes from the phone. That is a multi-day
physical callback.

---

## 11. Animation and cinematic quality bar — PRINCIPLE

Animation quality matters enormously. Be extremely picky about timing, easing,
scroll progression, typography, transitions, sound timing, restraint,
atmospheric movement, scene entry and exit, tiny interaction details. It is
acceptable to spend substantial effort on small details.

"Cinematic" must not mean excessive motion, generic horror clip-art, skulls
everywhere, constant glitch effects, loudness, or clutter. Subtle motion can be
more effective.

**Slow is not suspense** (2026-09-22). Suspense requires anticipation. Quiet
and restraint remain core values, but dead time is not automatically
cinematic; on hardware, most of v0's silences read as _"is this broken?"_ and
"Still awake?" became accidentally literal. The shape to aim for is
`compress → intensify → payoff → handoff`, with a few long pauses kept
deliberately **after** attention has been earned. Do not fix bad pacing by
filling every second with effects. And note the gap between the page and the
room: timing values that read as restrained in a script felt like abandonment
in a chair.

**Evolved after v0.1 (§26, §27.4): slow is still not suspense, and shorter
timers were not the answer either.** A cut that runs on timers cannot tell
the person whether October is waiting or the software has stopped, however
tight the timers get. _Timers are a directing tool, not the engine._ Story
provides momentum; the person's own scroll and tap provide pacing; cinema
provides atmosphere; October provides continuity; and cinematic techniques
_interrupt_ the story deliberately, rather than being the thing the person
waits through.

**We are not anti-jump-scare; we are anti-_cheap_-jump-scare.** One hard,
earned scare after sustained restraint can be extremely effective. A scare
should punctuate a scene and hand the person into something useful, never
leave them staring at the environment.

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

**Evolved 2026-09-22 — TRUE / TOLD / OURS (§27.7).** Now that an authored
October narrative is on the table, the provenance labels above gain a third
column. **TRUE**: documented history, places, events, facts. **TOLD**:
documented folklore, legends, the stories people tell — represented as such.
**OURS**: the fictional October narrative. These can interact beautifully,
and Passport must never deliberately present TOLD or OURS as TRUE. This is
the same rule the existing `LocalLegend.kind` labels already enforce
(Documented · Local Legend · Concept), extended to cover fiction Passport
itself writes.

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

**Working method, added after v0.1 (§26.5): writer's block must not stop
production.** There are enough lanes that one being stuck never idles the
project — the October story and mystery · cinematic techniques · practical
surfaces · Movie Night · Things to Do · My October · the Okanagan corpus ·
the Vancouver Halloween corpus · the Hockey Night corpus · local folklore and
history · Atlas improvements exposed by any of those. Move between lanes;
keep one product direction.

---

## 22. Likely first experiment — CANDIDATE

**Witching Hour**, because Lorne is skeptical of it. Route concept:

```
/labs/october/scenes/witching-hour
```

Fixture-driven context with dev controls that simulate: time · weather · moon ·
fear level · location label · group context · prior history.

**Done, twice.** v0 shipped as `/labs/october/witching-hour` with fixtured
context (no dev controls yet), three cuts — phone alone, desktop alone,
desktop + phone — and was screened on a real desktop and a real iPhone (§25).
v0.1 recut the pacing and added the door and a Stay Inside surface, and was
screened the same way (§26). The experiment's finding is no longer "can it be
compelling" but "the sequence needs a premise, not a shorter clock."

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
   the Lab is also one browser. ~~Real multi-device presence exists nowhere
   yet~~ — as of v0 it exists as an ephemeral two-device pairing, screened.
9. **"Scene" for everything vs scenes _and_ surfaces.** Earlier sections
   sometimes used "scene" to mean any October screen. §3.1 corrects this; the
   older wording is left where it was so the drift is visible.
10. **Desktop as director vs devices as instruments.** v0's code names the
    desktop "director" and the phone "prop" — correct for v0's one authored
    cut, and _wrong as a principle_. §25.5 and the App ADR say no device is
    permanently primary. Do not read v0's variable names as architecture.
11. **"I didn't tell you to pick it up" — proven in v0, deflated in v0.1.**
    §25 calls it the first proven beat. §26 found it lost its magic when the
    sequence had effectively _prompted_ the pickup. Both are true: the line
    works only when picking up the phone genuinely feels like the person's
    own decision. That is a constraint on how it is staged, not a reason to
    cut the line.
12. **Categories vs desire.** §9.1's doorway and v0's choices ("Stay inside ·
    Go outside · Tell me something · Surprise me") are abstract categories.
    §27.3 says choices must emerge from desire the story created. The older
    copy stays in v0's script as the record of what did not work.
13. **Surfaces as menus.** §3.1 says a surface "lets the person do something
    with the feeling." v0.1's Stay Inside surface did exactly that as a menu of
    cards, and the cards killed the feeling instantly (§26.2). A surface must
    be useful _without_ becoming a recommendation menu; how is open (§24).

---

## 24. Open questions — OPEN

Things that need experiments, not answers written tonight.

1. ~~Can Witching Hour be made compelling at all?~~ **Answered yes** on
   2026-09-22, by a rough prototype. The open question is now pacing (§11).
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
13. Why does a real iPhone still sleep face down with a Screen Wake Lock
    requested from a gesture? (Suspected: iOS releases it on backgrounding or
    the request silently failed; needs a real-hardware trace, not a guess.)
14. Does the earned door slam survive repetition, or is it a once-per-October
    device? (Related: how does a scene know it has already used its one scare?)
15. What is the honest boundary for camera ambiguity (§25.10) — what can a
    live camera view be allowed to _suggest_ without Passport claiming
    anything about reality?
16. **What is October?** The season anthropomorphised, a storyteller, a ghost,
    something connected to Passport, something older, something else — not
    to be answered on paper (§27.1). The "dead someone" idea is kept because
    it revealed that a deeper mystery is _possible_, not because it is chosen.
17. How is a phone pickup staged so that it is the person's own decision and
    not a prompted one? (§23 #11.) The line depends on the answer.
18. How can a surface be genuinely useful without becoming a menu of cards?
    (§26.2.) The Towne Cinema card and The Others card both broke the spell
    the moment they appeared — the same failure from two directions.
19. Why did face-down detection not visibly work on the physical iPhone in
    the v0.1 run — sensor permission, the β threshold, or the fallback path?
    Needs a hardware trace, not a guess.
20. How loud should the door be? v0.1's slam was capped for safety and was
    "much too quiet" in the room. The ceiling was the right idea at the wrong
    number.
21. Does an opening that the person paces by scroll and tap (§27.4) hold
    atmosphere as well as a timed one, or does control dissolve it?

---

## 25. First physical screening — Witching Hour v0, 2026-09-22 — EVIDENCE

Experienced on a deployed desktop browser and a physical iPhone, with
headphones, paired through Supabase Realtime, from `elk-passport.vercel.app`.
This section is the record. It is deliberately specific; the bland version of
any line here would destroy the thing it is preserving.

**The conclusion, before the detail:** the concept is emphatically validated
and the execution is very rough. _The parts that work are already unusually
compelling. There is simply far too much nothing between them._ So the job is
to **edit and direct**, not to rethink.

### 25.1 What actually happened

**Good.**

- The ambient wind was very good.
- The strange directional ticks were very cool in headphones.
- Atmosphere existed immediately.
- The dark desktop _waiting for the phone_ already felt exciting before
  pairing succeeded.
- Physically taking the phone out and pointing its camera at the glowing QR
  code felt creepy — before anything scary had happened on the phone.
- The phone physically sitting beside the monitor changed the experience.
- Cross-device participation felt fundamentally different from using a
  website.
- The headphone thump works as a physical cue even though iPhone cannot
  vibrate.
- **"I didn't tell you to pick it up."** produced immediate laughter and an
  emphatic "oh heck yeah." **Keep that beat. It is one of the first proven
  moments.**
- The browser briefly disappeared psychologically: it felt like October had
  _noticed a physical action_.
- Lorne repeatedly called the rough prototype unreal / freaking cool despite
  obvious defects — and the concept became _more_ convincing because something
  so unfinished already produced atmosphere and physical reactions.

**Bad.**

- Pacing is dramatically too slow — worst after the headphones question and
  before pairing, with further dead stretches around face-down/pickup and
  after later beats.
- Silence usually read as "is this broken?" rather than as anticipation. The
  experience lost attention instead of building it.
- "Still awake?" became accidentally literal.
- The physical iPhone still fell asleep despite the Wake Lock request.
- Several stretches did not communicate whether October was intentionally
  waiting or the software had stalled.
- The doorway leads nowhere useful. Stay Inside → desktop: "Good. The door
  stays closed tonight." → phone: "Okay." → effectively nothing. That reads
  as unfinished, not mysterious.

### 25.2 The door — a discovery from an unmet expectation

After choosing Stay Inside, Lorne instinctively waited for something to
happen to the door. Nothing did. His reaction: _"Is it done? No door creaking?
No door slam?"_ The writing had created an expectation the scene did not
honour.

Candidate direction, in full:

```
Stay Inside.

"Good.
The door stays closed tonight."

beat.

(maybe) a subtle latch, or a creak.

then ONE earned, spatially convincing, hard DOOR SLAM through the headphones.

silence.

(maybe) "Locked."

then, immediately, useful Stay Inside content.
```

Preserve the joke inside it: the person means _"I choose an indoor
activity"_; October momentarily hears _"you are staying inside."_ Playful,
creepy, and it needs no overarching plot. The scare punctuates the scene and
hands the person into useful Passport; it never leaves them staring at trees.

### 25.3 Not everything is a scene

Recorded at §3.1 as a correction to our own language, with the provisional
vocabulary (Scene · Surface · Thing · Moment · Thread · Callback · Director).
The Director must know when not to direct.

### 25.4 Movies

Recorded at §9.2: a movie is not an existing Atlas kind and must not be forced
into one; a curated fixture catalogue first; directed trailer moments as a
candidate.

### 25.5 Devices are instruments, not mirrors — PRINCIPLE

One of the largest discoveries of the night. Preserve the phrase:

> **A Passport experience does not belong to a screen. It can move between
> and coordinate the devices around the people participating in it. Each
> device is an instrument, not a mirror. There is no permanently primary or
> secondary device; attention and control can move between them as part of
> the experience.**

Do not frame the desktop as permanently primary and the phone as secondary.
Both can be primary at different moments:

```
desktop owns attention.  phone sits forgotten.
phone makes a sound.     phone owns attention.  desktop is a dormant object behind the person.
minutes pass on the phone. the desktop is mentally removed from the experience.
CREAK — from the desktop.
the person physically turns around.
the desktop is different.
```

The reverse is equally valid. This is also the first App ADR
(`docs/architecture/decisions/001-devices-are-instruments-not-mirrors.md`).

### 25.6 Attention handoff · device dormancy · device re-entry

Recorded at §10.1 as named techniques, with the v0 beat preserved in its
specific form.

### 25.7 The room becomes the soundstage

Recorded at §10.2. The origin is worth keeping here: **iPhone's missing
vibration produced a better idea.** Treated as a degraded capability it was a
loss; treated as "there are two sound sources in this room" it became a
composition.

### 25.8 Capability-based cinematic cuts — PRINCIPLE

An unsupported capability should **change the cut**, not produce a worse
version of the same cut.

| what is in the room | what October does                                                    |
| ------------------- | -------------------------------------------------------------------- |
| Android + vibration | real haptic pulses                                                   |
| iPhone + headphones | a low thump, spatial sound                                           |
| no headphones       | some other combination — screen, orientation, touch, a second device |
| camera / motion     | only when explicitly appropriate and permissioned                    |

Never display "Your browser does not support vibration." October simply
chooses from the instruments available. A future Director context may include
_"what can the devices in this experience physically do right now?"_, and that
should shape composition. Origin: this exists because iPhone vibration failed.

### 25.9 Pairing itself can be cinema

Picking up the phone and aiming its camera at the glowing code on the dark
desktop felt creepy _before_ anything happened on the phone. So pairing is not
setup plumbing to be hidden. It worked because atmosphere already existed and
the person knew something was coming. Do not overdecorate it. Preserve: _the
transition between devices can itself be part of the experience._

### 25.10 The camera / finger accident — CANDIDATE, with a hard boundary

While aiming at the QR code, Lorne's finger crossed the camera. For an instant
it looked like something on the screen, or behind the phone. It creeped him
out and immediately suggested a technique — something small and ambiguous
crossing the live frame, a spider-like silhouette. **Do not implement this
now. Do not turn October into cheap AR ghosts.**

The deeper discovery: when the live camera view _is_ the person's room, a
tiny ambiguous intrusion can momentarily confuse "on the screen" · "in the
camera image" · "physically behind the phone". That boundary uncertainty is
potentially powerful. Any future camera use: explicit opt-in · honest about
camera use · no secret recording · preferably local processing · never a claim
that something was "detected" · restrained. **Ambiguity in presentation,
never deception about surveillance or reality.**

### 25.11 Building creates the ideas — PRINCIPLE

Tonight's loop, demonstrated repeatedly: `build → experience → discover →
preserve → build again`.

- iPhone vibration failing → multi-device spatial audio.
- QR setup → cinematic pairing.
- physical phone placement → attention ownership.
- a finger over the camera → screen/reality ambiguity.
- a boring ending → the scene → surface handoff.
- timing values on a page → radically different in a chair.
- "I didn't tell you to pick it up" → proven only when experienced physically.

Therefore: do not design October on paper; do not build a generalised
Director / Scene Engine from imagined needs. Build authored experiences,
experience them physically, extract the language that proves itself, preserve
it, and let architecture emerge from evidence. **Recklessly ambitious
creatively; conservative architecturally.**

### 25.12 What v0 proved

The question was: _can Passport feel less like a website and more like an
interactive movie?_ v0 is enough evidence to continue confidently — not
because of polish, but because the person physically arranged devices;
pairing created anticipation; sound moved attention; the phone became a prop;
the experience responded to a physical action; one line on the phone produced
a strong emotional reaction; the person began thinking about the _room_ as part
of the experience; and what they wanted afterwards was a missing cinematic
payoff, not more UI. **The browser briefly ceased to be the mental model.**
That is the direction.

### 25.13 Preservation rule, reinforced

When a discovery materially changes what October is, preserve it in Passport
before moving far beyond it. Not every joke — but the why, the weird specific
mechanics worth protecting, screening evidence good and bad, rejected
directions and why, cinematic principles, recurring motifs, architecture
decisions, and anything that came from a physical build. Specificity matters:
"cross-device support" is worthless; _"the phone sits dormant beside the
monitor; October makes it speak, stealing attention; while the person looks
away the desktop silently changes"_ is the idea.

---

## 26. Second physical screening — Witching Hour v0.1, 2026-09-22 — EVIDENCE

Same rig as §25: deployed desktop, physical iPhone, headphones, Realtime
pairing. v0.1 (`da6b323`) had recut every timer, made the desktop change
pre-attentive, built the door, and added a Stay Inside surface.

**The conclusion, before the detail:** _stop iterating this sequence as v0.2
through timer and polish tweaks. The problem is now narrative and premise._

### 26.1 What worked

- The ambient wind still works — and it is spatial enough that Lorne at first
  thought it was _absent_, because he was wearing only the right headphone
  and the wind sat mostly in the left.
- Sound materially changes behaviour: he was reluctant to put the second
  headphone on, because the experience had already made him nervous.
- The smaller sounds — latch, wood — were good.
- Pairing and cross-device remain a promising cinematic technique.
- **The real garage became scarier than some of the generated sounds.**
  Ordinary noises felt threatening once attention had been conditioned.
  (Preserved as principle at §8 and §26.4.)
- The door's _setup_ worked: "Good. The door stays closed tonight." landed,
  and the latch and wood registered.

### 26.2 What failed

- Still substantially too slow, despite doorway-at-82-seconds. Repeated
  stretches read as nothing happening.
- Face-down detection did not visibly work on the physical iPhone.
- The environmental changes were still too subtle. The reaction was
  effectively _"am I looking at the same thing? did something change?"_ —
  not "what the hell?"
- **"I didn't tell you to pick it up" lost its magic**, because the sequence
  had effectively prompted the pickup. The line only works when the pickup is
  genuinely the person's own idea.
- "Put it back." followed by no perceptible response was brokenness, not
  tension.
- "Still awake?" after the waiting produced: _"no shit."_
- **The door slam was much too quiet.** Setup better than payoff.
- "Stay inside · Go outside · Tell me something · Surprise me" lacked meaning
  because the person did not yet understand what October was offering or why
  those choices mattered.
- The Stay Inside surface was understandable and **emotionally dead** — a
  recommendation menu. The Towne Cinema legend card and The Others card
  showed the same failure from two directions: useful content, presented as a
  card, broke the cinematic spell the instant it appeared.

### 26.3 What this changes

Pacing was the diagnosis after the first screening and it was half right.
Cutting the clock made the sequence shorter without making it _mean_ more.
What is missing is a reason to be there: a premise that creates desire, so
that the person's own curiosity supplies momentum and the timers only
interrupt it. That is §27.

### 26.4 Conditioning — the real world as instrument

Across three sessions: a cat outside the garage after the first screening
startled Lorne badly; real coyotes outside joined the brainstorming
atmosphere; ordinary garage sounds during v0.1 were scarier than the
headphones. **October does not always need to provide the scary thing.
Sometimes it only needs to change how attentively you experience the
ordinary world.** The room can be part of the experience without Passport
ever pretending to detect anything in it.

### 26.5 Working method

Writer's block must not stop production. Recorded at §21 with the lanes.

### 26.6 ADR 001, checked against this screening

Unchanged as a decision. Its evidence section is amended: consequence 2 (the
instrument shapes the cut) was exercised for the first time and held; the
room proved to be an instrument; and one limit was found — attention
handoff must feel like the person's own decision, which the ADR does not
claim to solve.

---

## 27. Storytelling direction — EXPLORATION, not canon

Everything in this section is being explored. Nothing here is decided, and
the point of writing it down is so that the next conversation does not have
to reconstruct it.

### 27.1 October may be a presence

October may itself become a presence — companion, director, character. The
person should gradually begin to wonder: _"What the hell is October?"_ —
_"Who have I been talking to?"_

We do not know what October is: the season anthropomorphised · a storyteller
· a ghost, a dead someone · something connected to Passport · something older
· something else. **Do not canonise an answer.** The "dead someone" idea was
exciting because it showed that a deeper mystery is _possible_ — that is what
it is kept for, not as a selection.

October can be helpful, funny, mischievous, warm, creepy and frightening at
different times. The person should have reasons to return beyond narrative
curiosity.

### 27.2 The model, as currently imagined

```
PASSPORT       the useful product
OCTOBER        a seasonal presence / director / companion
YOUR OCTOBER   the real story, made of what the person actually did — THE PRODUCT (§28)
SIDE STORY     an optional authored narrative threaded through the month
SCENES         directed cinematic experiences
SURFACES       useful product areas
THINGS         actual movies, events, places, recipes, activities, stories
MOMENTS        small cinematic interventions
THREADS        continuity across time
CALLBACKS      later references and payoffs
```

**The story must not consume the product.** (§28 holds the test.)

### 27.3 Choices emerge from desire, not from categories — PRINCIPLE

October creates desire, then offers an action. Same utility, different
psychology.

| bad                         | potentially strong                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| "Tell me something creepy." | "There is a story people tell about a place near here. I probably shouldn't tell you this one tonight. — Tell me anyway." |
| "Go outside."               | "There's somewhere I want to show you. It's 11 minutes away. — Take me there."                                            |

This is why v0's doorway failed (§26.2): the categories asked the person to
want something before anything had made them want it.

### 27.4 Story pacing

Explore an opening — a trailer, almost — where the person controls much of
the pace through scroll and tap rather than waiting through timers.

```
story          provides momentum
interaction    provides pacing
cinema         provides atmosphere
October        provides continuity
technique      interrupts the story, deliberately
```

Timers are a directing tool, not the engine (§11).

A possible purpose for the opening: make the person feel _"I have absolutely
no idea what this thing is going to do over the next month, and I need to
find out."_

Exploratory copy, not canon:

```
How long do I have you?
  Just tonight
  Until Halloween

(Until Halloween)
Good.
        beat
Then we have time.
```

### 27.5 Music and voice — CANDIDATE

An original October musical language: a tiny recognisable three-to-five-note
motif, perhaps piano; innocent at first; later buried or reinterpreted; able
to migrate between devices; completed or transformed near Halloween.

Voice should be rare enough to matter. October might exist entirely as text
at first. If the person becomes used to _reading_ October, the first time
October actually speaks could be a major moment. Do not default to constant
narration.

### 27.6 Reality bleed and conditioning

§8 and §26.4. Preserved strongly.

### 27.7 TRUE / TOLD / OURS

The storytelling integrity model, recorded at §20. TRUE is documented; TOLD
is folklore represented as folklore; OURS is the fiction. They can interact
beautifully. Passport never presents TOLD or OURS as TRUE.

---

## 28. The practical product — Your October — PRINCIPLE

**The story is not the product. Your October is the product.** Passport must
be genuinely useful even if every cinematic and story element were removed.

**The product test:**

> If October disappeared entirely, Passport should still be excellent at
> helping me have an amazing October. When October appears, it should make
> that experience unforgettable.

Candidate persistent doors and surfaces — names and boundaries provisional:

- **Tonight** — _"Make me a hell of a night."_ Contextual composition of
  real things to do: stay-in, go-out, and mixed evenings.
- **Things to Do** — events, pumpkin patches, haunted attractions, markets,
  walks, theatre, screenings, seasonal activities, local Halloween.
- **Movies** — browse, filter, discover; the Fear Profile; couples and
  groups; watched and reactions; Movie Night.
- **Food & Drink** — recipes, treats, dinner ideas, seasonal food, useful
  nearby places.
- **Games & Fun** — trivia, challenges, date activities, friend and family
  activities, party material.
- **Stories** — real history, sourced folklore, local legends, and authored
  October side stories, with the TRUE / TOLD / OURS boundary visible.
- **My October** — a beautiful, evolving record of what the person actually
  did: places visited, events attended, movies watched, recipes made,
  activities tried, stories experienced, reactions, saved plans, memories,
  friends where appropriate. **Not points, badges or streaks.** A core
  motivation can simply be _"I want to have a great October and try as many
  worthwhile things as I can."_ By Halloween it should feel like a record of
  the October the person actually had. (§14's DID / WATCHED / MADE / SAVED
  states are the bones of this.)
- **Fear Dial** — persistent but unobtrusive; it changes how October treats
  the person rather than functioning as a settings control (§4, §6).

---

## 29. October as a way to develop Atlas — DIRECTION

October becomes a **demand-driven** way to grow Atlas. Do not grow Atlas to
raise the entity count; use real Passport experiences to expose missing
knowledge and modelling weaknesses, then fix them systemically.

Initial geographic and product wedges:

1. **Okanagan / Vernon-area Halloween** — deep enough that Lorne can
   personally use and test it.
2. **Vancouver Halloween** — not full Vancouver coverage; Halloween-first is
   fine.
3. **Vancouver Hockey Night** — a small useful wedge around the actual
   evening: the arena, walkable nearby places, food, timing, activities, the
   practical composition of the night.

The loop:

```
experience need
  → discover real-world Things
  → inspect Atlas capability and gaps
  → systemic Atlas improvement where warranted
  → acquire high-quality evidence
  → compose a useful Passport experience
  → personally test
  → repeat
```

Atlas should eventually know enough about a real Thing to answer the
questions that decide whether someone actually wants to do it: _What is it?
Why go? What is happening, and when? Is it open or available tonight? How
much? Who is it good for? How scary or intense? Indoor or outdoor? How long
does it take? What should it be combined with? What does the surrounding
evening look like?_

Do not assume every answer is a scalar field. Atlas's evidence and provenance
principles hold: an answer is a claim with a source, and "Atlas does not
know" is a valid answer.

---

_Nothing in this document is code. When the code disagrees with it, the code is
right and this document should be corrected — or the code should be killed,
because that is what scenes are for._
