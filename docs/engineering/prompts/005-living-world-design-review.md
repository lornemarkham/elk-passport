# Sprint 005 — The Living World

## Design and Architecture Review — Do Not Code Yet

You are continuing Passport Motion Lab after Sprint 004 (`efb7015`).

Sprint 004 improved the engine, but the experience still misses the mark. This is not mainly a tuning problem. The current implementation expresses personality as deformation and effects attached to individual cards. Passport needs a deeper model: each card must feel alive before interaction, its atmosphere must exist outside the video frame, and its character must be revealed by how it changes the shared world around it.

This phase is a design and architecture review only.

**Do not implement anything yet.**

Read the existing project, the Physics of Passport document, Sprint 003 and Sprint 004 documents, and inspect the current Motion Lab implementation. Then return a concrete implementation plan, identify architectural risks, challenge weak assumptions, and wait for approval.

---

# The core correction

The current system still reads as:

> A rectangular card twists while an effect plays inside it.

The target is:

> A living object carries an atmosphere through a shared world and influences nearby objects.

The rectangle is only the visual anchor. The personality must not be trapped inside the card.

The world around the card is part of the object.

---

# What is currently wrong

## 1. The cards are inactive until hover

They need presence even when nobody is touching them.

Not constant noisy animation. Not five looping attention grabs.

Each object should occasionally reveal a quiet sign of life:

- a single ember rises
- steam curls and disappears
- a small vibration or correction passes through the helicopter
- dust settles behind the dirt bike
- light glints across the wine card

These moments should be irregular, subtle, and personality-specific. They should happen rarely enough to feel discovered rather than scheduled.

Think **idle behaviour**, not idle animation.

## 2. Universal skew is not personality

All cards currently twist or skew while moving. Some differ in degree, but they still feel like variants of one motion system. The result is awkward and generic.

Do not assume every experience needs deformation.

Possible direction:

- Campfire may flex or breathe.
- Helicopter should feel mechanically rigid, with banking and micro-correction rather than rubbery skew.
- Sauna may drift upward and barely deform.
- Dirt Bike may pitch, carve, or momentarily kick sideways, but should still feel smooth and flowing rather than randomly violent.
- Wine may remain composed, with delayed internal movement or subtle rotational lag rather than visible card bending.

Personality comes before abstraction. Different experiences may require different motion models.

## 3. Personality remains trapped inside the card

This has now been repeated across multiple sprints and must be treated as a primary acceptance criterion.

Sparks, steam, dust, wind, glow, light, and other atmospheric elements must:

- exist visibly outside the card bounds
- remain above the video rather than hidden behind it
- travel with the card while it is being moved
- detach, lag, stretch, disperse, or persist according to the material
- continue briefly after release
- be visible even when the card itself is not hovered

A portal alone is not enough. The result must visually read as one object carrying an atmosphere, not a card plus a disconnected particle overlay.

## 4. Every card must be throwable

All cards need convincing toss behaviour.

Release should preserve meaningful momentum. The card should travel, decelerate, overshoot, collide with boundaries if relevant, and settle according to its physical character.

The toss must not merely mean “spring back to origin using release velocity.”

We need to decide the world model:

- Are cards free-positioned after release?
- Do they return to layout slots?
- Do they have soft constraints?
- Can they bump, displace, or influence nearby cards?
- What happens at stage boundaries?

Do not decide this casually. Propose a coherent interaction model that can scale from 5 cards to 20 or more.

---

# Per-experience critique and direction

These are design intentions, not literal implementation commands. Challenge them where necessary, but preserve the emotional goal.

## Campfire

Current issue:

The fire is still visually contained. Sparks do not convincingly feel pulled out by motion.

Target:

- The fire has a quiet living presence without hover.
- A quick drag pulls embers into a visible trail.
- Embers have inertia: some follow, some detach, some rise independently.
- The glow and heat field extend beyond the rectangle.
- Nearby cards can become warmer or brighter when close.
- After a toss, a few embers continue on their own path while the card settles.

