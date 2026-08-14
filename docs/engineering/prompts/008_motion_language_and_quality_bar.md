# Prompt 008 — Motion Language and Quality Bar

Save as: `docs/engineering/prompts/008_motion_language_and_quality_bar.md`

## Purpose

This is a documentation and alignment task, not an implementation task.

Review the current Motion Lab and Discovery Space implementations, then create a permanent motion-language document that future product, design, and engineering work must follow.

Do not write code.

## Product Intent

We are not building animated cards.

We are building a premium, playful, living environment that quietly seduces the user into exploring.

The experience should remain interesting even if the user never moves the mouse.

Motion should whisper rather than shout.

A user watching the field for 5, 15, 30, and 60 seconds should continue discovering subtle behaviour.

The emotional standard is more important than technical cleverness.

A technically impressive simulation that does not feel warm, playful, organic, or inviting has failed.

## Core Motion Qualities

Every movement should feel:

- Organic
- Continuous
- Intentional
- Playful
- Premium
- Warm
- Curious
- Physically believable
- Emotionally expressive
- Slightly whimsical without becoming silly

Every moving object should exhibit some appropriate combination of:

- Weight
- Inertia
- Anticipation
- Follow-through
- Drag
- Overshoot
- Settle
- Variation
- Memory of its previous state

Nothing should:

- Jitter
- Teleport
- Snap between unrelated poses
- Randomly vibrate
- Repeat on an obvious loop
- Move only because animation is available
- Compete aggressively for attention
- Resemble a generic UI animation demo
- Look like disconnected CSS keyframes
- Become cartoonishly stupid

## Continuous Motion Rule

Frame B must feel born from Frame A.

Prefer springs, damped motion, continuous noise, flow fields, procedural deformation, smooth force accumulation, layered signals, and state-based animation.

Avoid frame-to-frame randomness and visibly authored pose sequences for natural phenomena.

Randomness alone is not organic. Perfect repetition is not organic. The target is structured variation.

## Idle Behaviour

Every meaningful card should possess life when ignored.

Idle life may include breathing, subtle buoyancy, soft settling, environmental sway, glow variation, reflections, tiny material reactions, rare environmental events, posture adjustments, and slight spacing negotiations.

Rare events must include genuine silence. The user should occasionally wonder whether they truly saw something.

## Interaction Behaviour

Interaction should amplify an existing personality rather than turn on an unrelated effect.

Pointer proximity may influence attention, brightness, energy, orientation, particle activity, curiosity, and personal space.

Drag interaction should communicate weight and inertia.

Example: if a flame is pulled left, its upper body should trail right because its base moved first and the flame follows with delay.

The response should trail, overshoot slightly where appropriate, return gradually, and settle naturally.

## Phenomenon Personalities

Document personality and behaviour for:

- Fire: warm, energetic, social, upward-seeking, wind-sensitive.
- Embers: rare, light, independent once released.
- Smoke: lazy, buoyant, layered, wind-sensitive.
- Steam: soft, intimate, temporary.
- Water: patient, hypnotic, reflective.
- Ripples: consequences spreading outward and weakening with distance.
- Leaves: playful, light, social, responsive to wind.
- Mist: slow, quiet, atmospheric.
- Dust and pollen: evidence the world continues without user input.
- Light: relational; able to warm, reflect, reveal, and connect.
- Insects and birds: extremely rare visitors, never decorative spam.
- Mechanical experiences: grounded and purposeful, never toy-like or randomly floating.

## Evaluation Standard

Every review must answer:

1. Does it feel alive when untouched?
2. Does it feel continuous rather than pose-based?
3. Does it have weight and memory?
4. Does it create curiosity?
5. Is it playful without being silly?
6. Does it support the card's personality?
7. Does it belong to the same world as neighbouring cards?
8. Does it remain interesting after 30 seconds?
9. Would a non-engineer describe it emotionally rather than technically?
10. Does it make the user want to move the mouse toward it?

## Deliverable

Create or update a permanent project document containing the motion philosophy, vocabulary, phenomenon personalities, idle and interaction principles, quality bar, anti-patterns, review checklist, examples mapped to existing experiences, and contradictions in the current implementation.

Wait for approval after presenting the proposed permanent document structure.

## Completion / Output Requirements

1. Summary of what was documented
2. Complete list of files created or modified
3. Important decisions captured
4. Contradictions or gaps found
5. Questions requiring product approval
6. Recommended next prompt
