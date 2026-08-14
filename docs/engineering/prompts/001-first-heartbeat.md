# Prompt 001 -- First Heartbeat

## Objective

Build the very first interactive prototype for Passport.

This is **not** Discovery. This is **not** production code.

This is a Motion Lab whose only purpose is to answer one question:

> Can a single Passport experience feel alive?

If the answer is yes, stop.

---

# Context

Passport is building a new way to discover experiences.

Experiences are **not cards**. They are living entities with identity,
personality, and purpose.

The interface should feel calm, premium, cinematic, and emotionally
intelligent.

Nothing should resemble a traditional website hover animation.

Users should feel like the experience quietly notices them.

Think Apple. Think Pixar. Think Calm.

---

# Build

Create a page:

`/motion-lab`

This page should contain exactly one experience: **Campfire**.

No navigation. No sidebar. No search. No Discovery UI.

Just one experience centered beautifully on the screen.

---

# Experience Model

```ts
interface Experience {
  id: string;
  title: string;
  futureMemory: string;
  dimensions: {
    energy: number;
    wonder: number;
    connection: number;
    comfort: number;
  };
}
```

Campfire future memory:

> "The night nobody wanted to leave."

---

# Motion

## Heartbeat

- 6 second breathing cycle
- Tiny scale changes
- Almost imperceptible

## Awareness

Before hover, as the cursor approaches:

- Warmer glow
- Softer shadow
- Slight breathing change
- Gentle acknowledgement

## Focus

On hover:

- Future memory brightens
- Slight lift
- Increased depth
- Richer glow

Avoid standard website hover animations.

## Linger

When the cursor leaves:

Linger → Soft exhale → Return to heartbeat.

---

# Technical Requirements

Use React + TypeScript.

Keep state local.

Do not over-engineer.

---

# Deliverables

- MotionLab.tsx
- LivingExperience.tsx
- LivingExperience.css (or module)
- experience.ts
- campfire.ts
- Route for `/motion-lab`

---

# Success Criteria

When I run the app:

- One beautiful experience is centered.
- It feels alive before interaction.
- It notices the cursor before hover.
- Hover feels emotional, not mechanical.
- Leaving the card lingers naturally.

If the prototype succeeds, stop coding.
