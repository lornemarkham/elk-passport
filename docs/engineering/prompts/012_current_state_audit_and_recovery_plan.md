# Prompt 012 — Current State Audit and Recovery Plan

Save as: `docs/engineering/prompts/012_current_state_audit_and_recovery_plan.md`

## Purpose

We have completed approximately eight rounds of motion work and remain dissatisfied.

Before adding more code, document exactly what exists, what was intended, what succeeded, what failed, and what should be retained or removed.

Do not implement new visual behaviour.

## Required Investigation

Inspect Motion Lab, Discovery Space, the shared motion library, all numbered motion prompts, project-management implementation prompts, tests, decision records, current assets, routes, demos, and superseded implementations where history is available.

Map:

1. Systems that exist
2. Ownership
3. Reusable primitives
4. Duplicate primitives
5. Dead code
6. Experimental code
7. Production-connected code
8. Proven behaviour
9. Visually unacceptable behaviour
10. Discussed but unimplemented behaviour
11. Implemented but undocumented behaviour
12. Documentation that no longer matches code

## Known Decisions to Confirm

- Discovery Space is the product.
- Motion Lab is the R&D sandbox.
- Shared primitives live outside both.
- A card is a window into a living world.
- Appropriate phenomena may escape the card.
- Cards must be evaluated individually, in groups, and in the full field.
- Shared forces and inter-card behaviour are core requirements.
- Motion must be organic, playful, premium, seductive, and restrained.
- No jitter, teleportation, synchronized loops, or silly mechanical behaviour.
- Images and videos remain important content layers.
- Sparks may appear above video and outside the card.
- Layering is a first-class design decision.
- Major prompts begin with inspection and an approved plan.
- No successful primitive is duplicated between systems.

Identify contradictions.

## Recovery Classification

Classify each relevant file or component as:

- Keep
- Keep but refactor
- Sandbox only
- Graduate later
- Replace
- Delete
- Unknown pending visual review

Explain every classification.

Do not preserve code merely because effort was spent. Do not discard sound infrastructure merely because the current visuals disappoint. Separate architectural value from visual quality.

## Required Deliverables

### Current-State Map

Concise relevant tree and ownership.

### Decision Ledger

Everything already agreed upon.

### Gap Analysis

What the current implementation fails to deliver.

### Duplication Analysis

Where systems overlap or conflict.

### Recovery Sequence

The smallest safe steps to regain control.

### Stop-Doing List

Work that should pause.

### Next Three Prompts

Recommend the next three numbered prompts in order.

Do not implement until this audit is approved.

## Completion / Output Requirements

1. Summary of findings
2. Complete list of files inspected
3. Complete list of files created or modified
4. Current-state architecture
5. Decision ledger
6. Keep/refactor/replace/delete classifications
7. Contradictions found
8. Missing documentation
9. Recommended recovery sequence
10. Risks
11. Recommended next three prompts
