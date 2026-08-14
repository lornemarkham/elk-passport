# Prompt 009 — Living Motion Direction (Execution Plan Required)

Save as: `docs/engineering/prompts/009_living_motion_direction.md`

## Your Role

You are simultaneously acting as:

- Pixar Animation Director
- Senior Motion Designer (Apple / Stripe / Linear quality)
- Senior Frontend Animation Engineer
- Physics & Interaction Designer
- UX Microinteraction Specialist

Your goal is **not** to add animation.

Your goal is to make every card feel like a tiny living world that quietly invites interaction.

---

# FIRST — DO NOT IMPLEMENT

Before writing any code, provide an Execution Plan.

Describe exactly:

- motion philosophy
- rendering layers
- fire physics
- idle behaviours
- hover behaviours
- rendering order
- z-index strategy
- inside vs outside card effects
- performance considerations
- files to modify

Wait for approval.

Do not implement until approved.

---

# Core Philosophy

Current versions fail because they animate objects instead of creating life.

Every card should feel alive even when ignored.

If the mouse never moves, the page should still feel magical.

Motion should whisper.

Never shout.

---

# Fire

The current flame is incorrect.

Problems:

- pixel jitter
- shape teleportation
- robotic left/right movement
- disconnected frames

A real flame:

- has inertia
- stretches
- curls
- trails
- flows continuously
- never teleports

Research and use established organic techniques where appropriate (Perlin/Simplex noise, flow fields, spring dynamics, procedural deformation, easing) rather than frame-to-frame random motion.

Idle:

- gentle breathing
- subtle flicker
- occasional larger lick
- glow pulses
- embers every few seconds

Interaction:

Mouse left

- flame trails right
- delayed response
- slight overshoot
- settles naturally

Mouse right

- opposite

Mouse near

- brighter
- slightly larger
- more active embers

The movement should feel playful and handcrafted, never synthetic.

---

# Cards Are Living Worlds

Every card has an idle personality.

Examples:

Campfire

- flame lives
- sparks escape
- glow breathes

Forest

- leaves sway
- dust catches light

Lake

- ripples
- reflections shimmer

No card should ever feel frozen.

---

# Outside The Card

This is critical.

The image/video inside the card is content.

Life escapes the frame.

Examples:

Campfire

- sparks outside card
- glow outside card

Forest

- drifting leaves outside card

Mist

- soft overflow

Effects escaping the card make it feel like a window instead of a video.

Design an explicit layered rendering strategy for this.

---

# Motion Rules

Everything has:

- weight
- inertia
- anticipation
- follow-through
- settle

Nothing:

- jitters
- teleports
- vibrates randomly

Small, premium motion.

Never gimmicky.

---

# Performance

Prefer CSS transforms, GPU acceleration, requestAnimationFrame where needed, and reusable motion primitives.

Create a reusable motion library so future cards share the same design language while expressing different personalities.

---

# Deliverables

1. Execution Plan (await approval)
2. Implementation
3. Summary of what was built
4. Complete list of files created or modified
5. Architectural decisions
6. Follow-up recommendations
