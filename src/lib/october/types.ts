/**
 * What a row in My October points at.
 *
 * Four of these name an Atlas entity. `"Movie"` names an id in Passport's own
 * curated catalogue — **not an Atlas ontology change** (bible §9.2). A film
 * watched in October belongs in the record of that October beside a pumpkin
 * patch, and where movies eventually live as knowledge is still open.
 */
export type OctoberKind =
  "Place" | "Organization" | "Activity" | "Event" | "Movie";
export type OctoberState = "ahead" | "lived";

export interface OctoberThing {
  entityId: string;
  entityKind: OctoberKind;
  name: string;
  startsAt: string | null;
  state: OctoberState;
  wantedAt: string;
  livedAt: string | null;
}

/**
 * The kinds My October can actually store.
 *
 * Deliberately **not** every `ExperienceKind`. Atlas now materialises
 * `Experience` entities, and `passport_october_things.entity_kind` does not
 * accept one — so the honest behaviour is to say a Thing cannot be kept yet,
 * rather than offer a control that fails at the database. Widening this is a
 * schema change, not a type change.
 *
 * Lives here rather than in `octoberThings` because that module is
 * `server-only` and the control that must ask this question is a client
 * component.
 */
export const OCTOBER_KINDS: readonly OctoberKind[] = [
  "Place",
  "Organization",
  "Activity",
  "Event",
];

export const isOctoberKind = (v: unknown): v is OctoberKind =>
  typeof v === "string" && (OCTOBER_KINDS as readonly string[]).includes(v);
