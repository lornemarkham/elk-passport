/**
 * The Passport Personality Engine — Sprint 003.
 *
 * The premise: one system of behaviors, driven entirely by nine trait
 * values, should be able to produce experiences that feel nothing alike.
 * Campfire and Helicopter run through the exact same hook, the exact same
 * particle field, the exact same drag physics — only the numbers differ.
 *
 * Personality → Behavior → Animation → Rendering. This file is the
 * "Personality" layer: pure data, no rendering, no React.
 */

/** Every value is 0–100. 100 is deliberately excessive for this sprint — the
 * point is to see what each trait actually controls, not to ship a tuned
 * final feel. */
export interface Personality {
  /** Glow presence: radius, softness, brightness ceiling, how gently it settles. */
  warmth: number;
  /** How much it turns to track the cursor, not just glow at it. At 100, it follows. */
  curiosity: number;
  /** Movement amplitude, brightness range, particle intensity, acceleration. */
  energy: number;
  /** Chance and size of a bonus flourish on interaction — reward for playing with it. */
  playfulness: number;
  /** Randomness injected into timing, position, and variation — 0 is metronomic, 100 is unruly. */
  chaos: number;
  /** Mass and settle behavior under drag — how heavy it feels to move and release. */
  gravity: number;
  /** How far away it senses the cursor, and how quickly it reacts once it does. */
  attention: number;
  /** The cadence of its idle life — how fast it breathes. */
  rhythm: number;
  /** How often something happens that nobody asked for. */
  mystery: number;
}

export const TRAIT_KEYS: (keyof Personality)[] = [
  "warmth",
  "curiosity",
  "energy",
  "playfulness",
  "chaos",
  "gravity",
  "attention",
  "rhythm",
  "mystery",
];

/**
 * How drag settles, as a *kind* of physical thing — not a number, because
 * "heavy" reads completely differently on a rigid machine (one decisive
 * overshoot, then stop) than on a liquid (several diminishing sloshes) or
 * something with almost no mass at all (drifts back, barely resists).
 * Gravity sets the magnitude; this sets the character.
 */
export type PhysicsCharacter = "rigid" | "liquid" | "floaty" | "agile";

/** What kind of particle this experience sheds, and which way it moves. */
export interface ParticleMaterial {
  color: string;
  colorSoft: string;
  /** rise = embers/steam; fall = kicked-up dirt; outward = blown by wind; static = glints that flash in place. */
  direction: "rise" | "fall" | "outward" | "static";
  /** How wide particles diffuse as they travel — steam spreads, embers stay tight. */
  spread: number;
}

/** The part of an experience that ISN'T personality — what it's called, what it looks like, what it's made of. */
export interface ExperienceIdentity {
  id: string;
  emoji: string;
  title: string;
  futureMemory: string;
  /** Base hue the glow is built from — personality (warmth, energy) modulates intensity, not this. */
  hue: { glow: string; glowSoft: string; accent: string };
  material: ParticleMaterial;
  physics: PhysicsCharacter;
  /** One of "campfire" | "helicopter" | "sauna" | "dirtbike" | "wine" | undefined — selects a bespoke signature layer beyond the generic engine, for the handful of things that need one true visual to read correctly. */
  signature?: "helicopter-beacon" | "sauna-haze" | "wine-swirl";
}

export interface ExperienceDefinition {
  identity: ExperienceIdentity;
  personality: Personality;
}
