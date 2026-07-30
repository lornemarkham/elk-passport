/**
 * Prompt 001 (First Heartbeat) prototype model — deliberately not the real
 * Passport domain model (`@/domain/experience/types.ts`). This lab exists to
 * answer one question about motion and feel, not to model the product's
 * actual data. Keep it isolated so it can be deleted without touching
 * anything real.
 */

/** Normalized 0–1. What the experience is made of, emotionally. */
export interface ExperienceDimensions {
  energy: number;
  wonder: number;
  connection: number;
  comfort: number;
}

export interface Experience {
  id: string;
  title: string;
  futureMemory: string;
  dimensions: ExperienceDimensions;
}
