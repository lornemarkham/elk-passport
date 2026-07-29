# 00 — Foundation

This folder is Passport's constitution: the permanent principles every future implementation prompt and every future contributor — human or model — should be aligned to before writing product-facing code. It is not project documentation and not a spec; those live at the repo root (`/01-mission.md` onward, the "Product Brain") and in [`../../docs/`](../../docs/) (engineering syntheses: vision, experience, technical, architecture, build contract).

## Why these documents exist

Implementation work drifts without a stable reference for two different kinds of thing:

- **What Passport is for** — the Product Brain answers this in full, but it's fourteen documents deep and written for product thinking, not for "what should I do while building this button."
- **How that translates into interface and code** — design, UX, motion, visual identity, and engineering conventions are not written down anywhere else as reusable, timeless rules. Without them, every implementation reinvents its own answer, and Passport slowly stops looking and feeling like one product.

These documents exist to close that gap: timeless principles, not implementation details, specific enough to actually guide a decision.

## The documents

| Document                                                   | Responsibility                                                                               |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [`passport-philosophy.md`](./passport-philosophy.md)       | Why Passport exists, what it is/isn't, the decision hierarchy. Read this first, always.      |
| [`design-principles.md`](./design-principles.md)           | Visual/structural design — hierarchy, composition, anti-patterns.                            |
| [`ux-principles.md`](./ux-principles.md)                   | Interaction and flow — what Passport asks of a person, and what it shouldn't.                |
| [`motion-principles.md`](./motion-principles.md)           | Motion as meaning — anticipation, confirmation, pacing.                                      |
| [`visual-language.md`](./visual-language.md)               | Color, typography, imagery as an identity system.                                            |
| [`engineering-principles.md`](./engineering-principles.md) | The one document allowed to talk about actual code — stack, conventions, definition of done. |
| [`prompting-guide.md`](./prompting-guide.md)               | How to write a future implementation prompt that stays aligned to all of the above.          |

Each document owns one responsibility on purpose. If you find yourself wanting to say the same thing in two of them, it belongs in whichever one is more fundamental (usually `passport-philosophy.md`), and the other should link to it instead of repeating it.

## Read before every implementation

At minimum: `passport-philosophy.md`, then whichever of `design-principles.md` / `ux-principles.md` / `motion-principles.md` / `visual-language.md` bears on the surface being built, then `engineering-principles.md` for the actual conventions. See [`prompting-guide.md`](./prompting-guide.md) for the full reading protocol and how to reference this folder from a prompt instead of restating it.

## How future prompts should reference this folder

Point at it, don't paste it:

> "Follow `prompts/00-foundation/` — particularly `motion-principles.md` for this one."

If a principle needs more than a sentence of explanation inside a prompt, it belongs in this folder, not in the prompt.

## How to add a new principle over time

1. Check whether it already belongs under an existing document's responsibility — most new principles are refinements of something already here, not a new category.
2. If it's genuinely new territory, either extend the closest existing document or propose a new one with a single, clearly scoped responsibility (don't let a document's scope quietly sprawl).
3. Prefer timeless framing over implementation specifics. If a rule only makes sense in terms of today's tech stack, it likely belongs in `engineering-principles.md` or `../../docs/technical.md`, not one of the timeless documents.
4. If it resolves a tension the Product Brain or another foundation document already flagged as open (search for `TODO`), update the flagged document to point at the resolution instead of leaving both versions live.
5. Cross-link rather than duplicate — link to the sibling document that owns the related idea instead of re-explaining it here.

## Relationship to the rest of the repo

```
/01-mission.md … /14-science-of-meaningful-experiences.md   ← Product Brain: source of truth for what Passport is
/docs/                                                        ← engineering synthesis of the Product Brain
/prompts/00-foundation/                                       ← this folder: timeless principles for how to build it
```

If this folder ever conflicts with the Product Brain, the Product Brain wins — these documents are a lens on it, not a replacement for it.
