# Sprint 004 — Living Objects

## Before You Begin

For this project, you are **not** primarily a software engineer.

You are expected to think like all of these disciplines simultaneously:

- An Apple interaction designer obsessed with elegance, restraint, and intuitive interactions.
- A Pixar character animator who brings personality and emotion to things that do not speak.
- A Nintendo game designer who understands that tiny moments of delight create curiosity and play.
- An art director who creates atmosphere, mood, and emotional storytelling.
- A frontend engineer who turns those ideas into beautiful, performant React code.

Every solution must satisfy all five perspectives.

A technically correct implementation that lacks personality, emotional impact, physical believability, or play is incomplete.

Your job is not to add effects.

Your job is to make the user believe these are living objects.

Think in systems, not isolated animations.

---

## Read First

Before writing any code, read these documents completely:

1. `/docs/passport/the-physics-of-passport.md`
2. `003-personality-engine.md`

Treat both as required product specifications, not optional creative guidance.

If the implementation conflicts with these documents, follow the documents.

---

## What We Learned

Sprint 003 was a success architecturally.

The Personality Engine is a strong foundation.

However, after interacting with the result, we discovered that most of the personality still lives **inside the cards** instead of in the cards themselves and the world around them.

The current result feels like:

```text
Card
┌──────────────────┐
│ animated content │
└──────────────────┘
```

Passport should feel like:

```text
             atmosphere

      steam              sparks

             glow

         shadow

    ┌──────────────────┐
    │      video       │
    └──────────────────┘

       trails     heat

             momentum
```

The card is only one layer.

The object extends beyond it.

---

# Sprint Objective

Build the next version of the Personality Engine around two major breakthroughs:

1. **Unique physical drag and release behavior for every experience**
2. **World-space effects that escape the card and trail through the surrounding environment**

Do not spend this sprint polishing internal decorative animations.

Do not add more effects simply because they look interesting.

Instead, redesign how each object physically behaves.

We are no longer asking:

> What animation should Campfire have?

We are asking:

> How does Campfire exist in the world?

---

# Primary Personality Test

Dragging is now the primary personality test.

When someone grabs, moves, tosses, and releases an object, its personality should become obvious.

If every card still uses the same drag-and-drop behavior with slightly different visual effects, the sprint failed.

Each experience must define its own:

- grab response
- acceleration
- resistance
- elasticity
- tilt
- rotation
- deformation
- momentum
- release velocity
- trailing material
- overshoot
- settling
- recovery

---

# World-Space Requirement

Do not keep all effects inside the card.

The video will eventually live inside the card.

The personality must therefore be expressed through:

- the way the card moves
- the way the card bends, twists, tilts, or compresses
- what escapes from it
- what trails behind it
- how the surrounding space reacts
- how motion continues after release

Effects such as sparks, steam, dust, glow, light, haze, and trails should exist outside the card whenever appropriate.

They may appear:

- behind the card
- around the card
- above the card
- along its movement path
- left behind in world space after it moves

Do not clip these effects to the card unless there is a deliberate physical reason.

---

# Experience Physics

## Campfire

Campfire should feel warm, alive, elastic, and inviting.

When grabbed and moved:

- the card should tilt toward force
- it may bend or flex subtly
- the glow should lag behind the card
- embers should detach during faster movement
- sparks should trail opposite the direction of acceleration
- sparks should remain in world space after the card moves away
- the card should continue moving after release
- the glow should settle more slowly than the card
- warmth should linger after interaction
- the final recovery should feel soft and forgiving

The most important behavior:

> Pulling or tossing Campfire should feel like pulling a burning log through the air, with embers left behind along the path.

Use significantly more sparks during strong movement than in the previous sprint.

The sparks should not merely appear inside the card.

They should be visibly pulled out of it.

---

## Helicopter

Helicopter should feel rigid, mechanical, directional, heavy, and alert.

When grabbed and moved:

- the body should bank into direction changes
- acceleration should feel strong and deliberate
- resistance should communicate weight
- the spotlight should lag and overshoot
- rotor vibration should continue briefly after release
- the surrounding atmosphere should be pushed by subtle rotor wash
- released momentum should feel different from Campfire
- correction and stabilization should feel sharper

