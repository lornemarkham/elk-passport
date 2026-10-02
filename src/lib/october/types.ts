/**
 * What a row in My October points at.
 *
 * Five of these name an Atlas entity. `"Movie"` names an id in Passport's own
 * hand-authored catalogue (`lib/movies/catalogue.ts`) — **not an Atlas
 * ontology change** (bible §9.2). A film watched in October belongs in the
 * record of that October beside a pumpkin patch, and where movies eventually
 * live as knowledge is still open.
 */
export type OctoberKind =
  | "Place"
  | "Organization"
  | "Activity"
  | "Event"
  | "Experience"
  | "Movie"
  /**
   * **Something you mean to do, that nothing in the world owns.**
   *
   * Carving a pumpkin has no venue, no start time and no publisher, so Atlas
   * correctly knows nothing about it — *I am going to carve a pumpkin this
   * weekend* is not a fact about the world. A `Doing` names a row in
   * Passport's own authored catalogue (`lib/making/catalogue.ts`), exactly as
   * `Movie` names a film in that one.
   *
   * Without it the only October a person could record was the part somebody
   * else had scheduled, which is why My October read as a list of bookmarks.
   */
  | "Doing";
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
 * **This list and the column's check constraint say the same thing, and they
 * have to.** A kind named here but refused there is a control that fails at
 * the database; a kind a page *writes* but neither names is worse, because it
 * fails at this guard with a 400 and the page has already said it worked.
 *
 * Both have happened. `Experience` waited for its migration rather than being
 * added to satisfy a page. `Movie` went the other way: Movie Night has called
 * `wantToDo({ entityKind: "Movie" })` since 2026-09-22 and every one of those
 * calls was refused here, while the screen behind the toast read *"It's in
 * your October."* Any change to this array is a change to
 * `passport_october_things`, in both directions.
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
  // Added 2026-09-30 with `202609301000_october_things_movie`. My October is
  // what somebody means to experience this October, and a film on the sofa on
  // the 12th is one of those.
  "Movie",
  "Doing",
];

export const isOctoberKind = (v: unknown): v is OctoberKind =>
  typeof v === "string" && (OCTOBER_KINDS as readonly string[]).includes(v);
