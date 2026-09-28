/**
 * What a row in My October points at.
 *
 * Five of these name an Atlas entity. `"Movie"` names an id in Passport's own
 * curated catalogue — **not an Atlas ontology change** (bible §9.2). A film
 * watched in October belongs in the record of that October beside a pumpkin
 * patch, and where movies eventually live as knowledge is still open.
 */
export type OctoberKind =
  "Place" | "Organization" | "Activity" | "Event" | "Experience" | "Movie";
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
 * This list and the column's check constraint say the same thing, and they
 * have to: a kind named here but refused there is a control that fails at the
 * database, which is why `Experience` waited for the migration
 * (`202609281400`) rather than being added to satisfy a page.
 *
 * `Movie` is in the union above and deliberately **not** here. Passport means
 * to keep a film in October's record one day, but nothing writes one through
 * this path today and the column does not accept it. Widening this is a schema
 * change, not a type change.
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
  // Added 2026-09-28 with the migration that widened the column's check.
  // October's two flagship haunts are Experiences, so without this the
  // reference page was the one page that could not offer to keep itself.
  "Experience",
];

export const isOctoberKind = (v: unknown): v is OctoberKind =>
  typeof v === "string" && (OCTOBER_KINDS as readonly string[]).includes(v);
