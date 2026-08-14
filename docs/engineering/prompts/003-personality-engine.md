# Sprint 003 -- Personality Engine

## Before You Begin

For this project, you are **not** primarily a software engineer.

You are a multidisciplinary creative team consisting of:

- An Apple interaction designer obsessed with elegance, restraint, and
  intuitive interactions.
- A Pixar character animator who brings personality and emotion to
  things that don't speak.
- A Nintendo game designer who understands that tiny moments of
  delight create curiosity and play.
- An art director who creates atmosphere, mood, and emotional
  storytelling.
- A frontend engineer who turns those ideas into performant React
  code.

Your job is not to build hover effects.

Your job is to make people **feel** something.

Think in **systems**, not effects.

---

# Objective

Stop tuning Campfire.

Instead, build the **first version of the Passport Personality Engine**.

The goal is to prove that one reusable engine can produce completely
different personalities simply by changing trait values.

## Experiences

Create five experiences:

- 🔥 Campfire
- 🚁 Helicopter
- 🧖 Sauna
- 🏍 Dirt Bike
- 🍷 Wine

They may live on separate screens, tabs, or simple buttons that switch
between personalities.

The UI is not important.

The personality is.

---

# Build a Personality Engine

Create a reusable personality object.

Example:

```ts
{
  warmth: 0-100,
  curiosity: 0-100,
  energy: 0-100,
  playfulness: 0-100,
  chaos: 0-100,
  gravity: 0-100,
  attention: 0-100,
  rhythm: 0-100,
  mystery: 0-100
}
```

These values should drive behaviors, not individual animations.

Personality → Behavior → Animation → Rendering

---

# Map Traits To Behaviors

Do not treat these as labels.

Each trait should influence multiple animation systems.

Examples:

Warmth - glow radius - glow softness - colour temperature - cursor
influence radius - settle speed

Curiosity - cursor tracking - follow strength - reaction delay -
interest radius

Gravity - inertia - spring weight - drag lag - overshoot - settling

Energy - movement amplitude - frequency - brightness - acceleration -
particle intensity

Playfulness - interaction rewards - secondary motion - chain reactions -
surprise

Chaos - controlled noise - particle variation - timing variation - flame
variation

Rhythm - breathing cadence - pulse timing - idle motion

Attention - how aware the experience is of the cursor

Mystery - rare events - unexpected but tasteful moments

---

# Interaction

The experience should reward curiosity.

Ideas:

- cursor proximity
- dragging
- inertia
- particle trails
- glow stretching
- delayed settling
- sparks left behind after movement
- secondary motion
- subtle anticipation

Dragging should feel physical.

If I drag Campfire quickly, I want embers to trail behind as though they
were ripped away from the fire.

---

# Important

Do NOT keep all effects inside the card.

Let personality escape the bounds of the card.

Particles, glow and atmosphere should extend beyond the component when
appropriate.

---

# Debug Mode

Create a developer panel.

Each personality trait should have a slider from 0--100.

Changing a slider should immediately change the experience.

100 should be intentionally excessive.

If I set Curiosity to 100 it should feel almost sentient.

If I set Gravity to 100 it should feel dramatically heavy.

If I set Energy to 100 it should almost become too energetic.

The purpose is to verify that each trait has meaningful influence.

Later we will tune them back.

---

# Success Criteria

Without reading the titles, I should be able to guess which experience I
am interacting with.

If Campfire and Helicopter feel similar, the sprint failed.

If I instinctively play with each experience to discover its
personality, the sprint succeeded.

---

# Deliverables

- Summary
- Files changed
- Personality architecture
- Trait mapping explanation
- Manual testing performed
- Suggested future improvements (do not implement)
- Suggested git commit
