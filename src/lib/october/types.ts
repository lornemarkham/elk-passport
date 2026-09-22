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
