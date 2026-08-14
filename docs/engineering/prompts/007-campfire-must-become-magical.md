# 007 – Campfire Must Become Magical

## Objective

Forget the engine.

Forget scalability.

Forget the other four experiences.

For this sprint there is only one goal:

> **Make Campfire the first Passport experience that someone instinctively wants to interact with again immediately after letting go.**

If that doesn't happen, the sprint has failed regardless of how elegant the implementation is.

---

# Stop Thinking Like an Engineer

Do **not** optimize architecture.

Do **not** optimize abstractions.

Do **not** optimize for future reuse.

For this sprint you are an animation director.

Your only job is to create an interaction that makes someone smile.

Nothing else matters.

---

# The Problem

The current implementation is technically impressive but emotionally flat.

It still feels like:

- A glowing card.
- With particles.
- That tilts while being dragged.

It does **not** feel like I am interacting with fire.

The atmosphere is trapped around the rectangle.

The rectangle is still the star.

It shouldn't be.

---

# Change Your Mental Model

Do NOT think:

> I am dragging a card.

Think:

> I am dragging a campfire through the air.

The card is only an anchor.

The fire is the object.

The fire should visually exist well beyond the rectangle.

The rectangle should almost disappear beneath the atmosphere.

---

# What Must Be Visible

## Idle

Before I touch anything...

The fire is already alive.

Requirements:

- No obvious looping.
- No rhythmic animation.
- Long periods of subtle calm.
- Occasionally:
  - one ember escapes
  - tiny flicker
  - subtle breathing
  - slight variation in flame height

If I watch for twenty seconds I should believe the fire exists without me.

---

## Hover

Hover should NOT start the fire.

The fire was already alive.

Hover simply makes it aware that I exist.

It should feel curious.

Not excited.

---

## Slow Drag

This is the most important interaction.

Dragging should NOT feel like moving a UI component.

It should feel like physically pulling fire.

Visible requirements:

- Flames resist.
- Brightest portion lags.
- Ember trail stretches behind.
- Atmosphere follows with delay.
- Motion extends outside the card.

The rectangle should feel secondary.

---

## Fast Drag

Fast motion should create a completely different emotional response.

Not simply "more particles."

It should make me immediately think:

> "I want to do that again."

Possible techniques include:

- longer ember ribbons
- richer flame distortion
- dramatic atmospheric stretching
- brief separation of flame from the card

Use your judgment.

The requirement is emotional, not literal.

---

## Release

When I release the mouse...

The interaction should continue.

The fire does NOT stop.

Instead:

- embers continue upward
- heat slowly settles
- atmosphere reconnects
- flame naturally returns

The interaction ends naturally.

Not because input ended.

---

## Toss

This is the hero interaction.

A hard toss must create something impossible during a slow drag.

Not simply additional particles.

A unique visual reward.

After seeing it once I should immediately throw it again.

---

# Remove

Reduce or eliminate:

- generic skew
- generic squash
- decorative particles
- effects glued to the card
- motion that reminds me I am manipulating a UI component

Every visible movement should reinforce:

> This is fire.

Not:

> This is a React component.

---

# Important

Do NOT tell me the architecture is complete.

Do NOT tell me the implementation is scalable.

Do NOT tell me which systems were added.

I will judge only what I can see.

---

# Before Declaring Success

Watch your own recording.

Ask yourself:

1. Does this look like fire?
2. Does it still look like a glowing card?
3. Would I instinctively drag it again?

If the answer to question 3 is anything except an immediate "yes", continue iterating.

---

# Deliverables

Provide only:

1. A concise summary of visual changes.
2. A screen recording.
3. A short explanation answering:

> Why will someone immediately perform this interaction a second time?

If you cannot answer that confidently, the sprint is not complete.