The key emotional moment:

> It should feel like moving something that is actually burning.

## Dirt Bike

Current issue:

This experience is difficult because “aggressive” is not the same as enjoyable. Excessive skew or chaotic movement does not communicate dirt biking.

The intended character is **flow**:

- dirt biking
- wakeboarding
- snowboarding
- carving
- momentum
- smooth speed
- controlled fun

Possible behaviours:

- it leans into direction changes
- it carves rather than rubber-skews
- a hard turn produces a brief kick of dust
- a fast pass can bump or disturb nearby cards
- the object feels playful and energetic, but not clumsy

The video will contribute strongly later, but the interaction must still communicate flow before video polish is used as a crutch.

## Helicopter

Current issue:

The current centre element is visually confusing and should not survive merely because it already exists. The card does not yet communicate a helicopter.

Questions to solve:

- Does it have subtle mechanical vibration?
- Does it bank rigidly during lateral movement?
- Does rotor wash push particles, steam, or nearby cards?
- Does a searchlight or beacon have useful inertia, or should that concept be removed?
- How do we imply controlled machinery without making the card jitter constantly?

Target:

- rigid rather than rubbery
- tiny mechanical corrections
- visible influence on the surrounding atmosphere
- rotor wash as a world interaction, not decorative lines inside the card

Remove or redesign the current middle element if it has no clear semantic purpose.

## Sauna

Current issue:

The steam remains inside the card and the universal skew does not suit it.

Target:

- steam visibly rises above and outside the card
- steam has organic variation, persistence, curl, and dissipation
- when the card moves, steam is pulled, stretched, and left behind
- after release, steam continues upward rather than snapping back
- nearby cards can be softened, hazed, or humidified when close
- the card itself should feel buoyant and upward-seeking, not rubbery

The movement may be extremely restrained. The atmosphere can carry more of the personality than the rectangle.

## Wine

Current issue:

Wine may never need a dramatic personality. That is acceptable.

Not every object should be equally moody, loud, or animated.

Target:

- composed
- elegant
- quiet
- perhaps a subtle glint, delayed liquid response, or graceful settling
- minimal particles
- less deformation than the others

A generic-but-refined base behaviour may be the correct answer for experiences whose identity comes more from content and mood than exaggerated physical character.

Do not force differentiation where restraint is more truthful.

---

# The major new idea: personality through influence

The strongest direction is that personality may be revealed less by how a card deforms and more by how it affects other things.

Examples:

- Campfire lights or warms nearby cards.
- Sauna steam drifts across neighbouring cards.
- Dirt Bike bumps cards or throws dust across them.
- Helicopter rotor wash pushes steam, sparks, dust, and perhaps lightweight cards.
- Wine may calm motion, soften lighting, or simply remain largely unaffected.

This creates a shared ecology rather than five isolated demos.

The Motion Lab should begin evolving from a card gallery into a small living scene.

---

# Required architectural questions

Your review must answer these before implementation begins.

## A. World model

Propose a clear model for a stage containing 5, 20, or potentially 50 objects.

Address:

- object position and layout
- drag and toss state
- boundaries
- collision or soft avoidance
- z-order
- stage-space atmosphere
- idle updates
- object removal and cleanup

Do not promise 50 objects without profiling. Explain what is likely feasible and what must be measured.

## B. Influence model

Propose an `Influence Engine` or equivalent abstraction.

Each object may emit one or more fields, such as:

- heat
- light
- wind
- humidity
- force
- dust
- calm
- attention

Nearby objects and atmospheric particles may respond to those fields.

Avoid naive all-to-all React state updates every frame.

Consider:

- spatial hashing or a simple grid
- radius-based queries
- imperative simulation state outside React render cycles
- a shared animation loop
- quality tiers
- capped particle budgets