Helicopter should not feel soft, floaty, or elastic.

---

## Sauna

Sauna should feel light, enveloping, slow, and atmospheric.

When grabbed and moved:

- the card should feel almost buoyant
- acceleration should be gentle
- steam should stretch behind it
- steam should remain suspended after the card passes
- the surrounding haze should recover slowly
- deformation should be soft
- rotation should be minimal and calm
- damping should be long and smooth
- release should feel like drifting rather than throwing

Sauna should feel as though it is moving through warm, humid air.

---

## Dirt Bike

Dirt Bike should feel fast, rebellious, agile, and aggressive.

When grabbed and moved:

- response should be immediate
- acceleration should be sharp
- the card should tilt strongly under force
- motion should feel eager and difficult to contain
- release velocity should be high
- the card may skid or slide after release
- dust or sparks should burst outside the card
- the trail should remain briefly in the environment
- settling should be quick but imperfect
- sharp direction changes should trigger stronger secondary motion

The faster the user grabs and pulls it, the more alive it should become.

---

## Wine

Wine should feel smooth, elegant, weighted, and fluid.

When grabbed and moved:

- the glass/card body should respond immediately
- the liquid response should lag
- direction changes should create slosh
- rotation should continue after release
- settling should be long and graceful
- reflections should lag and recover slowly
- movement should overshoot elegantly
- particles should be minimal
- viscosity and damping should carry most of the personality

Wine should never feel dusty, explosive, mechanical, or jittery.

---

# The Card Itself Must Have Personality

The previous sprint gave the contents personality.

This sprint must give the **card body** personality.

Explore restrained versions of:

- tilt
- bend
- twist
- torsion
- squash and stretch
- perspective distortion
- edge compression
- directional warping
- shadow stretch
- elastic response

These effects should be driven by velocity, acceleration, force, and personality.

Do not make every card use the same deformation formula.

Campfire may flex.

Helicopter should remain mostly rigid.

Sauna may softly distort.

Dirt Bike may snap and pitch.

Wine may glide and rotate with minimal bending.

---

# Momentum and Toss

Objects should continue moving after the user releases them.

Capture pointer velocity and translate it into personality-specific momentum.

Each experience should have distinct values for:

- mass
- friction
- inertia
- release multiplier
- rotational momentum
- damping
- overshoot
- boundary response
- recovery

A gentle release and a hard throw should not produce the same result.

The result should remain controlled and usable, but Motion Lab should support exaggerated values for testing.

---

# Secondary Motion

Nothing should move alone.

Every primary movement should produce secondary motion.

Examples:

## Campfire

```text
Card motion
    ↓
Card flex
    ↓
Glow lag
    ↓
Embers detach
    ↓
Heat and shadow settle
```

## Helicopter

```text
Card motion
    ↓
Banking
    ↓
Rotor vibration
    ↓
Spotlight lag
    ↓
Wind disturbance
    ↓
Stabilization
```

## Sauna

```text
Card motion
    ↓
Soft deformation
    ↓
Steam trails
    ↓
Haze remains
    ↓
Atmosphere slowly reforms
```

## Dirt Bike

```text
Card motion
    ↓
Sharp tilt
    ↓
Dust or sparks burst
    ↓
Trail remains
    ↓
Skid and rebound
```

## Wine

```text
Card motion
    ↓
Container movement
    ↓
Liquid lag
    ↓
Slosh and rotation
    ↓
Long graceful settling
```

Secondary motion must continue briefly after the main object slows or stops.

---

# Interaction Before Grab

Each object should subtly notice the pointer before direct interaction.

This should be restrained but meaningful.

Examples:

- slight orientation toward the pointer
- a change in breathing
- a small anticipation tilt
- atmosphere moving toward or away from the cursor
- a brief pause or alert response
- a soft increase in influence radius

The reaction must suit the personality.

The user should occasionally wonder:

> Did that just notice me?

Do not use the same proximity response for every card.

---

# Debug Mode

Keep the existing personality sliders.

Add developer controls for the new physical systems where useful:

