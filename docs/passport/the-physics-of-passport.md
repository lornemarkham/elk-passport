# The Physics of Passport

## Purpose

Passport experiences are not static cards with decorative animations.

They are **living objects sharing a world**.

This document defines the physical and behavioral laws that every Passport experience must follow. These laws are more important than any individual effect, animation library, or implementation detail.

Campfire, Helicopter, Sauna, Dirt Bike, Wine, and every future experience should feel different because they obey the same universe through different personalities, materials, and physical responses.

---

# Creative Direction

For this project, think like all of these disciplines at once:

- An Apple interaction designer obsessed with elegance, restraint, and intuitive interactions.
- A Pixar character animator who brings personality and emotion to things that do not speak.
- A Nintendo game designer who understands that tiny moments of delight create curiosity and play.
- An art director who creates atmosphere, mood, and emotional storytelling.
- A frontend engineer who turns those ideas into beautiful, performant React code.

A technically correct implementation that lacks emotion, personality, or play is incomplete.

Think in systems, not isolated effects.

---

# Core Mental Model

Do not think:

> Card with animation inside it.

Think:

> Living object moving through atmosphere.

The card is only one layer.

Each experience may include:

- the card or video surface
- body motion
- deformation
- shadow
- light
- particles
- atmosphere
- trails
- inertia
- memory
- influence on nearby space

The personality must be visible in **how the object moves**, not only in what appears inside it.

---

# Laws of the Passport Universe

## Law 1 — Nothing Stops Instantly

Every object has momentum.

When released, an object should continue moving according to its velocity, mass, friction, damping, and personality.

Stopping instantly is allowed only when it is a deliberate character trait.

Every movement should have:

- anticipation
- acceleration
- momentum
- overshoot or drift
- settling

---

## Law 2 — The World Exists Outside the Card

The card is a window into an experience, not a prison for effects.

Where appropriate:

- sparks escape
- steam escapes
- dust escapes
- light escapes
- heat escapes
- wind disturbs nearby atmosphere

Effects may appear behind, around, or above the card.

If every effect is clipped inside the card, the experience will feel like a UI component rather than a living object.

---

## Law 3 — Dragging Reveals Personality

Dragging is not one shared interaction.

Dragging is a personality test.

Each experience must define its own:

- grab response
- acceleration
- resistance
- elasticity
- rotation
- deformation
- inertia
- release velocity
- trailing material
- settling behavior

If every card drags and releases the same way, the personality system has failed.

---

## Law 4 — Nothing Moves Alone

Primary motion must create secondary motion.

When an object moves, at least one related system should react:

- glow lags
- shadow stretches
- particles trail
- steam bends
- liquid sloshes
- dust kicks up
- light swings
- the card bends, twists, tilts, or compresses

Secondary motion should continue briefly after the main object stops.

---

## Law 5 — Materials Behave Like Materials

Different materials require different physical rules.

### Fire and Embers

- rise
- flicker
- separate under acceleration
- leave trails
- continue after release
- respond to disturbance
- lose brightness over time

### Steam and Mist

- drift
- diffuse
- curl
- lag behind movement
- spread into surrounding space
- respond to directional force

### Dust

- bursts under acceleration
- remains suspended
- scatters
- catches light
- settles gradually

### Liquid

- lags behind the container
- sloshes
- rotates
- overshoots
- settles with damping
- preserves momentum after the card changes direction

### Light and Beams

- pivot
- sweep
- overshoot
- lag behind rigid motion
- illuminate surrounding atmosphere

The same generic particle behavior must not be used for every material.

---

## Law 6 — Interactions Have Memory

An experience should remember what just happened.

Memory may include:

- previous velocity
- direction
- number of visits
- recent hover duration
- recent drag intensity
- whether the user approached slowly or quickly
- whether the object was thrown
- how long the user stayed nearby

The object should not reset immediately when the pointer leaves.

Examples:

- Campfire remains warmer after a long visit.
- Wine continues to swirl after release.
- Dust remains after Dirt Bike stops.
- Helicopter's light continues swinging.
- Sauna steam slowly returns after being disturbed.

---

## Law 7 — The Object Notices Before It Is Touched

Every experience should create subtle anticipation.

Before direct interaction, it may:

- lean slightly
- brighten
- breathe differently
- orient toward the cursor
- reveal a small atmospheric response
- delay, hesitate, or become alert

The response must suit the personality.

The user should occasionally wonder:

> Did that just notice me?

---

## Law 8 — Every Personality Has a Physical Vocabulary

Personality must be described with verbs, not only adjectives.

### Campfire

- breathes
- flickers
- leans
- warms
- trails
- lingers
- spits
- settles softly

### Helicopter

- vibrates
- banks
- accelerates
- resists
- pivots
- sweeps
- overshoots
- stabilizes

### Sauna

- drifts
- diffuses
- envelops
- softens
- exhales
- floats
- returns slowly

### Dirt Bike

- snaps
- kicks
- skids
- bursts
- slides
- throws
- rebounds
- stops aggressively

### Wine

- swirls
- sloshes
- rotates
- lags
- pours
- settles
- glides
- reflects

Every implementation should use these verbs to choose motion behavior.

---

## Law 9 — The Environment Reacts

Objects influence the space around them.

Each experience may define:

- influence radius
- force direction
- temperature
- turbulence
- glow contribution
- atmospheric distortion
- particle displacement
- interaction with nearby objects