Explain when the simple solution is sufficient and when a spatial index becomes necessary.

## C. Atmosphere ownership

Define who owns world-space effects.

Questions:

- Does each object own its atmosphere?
- Does the world own all particles and fields?
- How does an effect remain attached while also being able to detach?
- How do multiple influences modify one particle?
- How are effects layered above video and outside card bounds?

The architecture must support attached, trailing, detached, and ambient states.

## D. Idle behaviour system

Idle behaviour must be:

- subtle
- irregular
- deterministic enough to debug
- cheap enough to run across many objects
- respectful of reduced-motion settings
- capable of being paused when offscreen or hidden

Propose how idle “moments” are scheduled without creating one timer per tiny effect or producing synchronized loops.

## E. Toss model

Propose how toss actually works in the shared world.

Include:

- velocity capture
- inertial continuation
- damping or friction
- optional spin
- stage boundaries
- soft collision or influence on other objects
- final resting behaviour
- how layout remains usable after play

The experience should feel playful without allowing the screen to become permanently chaotic or unusable.

## F. Performance strategy

We eventually want to test scenes with many objects.

Provide a practical performance plan for:

- 5 objects
- 20 objects
- 50 objects

Address:

- DOM vs canvas vs hybrid rendering
- particle caps
- frame-loop ownership
- React render frequency
- event handling
- proximity calculations
- browser/device quality tiers
- profiling metrics

Do not recommend a full engine rewrite unless the current architecture truly cannot support the intended scene.

---

# Scope proposal for the next implementation sprint

Do not attempt to build the entire ecology at once.

Recommend the smallest implementation slice that can prove the direction visually.

A likely candidate is a **three-object interaction scene**:

1. Campfire
2. Sauna
3. Helicopter

Why these three:

- Campfire emits embers, light, and heat.
- Sauna emits steam and humidity.
- Helicopter emits wind/force.
- Rotor wash can push steam and embers.
- Campfire can illuminate nearby cards.
- The effects are visually legible outside the rectangles.

This scene can prove:

- idle presence
- atmosphere outside the card
- attached and detached effects
- toss
- cross-object influence
- world-space layering

Dirt Bike and Wine can follow after the world model is proven.

Challenge this slice if you believe another is materially better, but explain why.

---

# What not to do

Do not:

- add more universal skew and call it personality
- solve this by increasing particle counts
- hide effects inside card overflow
- create five isolated bespoke demos with no shared world model
- implement full pairwise collision among 50 React components
- build a complex game engine before proving one compelling scene
- force every experience to be equally dramatic
- assume correct math means successful feel
- proceed to code before the design and architecture review is approved

---

# What your response must contain

Return a concise but substantive review with these sections:

1. **Restatement of the target** — demonstrate that you understand the shift from animated cards to living objects in a shared world.
2. **Diagnosis of the current architecture** — what can be extended, what should be removed, and what will fight the new direction.
3. **Recommended world architecture** — components, stores, simulation loop, rendering layers, and data flow.
4. **Influence model** — how objects affect particles and other objects.
5. **Idle-presence model** — how unprompted moments work.
6. **Toss model** — how movement continues after release without destroying layout usability.
7. **Three-object proof scene** — exact behaviours for Campfire, Sauna, and Helicopter.
8. **Performance plan** — realistic expectations for 5, 20, and 50 objects.
9. **Implementation phases** — a small sequence of reviewable milestones.
10. **Risks and open decisions** — specifically call out anything that requires Lorne's artistic judgment.
11. **Questions for Lorne** — only questions that materially change the architecture or intended feel.

Then stop and wait for approval.

---

# The standard

The next implementation is successful only if a person can watch the scene without hovering and sense that it is alive.

When they grab an object, its atmosphere must come with it.

When they toss it, momentum must continue.

When objects approach each other, something in the world must change.

The goal is not five impressive card animations.

The goal is a small world that appears to have been living before the user arrived.
