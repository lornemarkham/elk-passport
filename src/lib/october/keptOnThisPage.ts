import "server-only";
import { currentUser } from "@/lib/auth/currentUser";
import { octoberThingsFor } from "@/lib/october/octoberThings";
import { isOctoberKind, type OctoberKind } from "@/lib/october/types";

/**
 * **What this person has already kept, read once for a whole page.**
 *
 * Every card on an October surface needs the same answer — *is this one of
 * mine?* — and the obvious way to give it to them is the wrong one: a client
 * component per card, each asking `/api/october/things` on mount. Thirty-nine
 * cards on Discover is thirty-nine requests for one list, all of them
 * identical, all of them after first paint, and a row of controls that flicker
 * from "not kept" to "kept" a second after the page arrives.
 *
 * So the page asks once, on the server, before it renders anything, and hands
 * each card a boolean it already knows. The control's first painted frame is
 * correct, which is also why a refresh shows what a refresh should show.
 *
 * ## A visitor is not an error
 *
 * Signed out, this is an empty set and `signedIn: false`, and the cards render
 * the way the detail page does for a visitor: a control that invites a sign-in
 * rather than one that pretends to work or one that is missing.
 */
export interface KeptOnThisPage {
  readonly signedIn: boolean;
  /** Entity ids already in this person's October, in any state. */
  readonly kept: ReadonlySet<string>;
}

export async function keptOnThisPage(): Promise<KeptOnThisPage> {
  const user = await currentUser().catch(() => null);
  if (!user) return { signedIn: false, kept: new Set() };
  const things = await octoberThingsFor(user).catch(() => []);
  return { signedIn: true, kept: new Set(things.map((t) => t.entityId)) };
}

/**
 * **Whether this subject is one October can hold at all.**
 *
 * `passport_october_things.entity_kind` accepts six kinds and refuses the
 * rest, and `OCTOBER_KINDS` is the same list said in TypeScript. A card for
 * anything else gets no control rather than one that fails at the database —
 * the rule the Movie repair was written to enforce, applied before the
 * control is drawn instead of after it is pressed.
 *
 * This slice does not widen the ontology. It only asks the existing contract.
 */
export const keepableKind = (kind: string): OctoberKind | undefined =>
  isOctoberKind(kind) ? kind : undefined;