Examples:

- Campfire lights nearby particles.
- Helicopter pushes steam and dust.
- Sauna adds haze to nearby space.
- Dirt Bike disturbs particles violently.
- Wine contributes reflection and fluid motion rather than wind.

This should remain subtle in production, but the engine must support obvious values during testing.

---

## Law 10 — Extreme Values Must Be Extreme

Trait values use a 0–100 scale.

The scale must have real range.

- 0 = absent
- 25 = barely noticeable
- 50 = normal
- 75 = strong
- 90 = extreme
- 100 = intentionally excessive

At 100:

- Curiosity should feel nearly sentient.
- Energy should feel difficult to contain.
- Gravity should feel dramatically heavy.
- Playfulness should create frequent rewards.
- Chaos should feel unstable but still intentional.
- Warmth should feel overwhelmingly inviting.

Production values will usually remain below 90.

Motion Lab exists to push systems too far so their real boundaries can be understood.

---

# Personality to Physics

Personality traits should not map to one visual property.

Each trait must influence multiple systems.

## Warmth

May affect:

- influence radius
- glow spread
- linger duration
- release softness
- return speed
- memory duration
- particle brightness
- invitation distance

## Curiosity

May affect:

- cursor orientation
- anticipation
- follow strength
- reaction to approach versus retreat
- investigation after hesitation
- memory of repeated visits
- sensitivity to circling motion

## Energy

May affect:

- acceleration
- movement amplitude
- frequency
- particle count
- release velocity
- deformation
- brightness
- recovery time

## Playfulness

May affect:

- interaction rewards
- chain reactions
- response variety
- hidden gestures
- toss reactions
- repeat-interaction escalation
- surprise frequency

## Chaos

May affect:

- turbulence
- timing variance
- path irregularity
- particle spread
- deformation variance
- event unpredictability
- oscillation complexity

Use continuous noise where possible. Avoid uncontrolled frame-by-frame randomness.

## Gravity

May affect:

- mass
- inertia
- drag resistance
- release distance
- overshoot
- damping
- vertical pull
- settling duration

## Attention

May affect:

- detection radius
- response delay
- focus strength
- reaction to pointer velocity
- how long attention persists
- how quickly focus shifts

## Rhythm

May affect:

- breathing cadence
- pulse spacing
- repeated motion timing
- idle sequence
- event clustering
- recovery rhythm

## Mystery

May affect:

- rare events
- delayed rewards
- hidden responses
- non-repeating sequences
- patience-based behavior
- low-probability environmental moments

Mystery is not random decoration. It should create curiosity about cause and meaning.

---

# Required Motion Layers

Each experience should consider these layers independently:

1. **Body motion**  
   Translation, rotation, scale, tilt, deformation, bend, twist.

2. **Material response**  
   Sparks, steam, dust, liquid, light, smoke.

3. **Atmosphere**  
   Glow, blur, haze, heat, wind, shadow, distortion.

4. **Inertia and settling**  
   Release velocity, lag, overshoot, damping, recovery.

5. **Awareness**  
   Proximity, attention, anticipation, memory.

6. **Environment influence**  
   Effects on nearby space or other cards.

Not every experience needs every layer, but no experience should rely only on an animation inside the card.

---

# Experience Physics Profiles

## Campfire

- Soft but alive
- Low body weight
- Medium elasticity
- Long glow memory
- Embers trail opposite acceleration
- Sparks remain in world space after release
- Warmth expands before contact
- Card may gently bend or breathe
- Settle is slow and forgiving

## Helicopter

- Heavy and rigid
- High directional momentum
- Fast acceleration
- Low deformation
- Rotor vibration
- Beam lags and overshoots
- Strong wind influence
- Sharp correction after release

## Sauna

- Light and floaty
- Slow acceleration
- Long damping
- Steam remains behind
- Soft deformation
- Diffuse influence radius
- Minimal sharp rotation
- Slow atmospheric recovery

## Dirt Bike

- Aggressive and agile
- Fast acceleration
- Sharp tilt
- Strong release velocity
- Dust bursts under force
- Short, violent secondary motion
- Skid or slide on release
- Quick but imperfect settling

## Wine

- Smooth and elegant
- Medium body weight
- Low-frequency motion
- Liquid lags behind direction changes
- Long rotational settling
- Soft deformation
- Minimal particles
- Strong internal and external reflection behavior

---

# Success Test

Hide all titles and imagery.

Interact with each object.

A successful system should allow someone to distinguish them through:

- movement
- resistance
- release
- trails
- deformation
- settling
- atmosphere

If the experiences can only be identified by color, icon, video, or particles inside the card, the system is not finished.

---

# Implementation Guidance

The exact library may change, but the architecture should preserve these responsibilities:

- personality traits
- derived physical parameters
- per-material behavior
- pointer awareness
- drag velocity
- momentum and inertia
- deformable card motion
- world-space particles
- atmosphere layers
- interaction memory
- environment influence

Use animation libraries as execution tools, not as the source of personality.

The system should expose debug controls for both:

- personality traits
- derived motion values

Every important behavior should be tunable in Motion Lab.

---

# Final Principle

Do not animate the card.

Animate the relationship between:

- the object
- its material
- the user
- its momentum
- and the surrounding world

That relationship is where personality lives.
