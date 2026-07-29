# Visual Language

Scope: color, typography, spacing rhythm, and imagery as an _identity system_ — the recognizable feel that should be consistent across every screen. Not layout/hierarchy rules (see [`design-principles.md`](./design-principles.md)), and deliberately not a locked palette or type scale — those are implementation detail that belongs in `src/app/globals.css` and should evolve there, not be pinned in prose here.

## Core rule

Passport should never be mistaken for a generic SaaS product or a generic travel site. If a screenshot could be re-skinned into a project-management tool by swapping the logo, the visual language has failed regardless of how clean it looks.

## Personality to design from

Bright, bold, energetic, playful, slightly rebellious, encouraging, informative, occasionally funny, unafraid to be memorable. Confident type, strong imagery, and layered reveals over flat, safe minimalism. See [`/12-mvp-experience-visual-contract.md`](../../12-mvp-experience-visual-contract.md).

This personality should express itself through:

- **Typography with character**, not a default system font doing the emotional work by omission.
- **Color used with intent** — a mood per moment (the calm of a plan, the excitement of a reveal) rather than one flat palette applied uniformly regardless of context.
- **Real imagery and texture over icon-and-card grids.** The subject is the place and the moment, not the UI.
- **Spacing rhythm that feels considered**, not defaulted — generous where a moment should breathe (Reveal), tighter where speed matters (Adventure Mode).

## Principles

1. **Color and type should shift with emotional register, within one coherent system.** A calm planning surface and a triumphant reveal don't have to look identical — they have to look like they belong to the same product. Shared tokens, varied application.
2. **Never let visual identity become invisible.** Beige minimalism and purple-gradient "AI app" styling are both explicitly rejected — not because they're poorly executed, but because they're the visual language of a hundred other products. Passport needs its own.
3. **Imagery is content, not decoration.** Photography and place should be given room to be the hero; UI chrome should recede around it, not compete with it.
4. **Consistency lives in the system, not in memory.** Anyone building a new screen should be able to reach for existing type scale, spacing, and color tokens rather than re-deriving them by eye. See [`engineering-principles.md`](./engineering-principles.md) for where those tokens live in code.

## Open tension — flagged, not resolved

The documented personality above (bright, bold, early-2000s energy) and the palette currently defined in `src/app/globals.css` (a calm, warm "paper, moss, cedar" theme — soft, weathered, artisanal) read as two different visual directions. Both are legitimate directions for an adventure brand; they are not obviously the same one.

> **TODO (founder decision):** reconcile the documented personality in [`/12-mvp-experience-visual-contract.md`](../../12-mvp-experience-visual-contract.md) with the shipped palette in `src/app/globals.css`, the same way other open tensions in the Product Brain are flagged rather than silently picked one way. Do not treat either as more authoritative than the other until this is decided — building new screens should match whichever is confirmed current, and raise this doc if the mismatch causes a real decision to stall.

## Explicit anti-patterns

- A palette or type choice that would feel at home in a corporate productivity tool.
- Stock-photo-style imagery that feels generic rather than specific to a real place or moment.
- Visual identity that only lives in one hero screen and disappears everywhere else in the product.
