# Prompt 011 — Motion Playground and Validation Workflow

Save as: `docs/engineering/prompts/011_motion_playground_and_validation.md`

## Purpose

Eight large implementation rounds produced slow feedback and insufficient visual progress.

Create a tuning and validation environment that lets us evaluate one behaviour, relationship, or group rule at a time.

## Required Playground

Support live tuning of:

### Phenomena

Fire shape and continuity, lean and trail, breathing, glow, ember emission and lifetime, smoke, wind response, spring behaviour, settle, and rare-event frequency.

### Card Behaviour

Idle amplitude, buoyancy, rotation, personal space, proximity response, hover response, drag weight, recovery, and personality parameters.

### Group Behaviour

Two-card spacing, attraction/repulsion, shared wind, light spill, attention transfer, support/quieting, group settling, and density response.

### Full Field

Global energy, attention budget, expressive-card limit, ambient event rate, shared events, reduced motion, and realistic performance.

## Playground Requirements

Include:

- Live sliders and toggles
- Reset to approved defaults
- Named presets
- Side-by-side comparison
- Solo mode
- Pair mode
- Small-cluster mode
- Full-field mode
- Pause
- Slow motion
- Debug overlays
- Pointer-force visualization
- Influence-radius visualization
- Particle-path visualization
- FPS and active-simulation count
- Exportable parameter configuration
- A way to copy approved settings into production data

Organize controls according to the Motion Language and Living World System.

## Validation Protocol

Every experiment must ask one question.

Examples:

- Does the flame trail naturally?
- Do released embers remain independent?
- Do two nearby cards maintain pleasant personal space?
- Does a hovered card become the protagonist without neighbours freezing?
- Does the full field remain alive without visual noise?

For each experiment:

1. State the question.
2. State the expected emotional result.
3. Change the smallest parameter set.
4. Watch without interacting.
5. Interact.
6. Test as a pair.
7. Test as a group.
8. Test in the field.
9. Record the result.
10. Save approved parameters.

## Approval Gates

A primitive may graduate only after solo, interaction, pair, small-group, full-field performance, reduced-motion, layering, content-legibility, and emotional-quality review.

## Completion / Output Requirements

1. Summary of what was built
2. Complete list of files created or modified
3. Playground modes and controls
4. Presets created
5. Validation questions supported
6. Tests run and results
7. Performance results
8. Reduced-motion verification
9. Known limitations
10. Graduation path to Discovery Space
11. Recommended next experiment
