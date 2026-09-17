import type { PlaceLocatedHere } from "@/lib/data/types";

/**
 * **What is at this place — Organizations Atlas asserts are located here.**
 *
 * The data is `locatedHere` from Atlas's detail route: the Organizations at
 * the source end of a `located_at` edge whose target is this Place (ADR
 * 067), read from the Place end. This module decides only what the card
 * may say, and says nothing the payload does not carry:
 *
 * - the name, and the Organization's own type when it says more than the
 *   name already does ("Kalavida Surf Shop" is not followed by "surf shop");
 * - the description Atlas holds, excerpted;
 * - the Activities Atlas holds `offers` edges for, by name — "Paddleboard"
 *   is listed because an edge to that Activity exists, never because the
 *   shop is called a surf shop. An Organization with no `offers` edge lists
 *   nothing, and the card does not guess.
 *
 * Not a link: Passport has no traveller-facing Organization page, and a
 * link to a 404 is worse than a name (the rule `PlaceOffers` follows).
 */

export interface AtThisPlaceCard {
  readonly id: string;
  readonly name: string;
  /** The Organization's type, only when it adds to the name. */
  readonly kindLabel?: string;
  readonly description?: string;
  readonly imageUrl?: string;
  /** Names of Activities Atlas holds `offers` edges for. */
  readonly offers: readonly string[];
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function atThisPlace(
  locatedHere: readonly PlaceLocatedHere[] | undefined,
): AtThisPlaceCard[] {
  const seen = new Set<string>();
  const cards: AtThisPlaceCard[] = [];
  for (const org of locatedHere ?? []) {
    if (seen.has(org.id)) continue; // one card per Organization, however many edges
    seen.add(org.id);
    const type = org.organizationType.trim();
    const kindLabel =
      type && type !== "unknown" && !norm(org.name).includes(norm(type))
        ? type
        : undefined;
    const offerNames = [
      ...new Set(
        org.offers
          .filter((o) => o.kind === "Activity")
          .map((o) => o.name.trim())
          .filter((n) => n.length > 0),
      ),
    ];
    cards.push({
      id: org.id,
      name: org.name,
      ...(kindLabel ? { kindLabel } : {}),
      ...(org.description.trim()
        ? { description: org.description.trim() }
        : {}),
      ...(org.imageUrl ? { imageUrl: org.imageUrl } : {}),
      offers: offerNames,
    });
  }
  return cards.sort(
    (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
}
