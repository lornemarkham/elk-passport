import { z } from "zod";

// Today's Intent — examples only, not a finalized taxonomy.
// See /09-curation-framework.md.
export const TODAYS_INTENTS = [
  "Adventure",
  "Active",
  "Family",
  "Food",
  "Water",
  "Learning",
  "Date",
  "Road Trip",
  "Escape",
  "Relax",
] as const;

export const todaysIntentSchema = z.enum(TODAYS_INTENTS);
export type TodaysIntent = z.infer<typeof todaysIntentSchema>;

// Adventure DNA traits — examples only, not a finalized model.
// See /09-curation-framework.md and /11-capabilities.md.
export const ADVENTURE_DNA_TRAITS = [
  "Loves water",
  "Prefers dry land",
  "Fear of heights",
  "History enthusiast",
  "Foodie",
  "Dog owner",
  "Vegetarian",
  "Budget conscious",
  "Loves splurging",
  "Loves hidden gems",
  "Homebody at heart",
  "Always up for a challenge",
] as const;

export const adventureDnaSchema = z.object({
  traits: z.array(z.string()).default([]),
  notes: z.string().max(280).optional(),
});
export type AdventureDna = z.infer<typeof adventureDnaSchema>;

export const constraintsSchema = z.object({
  timeAvailable: z.enum(["A few hours", "Half a day", "All day"]),
  budget: z.enum(["Keep it free/cheap", "Some spending money", "Treat me"]),
  location: z.string().min(1).max(120),
  maxDistanceKm: z.number().int().min(1).max(500).optional(),
});
export type Constraints = z.infer<typeof constraintsSchema>;

export const planInputSchema = z.object({
  intent: todaysIntentSchema,
  constraints: constraintsSchema,
  dna: adventureDnaSchema,
});
export type PlanInput = z.infer<typeof planInputSchema>;

export const adventureBlockSchema = z.object({
  time: z.string().min(1).max(40),
  title: z.string().min(1).max(80),
  description: z.string().min(1).max(280),
});
export type AdventureBlock = z.infer<typeof adventureBlockSchema>;

export const recommendationSchema = z.object({
  title: z.string().min(1).max(80),
  tagline: z.string().min(1).max(140),
  blocks: z.array(adventureBlockSchema).min(2).max(6),
});
export type Recommendation = z.infer<typeof recommendationSchema>;

export const momentSchema = z.object({
  id: z.string(),
  adventureId: z.string(),
  note: z.string().max(280).optional(),
  photoDataUrl: z.string().optional(),
  createdAt: z.string(),
});
export type Moment = z.infer<typeof momentSchema>;

export const adventureStatusSchema = z.enum(["planned", "active", "completed"]);

export const adventureSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  intent: todaysIntentSchema,
  constraints: constraintsSchema,
  recommendation: recommendationSchema,
  status: adventureStatusSchema,
  currentBlockIndex: z.number().int().min(0).default(0),
  moments: z.array(momentSchema).default([]),
});
export type Adventure = z.infer<typeof adventureSchema>;