- mass
- inertia
- drag resistance
- elasticity
- release multiplier
- rotational momentum
- damping
- deformation strength
- trail length
- particle lifetime
- particle detachment threshold
- influence radius
- world-space spread

The debug panel should expose both:

1. personality traits
2. derived motion values

At 100, values should remain intentionally excessive.

Motion Lab exists to push systems too far before tuning them back.

---

# Architectural Guidance

Preserve the reusable Personality Engine.

Do not build five unrelated custom components.

However, do not force physically different materials into one generic behavior when doing so destroys personality.

The system should support:

- shared motion infrastructure
- personality-derived parameters
- per-experience physics profiles
- per-material behaviors
- pointer velocity and acceleration
- toss momentum
- card deformation
- world-space particle layers
- independent settling
- atmosphere that persists after movement

Use an animation library as an execution tool, not as the source of personality.

Choose or extend libraries only where they improve:

- spring physics
- inertial drag
- timeline coordination
- world-space particle performance
- deformation
- velocity tracking

Explain any library decision in the final report.

---

# Scope Control

Focus this sprint on these two breakthroughs:

## 1. Unique Physical Drag and Release

Every experience must feel clearly different when grabbed, moved, tossed, and released.

## 2. World-Space Trails and Atmosphere

Sparks, steam, dust, light, and related effects must escape the card and remain in the surrounding environment where physically appropriate.

Do not attempt to fully build:

- inter-card communication
- complex collision physics
- long-term relationship memory
- final video integration
- production-level balancing

Those may come later.

Build the strongest possible foundation for them now.

---

# Success Criteria

Hide:

- titles
- icons
- colors
- videos
- internal decorative animations

Then interact with each object.

The sprint succeeds only if the experiences can still be distinguished through:

- grab response
- movement
- resistance
- deformation
- momentum
- release
- trails
- overshoot
- settling
- atmospheric response

Specifically verify:

- Campfire leaves embers behind when pulled or tossed.
- Helicopter banks and stabilizes rather than flexing.
- Sauna drifts and leaves steam behind.
- Dirt Bike accelerates, skids, and throws material aggressively.
- Wine sloshes and settles with fluid lag.
- Effects visibly exist outside the card.
- Different release velocities create different outcomes.
- None of the five experiences feel like the same drag preset with different particles.

If personality is only recognizable through what appears inside the card, the sprint failed.

---

# Manual Review Requirement

Do not declare this complete based only on:

- screenshots
- DOM inspection
- successful compilation
- static visual differences

This sprint is about **felt interaction**.

Manually test:

- slow dragging
- fast dragging
- sharp direction changes
- circling
- gentle release
- hard toss
- repeated grabs
- waiting for effects to settle

If your environment prevents reliable manual gesture testing, state that clearly and do not claim the interaction has been verified.

---

# Deliverables

When complete, provide:

## Summary

What changed and whether the two primary breakthroughs were achieved.

## Files Changed

Every file created, modified, or removed.

## Physics Architecture

Explain:

- how velocity is captured
- how toss momentum works
- how physical profiles differ
- how card deformation is derived
- how world-space effects are rendered
- how secondary motion persists after release

## Experience Breakdown

For each of the five experiences, explain:

- grab personality
- motion personality
- release personality
- secondary motion
- world-space behavior
- settling behavior

## Debug Controls

List all new controls and the physical parameters they affect.

## Verification

- [ ] Build passes
- [ ] Lint passes
- [ ] TypeScript passes
- [ ] No console errors
- [ ] Slow drag tested
- [ ] Fast drag tested
- [ ] Toss tested
- [ ] Distinct physics verified across all five
- [ ] World-space effects verified outside card bounds
- [ ] No obvious cleanup, timer, animation-frame, or particle leaks

## Honest Limitations

State anything that could not be fully verified.

## Future Improvements

Suggest improvements only.

Do not implement them.

## Git Commit

Provide a suggested commit message.

---

# Final Principle

Do not ask:

> What animation should I add?

Ask:

> If this object existed in the real world, what physical laws would make it instantly recognizable?

Then implement those laws.

Do not animate the card.

Animate the relationship between:

- the object
- its material
- the user
- its momentum
- and the surrounding world

That relationship is where personality lives.
