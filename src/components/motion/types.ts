import type { MotionValue } from "framer-motion";

/**
 * How drag settles, as a *kind* of physical thing — not a number, because
 * "heavy" reads completely differently on a rigid machine than on a liquid
 * or something with almost no mass at all. Promoted from Motion Lab's
 * personality engine (`motion-lab/engine/types.ts`), which remains the
 * source of the full trait model this is drawn from; this is only the
 * slice every shared phenomenon needs.
 */
export type PhysicsCharacter = "rigid" | "liquid" | "floaty" | "agile";

/**
 * Every phenomenon accepts the same attention input: 0 (ignored) to 1
 * (hovered/near). What a phenomenon *does* with it is its own decision —
 * fire brightens, embers quicken, snow doesn't have to care — but the
 * input contract itself is shared so composing several phenomena on one
 * card never means wiring hover state through by hand more than once.
 */
export interface PhenomenonAttention {
  attention: MotionValue<number>;
}

/** Whether a phenomenon instance renders clipped to its card ("inside",
 * read as part of the photograph) or escapes into the world around it
 * ("outside" — see `WorldWindow`). Data, not a per-experience special case. */
export type PhenomenonLayer = "inside" | "outside";
